import pytest

from backend.app.comparator import (
    ComparisonError, canonical_observables, first_divergence,
    matching_trace_window, MATCHING_WINDOW, trace_window,
)
from backend.app.ir import TagMapping, TraceEntry


def obs(legacy, target, rule="OUTPUT_MAP_V1"):
    return TagMapping(legacy, target, "observable", rule, "user-confirmed")


MAP = [
    obs("O:2/0", "Motor"),
    obs("O:2/1", "Lamp"),
    TagMapping("I:1/0", "Start", "input", "INPUT_MAP_V1", "user-confirmed"),
]


def trace(*rows):
    """trace({"O:2/0": 1}, {...}) -> scans 1, 2, ..."""
    return [TraceEntry(scan=i, observables=o) for i, o in enumerate(rows, start=1)]


def test_canonical_observables_renames_target_and_keeps_only_mapped():
    target = trace({"Motor": 1, "Lamp": 0, "Internal": 1})
    assert canonical_observables(target, MAP, "target") == trace({"O:2/0": 1, "O:2/1": 0})


def test_identical_traces_have_no_divergence():
    legacy = trace({"O:2/0": 1, "O:2/1": 0}, {"O:2/0": 0, "O:2/1": 1})
    target = trace({"Motor": 1, "Lamp": 0}, {"Motor": 0, "Lamp": 1})
    assert first_divergence(legacy, target, MAP) is None


def test_flipped_stop_diverges_at_scan_1_on_canonical_tag():
    seal_in_map = [obs("O:2/0", "Motor")]
    legacy = trace({"O:2/0": 1}, {"O:2/0": 1})
    target = trace({"Motor": 0}, {"Motor": 0})
    assert first_divergence(legacy, target, seal_in_map) == {
        "scan": 1, "tag": "O:2/0", "legacy": 1, "target": 0, "rung": None,
    }


def test_same_scan_two_differences_alphabetically_first_tag_wins():
    legacy = trace({"O:2/0": 1, "O:2/1": 1})
    target = trace({"Motor": 0, "Lamp": 0})
    assert first_divergence(legacy, target, MAP)["tag"] == "O:2/0"


def test_lowest_scan_wins():
    legacy = trace(*[{"O:2/0": 0, "O:2/1": 0}] * 3, {"O:2/0": 1, "O:2/1": 0})
    target = trace(*[{"Motor": 0, "Lamp": 0}] * 2, {"Motor": 0, "Lamp": 1},
                   {"Motor": 0, "Lamp": 0})
    assert first_divergence(legacy, target, MAP) == {
        "scan": 3, "tag": "O:2/1", "legacy": 0, "target": 1, "rung": None,
    }


# Swapped-output-tag bug: the target writes a different tag than the mapped one.
def test_target_never_writes_mapped_output():
    seal_in_map = [obs("O:2/0", "Motor")]
    legacy = trace({"O:2/0": 1})
    target = trace({"Lamp": 1})
    with pytest.raises(ComparisonError) as err:
        first_divergence(legacy, target, seal_in_map)
    assert str(err.value) == "MISSING_OBSERVABLE: target never writes Motor (mapped from O:2/0)"


def test_legacy_never_writes_mapped_output():
    with pytest.raises(ComparisonError) as err:
        first_divergence(trace({"O:2/1": 1}), trace({"Motor": 1}), [obs("O:2/0", "Motor")])
    assert str(err.value) == "MISSING_OBSERVABLE: legacy never writes O:2/0 (mapped to Motor)"


def test_observable_missing_on_one_scan():
    seal_in_map = [obs("O:2/0", "Motor")]
    with pytest.raises(ComparisonError) as err:
        first_divergence(trace({"O:2/0": 1}, {"O:2/0": 1}),
                         trace({"Motor": 1}, {}), seal_in_map)
    assert str(err.value) == (
        "MISSING_OBSERVABLE: target trace has no Motor at scan 2 (mapped from O:2/0)"
    )


def test_scan_mismatch():
    seal_in_map = [obs("O:2/0", "Motor")]
    with pytest.raises(ComparisonError) as err:
        first_divergence(trace({"O:2/0": 1}, {"O:2/0": 1}), trace({"Motor": 1}), seal_in_map)
    assert err.value.code == "TRACE_SCAN_MISMATCH"


@pytest.mark.parametrize("tag_map", [
    [obs("O:2/0", "Motor"), obs("O:2/0", "Lamp")],   # one legacy -> two targets
    [obs("O:2/0", "Motor"), obs("O:2/1", "Motor")],  # two legacy -> one target
])
def test_ambiguous_mapping(tag_map):
    with pytest.raises(ComparisonError) as err:
        first_divergence(trace({"O:2/0": 1, "O:2/1": 1}),
                         trace({"Motor": 1, "Lamp": 1}), tag_map)
    assert err.value.code == "AMBIGUOUS_MAPPING"


def test_no_observable_mappings_is_not_a_pass():
    only_inputs = [m for m in MAP if m.kind == "input"]
    with pytest.raises(ComparisonError) as err:
        first_divergence(trace({"O:2/0": 1}), trace({"Motor": 1}), only_inputs)
    assert err.value.code == "NO_OBSERVABLE_MAPPINGS"


def test_empty_traces_are_not_a_pass():
    with pytest.raises(ComparisonError) as err:
        first_divergence([], [], MAP)
    assert err.value.code == "EMPTY_TRACE"


SEAL = [obs("O:2/0", "Motor")]
LEGACY_20 = trace(*[{"O:2/0": 1}] * 20)
TARGET_20 = trace(*[{"Motor": 0}] * 20)


@pytest.mark.parametrize("scan, start, end", [(2, 1, 7), (10, 5, 15), (20, 15, 20)])
def test_trace_window_bounds(scan, start, end):
    window = trace_window(LEGACY_20, TARGET_20, SEAL, scan)
    assert (window["start_scan"], window["end_scan"]) == (start, end)
    assert [e.scan for e in window["legacy"]] == list(range(start, end + 1))
    assert [e.scan for e in window["target"]] == list(range(start, end + 1))


def test_trace_window_uses_canonical_names():
    window = trace_window(LEGACY_20, TARGET_20, SEAL, 1)
    assert window["target"][0] == TraceEntry(scan=1, observables={"O:2/0": 0})


def test_matching_trace_window_is_capped():
    assert MATCHING_WINDOW == 30
    long_legacy = trace(*[{"O:2/0": 1}] * 40)
    long_target = trace(*[{"Motor": 1}] * 40)
    window = matching_trace_window(long_legacy, long_target, SEAL)
    assert window["start_scan"] == 1
    assert window["end_scan"] == 30
    assert len(window["legacy"]) == 30
    assert window["target"][0] == TraceEntry(scan=1, observables={"O:2/0": 1})
