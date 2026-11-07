"""Thursday gate, end to end through the CLI with the real engine (no stand-ins).
These inline programs are placeholders; Sadia's fixture files replace them."""
import json
from pathlib import Path

import pytest

from backend.app import cli

LEGACY = "SOR BST XIC I:1/0 NXB XIC O:2/0 BND XIO I:1/1 OTE O:2/0 EOR\n"
TARGET_CORRECT = "SOR BST XIC Start NXB XIC Motor BND XIO Stop OTE Motor EOR\n"
TARGET_FLIPPED_STOP = "SOR BST XIC Start NXB XIC Motor BND XIC Stop OTE Motor EOR\n"


def mapping(legacy, target, kind, evidence="user-confirmed"):
    rule = "INPUT_MAP_V1" if kind == "input" else "OUTPUT_MAP_V1"
    return {"legacy_tag": legacy, "target_tag": target, "kind": kind,
            "rule": rule, "evidence": evidence}


TAG_MAP = [
    mapping("I:1/0", "Start", "input"),
    mapping("I:1/1", "Stop", "input"),
    mapping("O:2/0", "Motor", "observable"),
]
# Cheat sheet §6 trace: start, release start (sealed in), press stop, release stop.
INPUTS = [
    {"scan": 0, "tag": "I:1/0", "value": 1},
    {"scan": 0, "tag": "I:1/1", "value": 0},
    {"scan": 2, "tag": "I:1/0", "value": 0},
    {"scan": 3, "tag": "I:1/1", "value": 1},
    {"scan": 4, "tag": "I:1/1", "value": 0},
]


@pytest.fixture
def run_cli(tmp_path, capsys):
    def go(target_text, tag_map=TAG_MAP, legacy_text=LEGACY, inputs=INPUTS, extra=()):
        files = {
            "legacy.txt": legacy_text, "target.txt": target_text,
            "tag_map.json": json.dumps(tag_map), "inputs.json": json.dumps(inputs),
        }
        for name, text in files.items():
            (tmp_path / name).write_text(text, encoding="utf-8")
        code = cli.main([
            "verify", "--legacy", str(tmp_path / "legacy.txt"),
            "--target", str(tmp_path / "target.txt"),
            "--map", str(tmp_path / "tag_map.json"),
            "--inputs", str(tmp_path / "inputs.json"), *extra,
        ])
        out = capsys.readouterr()
        return code, (json.loads(out.out) if code == 0 else out.err)
    return go


def test_flipped_stop_is_different_at_scan_1(run_cli):
    code, report = run_cli(TARGET_FLIPPED_STOP)
    assert code == 0
    assert report["status"] == "different"
    assert report["first_divergence"] == {
        "scan": 1, "tag": "O:2/0", "legacy": 1, "target": 0, "rung": 1,
    }
    assert report["counterexample"] == [
        {"scan": 0, "tag": "I:1/0", "value": 1},
        {"scan": 0, "tag": "I:1/1", "value": 0},
    ]
    assert report["warnings"] == []


def test_correct_target_is_no_difference_observed(run_cli):
    code, report = run_cli(TARGET_CORRECT)
    assert code == 0
    assert report["status"] == "no_difference_observed"
    assert report["first_divergence"] is None
    assert report["coverage"] == {"scenarios": 1, "scans": 300, "seed": 42}
    assert report["warnings"] == []


def test_scans_flag_sets_scans_per_scenario(run_cli):
    code, report = run_cli(TARGET_CORRECT, extra=["--scans", "4"])
    assert report["status"] == "no_difference_observed"
    assert report["coverage"]["scans"] == 4
    assert report["warnings"] == []


def test_scans_shorter_than_last_input_event_is_needs_review(run_cli):
    code, report = run_cli(TARGET_CORRECT, extra=["--scans", "3"])
    assert report["status"] == "needs_review"
    assert report["warnings"] == [
        "INPUT_EVENT_OUTSIDE_HORIZON: explicit scans too short (legacy program)"
    ]


def test_unconfirmed_row_is_needs_review(run_cli):
    tag_map = TAG_MAP[:2] + [mapping("O:2/0", "Motor", "observable", evidence="ai-proposed")]
    code, report = run_cli(TARGET_CORRECT, tag_map=tag_map)
    assert code == 0
    assert report["status"] == "needs_review"
    assert report["warnings"] == [
        "UNCONFIRMED_MAPPING: O:2/0 -> Motor has evidence 'ai-proposed'"
    ]


def test_parse_error_is_needs_review(run_cli):
    code, report = run_cli("SOR XIC Start ADD N7:0 OTE Motor EOR\n")
    assert report["status"] == "needs_review"
    assert report["warnings"] == [
        "UNSUPPORTED_OPCODE: target line 1: unsupported instruction 'ADD' at column 15"
    ]


