"""Friday TON + explicit scan horizon golden cases.

Expected scan numbers here were calculated by hand under proposed S6;
never generate expected values by calling the simulator itself.
Pending Tami's review of S6 and Rockwell references.
"""

import json
from pathlib import Path

import pytest

from backend.app import ir
from backend.app.semantics import NeedsReviewError, run
from backend.app.scenarios import generate_scenarios


def timer_program(profile: str, *, preset: int, timebase_ms: int) -> ir.Program:
    is_slc = profile == "slc_subset_v1"
    timer = "T4:0" if is_slc else "Timer0"
    start = "I:1/0" if is_slc else "Start"
    motor = "O:2/0" if is_slc else "Motor"
    dn = f"{timer}/DN" if is_slc else f"{timer}.DN"
    return ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(id=1, source_text="TON", condition=ir.Contact("XIC", start),
                outputs=[ir.TON(timer, preset, timebase_ms)]),
        ir.Rung(id=2, source_text="output", condition=ir.Contact("XIC", dn),
                outputs=[ir.OTE(motor)]),
    ])])


def inputs(profile: str, *changes: tuple[int, int]) -> list[ir.InputEvent]:
    start = "I:1/0" if profile == "slc_subset_v1" else "Start"
    return [ir.InputEvent(scan=scan, tag=start, value=value) for scan, value in changes]


def values(trace: ir.Trace, scan: int, profile: str) -> tuple[int, int, int]:
    prefix, sep, motor = ("T4:0", "/", "O:2/0") if profile == "slc_subset_v1" else ("Timer0", ".", "Motor")
    d = trace[scan - 1].observables
    return (d[prefix + sep + "DN"], d[prefix + sep + "TT"], d[motor])


@pytest.mark.parametrize("profile,preset,timebase", [
    ("slc_subset_v1", 5, 10),
    ("logix_subset_v1", 50, 1),
])
def test_timer_first_true_boundary_and_saturation(profile, preset, timebase):
    t = run(timer_program(profile, preset=preset, timebase_ms=timebase),
            inputs(profile, (0, 1)), profile, 10, scans=10)
    assert len(t) == 10
    assert [row.scan for row in t] == list(range(1, 11))
    # First true scan ACC=0; 5 consecutive intervals have elapsed by scan 6.
    assert values(t, 1, profile) == (0, 1, 0)
    assert values(t, 5, profile) == (0, 1, 0)
    assert values(t, 6, profile) == (1, 0, 1)
    assert values(t, 10, profile) == (1, 0, 1)
    assert all("ACC" not in key and "PRE" not in key for row in t for key in row.observables)


@pytest.mark.parametrize("profile,preset,timebase", [
    ("slc_subset_v1", 5, 10),
    ("logix_subset_v1", 50, 1),
])
def test_timer_false_resets_and_reenable_starts_at_zero(profile, preset, timebase):
    t = run(timer_program(profile, preset=preset, timebase_ms=timebase),
            inputs(profile, (0, 1), (7, 0), (8, 1)), profile, 10, scans=14)
    expected = {
        6: (1, 0, 1),  # first cycle done
        7: (0, 0, 0),  # immediately reset on false
        8: (0, 1, 0),  # new first true scan, ACC=0
        12: (0, 1, 0),
        13: (1, 0, 1), # five full 10-ms intervals since re-enable
    }
    for scan, target in expected.items():
        assert values(t, scan, profile) == target


def test_slow_slc_timebase_carries_10ms_intervals():
    profile = "slc_subset_v1"
    t = run(timer_program(profile, preset=1, timebase_ms=1000),
            inputs(profile, (0, 1)), profile, 10, scans=103)
    assert values(t, 1, profile) == (0, 1, 0)
    assert values(t, 100, profile) == (0, 1, 0)
    assert values(t, 101, profile) == (1, 0, 1)


def test_seeded_timer_scaling_bug_first_diverges_at_executed_scan_6():
    old_profile, new_profile = "slc_subset_v1", "logix_subset_v1"
    old = run(timer_program(old_profile, preset=50, timebase_ms=10),
              inputs(old_profile, (0, 1)), old_profile, 10, scans=55)
    buggy = run(timer_program(new_profile, preset=50, timebase_ms=1),
                inputs(new_profile, (0, 1)), new_profile, 10, scans=55)
    old_motor, new_motor = "O:2/0", "Motor"
    mismatches = [scan for scan in range(1, 56)
                  if old[scan - 1].observables[old_motor] != buggy[scan - 1].observables[new_motor]]
    assert mismatches[0] == 6
    assert old[5].observables[old_motor] == 0
    assert buggy[5].observables[new_motor] == 1
    assert old[50].observables[old_motor] == 1
    assert buggy[50].observables[new_motor] == 1


