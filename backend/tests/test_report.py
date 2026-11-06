"""verify() tests with a stand-in engine. The stand-in run() has Arnav's exact
signature, run(program_ir, input_events, profile, dt_ms) -> Trace, and returns
hand-written traces per profile, so these tests check orchestration only."""
import pytest

from backend.app import report
from backend.app.ir import InputEvent, TagMapping, TraceEntry, VerifyConfig
from backend.app.parser import parse

LEGACY = parse("SOR BST XIC I:1/0 NXB XIC O:2/0 BND XIO I:1/1 OTE O:2/0 EOR")
TARGET = parse("SOR BST XIC Start NXB XIC Motor BND XIO Stop OTE Motor EOR")


def row(legacy, target, kind, evidence="user-confirmed"):
    rule = "INPUT_MAP_V1" if kind == "input" else "OUTPUT_MAP_V1"
    return TagMapping(legacy, target, kind, rule, evidence)


MAP = [
    row("I:1/0", "Start", "input"),
    row("I:1/1", "Stop", "input"),
    row("O:2/0", "Motor", "observable"),
]
EVENTS = [
    InputEvent(0, "I:1/0", 1), InputEvent(0, "I:1/1", 0),
    InputEvent(2, "I:1/0", 0),
]
CONFIG = VerifyConfig(seed=7, scenarios=1, scans=2, dt_ms=10)


def trace(tag, *values):
    return [TraceEntry(scan=i, observables={tag: v}) for i, v in enumerate(values, start=1)]


class FakeNeedsReview(Exception):
    pass


class FakeEngine:
    """Stand-in for Arnav's run() and generate_scenarios()."""

    def __init__(self, traces=None, fail_profile=None, generated=None):
        self.traces = traces or {}
        self.fail_profile = fail_profile
        self.generated = generated
        self.calls = []        # (profile, input_events, dt_ms)
        self.gen_calls = []

    def run(self, program_ir, input_events, profile, dt_ms):
        self.calls.append((profile, input_events, dt_ms))
        if profile == self.fail_profile:
            raise FakeNeedsReview("UNVALIDATED_TON_S6: timer model is not approved yet")
        return self.traces[profile]

    def generate_scenarios(self, program_ir, *, seed, scenarios, scans, input_tags=None):
        self.gen_calls.append((seed, scenarios, scans))
        return self.generated


@pytest.fixture
def use_engine(monkeypatch):
    def install(engine):
        monkeypatch.setattr(report, "_engine",
                            lambda: (engine.run, FakeNeedsReview, engine.generate_scenarios))
        return engine
    return install


def correct_engine():
    return FakeEngine({"slc_subset_v1": trace("O:2/0", 1, 1),
                       "logix_subset_v1": trace("Motor", 1, 1)})


def test_report_has_exactly_the_contract_keys(use_engine):
    use_engine(correct_engine())
    assert set(report.verify(LEGACY, TARGET, MAP, CONFIG, input_scenarios=[EVENTS])) == {
        "status", "coverage", "assumptions", "first_divergence", "mapping_evidence",
        "counterexample", "rules_used", "warnings", "trace_window",
    }


def test_flipped_stop_is_different_at_scan_1(use_engine):
    engine = use_engine(FakeEngine({"slc_subset_v1": trace("O:2/0", 1, 1),
                                    "logix_subset_v1": trace("Motor", 0, 0)}))
    result = report.verify(LEGACY, TARGET, MAP, CONFIG, input_scenarios=[EVENTS])
    assert result == {
        "status": "different",
        "coverage": {"scenarios": 1, "scans": 2, "seed": 7},
        "assumptions": {"dt_ms": 10, "executed_scan_index": "1_based",
                        "profiles": ["slc_subset_v1", "logix_subset_v1"]},
        "first_divergence": {"scan": 1, "tag": "O:2/0", "legacy": 1, "target": 0, "rung": 1},
        "mapping_evidence": [
            {"legacy_tag": "O:2/0", "target_tag": "Motor", "rule": "OUTPUT_MAP_V1"},
            {"legacy_tag": "I:1/0", "target_tag": "Start", "rule": "INPUT_MAP_V1"},
            {"legacy_tag": "I:1/1", "target_tag": "Stop", "rule": "INPUT_MAP_V1"},
        ],
        "counterexample": [{"scan": 0, "tag": "I:1/0", "value": 1},
                           {"scan": 0, "tag": "I:1/1", "value": 0}],
        "rules_used": [],
        "warnings": [],
        "trace_window": {
            "start_scan": 1, "end_scan": 2,
            "legacy": [{"scan": 1, "observables": {"O:2/0": 1}},
                       {"scan": 2, "observables": {"O:2/0": 1}}],
            "target": [{"scan": 1, "observables": {"O:2/0": 0}},
                       {"scan": 2, "observables": {"O:2/0": 0}}],
        },
    }
    # Both programs got the same events; the target got them under target names.
    assert engine.calls == [
        ("slc_subset_v1", EVENTS, 10),
        ("logix_subset_v1", [InputEvent(0, "Start", 1), InputEvent(0, "Stop", 0),
                             InputEvent(2, "Start", 0)], 10),
    ]