def test_converted_seal_in_matches_legacy_after_ui_confirmation():
    """convert() -> UI confirms every proposed row -> verify() with the real engine."""
    from backend.app.ir import InputEvent, TagMapping, VerifyConfig
    from backend.app.parser import parse
    from backend.app.report import verify, with_rules_used
    from backend.app.translator import convert

    legacy = parse(LEGACY)
    target, proposed, rule_ids, unresolved = convert(legacy)
    assert unresolved == []
    confirmed = [TagMapping(r.legacy_tag, r.target_tag, r.kind, r.rule,
                            f"user-confirmed · {r.evidence}") for r in proposed]
    events = [InputEvent(**e) for e in INPUTS]
    report = with_rules_used(
        verify(legacy, target, confirmed, VerifyConfig(), input_scenarios=[events]),
        rule_ids,
    )
    assert report["status"] == "no_difference_observed"
    assert report["coverage"]["scans"] == 300
    assert report["rules_used"] == ["INPUT_MAP_V1", "OUTPUT_MAP_V1"]


TIMER_LEGACY = ("SOR XIC I:1/0 TON T4:0 0.01 50 0 EOR\n"
                "SOR XIC T4:0/DN OTE O:2/0 EOR\n")


def verify_converted_timer(target_text=None):
    """convert() the timer program, confirm every proposed row, verify().
    target_text replaces the converted target (to seed a bug)."""
    from backend.app.ir import InputEvent, TagMapping, VerifyConfig
    from backend.app.parser import parse
    from backend.app.report import verify
    from backend.app.translator import convert

    legacy = parse(TIMER_LEGACY)
    target, proposed, _, unresolved = convert(legacy)
    assert unresolved == []
    if target_text is not None:
        target = parse(target_text)
    confirmed = [TagMapping(r.legacy_tag, r.target_tag, r.kind, r.rule,
                            f"user-confirmed · {r.evidence}") for r in proposed]
    return verify(legacy, target, confirmed, VerifyConfig(),
                  input_scenarios=[[InputEvent(0, "I:1/0", 1), InputEvent(80, "I:1/0", 0)]])


def test_converted_timer_program_is_no_difference_observed():
    report = verify_converted_timer()
    assert report["status"] == "no_difference_observed"
    assert report["coverage"]["scans"] == 300
    assert report["warnings"] == []


def test_unscaled_timer_preset_is_different_at_scan_6():
    """Target keeps the SLC preset 50 but counts in ms: done after 50 ms, not 500 ms."""
    report = verify_converted_timer("SOR XIC I_1_0 TON T4_0 50 0 EOR\n"
                                    "SOR XIC T4_0.DN OTE O_2_0 EOR\n")
    assert report["status"] == "different"
    assert report["first_divergence"] == {
        "scan": 6, "tag": "O:2/0", "legacy": 0, "target": 1, "rung": 2,
    }


AI_DEMO = Path(__file__).resolve().parents[2] / "demo" / "ai_conversion"


def run_ai_demo(capsys, target_file):
    code = cli.main([
        "verify", "--legacy", str(AI_DEMO / "legacy.txt"),
        "--target", str(AI_DEMO / target_file),
        "--map", str(AI_DEMO / "tag_map.json"),
        "--inputs", str(AI_DEMO / "inputs.json"),
    ])
    assert code == 0
    return json.loads(capsys.readouterr().out)


def test_ai_demo_conversion_is_no_difference_observed(capsys):
    report = run_ai_demo(capsys, "target_ai.txt")
    assert report["status"] == "no_difference_observed"
    assert report["coverage"] == {"scenarios": 3, "scans": 900, "seed": 42}
    assert report["warnings"] == []


def test_ai_demo_unscaled_preset_is_different_at_scan_21(capsys):
    report = run_ai_demo(capsys, "target_ai_unscaled_example.txt")
    assert report["status"] == "different"
    assert report["first_divergence"] == {
        "scan": 21, "tag": "O:2/0", "legacy": 0, "target": 1, "rung": 4,
    }
    # Divergent observable first, then every other observable in trace_window,
    # then the inputs used in the counterexample.
    assert [(m["legacy_tag"], m["target_tag"]) for m in report["mapping_evidence"]] == [
        ("O:2/0", "Conveyor_Motor"),
        ("O:2/1", "Run_Light"),
        ("O:2/2", "Warning_Horn"),
        ("T4:0/DN", "StartDelay.DN"),
        ("T4:0/TT", "StartDelay.TT"),
        ("I:1/0", "Start_PB"),
        ("I:1/1", "Stop_PB"),
    ]


def test_malformed_map_exits_2(run_cli):
    code, err = run_cli(TARGET_CORRECT, tag_map=[{"legacy_tag": "I:1/0"}])
    assert code == 2
    assert err.startswith("error: tag map entry 0 must have exactly the keys")


NEEDS_REVIEW_DEMO = Path(__file__).resolve().parents[2] / "demo" / "needs_review"


def test_needs_review_demo_reports_unsupported_osr(capsys):
    code = cli.main([
        "verify", "--legacy", str(NEEDS_REVIEW_DEMO / "legacy.txt"),
        "--target", str(NEEDS_REVIEW_DEMO / "target.txt"),
        "--map", str(NEEDS_REVIEW_DEMO / "tag_map.json"),
        "--inputs", str(NEEDS_REVIEW_DEMO / "inputs.json"),
    ])
    assert code == 0
    report = json.loads(capsys.readouterr().out)
    assert report["status"] == "needs_review"
    assert report["warnings"] == [
        "UNSUPPORTED_OPCODE: target line 1: unsupported instruction 'OSR' at column 46"
    ]
