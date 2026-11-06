"""Rule-based SLC -> Logix translator and target-text renderer. Owner: Tami.
Contract: CONTRACT.md section 3 (convert, renderer) and section 6 (tag map).

convert(program) -> (target_ir, tag_map, rule_ids, unresolved)

All-or-nothing: if anything cannot be converted by a rule, convert() returns
an empty Program, no tag map, no rule ids, and the full unresolved list.
Nothing is guessed and no rung is silently dropped.

Rules (deterministic and one-to-one; numbers have no leading zeros):
    I:<slot>/<bit>   ->  I_<slot>_<bit>      input       INPUT_MAP_V1
    O:<slot>/<bit>   ->  O_<slot>_<bit>      observable  OUTPUT_MAP_V1
    TON T4:0 <tb s> <PRE> 0 -> TON T4_0 <PRE x tb_ms> 0  TON_TIMEBASE_MAP_V1
    T4:0/DN, T4:0/TT ->  T4_0.DN, T4_0.TT    observable  TIMER_STATUS_MAP_V1
The TON rule keeps the duration exactly: the target preset in milliseconds is
the legacy preset times the timebase in milliseconds (integers, no rounding).

Tag map rows come back as proposals ("proposed: <rule>"); the UI must confirm
them (evidence starting "user-confirmed") before verify() will compare.
"""
from __future__ import annotations

import re

from backend.app.ir import (
    OTE,
    TON,
    Contact,
    Parallel,
    Program,
    Routine,
    Rung,
    Series,
    TagMapping,
)

INPUT_RULE = "INPUT_MAP_V1"
OUTPUT_RULE = "OUTPUT_MAP_V1"
TON_RULE = "TON_TIMEBASE_MAP_V1"
TIMER_STATUS_RULE = "TIMER_STATUS_MAP_V1"
PROPOSED_PREFIX = "proposed: "

_NUM = r"(0|[1-9][0-9]*)"
_BIT_ADDRESS = re.compile(rf"([IO]):{_NUM}/{_NUM}")
_TIMER = re.compile(rf"T{_NUM}:{_NUM}")
_TIMER_BIT = re.compile(rf"(T{_NUM}:{_NUM})/(DN|TT)")
_SLC_TIMEBASES_MS = (10, 1000)


# ---------- Renderer (IR -> demonstration mnemonic text) ----------

_TIMEBASE_TEXT = {10: "0.01", 1000: "1.0"}


def render_node(node) -> str:
    if isinstance(node, Contact):
        return f"{node.op} {node.tag}"
    if isinstance(node, Series):
        return " ".join(render_node(n) for n in node.nodes)
    if isinstance(node, Parallel):
        return "BST " + " NXB ".join(render_node(n) for n in node.nodes) + " BND"
    raise TypeError(f"cannot render condition node {node!r}")


def render_output(instr) -> str:
    if isinstance(instr, OTE):
        return f"OTE {instr.tag}"
    if isinstance(instr, TON):
        if instr.timebase_ms == 1:       # Logix form: preset in ms
            return f"TON {instr.timer} {instr.preset} 0"
        if instr.timebase_ms in _TIMEBASE_TEXT:  # SLC form: timebase in seconds
            return f"TON {instr.timer} {_TIMEBASE_TEXT[instr.timebase_ms]} {instr.preset} 0"
        raise ValueError(f"cannot render TON timebase_ms={instr.timebase_ms}")
    raise TypeError(f"cannot render output {instr!r}")


def render_rung(condition, outputs) -> str:
    parts = ["SOR", render_node(condition), *(render_output(o) for o in outputs), "EOR"]
    return " ".join(p for p in parts if p)


def render(program: Program) -> str:
    """One `SOR ... EOR` line per rung, in order. parse(render(p)) == p."""
    return "".join(
        render_rung(rung.condition, rung.outputs) + "\n"
        for routine in program.routines for rung in routine.rungs
    )


# ---------- Naming rules ----------

def bit_name(address: str) -> str | None:
    """I:1/0 -> I_1_0, O:2/0 -> O_2_0; None if no bit rule applies."""
    match = _BIT_ADDRESS.fullmatch(address)
    return None if match is None else "_".join(match.groups())


def timer_name(timer: str) -> str | None:
    """T4:0 -> T4_0; None if no timer rule applies."""
    match = _TIMER.fullmatch(timer)
    return None if match is None else f"T{match.group(1)}_{match.group(2)}"


def timer_bit_name(address: str) -> str | None:
    """T4:0/DN -> T4_0.DN, T4:0/TT -> T4_0.TT; None for other bits (EN, ACC, PRE)."""
    match = _TIMER_BIT.fullmatch(address)
    return None if match is None else f"{timer_name(match.group(1))}.{match.group(4)}"


def target_name(address: str) -> str | None:
    """Target name for any address a contact may read; None if no rule applies."""
    return bit_name(address) or timer_bit_name(address)


def _bit_sort_key(address: str):
    kind, slot, bit = _BIT_ADDRESS.fullmatch(address).groups()
    return (kind != "I", int(slot), int(bit))  # inputs first, then numeric order


def _timer_sort_key(timer: str):
    file_no, element = _TIMER.fullmatch(timer).groups()
    return (int(file_no), int(element))


# ---------- Reading the program ----------

def _contacts(node) -> list[str]:
    """Contact tags in left-to-right order."""
    if isinstance(node, Contact):
        return [node.tag]
    return [tag for child in node.nodes for tag in _contacts(child)]


