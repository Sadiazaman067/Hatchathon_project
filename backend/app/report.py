"""verify(): run both programs on the same inputs and build the report.
Owner: Tami. Contract: CONTRACT.md sections 3 (verify), 6 (events, mappings),
7 (comparison) and 8 (report JSON). Everything in the report uses legacy names.

Status rules:
- Any mapping problem found before running -> needs_review, nothing is run.
- Scenarios run in order. The first engine NeedsReviewError or ComparisonError
  -> needs_review. The first observed difference -> different.
- Only if every scenario ran and compared cleanly -> no_difference_observed.
"""
from __future__ import annotations

from dataclasses import asdict
from typing import Literal, TypedDict

from backend.app.comparator import (
    ComparisonError,
    first_divergence,
    missing_observable,
    trace_window,
)
from backend.app.ir import (
    OTE,
    PROFILES,
    TON,
    Contact,
    InputEvent,
    Parallel,
    ParseDiagnostic,
    Program,
    Series,
    TagMapping,
    VerifyConfig,
)

LEGACY_PROFILE, TARGET_PROFILE = PROFILES  # ("slc_subset_v1", "logix_subset_v1")
CONFIRMED_PREFIX = "user-confirmed"


# ---------- Report shape (CONTRACT §8). A plain dict, typed for readers. ----------

class Coverage(TypedDict):
    scenarios: int
    scans: int          # total executed scans across all scenarios
    seed: int


class Assumptions(TypedDict):
    dt_ms: int
    executed_scan_index: Literal["1_based"]
    profiles: list[str]


class Divergence(TypedDict):
    scan: int
    tag: str
    legacy: int
    target: int
    rung: int | None


class MappingEvidence(TypedDict):
    legacy_tag: str
    target_tag: str
    rule: str


class EventDict(TypedDict):
    scan: int
    tag: str
    value: int


class TraceEntryDict(TypedDict):
    scan: int
    observables: dict[str, int]


class TraceWindow(TypedDict):
    start_scan: int
    end_scan: int
    legacy: list[TraceEntryDict]
    target: list[TraceEntryDict]


class Report(TypedDict):
    status: Literal["different", "no_difference_observed", "needs_review"]
    coverage: Coverage
    assumptions: Assumptions
    first_divergence: Divergence | None
    mapping_evidence: list[MappingEvidence]
    counterexample: list[EventDict]
    rules_used: list[str]
    warnings: list[str]
    trace_window: TraceWindow | None


# ---------- The engine (Arnav). Loaded lazily; tests replace _engine. ----------

def _engine():
    """Returns (run, NeedsReviewError, generate_scenarios) from Arnav's modules."""
    from backend.app.scenarios import generate_scenarios
    from backend.app.semantics import NeedsReviewError, run
    return run, NeedsReviewError, generate_scenarios


# ---------- What each program reads and writes ----------

def _contact_tags(node) -> set[str]:
    if isinstance(node, Contact):
        return {node.tag}
    if isinstance(node, (Series, Parallel)):
        return set().union(*(_contact_tags(n) for n in node.nodes)) if node.nodes else set()
    raise TypeError(f"unknown condition node {node!r}")


def timer_bits(timer: str, side: str) -> list[str]:
    """Status bits a TON writes: legacy T4:0/DN, T4:0/TT; target Timer0.DN, Timer0.TT."""
    sep = "/" if side == "legacy" else "."
    return [f"{timer}{sep}DN", f"{timer}{sep}TT"]


def writers(program: Program, side: str) -> dict[str, list[int]]:
    """Each written tag (OTE bits, timer DN/TT) -> ids of the rungs that write it."""
    result: dict[str, list[int]] = {}
    for routine in program.routines:
        for rung in routine.rungs:
            for instr in rung.outputs:
                tags = [instr.tag] if isinstance(instr, OTE) else timer_bits(instr.timer, side)
                for tag in tags:
                    result.setdefault(tag, []).append(rung.id)
    return result


def reads(program: Program) -> set[str]:
    return set().union(*(
        _contact_tags(rung.condition)
        for routine in program.routines for rung in routine.rungs
    ))


