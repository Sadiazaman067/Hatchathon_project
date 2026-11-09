"""Demo sample programs used by frontend-v2. Real engine, same inputs."""
import json
from pathlib import Path

from backend.app.cli import load_scenarios, load_tag_map, run_verify
from backend.app.ir import VerifyConfig

ROOT = Path(__file__).parent / "fixtures" / "demo_samples"
CONFIG = VerifyConfig(seed=42, scenarios=1, scans=30, dt_ms=10)


def _verify(folder: str):
    tag_map = load_tag_map(json.loads((ROOT / "tag_map.json").read_text(encoding="utf-8")))
    scenarios = load_scenarios(json.loads((ROOT / "inputs.json").read_text(encoding="utf-8")))
    base = ROOT / folder
    return run_verify(
        (base / "legacy.txt").read_text(encoding="utf-8"),
        (base / "target.txt").read_text(encoding="utf-8"),
        tag_map,
        scenarios,
        CONFIG,
    )


def test_match_sample_is_no_difference_with_clip():
    report = _verify("match")
    assert report["status"] == "no_difference_observed"
    assert report["first_divergence"] is None
    assert report["trace_window"]["start_scan"] == 1
    assert report["trace_window"]["end_scan"] == 30
    assert report["trace_window"]["legacy"][20]["observables"]["O:2/0"] == 0
    assert report["trace_window"]["target"][20]["observables"]["O:2/0"] == 0


def test_dropped_stop_differs_at_scan_21():
    report = _verify("dropped_stop")
    assert report["status"] == "different"
    assert report["first_divergence"] == {
        "scan": 21, "tag": "O:2/0", "legacy": 0, "target": 1, "rung": 1,
    }
    window = report["trace_window"]
    assert window["start_scan"] == 16
    assert window["end_scan"] == 26


def test_osr_sample_is_needs_review():
    report = _verify("unsupported_osr")
    assert report["status"] == "needs_review"
    assert report["first_divergence"] is None
    assert report["trace_window"] is None
    assert any("OSR" in w for w in report["warnings"])