def test_correct_target_is_no_difference_observed(use_engine):
    use_engine(correct_engine())
    result = report.verify(LEGACY, TARGET, MAP, CONFIG, input_scenarios=[EVENTS])
    assert result["status"] == "no_difference_observed"
    assert result["first_divergence"] is None
    assert result["trace_window"] is None
    assert result["counterexample"] == []
    assert result["warnings"] == []
    assert result["coverage"] == {"scenarios": 1, "scans": 2, "seed": 7}
    assert len(result["mapping_evidence"]) == 3


LONG = VerifyConfig(seed=7, scenarios=1, scans=300, dt_ms=10)
HORIZON_1_OF_1 = ("SCAN_HORIZON: 1 of 1 scenarios ran fewer than the 300 requested "
                  "scans (run() stops at the last input event)")


def test_passed_in_scenarios_have_no_horizon_check_by_default(use_engine):
    use_engine(correct_engine())
    result = report.verify(LEGACY, TARGET, MAP, LONG, input_scenarios=[EVENTS])
    assert result["status"] == "no_difference_observed"
    assert result["coverage"]["scans"] == 2
    assert result["warnings"] == []


def test_passed_in_scenarios_horizon_check_on_request(use_engine):
    use_engine(correct_engine())
    result = report.verify(LEGACY, TARGET, MAP, LONG, input_scenarios=[EVENTS],
                           check_horizon=True)
    assert result["coverage"]["scans"] == 2
    assert result["warnings"] == [HORIZON_1_OF_1]


def test_generated_scenarios_that_ran_short_warn(use_engine):
    engine = use_engine(correct_engine())
    engine.generated = [EVENTS]
    result = report.verify(LEGACY, TARGET, MAP, LONG)
    assert result["warnings"] == [HORIZON_1_OF_1]


def test_none_scenarios_uses_generator_with_config(use_engine):
    engine = use_engine(correct_engine())
    engine.generated = [EVENTS, EVENTS]
    result = report.verify(LEGACY, TARGET, MAP, CONFIG)
    assert engine.gen_calls == [(7, 1, 2)]
    assert result["coverage"] == {"scenarios": 2, "scans": 4, "seed": 7}


def test_no_scenarios_is_needs_review(use_engine):
    use_engine(correct_engine())
    result = report.verify(LEGACY, TARGET, MAP, CONFIG, input_scenarios=[])
    assert result["status"] == "needs_review"
    assert result["warnings"] == ["NO_SCENARIOS: there are no input scenarios to run"]


def test_unconfirmed_row_is_needs_review_and_nothing_runs(use_engine):
    engine = use_engine(correct_engine())
    tag_map = MAP[:2] + [row("O:2/0", "Motor", "observable", evidence="ai-proposed")]
    result = report.verify(LEGACY, TARGET, tag_map, CONFIG, input_scenarios=[EVENTS])
    assert result["status"] == "needs_review"
    assert result["warnings"] == [
        "UNCONFIRMED_MAPPING: O:2/0 -> Motor has evidence 'ai-proposed'"
    ]
    assert engine.calls == []


def test_evidence_prefix_counts_as_confirmed(use_engine):
    use_engine(correct_engine())
    tag_map = MAP[:2] + [row("O:2/0", "Motor", "observable", "user-confirmed (Sadia)")]
    assert report.verify(LEGACY, TARGET, tag_map, CONFIG,
                         input_scenarios=[EVENTS])["status"] == "no_difference_observed"


def test_missing_input_mapping_is_needs_review(use_engine):
    use_engine(correct_engine())
    result = report.verify(LEGACY, TARGET, [MAP[0], MAP[2]], CONFIG, input_scenarios=[EVENTS])
    assert result["status"] == "needs_review"
    assert result["warnings"] == [
        "UNMAPPED_INPUT: legacy reads I:1/1 with no input mapping",
        "UNMAPPED_INPUT: target reads Stop with no input mapping",
    ]


def test_swapped_output_tag_is_needs_review_with_missing_observable(use_engine):
    engine = use_engine(correct_engine())
    swapped = parse("SOR BST XIC Start NXB XIC Motor BND XIO Stop OTE Lamp EOR")
    result = report.verify(LEGACY, swapped, MAP, CONFIG, input_scenarios=[EVENTS])
    assert result["status"] == "needs_review"
    assert result["warnings"] == [
        # The seal-in contact XIC Motor now reads a tag nothing writes.
        "UNMAPPED_INPUT: target reads Motor with no input mapping",
        "MISSING_OBSERVABLE: target never writes Motor (mapped from O:2/0)",
        "UNMAPPED_OUTPUT: target writes Lamp with no observable mapping",
    ]
    assert engine.calls == []


