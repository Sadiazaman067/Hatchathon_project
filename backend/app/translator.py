"""Rule-based SLC -> Logix translator and target-text renderer. Owner: Tami.
Contract: CONTRACT.md section 3 (convert, renderer) and section 6 (tag map).

convert(program) -> (target_ir, tag_map, rule_ids, unresolved)

All-or-nothing: if anything cannot be converted by a rule, convert() returns
an empty Program, no tag map, no rule ids, and the full unresolved list.
Nothing is guessed and no rung is silently dropped.

Naming rules (deterministic and one-to-one; numbers have no leading zeros):
    I:<slot>/<bit>  ->  I_<slot>_<bit>   input       INPUT_MAP_V1
    O:<slot>/<bit>  ->  O_<slot>_<bit>   observable  OUTPUT_MAP_V1
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
PROPOSED_PREFIX = "proposed: "

_NUM = r"(0|[1-9][0-9]*)"
_ADDRESS = re.compile(rf"([IO]):{_NUM}/{_NUM}")


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


# ---------- Reading the program ----------

def _contacts(node) -> list[str]:
    """Contact tags in left-to-right order."""
    if isinstance(node, Contact):
        return [node.tag]
    return [tag for child in node.nodes for tag in _contacts(child)]


def _all_rungs(program: Program) -> list[Rung]:
    return [rung for routine in program.routines for rung in routine.rungs]


def target_name(address: str) -> str | None:
    """I:1/0 -> I_1_0, O:2/0 -> O_2_0; None if no P0 naming rule applies."""
    match = _ADDRESS.fullmatch(address)
    return None if match is None else "_".join(match.groups())


def _sort_key(address: str):
    kind, slot, bit = _ADDRESS.fullmatch(address).groups()
    return (kind != "I", int(slot), int(bit))  # inputs first, then numeric order


# ---------- Conversion ----------

def find_unresolved(program: Program) -> list[str]:
    """Everything the bit rules cannot convert, in rung order. Empty = convertible."""
    written = {o.tag for rung in _all_rungs(program) for o in rung.outputs
               if isinstance(o, OTE)}
    problems: list[str] = []
    for rung in _all_rungs(program):
        seen: set[str] = set()

        def flag(message: str) -> None:
            if message not in seen:
                seen.add(message)
                problems.append(message)

        for tag in _contacts(rung.condition):
            if target_name(tag) is None:
                flag(f"UNRESOLVED_ADDRESS: rung {rung.id}: {tag} has no P0 naming rule")
            elif tag.startswith("O:") and tag not in written:
                flag(f"UNRESOLVED_OUTPUT_READ: rung {rung.id}: {tag} is read but never written")
        for instr in rung.outputs:
            if isinstance(instr, TON):
                flag(f"UNRESOLVED_INSTRUCTION: rung {rung.id}: TON {instr.timer} "
                     f"is not converted yet")
            elif target_name(instr.tag) is None:
                flag(f"UNRESOLVED_ADDRESS: rung {rung.id}: {instr.tag} has no P0 naming rule")
            elif instr.tag.startswith("I:"):
                flag(f"UNRESOLVED_INPUT_WRITE: rung {rung.id}: OTE writes input {instr.tag}")
    return problems


def _rename(node):
    if isinstance(node, Contact):
        return Contact(op=node.op, tag=target_name(node.tag))
    return type(node)(nodes=[_rename(n) for n in node.nodes])


def convert(program: Program) -> tuple[Program, list[TagMapping], list[str], list[str]]:
    unresolved = find_unresolved(program)
    if unresolved:
        return Program(routines=[]), [], [], unresolved

    routines = []
    for routine in program.routines:
        rungs = []
        for rung in routine.rungs:
            condition = _rename(rung.condition)
            outputs = [OTE(tag=target_name(o.tag)) for o in rung.outputs]
            rungs.append(Rung(id=rung.id, source_text=render_rung(condition, outputs),
                              condition=condition, outputs=outputs))
        routines.append(Routine(name=routine.name, rungs=rungs))

    addresses = {tag for rung in _all_rungs(program)
                 for tag in _contacts(rung.condition) + [o.tag for o in rung.outputs]}
    tag_map = []
    for address in sorted(addresses, key=_sort_key):
        is_input = address.startswith("I:")
        rule = INPUT_RULE if is_input else OUTPUT_RULE
        tag_map.append(TagMapping(
            legacy_tag=address, target_tag=target_name(address),
            kind="input" if is_input else "observable",
            rule=rule, evidence=PROPOSED_PREFIX + rule,
        ))
    rule_ids = sorted({row.rule for row in tag_map})
    return Program(routines=routines), tag_map, rule_ids, []
