"""Regression tests for seeded scenario generation on P0 TON programs.

The oracle for the timer-scaling example is the independent S6 fixture:
50 ms target first asserts DN at executed scan 6, 500 ms legacy at 51.
"""

import pytest

from backend.app import ir
from backend.app.scenarios import generate_scenarios
from backend.app.semantics import run


def timer_program(*, profile: str, preset: int, timebase_ms: int) -> ir.Program:
    if profile == "slc_subset_v1":
        input_tag, timer, motor, done = "I:1/0", "T4:0", "O:2/0", "T4:0/DN"
    else:
        input_tag, timer, motor, done = "Start", "T4_0", "Motor", "T4_0.DN"
    return ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(id=1, source_text="Start TON", condition=ir.Contact("XIC", input_tag),
                outputs=[ir.TON(timer, preset, timebase_ms)]),
        ir.Rung(id=2, source_text="Timer DN drives Motor", condition=ir.Contact("XIC", done),
                outputs=[ir.OTE(motor)]),
    ])])


@pytest.mark.parametrize("profile,preset,timebase", [
    ("slc_subset_v1", 50, 10),
    ("logix_subset_v1", 50, 1),
])
def test_timer_status_bits_are_not_generated_as_external_inputs(profile, preset, timebase):
    program = timer_program(profile=profile, preset=preset, timebase_ms=timebase)
    histories = generate_scenarios(program, seed=42, scenarios=5, scans=300)
    expected_input = "I:1/0" if profile == "slc_subset_v1" else "Start"
    assert len(histories) == 5
    assert {e.tag for history in histories for e in history} == {expected_input}
    for events in histories:
        # Critical: scan-0 initial value exists, even when the TON never enables.
        assert events[0].scan == 0 and events[0].tag == expected_input
        assert len(run(program, events, profile, 10, scans=300)) == 300


def test_scripted_all_high_catches_unscaled_preset_at_scan_six():
    legacy = timer_program(profile="slc_subset_v1", preset=50, timebase_ms=10)
    buggy = timer_program(profile="logix_subset_v1", preset=50, timebase_ms=1)
    histories = generate_scenarios(legacy, seed=42, scenarios=200, scans=300)
    assert len(histories) == 200
    # The second scripted scenario holds every physical input high for 300 scans.
    assert histories[1] == [ir.InputEvent(scan=0, tag="I:1/0", value=1)]
    legacy_trace = run(legacy, histories[1], "slc_subset_v1", 10, scans=300)
    target_events = [ir.InputEvent(e.scan, "Start", e.value) for e in histories[1]]
    target_trace = run(buggy, target_events, "logix_subset_v1", 10, scans=300)
    first = next(i for i in range(300)
                 if legacy_trace[i].observables["O:2/0"] != target_trace[i].observables["Motor"])
    assert legacy_trace[first].scan == target_trace[first].scan == 6
    assert legacy_trace[first].observables["O:2/0"] == 0
    assert target_trace[first].observables["Motor"] == 1


def test_seed_and_bounds_are_repeatable_for_timers():
    program = timer_program(profile="slc_subset_v1", preset=50, timebase_ms=10)
    first = generate_scenarios(program, seed=123, scenarios=200, scans=300)
    second = generate_scenarios(program, seed=123, scenarios=200, scans=300)
    assert first == second
    assert all(0 <= e.scan <= 300 for history in first for e in history)
    assert all(len([e for e in history if e.scan == 0]) == 1 for history in first)
    assert all(len({(e.scan, e.tag) for e in history}) == len(history) for history in first)


def test_explicit_confirmed_inputs_still_work_with_timer():
    program = timer_program(profile="logix_subset_v1", preset=50, timebase_ms=1)
    histories = generate_scenarios(program, seed=42, scenarios=2, scans=300, input_tags=["Start"])
    assert histories == [[ir.InputEvent(0, "Start", 0)], [ir.InputEvent(0, "Start", 1)]]


def test_bit_only_generator_does_not_change():
    program = ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(id=1, source_text="XIC A OTE B", condition=ir.Contact("XIC", "A"),
                outputs=[ir.OTE("B")])
    ])])
    assert generate_scenarios(program, scenarios=3, scans=300) == [
        [ir.InputEvent(0, "A", 0)],
        [ir.InputEvent(0, "A", 1)],
        [ir.InputEvent(0, "A", 0), ir.InputEvent(1, "A", 1), ir.InputEvent(2, "A", 0)],
    ]


def test_converter_native_timer_status_names_and_correct_preset_scaling():
    """Tami's convert() emits T4_0; scale 50 ticks x 10 ms to 500 ms.

    Independent model oracle: after an enabled scan at ACC=0, a 500 ms
    timer first sets DN on executed scan 51 when dt_ms=10.
    """
    legacy = timer_program(profile="slc_subset_v1", preset=50, timebase_ms=10)
    target = timer_program(profile="logix_subset_v1", preset=500, timebase_ms=1)
    histories = generate_scenarios(legacy, seed=42, scenarios=2, scans=300)
    legacy_events = histories[1]  # all-high from scan 0
    target_events = [ir.InputEvent(e.scan, "Start", e.value) for e in legacy_events]
    legacy_trace = run(legacy, legacy_events, "slc_subset_v1", 10, scans=300)
    target_trace = run(target, target_events, "logix_subset_v1", 10, scans=300)

    assert {e.tag for history in generate_scenarios(target, scenarios=2, scans=300)
            for e in history} == {"Start"}
    assert "T4_0.DN" in target_trace[0].observables
    assert "T4_0.TT" in target_trace[0].observables
    assert "T4_0/DN" not in target_trace[0].observables
    for old, new in zip(legacy_trace, target_trace, strict=True):
        assert old.scan == new.scan
        assert old.observables["T4:0/DN"] == new.observables["T4_0.DN"]
        assert old.observables["T4:0/TT"] == new.observables["T4_0.TT"]
        assert old.observables["O:2/0"] == new.observables["Motor"]
    assert next(row.scan for row in legacy_trace if row.observables["T4:0/DN"]) == 51
    assert next(row.scan for row in target_trace if row.observables["T4_0.DN"]) == 51


def test_target_timer_status_tt_is_not_a_physical_input():
    """Covers downstream contacts on TT as well as DN with converter tag names."""
    program = ir.Program(routines=[ir.Routine(name="Main", rungs=[
        ir.Rung(1, "XIC Start TON T4_0", ir.Contact("XIC", "Start"),
                [ir.TON("T4_0", 50, 1)]),
        ir.Rung(2, "XIC T4_0.TT OTE TimingLamp", ir.Contact("XIC", "T4_0.TT"),
                [ir.OTE("TimingLamp")]),
    ])])
    histories = generate_scenarios(program, scenarios=3, scans=300)
    assert {e.tag for history in histories for e in history} == {"Start"}
    t = run(program, histories[1], "logix_subset_v1", 10, scans=300)
    assert t[0].observables["T4_0.TT"] == 1
    assert t[5].observables["T4_0.TT"] == 0