def test_engine_needs_review_names_the_program(use_engine):
    use_engine(FakeEngine({"slc_subset_v1": trace("O:2/0", 1)},
                          fail_profile="logix_subset_v1"))
    result = report.verify(LEGACY, TARGET, MAP, CONFIG, input_scenarios=[EVENTS])
    assert result["status"] == "needs_review"
    assert result["warnings"] == [
        "UNVALIDATED_TON_S6: timer model is not approved yet (target program)"
    ]
    assert result["coverage"]["scenarios"] == 0


def test_unmapped_event_tag_is_needs_review(use_engine):
    use_engine(correct_engine())
    events = EVENTS + [InputEvent(1, "I:1/7", 1)]
    result = report.verify(LEGACY, TARGET, MAP, CONFIG, input_scenarios=[events])
    assert result["status"] == "needs_review"
    assert result["warnings"] == [
        "UNMAPPED_INPUT_EVENT: scenario sets I:1/7 at scan 1 but it has no input mapping"
    ]


def test_rung_is_null_when_two_legacy_rungs_write_the_tag(use_engine):
    legacy = parse("SOR XIC I:1/0 OTE O:2/0 EOR\nSOR XIC I:1/1 OTE O:2/0 EOR")
    target = parse("SOR XIC Start OTE Motor EOR\nSOR XIC Stop OTE Motor EOR")
    use_engine(FakeEngine({"slc_subset_v1": trace("O:2/0", 1),
                           "logix_subset_v1": trace("Motor", 0)}))
    result = report.verify(legacy, target, MAP, CONFIG, input_scenarios=[EVENTS])
    assert result["first_divergence"]["rung"] is None


def test_ui_confirmed_evidence_string_counts_as_confirmed(use_engine):
    use_engine(correct_engine())
    tag_map = [TagMapping(r.legacy_tag, r.target_tag, r.kind, r.rule,
                          f"user-confirmed · proposed: {r.rule}") for r in MAP]
    assert report.check_mappings(LEGACY, TARGET, tag_map) == []
    assert report.verify(LEGACY, TARGET, tag_map, CONFIG,
                         input_scenarios=[EVENTS])["status"] == "no_difference_observed"


def test_proposed_evidence_is_not_confirmed():
    tag_map = MAP[:2] + [row("O:2/0", "Motor", "observable", "proposed: OUTPUT_MAP_V1")]
    assert report.check_mappings(LEGACY, TARGET, tag_map) == [
        "UNCONFIRMED_MAPPING: O:2/0 -> Motor has evidence 'proposed: OUTPUT_MAP_V1'"
    ]


def test_unresolved_report():
    result = report.unresolved_report(
        CONFIG, ["UNRESOLVED_INSTRUCTION: rung 1: TON T4:0 is not converted yet"])
    assert result["status"] == "needs_review"
    assert result["warnings"] == ["UNRESOLVED_INSTRUCTION: rung 1: TON T4:0 is not converted yet"]
    assert result["first_divergence"] is None


def test_with_rules_used_returns_a_copy():
    original = report.unresolved_report(CONFIG, [])
    filled = report.with_rules_used(original, ["INPUT_MAP_V1", "OUTPUT_MAP_V1"])
    assert filled["rules_used"] == ["INPUT_MAP_V1", "OUTPUT_MAP_V1"]
    assert original["rules_used"] == []
    assert {k: v for k, v in filled.items() if k != "rules_used"} == \
           {k: v for k, v in original.items() if k != "rules_used"}


def test_invalid_mapping_kind_is_flagged():
    bad = MAP + [TagMapping("O:2/1", "Lamp", "output", "OUTPUT_MAP_V1", "user-confirmed")]
    assert report.check_mappings(LEGACY, TARGET, bad) == [
        "INVALID_MAPPING_KIND: O:2/1 -> Lamp has kind 'output' (expected input or observable)"
    ]


def test_parse_failure_report():
    from backend.app.ir import ParseDiagnostic
    result = report.parse_failure_report(
        CONFIG, [ParseDiagnostic(3, "UNSUPPORTED_OPCODE", "unsupported instruction 'ADD' at column 15")], [],
    )
    assert result["status"] == "needs_review"
    assert result["warnings"] == [
        "UNSUPPORTED_OPCODE: legacy line 3: unsupported instruction 'ADD' at column 15"
    ]
    assert result["coverage"] == {"scenarios": 0, "scans": 0, "seed": 7}


def test_timer_bits_need_explicit_mappings():
    legacy = parse("SOR XIC I:1/0 TON T4:0 0.01 50 0 EOR")
    target = parse("SOR XIC Start TON Timer0 500 0 EOR")
    warnings = report.check_mappings(legacy, target, [MAP[0]])
    assert warnings == [
        "UNMAPPED_OUTPUT: legacy writes T4:0/DN with no observable mapping",
        "UNMAPPED_OUTPUT: legacy writes T4:0/TT with no observable mapping",
        "UNMAPPED_OUTPUT: target writes Timer0.DN with no observable mapping",
        "UNMAPPED_OUTPUT: target writes Timer0.TT with no observable mapping",
    ]
