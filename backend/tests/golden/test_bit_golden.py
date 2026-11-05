"""Independently worked-out P0 bit/branch golden cases.

The JSON expectations were calculated from S1-S5, not from semantics.run().
"""

import json
from pathlib import Path
from dataclasses import asdict

import pytest

from backend.app import ir
from backend.app.scenarios import generate_scenarios
from backend.app.semantics import NeedsReviewError, run


EXPECTED = json.loads((Path(__file__).parent / "expected_bit_traces.json").read_text())["cases"]


def c(op, tag):
    return ir.Contact(op=op, tag=tag)


def program(*rung_conditions_and_output_tags):
    rungs = [
        ir.Rung(
            id=i,
            source_text=f"hand-built test rung {i}",
            condition=condition,
            outputs=[ir.OTE(tag=output)],
        )
        for i, (condition, output) in enumerate(rung_conditions_and_output_tags, start=1)
    ]
    return ir.Program(routines=[ir.Routine(name="Main", rungs=rungs)])


def events(*tuples):
    return [ir.InputEvent(scan=s, tag=t, value=v) for s, t, v in tuples]


@pytest.mark.parametrize("name,p,ev", [
    (
        "xic_true_then_false",
        program((c("XIC", "Start"), "Motor")),
        events((0, "Start", 1), (2, "Start", 0)),
    ),
    (
        "xio_open_then_pressed",
        program((c("XIO", "Stop"), "Motor")),
        events((0, "Stop", 0), (2, "Stop", 1)),
    ),
    (
        "series_and",
        program((ir.Series(nodes=[c("XIC", "Start"), c("XIO", "Stop")]), "Motor")),
        events((0, "Start", 1), (0, "Stop", 0), (2, "Start", 0), (3, "Start", 1), (3, "Stop", 1)),
    ),
    (
        "parallel_or",
        program((ir.Parallel(nodes=[c("XIC", "Start"), c("XIC", "Override")]), "Motor")),
        events((0, "Override", 1), (0, "Start", 0), (2, "Override", 0)),
    ),
    (
        "seal_in_motor",
        program((ir.Series(nodes=[
            ir.Parallel(nodes=[c("XIC", "I:1/0"), c("XIC", "O:2/0")]),
            c("XIO", "I:1/1"),
        ]), "O:2/0")),
        events((0, "I:1/0", 1), (0, "I:1/1", 0),
               (2, "I:1/0", 0), (3, "I:1/1", 1), (4, "I:1/1", 0)),
    ),
    (
        "later_rung_sees_earlier_coil",
        program((c("XIC", "Start"), "Relay"), (c("XIC", "Relay"), "Motor")),
        events((0, "Start", 1)),
    ),
])
def test_hand_computed_bit_traces(name, p, ev):
    legacy_trace = run(p, ev, "slc_subset_v1", 10)
    logix_trace = run(p, ev, "logix_subset_v1", 10)
    assert all(isinstance(entry, ir.TraceEntry) for entry in legacy_trace)
    assert all(isinstance(entry, ir.TraceEntry) for entry in logix_trace)
    assert [asdict(entry) for entry in legacy_trace] == EXPECTED[name]
    assert [asdict(entry) for entry in logix_trace] == EXPECTED[name]


def test_reject_uninitialized_physical_input():
    with pytest.raises(NeedsReviewError, match="MISSING_INITIAL_INPUTS"):
        run(program((c("XIC", "Start"), "Motor")), [], "slc_subset_v1", 10)


def test_reject_duplicate_event():
    p = program((c("XIC", "Start"), "Motor"))
    with pytest.raises(NeedsReviewError, match="DUPLICATE_EVENT"):
        run(p, events((0, "Start", 1), (0, "Start", 0)), "slc_subset_v1", 10)


def test_timer_not_silently_simulated():
    p = ir.Program(routines=[ir.Routine(name="Main", rungs=[ir.Rung(
        id=1, source_text="TON fixture", condition=c("XIC", "Start"),
        outputs=[ir.TON(timer="T4:0", preset=50, timebase_ms=10)],
    )])])
    with pytest.raises(NeedsReviewError, match="UNVALIDATED_TON_S6"):
        run(p, events((0, "Start", 1)), "slc_subset_v1", 10)


def test_generator_is_seeded_and_initializes_all_inputs():
    p = program((ir.Series(nodes=[c("XIC", "Start"), c("XIO", "Stop")]), "Motor"))
    a = generate_scenarios(p, seed=123, scenarios=7, scans=40)
    b = generate_scenarios(p, seed=123, scenarios=7, scans=40)
    assert a == b
    assert len(a) == 7
    for case in a:
        initial_tags = {getattr(e, "tag", None) if not isinstance(e, dict) else e["tag"]
                        for e in case if (getattr(e, "scan", None) if not isinstance(e, dict) else e["scan"]) == 0}
        assert initial_tags == {"Start", "Stop"}


def test_empty_series_is_true_as_defined_by_tami_ir():
    p = program((ir.Series(nodes=[]), "Motor"))
    trace = run(p, [], "slc_subset_v1", 10)
    assert trace == [ir.TraceEntry(scan=1, observables={"Motor": 1})]

def test_both_profiles_return_exact_trace_entry_types():
    p = program((c("XIC", "Start"), "Motor"))
    e = events((0, "Start", 1))
    for profile in ir.PROFILES:
        trace = run(p, e, profile, 10)
        assert trace == [ir.TraceEntry(scan=1, observables={"Motor": 1})]
        assert type(trace[0]) is ir.TraceEntry

def test_nested_parallel_requests_review():
    p = program((ir.Parallel(nodes=[ir.Parallel(nodes=[c("XIC", "Start")])]), "Motor"))
    with pytest.raises(NeedsReviewError, match="UNSUPPORTED_BRANCH"):
        run(p, events((0, "Start", 1)), "slc_subset_v1", 10)
