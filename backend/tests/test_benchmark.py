import json
from pathlib import Path

from backend.app import cli
from backend.app.benchmark import program_cases, summary_line
from backend.app.ir import VerifyConfig

LEGACY = "SOR BST XIC I:1/0 NXB XIC O:2/0 BND XIO I:1/1 OTE O:2/0 EOR\n"
CORRECT = "SOR BST XIC Start NXB XIC Motor BND XIO Stop OTE Motor EOR\n"
FLIPPED = "SOR BST XIC Start NXB XIC Motor BND XIC Stop OTE Motor EOR\n"


def row(legacy, target, kind):
    rule = "INPUT_MAP_V1" if kind == "input" else "OUTPUT_MAP_V1"
    return {"legacy_tag": legacy, "target_tag": target, "kind": kind,
            "rule": rule, "evidence": "user-confirmed"}


TAG_MAP = json.dumps([row("I:1/0", "Start", "input"), row("I:1/1", "Stop", "input"),
                      row("O:2/0", "Motor", "observable")])
INPUTS = json.dumps([{"scan": 0, "tag": "I:1/0", "value": 1},
                     {"scan": 0, "tag": "I:1/1", "value": 0},
                     {"scan": 2, "tag": "I:1/0", "value": 0}])
CONFIG = VerifyConfig(scans=10)


def files(**extra):
    base = {"legacy.txt": LEGACY, "tag_map.json": TAG_MAP, "inputs.json": INPUTS}
    return {**base, **extra}


def fake_clock():
    ticks = iter([1.0, 1.25, 2.0, 2.5])
    return lambda: next(ticks)


def test_one_row_per_target_sorted_with_status_divergence_and_time():
    rows = program_cases("seal_in", files(**{"target_correct.txt": CORRECT,
                                             "target_bug.txt": FLIPPED}),
                         CONFIG, clock=fake_clock())
    assert rows == [
        {"program": "seal_in", "target": "target_bug.txt", "status": "different",
         "first_divergence": {"scan": 1, "tag": "O:2/0", "legacy": 1, "target": 0, "rung": 1},
         "coverage": {"scenarios": 1, "scans": 10, "seed": 42},
         "warning_codes": [], "seconds": 0.25, "fixture_error": None},
        {"program": "seal_in", "target": "target_correct.txt",
         "status": "no_difference_observed", "first_divergence": None,
         "coverage": {"scenarios": 1, "scans": 10, "seed": 42},
         "warning_codes": [], "seconds": 0.5, "fixture_error": None},
    ]


def test_answer_key_and_other_files_are_ignored():
    with_key = program_cases("p", files(**{"target.txt": FLIPPED,
                                           "expected.json": "not even json",
                                           "notes.md": "x"}), CONFIG, clock=fake_clock())
    without = program_cases("p", files(**{"target.txt": FLIPPED}), CONFIG, clock=fake_clock())
    assert with_key == without


def test_warning_codes_are_the_part_before_the_colon():
    rows = program_cases("p", files(**{"target.txt": "SOR XIC Start ADD N7:0 OTE Motor EOR\n"}),
                         CONFIG, clock=fake_clock())
    assert rows[0]["status"] == "needs_review"
    assert rows[0]["warning_codes"] == ["UNSUPPORTED_OPCODE"]


def test_missing_inputs_uses_generated_scenarios():
    f = files(**{"target.txt": CORRECT})
    del f["inputs.json"]
    rows = program_cases("p", f, VerifyConfig(scenarios=3, scans=10), clock=fake_clock())
    assert rows[0]["status"] == "no_difference_observed"
    assert rows[0]["coverage"] == {"scenarios": 3, "scans": 30, "seed": 42}


def error_row(program, target, message):
    return {"program": program, "target": target, "status": None,
            "first_divergence": None, "coverage": None, "warning_codes": [],
            "seconds": None, "fixture_error": message}