# ---------- Pre-run mapping checks ----------

def check_mappings(legacy_ir: Program, target_ir: Program,
                   tag_map: list[TagMapping]) -> list[str]:
    """Every problem that blocks a full comparison, as warning strings.
    An empty list means the tag map covers both programs."""
    warnings: list[str] = []

    for row in tag_map:
        if row.kind not in ("input", "observable"):
            warnings.append(
                f"INVALID_MAPPING_KIND: {row.legacy_tag} -> {row.target_tag} "
                f"has kind '{row.kind}' (expected input or observable)"
            )
        if not row.evidence.startswith(CONFIRMED_PREFIX):
            warnings.append(
                f"UNCONFIRMED_MAPPING: {row.legacy_tag} -> {row.target_tag} "
                f"has evidence '{row.evidence}'"
            )

    for kind in ("input", "observable"):
        rows = [r for r in tag_map if r.kind == kind]
        for side in ("legacy", "target"):
            tags = [getattr(r, f"{side}_tag") for r in rows]
            for tag in sorted({t for t in tags if tags.count(t) > 1}):
                warnings.append(
                    f"AMBIGUOUS_MAPPING: {side} tag {tag} appears in more than one {kind} mapping"
                )

    observables = sorted((r for r in tag_map if r.kind == "observable"),
                         key=lambda r: r.legacy_tag)
    for side, program in (("legacy", legacy_ir), ("target", target_ir)):
        written = writers(program, side)
        mapped_inputs = {getattr(r, f"{side}_tag") for r in tag_map if r.kind == "input"}
        mapped_outputs = {getattr(r, f"{side}_tag") for r in observables}
        for tag in sorted(reads(program) - set(written) - mapped_inputs):
            warnings.append(f"UNMAPPED_INPUT: {side} reads {tag} with no input mapping")
        for row in observables:
            if getattr(row, f"{side}_tag") not in written:
                warnings.append(str(missing_observable(row, side)))
        for tag in sorted(set(written) - mapped_outputs):
            warnings.append(f"UNMAPPED_OUTPUT: {side} writes {tag} with no observable mapping")

    return warnings


def translate_events(events: list[InputEvent], tag_map: list[TagMapping]) -> list[InputEvent]:
    """Legacy input events -> the same events under target tag names."""
    to_target = {r.legacy_tag: r.target_tag for r in tag_map if r.kind == "input"}
    translated = []
    for event in events:
        if event.tag not in to_target:
            raise ComparisonError(
                "UNMAPPED_INPUT_EVENT",
                f"scenario sets {event.tag} at scan {event.scan} but it has no input mapping",
            )
        translated.append(InputEvent(scan=event.scan, tag=to_target[event.tag], value=event.value))
    return translated


# ---------- Report assembly ----------

def _report(config: VerifyConfig, status: str, warnings: list[str], *,
            scenarios: int = 0, scans: int = 0, divergence=None,
            mapping_evidence=None, counterexample=None, window=None) -> Report:
    return {
        "status": status,
        "coverage": {"scenarios": scenarios, "scans": scans, "seed": config.seed},
        "assumptions": {
            "dt_ms": config.dt_ms,
            "executed_scan_index": "1_based",
            "profiles": list(PROFILES),
        },
        "first_divergence": divergence,
        "mapping_evidence": mapping_evidence or [],
        "counterexample": counterexample or [],
        "rules_used": [],  # verify() compares a supplied target; convert() owns rule ids
        "warnings": warnings,
        "trace_window": window,
    }


def parse_failure_report(config: VerifyConfig,
                         legacy_diagnostics: list[ParseDiagnostic],
                         target_diagnostics: list[ParseDiagnostic]) -> Report:
    """A needs_review report for programs that did not parse. Warnings keep
    the stable code first, e.g. 'UNSUPPORTED_OPCODE: legacy line 3: ...'."""
    warnings = [
        f"{d.code}: {side} line {d.line}: {d.message}"
        for side, diagnostics in (("legacy", legacy_diagnostics),
                                  ("target", target_diagnostics))
        for d in diagnostics
    ]
    return _report(config, "needs_review", warnings)