def _all_rungs(program: Program) -> list[Rung]:
    return [rung for routine in program.routines for rung in routine.rungs]


def _tons(program: Program) -> list[tuple[int, TON]]:
    return [(rung.id, o) for rung in _all_rungs(program) for o in rung.outputs
            if isinstance(o, TON)]


# ---------- Conversion ----------

def find_unresolved(program: Program) -> list[str]:
    """Everything the rules cannot convert, in rung order. Empty = convertible."""
    written = {o.tag for rung in _all_rungs(program) for o in rung.outputs
               if isinstance(o, OTE)}
    timers = {ton.timer for _, ton in _tons(program)}
    first_ton_rung: dict[str, int] = {}
    problems: list[str] = []

    for rung in _all_rungs(program):
        seen: set[str] = set()

        def flag(message: str) -> None:
            if message not in seen:
                seen.add(message)
                problems.append(message)

        for tag in _contacts(rung.condition):
            timer_bit = _TIMER_BIT.fullmatch(tag)
            if target_name(tag) is None:
                flag(f"UNRESOLVED_ADDRESS: rung {rung.id}: {tag} has no P0 naming rule")
            elif timer_bit and timer_bit.group(1) not in timers:
                flag(f"UNRESOLVED_TIMER_READ: rung {rung.id}: {tag} is read but no "
                     f"TON {timer_bit.group(1)} exists")
            elif tag.startswith("O:") and tag not in written:
                flag(f"UNRESOLVED_OUTPUT_READ: rung {rung.id}: {tag} is read but never written")

        for instr in rung.outputs:
            if isinstance(instr, TON):
                if timer_name(instr.timer) is None:
                    flag(f"UNRESOLVED_ADDRESS: rung {rung.id}: {instr.timer} has no "
                         f"P0 naming rule")
                elif instr.timebase_ms not in _SLC_TIMEBASES_MS:
                    flag(f"UNRESOLVED_INSTRUCTION: rung {rung.id}: TON {instr.timer} has "
                         f"timebase_ms {instr.timebase_ms}, expected 10 or 1000")
                elif instr.timer in first_ton_rung:
                    flag(f"UNRESOLVED_DUPLICATE_TIMER: rung {rung.id}: {instr.timer} is "
                         f"already driven by the TON on rung {first_ton_rung[instr.timer]}")
                else:
                    first_ton_rung[instr.timer] = rung.id
            elif _TIMER_BIT.fullmatch(instr.tag):
                flag(f"UNRESOLVED_TIMER_WRITE: rung {rung.id}: OTE writes timer bit {instr.tag}")
            elif bit_name(instr.tag) is None:
                flag(f"UNRESOLVED_ADDRESS: rung {rung.id}: {instr.tag} has no P0 naming rule")
            elif instr.tag.startswith("I:"):
                flag(f"UNRESOLVED_INPUT_WRITE: rung {rung.id}: OTE writes input {instr.tag}")
    return problems


def _rename(node):
    if isinstance(node, Contact):
        return Contact(op=node.op, tag=target_name(node.tag))
    return type(node)(nodes=[_rename(n) for n in node.nodes])


def convert_ton(ton: TON) -> TON:
    """SLC TON -> Logix TON with the same duration: preset_ms = preset x timebase_ms."""
    return TON(timer=timer_name(ton.timer), preset=ton.preset * ton.timebase_ms,
               timebase_ms=1)


def _convert_output(instr):
    if isinstance(instr, TON):
        return convert_ton(instr)
    return OTE(tag=bit_name(instr.tag))


def _proposal(legacy: str, target: str, kind: str, rule: str) -> TagMapping:
    return TagMapping(legacy_tag=legacy, target_tag=target, kind=kind,
                      rule=rule, evidence=PROPOSED_PREFIX + rule)


def convert(program: Program) -> tuple[Program, list[TagMapping], list[str], list[str]]:
    unresolved = find_unresolved(program)
    if unresolved:
        return Program(routines=[]), [], [], unresolved

    routines = []
    for routine in program.routines:
        rungs = []
        for rung in routine.rungs:
            condition = _rename(rung.condition)
            outputs = [_convert_output(o) for o in rung.outputs]
            rungs.append(Rung(id=rung.id, source_text=render_rung(condition, outputs),
                              condition=condition, outputs=outputs))
        routines.append(Routine(name=routine.name, rungs=rungs))

    bit_addresses = {
        tag for rung in _all_rungs(program)
        for tag in _contacts(rung.condition)
                   + [o.tag for o in rung.outputs if isinstance(o, OTE)]
        if bit_name(tag) is not None
    }
    tag_map = []
    for address in sorted(bit_addresses, key=_bit_sort_key):
        if address.startswith("I:"):
            tag_map.append(_proposal(address, bit_name(address), "input", INPUT_RULE))
        else:
            tag_map.append(_proposal(address, bit_name(address), "observable", OUTPUT_RULE))
    for timer in sorted({ton.timer for _, ton in _tons(program)}, key=_timer_sort_key):
        for status in ("DN", "TT"):
            legacy = f"{timer}/{status}"
            tag_map.append(_proposal(legacy, timer_bit_name(legacy), "observable",
                                     TIMER_STATUS_RULE))

    rule_ids = {row.rule for row in tag_map}
    if _tons(program):
        rule_ids.add(TON_RULE)
    return Program(routines=routines), tag_map, sorted(rule_ids), []
