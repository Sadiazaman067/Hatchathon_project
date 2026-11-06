"""LadderProof P0 scan interpreter (Arnav-owned).

Deterministic, fixed-scan model for XIC, XIO, OTE, one-level OR branches,
and positive-preset TON instructions under the SLC and Logix subset profiles.

Reference: docs/semantics.md. This is NOT an emulator of physical PLC timing.
Timer behavior remains subject to Tami's golden-trace review (Friday S6 gate).
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any

from . import ir


class NeedsReviewError(Exception):
    """Unsupported or uncertain cases; verifier must report ``needs_review``."""


@dataclass
class _TimerState:
    """State is local to one run. Elapsed time is stored in milliseconds.

    For an SLC timer, native ACC is floor(elapsed_ms / timebase_ms).
    For a Logix timer, native ACC is elapsed_ms (timebase_ms == 1).
    """
    en: int = 0
    tt: int = 0
    dn: int = 0
    elapsed_ms: int = 0


def _get(obj: Any, field: str) -> Any:
    return obj[field] if isinstance(obj, dict) else getattr(obj, field)


def _condition_reads(node: ir.Node, *, branch_depth: int = 0) -> set[str]:
    if isinstance(node, ir.Contact):
        if node.op not in ("XIC", "XIO") or not isinstance(node.tag, str) or not node.tag:
            raise NeedsReviewError(f"UNSUPPORTED_CONTACT: {node!r}")
        return {node.tag}
    if isinstance(node, ir.Series):
        # The frozen IR defines an empty Series (logical AND) as True.
        result: set[str] = set()
        for child in node.nodes:
            result.update(_condition_reads(child, branch_depth=branch_depth))
        return result
    if isinstance(node, ir.Parallel):
        if branch_depth:
            raise NeedsReviewError("UNSUPPORTED_BRANCH: nested parallel branches")
        if not node.nodes:
            raise NeedsReviewError("INVALID_PARALLEL: empty branch")
        result: set[str] = set()
        for child in node.nodes:
            result.update(_condition_reads(child, branch_depth=branch_depth + 1))
        return result
    raise NeedsReviewError(f"UNSUPPORTED_CONDITION: {type(node).__name__}")


def _condition_value(node: ir.Node, bits: dict[str, int], *, branch_depth: int = 0) -> bool:
    if isinstance(node, ir.Contact):
        value = bits.get(node.tag, 0)
        if node.op == "XIC":
            return value == 1
        if node.op == "XIO":
            return value == 0
        raise NeedsReviewError(f"UNSUPPORTED_CONTACT: {node.op}")
    if isinstance(node, ir.Series):
        return all(_condition_value(child, bits, branch_depth=branch_depth) for child in node.nodes)
    if isinstance(node, ir.Parallel):
        if branch_depth:
            raise NeedsReviewError("UNSUPPORTED_BRANCH: nested parallel branches")
        return any(_condition_value(child, bits, branch_depth=branch_depth + 1) for child in node.nodes)
    raise NeedsReviewError(f"UNSUPPORTED_CONDITION: {type(node).__name__}")


def _timer_status_tags(timer_name: str, profile: str) -> dict[str, str]:
    if profile == "slc_subset_v1":
        return {bit: f"{timer_name}/{bit}" for bit in ("EN", "TT", "DN")}
    return {bit: f"{timer_name}.{bit}" for bit in ("EN", "TT", "DN")}


def _preflight(
    program_ir: ir.Program, profile: str,
) -> tuple[list[ir.Rung], set[str], set[str], set[str], dict[str, _TimerState]]:
    """Inspect entire program before any execution, including timer tag ownership."""
    if not isinstance(program_ir, ir.Program) or len(program_ir.routines) != 1:
        raise NeedsReviewError("UNSUPPORTED_ROUTINES: exactly one routine required")
    rungs = program_ir.routines[0].rungs
    read_tags: set[str] = set()
    coil_tags: set[str] = set()
    timer_names: set[str] = set()
    rung_ids: set[int] = set()
    for rung in rungs:
        if rung.id in rung_ids:
            raise NeedsReviewError(f"DUPLICATE_RUNG_ID: {rung.id}")
        rung_ids.add(rung.id)
        read_tags.update(_condition_reads(rung.condition))
        if not rung.outputs:
            raise NeedsReviewError(f"INVALID_RUNG: rung {rung.id} has no output")
        for instruction in rung.outputs:
            if isinstance(instruction, ir.OTE):
                if not isinstance(instruction.tag, str) or not instruction.tag:
                    raise NeedsReviewError("INVALID_OUTPUT_TAG: empty OTE tag")
                coil_tags.add(instruction.tag)
            elif isinstance(instruction, ir.TON):
                if not isinstance(instruction.timer, str) or not instruction.timer:
                    raise NeedsReviewError("INVALID_TIMER_TAG: empty timer name")
                if instruction.timer in timer_names:
                    raise NeedsReviewError(f"UNSUPPORTED_DUPLICATE_TIMER: {instruction.timer}")
                timer_names.add(instruction.timer)
                if type(instruction.preset) is not int or instruction.preset <= 0:
                    # PRE==0 first-enabled-scan behavior needs a separate approved golden gate.
                    raise NeedsReviewError("UNVALIDATED_TIMER_PRESET: only positive presets")
                if profile == "slc_subset_v1":
                    if type(instruction.timebase_ms) is not int or instruction.timebase_ms not in (10, 1000) or instruction.preset > 32767:
                        raise NeedsReviewError("INVALID_SLC_TIMER: timebase or preset")
                elif type(instruction.timebase_ms) is not int or instruction.timebase_ms != 1 or instruction.preset > 2147483647:
                    raise NeedsReviewError("INVALID_LOGIX_TIMER: timebase or preset")
            else:
                raise NeedsReviewError(
                    f"UNSUPPORTED_OUTPUT: rung {rung.id} has {type(instruction).__name__}"
                )

    status_tags: set[str] = set()
    observables = set(coil_tags)
    for timer_name in timer_names:
        status = _timer_status_tags(timer_name, profile)
        status_tags.update(status.values())
        observables.update((status["DN"], status["TT"]))
    overlap = coil_tags & status_tags
    if overlap:
        raise NeedsReviewError(f"AMBIGUOUS_TIMER_COIL_TAGS: {', '.join(sorted(overlap))}")
    for tag in read_tags:
        # A contact against a timer field must refer to a defined status bit.
        for timer_name in timer_names:
            if (tag.startswith(timer_name + "/") or tag.startswith(timer_name + ".")) and tag not in status_tags:
                raise NeedsReviewError(f"UNSUPPORTED_TIMER_FIELD: {tag}")
    states = {name: _TimerState() for name in timer_names}
    return rungs, read_tags - coil_tags - status_tags, observables, coil_tags | status_tags, states


def _validated_events(input_events: Iterable[Any]) -> tuple[dict[int, list[tuple[str, int]]], int, set[str]]:
    scheduled: dict[int, list[tuple[str, int]]] = defaultdict(list)
    initialized: set[str] = set()
    seen: set[tuple[int, str]] = set()
    prior_scan = -1
    last_scan = 0
    for event in input_events:
        scan, tag, value = _get(event, "scan"), _get(event, "tag"), _get(event, "value")
        if type(scan) is not int or scan < 0:
            raise NeedsReviewError(f"INVALID_EVENT_SCAN: {scan!r}")
        if not isinstance(tag, str) or not tag:
            raise NeedsReviewError(f"INVALID_EVENT_TAG: {tag!r}")
        if type(value) is not int or value not in (0, 1):
            raise NeedsReviewError(f"INVALID_EVENT_VALUE: {value!r}")
        if scan < prior_scan:
            raise NeedsReviewError("UNSORTED_EVENTS: ascending scans required")
        if (scan, tag) in seen:
            raise NeedsReviewError(f"DUPLICATE_EVENT: {tag} on scan {scan}")
        scheduled[scan].append((tag, value))
        seen.add((scan, tag))
        if scan == 0:
            initialized.add(tag)
        last_scan = scan
        prior_scan = scan
    return scheduled, last_scan, initialized


def _execute_timer(
    instruction: ir.TON, power: bool, state: _TimerState,
    bits: dict[str, int], profile: str, dt_ms: int,
) -> None:
    """Execute proposed S6 convention: initial enabled scan has zero ACC."""
    if not power:
        state.en = state.tt = state.dn = state.elapsed_ms = 0
    elif not state.en:
        # TON's first enabled scan captures time; it has not elapsed yet.
        state.en, state.tt, state.dn, state.elapsed_ms = 1, 1, 0, 0
    elif not state.dn:
        state.elapsed_ms += dt_ms
        native_acc = state.elapsed_ms // instruction.timebase_ms
        if native_acc >= instruction.preset:
            state.dn = 1
            state.tt = 0
    status = _timer_status_tags(instruction.timer, profile)
    bits[status["EN"]] = state.en
    bits[status["TT"]] = state.tt
    bits[status["DN"]] = state.dn


def run(
    program_ir: ir.Program,
    input_events: list[ir.InputEvent],
    profile: str,
    dt_ms: int,
    scans: int | None = None,
) -> ir.Trace:
    """Execute the modeled PLC program and return one TraceEntry per executed scan.

    `scans=None` preserves Thursday's four-argument behavior: execute through
    the last input event, at least one scan. For TON programs, an explicit
    `scans` is REQUIRED to prevent misleading under-tested comparisons.

    To guarantee 300 scans, call run(program, events, profile, 10, scans=300).
    Scan 0 sets initial inputs; executed scans are numbered 1 through N.
    """
    if profile not in ir.PROFILES:
        raise NeedsReviewError(f"UNKNOWN_PROFILE: {profile}")
    if type(dt_ms) is not int or dt_ms != 10:
        raise NeedsReviewError("UNVALIDATED_DT_MS: only 10 ms for v1")
    if scans is not None and (type(scans) is not int or scans < 1):
        raise NeedsReviewError("INVALID_SCAN_HORIZON: must be a positive integer")

    rungs, external_reads, observables, written_tags, timers = _preflight(program_ir, profile)
    if timers and scans is None:
        raise NeedsReviewError("MISSING_TIMER_HORIZON: pass scans explicitly")
    scheduled, last_event_scan, initialized = _validated_events(input_events)
    missing = external_reads - initialized
    if missing:
        raise NeedsReviewError(f"MISSING_INITIAL_INPUTS: {', '.join(sorted(missing))}")
    touched_writes = {tag for groups in scheduled.values() for tag, _ in groups} & written_tags
    if touched_writes:
        raise NeedsReviewError(f"INPUT_WRITES_INTERNAL_OUTPUT: {', '.join(sorted(touched_writes))}")
    if scans is not None and last_event_scan > scans:
        raise NeedsReviewError("INPUT_EVENT_OUTSIDE_HORIZON: explicit scans too short")

    final_scan = scans if scans is not None else max(1, last_event_scan)
    bits: dict[str, int] = {tag: 0 for tag in written_tags}
    for tag, value in scheduled.get(0, []):
        bits[tag] = value

    trace: ir.Trace = []
    for scan in range(1, final_scan + 1):
        for tag, value in scheduled.get(scan, []):
            bits[tag] = value
        for rung in rungs:
            power = _condition_value(rung.condition, bits)
            for instruction in rung.outputs:
                if isinstance(instruction, ir.OTE):
                    bits[instruction.tag] = int(power)
                else:
                    _execute_timer(instruction, power, timers[instruction.timer], bits, profile, dt_ms)
        trace.append(ir.TraceEntry(
            scan=scan,
            observables={tag: bits[tag] for tag in sorted(observables)},
        ))
    return trace