def test_explicit_horizon_does_not_depend_on_last_input_event():
    p = ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(id=1, source_text="coil", condition=ir.Contact("XIC", "Start"), outputs=[ir.OTE("Motor")]),
    ])])
    ev = [ir.InputEvent(scan=0, tag="Start", value=1)]
    assert len(run(p, ev, "logix_subset_v1", 10)) == 1  # unchanged old call
    extended = run(p, ev, "logix_subset_v1", 10, scans=300)
    assert len(extended) == 300
    assert extended[0] == ir.TraceEntry(scan=1, observables={"Motor": 1})
    assert extended[-1] == ir.TraceEntry(scan=300, observables={"Motor": 1})
    # Test no mutation of inputs or program.
    assert ev == [ir.InputEvent(scan=0, tag="Start", value=1)]


def test_generated_200_by_300_is_exactly_60000_executed_scans():
    p = ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(id=1, source_text="coil", condition=ir.Contact("XIC", "Start"), outputs=[ir.OTE("Motor")]),
    ])])
    cases = generate_scenarios(p, seed=42, scenarios=200, scans=300)
    total = sum(len(run(p, case, "slc_subset_v1", 10, scans=300)) for case in cases)
    assert total == 60000


@pytest.mark.parametrize("scans", [0, -1, True, 1.5, "300"])
def test_invalid_horizon_is_review(scans):
    p = ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(id=1, source_text="coil", condition=ir.Series([]), outputs=[ir.OTE("Motor")]),
    ])])
    with pytest.raises(NeedsReviewError, match="INVALID_SCAN_HORIZON"):
        run(p, [], "slc_subset_v1", 10, scans=scans)


def test_event_after_horizon_is_review_instead_of_silently_skipped():
    p = ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(id=1, source_text="coil", condition=ir.Contact("XIC", "Start"), outputs=[ir.OTE("Motor")]),
    ])])
    with pytest.raises(NeedsReviewError, match="INPUT_EVENT_OUTSIDE_HORIZON"):
        run(p, inputs("logix_subset_v1", (0, 1), (7, 0)), "logix_subset_v1", 10, scans=6)


def test_timer_without_explicit_horizon_is_review_instead_of_false_green():
    p = timer_program("slc_subset_v1", preset=50, timebase_ms=10)
    with pytest.raises(NeedsReviewError, match="MISSING_TIMER_HORIZON"):
        run(p, inputs("slc_subset_v1", (0, 1)), "slc_subset_v1", 10)


def test_zero_timer_preset_is_review_pending_extra_rule():
    p = timer_program("logix_subset_v1", preset=0, timebase_ms=1)
    with pytest.raises(NeedsReviewError, match="UNVALIDATED_TIMER_PRESET"):
        run(p, inputs("logix_subset_v1", (0, 1)), "logix_subset_v1", 10, scans=5)


GOLDEN = json.loads(
    (Path(__file__).parent / "expected_timer_traces.json").read_text(encoding="utf-8")
)["cases"]


@pytest.mark.parametrize("case_name", list(GOLDEN))
def test_independently_calculated_timer_golden(case_name):
    """Expected results are frozen in JSON, not calculated from run()."""
    case = GOLDEN[case_name]
    profile = case["profile"]
    actual = run(
        timer_program(profile, preset=case["preset"], timebase_ms=case["timebase_ms"]),
        inputs(profile, *[tuple(item) for item in case["events"]]),
        profile, 10, scans=case["scans"],
    )
    assert len(actual) == case["scans"]
    for scan_str, expected in case["checks"].items():
        assert values(actual, int(scan_str), profile) == tuple(expected)


def test_legacy_four_argument_call_remains_valid():
    p = ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(id=1, source_text="OTE", condition=ir.Contact("XIC", "Start"),
                outputs=[ir.OTE("Motor")])
    ])])
    events = [ir.InputEvent(scan=0, tag="Start", value=1)]
    assert run(p, events, "logix_subset_v1", 10) == [
        ir.TraceEntry(scan=1, observables={"Motor": 1})
    ]


def test_repeated_timer_runs_reset_all_state():
    p = timer_program("logix_subset_v1", preset=50, timebase_ms=1)
    ev = inputs("logix_subset_v1", (0, 1))
    first = run(p, ev, "logix_subset_v1", 10, scans=10)
    second = run(p, ev, "logix_subset_v1", 10, scans=10)
    assert first == second
