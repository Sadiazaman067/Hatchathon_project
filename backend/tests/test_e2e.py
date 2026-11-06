"""Thursday gate, end to end through the CLI with the real engine (no stand-ins).
These inline programs are placeholders; Sadia's fixture files replace them."""
import json

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
    assert report["coverage"] == {"scenarios": 1, "scans": 4, "seed": 42}
    assert report["warnings"] == []


def test_scans_flag_turns_on_horizon_check(run_cli):
    code, report = run_cli(TARGET_CORRECT, extra=["--scans", "300"])
    assert report["status"] == "no_difference_observed"
    assert report["coverage"]["scans"] == 4
    assert report["warnings"] == [
        "SCAN_HORIZON: 1 of 1 scenarios ran fewer than the 300 requested scans "
        "(run() stops at the last input event)"
    ]


def test_scans_flag_met_gives_no_warning(run_cli):
    code, report = run_cli(TARGET_CORRECT, extra=["--scans", "4"])
    assert report["warnings"] == []


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
    assert report["coverage"]["scans"] == 4
    assert report["rules_used"] == ["INPUT_MAP_V1", "OUTPUT_MAP_V1"]


def test_converted_timer_program_is_needs_review_until_timer_gate():
    """convert() handles TON, but the engine refuses timers until the S6 gate
    passes. When it passes, this should become no_difference_observed."""
    from backend.app.ir import InputEvent, TagMapping, VerifyConfig
    from backend.app.parser import parse
    from backend.app.report import verify
    from backend.app.translator import convert

    legacy = parse("SOR XIC I:1/0 TON T4:0 0.01 50 0 EOR\n"
                   "SOR XIC T4:0/DN OTE O:2/0 EOR\n")
    target, proposed, _, unresolved = convert(legacy)
    assert unresolved == []
    confirmed = [TagMapping(r.legacy_tag, r.target_tag, r.kind, r.rule,
                            f"user-confirmed · {r.evidence}") for r in proposed]
    report = verify(legacy, target, confirmed, VerifyConfig(),
                    input_scenarios=[[InputEvent(0, "I:1/0", 1), InputEvent(80, "I:1/0", 0)]])
    assert report["status"] == "needs_review"
    assert report["warnings"] == [
        "UNVALIDATED_TON_S6: timer model is not approved yet (legacy program)"
    ]


def test_malformed_map_exits_2(run_cli):
    code, err = run_cli(TARGET_CORRECT, tag_map=[{"legacy_tag": "I:1/0"}])
    assert code == 2
    assert err.startswith("error: tag map entry 0 must have exactly the keys")
