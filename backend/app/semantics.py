"""LadderProof P0 scan interpreter (Arnav-owned).

Implements verified bit/branch behavior only for the Thursday gate.
TON is intentionally NOT executed while semantics rule S6 is unapproved.

Important contract gap: run() has no `scans` argument. Until the team
ratifies a horizon mechanism, it executes through the highest input-event
scan, or one executed scan if all events occur at scan 0. Thus it must not
be used to claim 300-scan scenario coverage without resolving that gap.
"""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from typing import Any

from . import ir


class NeedsReviewError(Exception):
    """Unsupported, ambiguous or unvalidated PLC semantics.

    Tami's verify() must catch this and produce status='needs_review',
    with the message in the report's warnings. Never interpret it as a pass.
    """


def _get(obj: Any, field: str) -> Any:
    """Read a frozen IR/event field from a dataclass or serialized dict."""
    return obj[field] if isinstance(obj, dict) else getattr(obj, field)


def _condition_reads(node: Any, *, branch_depth: int = 0) -> set[str]:
    if isinstance(node, ir.Contact):
        if node.op not in ("XIC", "XIO") or not isinstance(node.tag, str) or not node.tag:
            raise NeedsReviewError(f"UNSUPPORTED_CONTACT: {node!r}")
        return {node.tag}
    if isinstance(node, ir.Series):
        # ir.Series explicitly defines empty AND as True (bare rung).
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


def _condition_value(node: Any, bits: dict[str, int], *, branch_depth: int = 0) -> bool:
    if isinstance(node, ir.Contact):
        value = bits.get(node.tag, 0)
        if node.op == "XIC":
            return value == 1
        if node.op == "XIO":
            return value == 0
        raise NeedsReviewError(f"UNSUPPORTED_CONTACT: {node.op}")
    if isinstance(node, ir.Series):
        return all(_condition_value(n, bits, branch_depth=branch_depth) for n in node.nodes)
    if isinstance(node, ir.Parallel):
        if branch_depth:
            raise NeedsReviewError("UNSUPPORTED_BRANCH: nested parallel branches")
        return any(_condition_value(n, bits, branch_depth=branch_depth + 1) for n in node.nodes)
    raise NeedsReviewError(f"UNSUPPORTED_CONDITION: {type(node).__name__}")


def _preflight(program_ir: ir.Program) -> tuple[list[Any], set[str], set[str]]:
    """Reject unsupported constructs BEFORE producing any partial trace."""
    routines = program_ir.routines
    if len(routines) != 1:
        raise NeedsReviewError("UNSUPPORTED_ROUTINES: P0 requires exactly one routine")
    rungs = routines[0].rungs
    read_tags: set[str] = set()
    output_tags: set[str] = set()
    rung_ids: set[int] = set()
    for rung in rungs:
        if rung.id in rung_ids:
            raise NeedsReviewError(f"DUPLICATE_RUNG_ID: {rung.id}")
        rung_ids.add(rung.id)
        read_tags.update(_condition_reads(rung.condition))
        if not rung.outputs:
            raise NeedsReviewError(f"INVALID_RUNG: rung {rung.id} has no output")
        for instruction in rung.outputs:
            if isinstance(instruction, ir.TON):
                raise NeedsReviewError("UNVALIDATED_TON_S6: timer model is not approved yet")
            if not isinstance(instruction, ir.OTE):
                raise NeedsReviewError(
                    f"UNSUPPORTED_OUTPUT: rung {rung.id} has {type(instruction).__name__}"
                )
            output_tags.add(instruction.tag)
    return rungs, read_tags, output_tags


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
            raise NeedsReviewError("UNSORTED_EVENTS: order events by ascending scan")
        if (scan, tag) in seen:
            raise NeedsReviewError(f"DUPLICATE_EVENT: {tag} on scan {scan}")
        scheduled[scan].append((tag, value))
        seen.add((scan, tag))
        if scan == 0:
            initialized.add(tag)
        prior_scan = scan
        last_scan = scan
    return scheduled, last_scan, initialized


def run(
    program_ir: ir.Program,
    input_events: list[ir.InputEvent],
    profile: str,
    dt_ms: int,
) -> ir.Trace:
    """Run the P0 bit/branch subset with a fresh local state per invocation.

    Inputs are already in this profile's native tag names (Tami handles
    old-to-new mapping). Trace entries use native output names.

    Contract horizon limitation: when no later input event exists, returns
    the first executed scan only. See module docstring.
    """
    if profile not in ("slc_subset_v1", "logix_subset_v1"):
        raise NeedsReviewError(f"UNKNOWN_PROFILE: {profile}")
    if type(dt_ms) is not int or dt_ms != 10:
        raise NeedsReviewError("UNVALIDATED_DT_MS: only 10 ms is accepted for P0")

    rungs, reads, outputs = _preflight(program_ir)
    scheduled, last_event_scan, initialized = _validated_events(input_events)
    required_external_inputs = reads - outputs
    missing = required_external_inputs - initialized
    if missing:
        raise NeedsReviewError(f"MISSING_INITIAL_INPUTS: {', '.join(sorted(missing))}")
    touched_outputs = {tag for group in scheduled.values() for tag, _ in group} & outputs
    if touched_outputs:
        raise NeedsReviewError(f"INPUT_WRITES_OUTPUT: {', '.join(sorted(touched_outputs))}")

    bits: dict[str, int] = {tag: 0 for tag in outputs}
    for tag, value in scheduled.get(0, []):
        bits[tag] = value

    # No scan horizon is present in the frozen four-argument function signature.
    # Today's fixture ensures at least scan 1 is executed; other cases use
    # events on later scans. A full N-scan API requires team approval.
    final_scan = max(1, last_event_scan)
    trace: ir.Trace = []
    for scan in range(1, final_scan + 1):
        for tag, value in scheduled.get(scan, []):
            bits[tag] = value
        for rung in rungs:
            power = int(_condition_value(rung.condition, bits))
            for instruction in rung.outputs:
                # Preflight has guaranteed every output is OTE.
                bits[instruction.tag] = power
        trace.append(
            ir.TraceEntry(
                scan=scan,
                observables={tag: bits[tag] for tag in sorted(outputs)},
            )
        )
    return trace