def _evidence(rows: list[TagMapping]) -> list[MappingEvidence]:
    return [{"legacy_tag": r.legacy_tag, "target_tag": r.target_tag, "rule": r.rule}
            for r in rows]


def _horizon_warning(short: int, scenarios: int, wanted: int) -> list[str]:
    if not short:
        return []
    return [
        f"SCAN_HORIZON: {short} of {scenarios} scenarios ran fewer than the "
        f"{wanted} requested scans (run() stops at the last input event)"
    ]


def verify(legacy_ir: Program, target_ir: Program, tag_map: list[TagMapping],
           config: VerifyConfig, *,
           input_scenarios: list[list[InputEvent]] | None = None,
           check_horizon: bool | None = None) -> Report:
    """Run both programs on identical inputs and report the first difference.

    input_scenarios=None uses Arnav's generate_scenarios with the config.
    check_horizon: warn (SCAN_HORIZON) when a scenario ran fewer than
    config.scans scans. None means: only when verify() generated the scenarios,
    because passed-in scenarios carry no requested scan count."""
    if check_horizon is None:
        check_horizon = input_scenarios is None

    problems = check_mappings(legacy_ir, target_ir, tag_map)
    if problems:
        return _report(config, "needs_review", problems)

    run, needs_review_error, generate_scenarios = _engine()
    if input_scenarios is None:
        input_scenarios = generate_scenarios(
            legacy_ir, seed=config.seed, scenarios=config.scenarios, scans=config.scans
        )
    if not input_scenarios:
        return _report(config, "needs_review", ["NO_SCENARIOS: there are no input scenarios to run"])

    scenarios_run = scans_run = short = 0

    def review(message: str) -> Report:
        return _report(config, "needs_review", [message],
                       scenarios=scenarios_run, scans=scans_run)

    for events in input_scenarios:
        try:
            target_events = translate_events(events, tag_map)
        except ComparisonError as error:
            return review(str(error))
        try:
            legacy_trace = run(legacy_ir, list(events), LEGACY_PROFILE, config.dt_ms)
        except needs_review_error as error:
            return review(f"{error} (legacy program)")
        try:
            target_trace = run(target_ir, target_events, TARGET_PROFILE, config.dt_ms)
        except needs_review_error as error:
            return review(f"{error} (target program)")
        try:
            divergence = first_divergence(legacy_trace, target_trace, tag_map)
        except ComparisonError as error:
            return review(str(error))

        scenarios_run += 1
        scans_run += len(legacy_trace)
        short += check_horizon and len(legacy_trace) < config.scans

        if divergence is not None:
            tag = divergence["tag"]
            legacy_writers = writers(legacy_ir, "legacy").get(tag, [])
            divergence["rung"] = legacy_writers[0] if len(legacy_writers) == 1 else None
            counterexample = [
                {"scan": e.scan, "tag": e.tag, "value": e.value}
                for e in sorted(events, key=lambda e: e.scan) if e.scan <= divergence["scan"]
            ]
            used_inputs = {e["tag"] for e in counterexample}
            rows = [r for r in tag_map if r.kind == "observable" and r.legacy_tag == tag]
            rows += sorted((r for r in tag_map
                            if r.kind == "input" and r.legacy_tag in used_inputs),
                           key=lambda r: r.legacy_tag)
            window = trace_window(legacy_trace, target_trace, tag_map, divergence["scan"])
            return _report(
                config, "different",
                _horizon_warning(short, scenarios_run, config.scans),
                scenarios=scenarios_run, scans=scans_run, divergence=divergence,
                mapping_evidence=_evidence(rows), counterexample=counterexample,
                window={
                    "start_scan": window["start_scan"], "end_scan": window["end_scan"],
                    "legacy": [asdict(e) for e in window["legacy"]],
                    "target": [asdict(e) for e in window["target"]],
                },
            )

    return _report(
        config, "no_difference_observed",
        _horizon_warning(short, scenarios_run, config.scans),
        scenarios=scenarios_run, scans=scans_run, mapping_evidence=_evidence(tag_map),
    )