def test_fixture_errors_are_not_statuses():
    def without(name, **extra):
        f = files(**extra)
        del f[name]
        return f
    assert program_cases("p", files(), CONFIG) == [
        error_row("p", None, "no target.txt or target_*.txt")]
    assert program_cases("p", without("legacy.txt", **{"target.txt": CORRECT}), CONFIG) == [
        error_row("p", "target.txt", "missing legacy.txt")]
    assert program_cases("p", without("tag_map.json", **{"target.txt": CORRECT}), CONFIG) == [
        error_row("p", "target.txt", "missing tag_map.json")]
    assert program_cases("p", files(**{"target.txt": CORRECT, "inputs.json": None}), CONFIG) == [
        error_row("p", "target.txt", "inputs.json is not readable UTF-8 text")]
    bad = program_cases("p", files(**{"target.txt": CORRECT, "tag_map.json": "[{"}), CONFIG)
    assert bad[0]["status"] is None
    assert bad[0]["fixture_error"].startswith("tag_map.json is not valid JSON")
    wrong_keys = program_cases("p", files(**{"target.txt": CORRECT, "tag_map.json": "[{}]"}),
                               CONFIG)
    assert wrong_keys[0]["fixture_error"].startswith(
        "tag map entry 0 must have exactly the keys")


def test_unreadable_target_is_an_error_row_others_still_run():
    rows = program_cases("p", files(**{"target_a.txt": None, "target_b.txt": CORRECT}),
                         CONFIG, clock=lambda: 0.0)
    assert rows[0] == error_row("p", "target_a.txt", "target_a.txt is not readable UTF-8 text")
    assert rows[1]["status"] == "no_difference_observed"


def test_summary_line():
    rows = program_cases("seal_in", files(**{"target_bug.txt": FLIPPED}), CONFIG,
                         clock=fake_clock())
    assert summary_line(rows[0]).split() == [
        "seal_in/target_bug.txt", "different", "scan", "1", "O:2/0", "L1", "T0", "0.250s"]
    assert summary_line(error_row("p", None, "missing legacy.txt")).split() == [
        "p/-", "fixture_error", "missing", "legacy.txt"]


# ---------- CLI: folders in, results file out ----------

def write_program(folder: Path, **texts):
    folder.mkdir(parents=True)
    for name, text in files(**texts).items():
        (folder / name).write_text(text, encoding="utf-8")


def test_cli_benchmark_walks_suite_in_sorted_order(tmp_path, capsys):
    suite = tmp_path / "suite"
    write_program(suite / "b_seal", **{"target.txt": CORRECT})
    write_program(suite / "a_group" / "flipped", **{"target.txt": FLIPPED})
    (suite / "c_empty").mkdir()
    out = tmp_path / "results.json"

    code = cli.main(["benchmark", str(suite), "--scans", "10", "--out", str(out)])
    assert code == 0
    result = json.loads(out.read_text(encoding="utf-8"))
    assert result["suite"] == "suite"
    assert result["config"] == {"seed": 42, "scenarios": 200, "scans": 10, "dt_ms": 10}
    assert set(result) == {"suite", "commit", "dirty", "run_at", "config", "cases"}
    assert [(c["program"], c["target"], c["status"]) for c in result["cases"]] == [
        ("a_group/flipped", "target.txt", "different"),
        ("b_seal", "target.txt", "no_difference_observed"),
        ("c_empty", None, None),
    ]
    assert result["cases"][2]["fixture_error"] == "no target.txt or target_*.txt"
    printed = capsys.readouterr().out.splitlines()
    assert printed[0].startswith("a_group/flipped/target.txt")
    assert printed[-1].startswith("3 cases, commit ")


def test_cli_benchmark_is_deterministic_apart_from_time(tmp_path):
    suite = tmp_path / "suite"
    write_program(suite / "seal", **{"target_ok.txt": CORRECT, "target_bug.txt": FLIPPED})

    def once(name):
        out = tmp_path / name
        assert cli.main(["benchmark", str(suite), "--scans", "10", "--out", str(out)]) == 0
        result = json.loads(out.read_text(encoding="utf-8"))
        del result["run_at"]
        for case in result["cases"]:
            del case["seconds"]
        return result
    assert once("r1.json") == once("r2.json")


def test_cli_benchmark_bad_suite_exits_2(tmp_path, capsys):
    assert cli.main(["benchmark", str(tmp_path / "nope")]) == 2
    assert capsys.readouterr().err.startswith("error: ")


def test_suite_inside_repo_is_refused_except_fixtures(tmp_path):
    repo = tmp_path / "repo"
    assert cli.suite_location_error(tmp_path / "hidden", repo) is None
    assert cli.suite_location_error(repo / "backend" / "tests" / "fixtures" / "practice",
                                    repo) is None
    assert "is inside the repo" in cli.suite_location_error(repo / "hidden", repo)
    assert "is inside the repo" in cli.suite_location_error(repo, repo)
