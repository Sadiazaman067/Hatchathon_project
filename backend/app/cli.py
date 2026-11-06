"""Command line for LadderProof. Owner: Tami. The only file reading is here.

    python -m backend.app.cli verify --legacy L.txt --target T.txt --map tag_map.json --inputs inputs.json [--scans N]
    python -m backend.app.cli benchmark <suite_folder> [--out results.json] [--scans N]

--scans N sets how many scans every scenario runs (config.scans, default 300).

Prints the CONTRACT §8 report as JSON on stdout and exits 0, whatever the status.
Malformed input files (bad JSON or wrong fields) print an error on stderr and exit 2.

inputs.json is either one scenario (a list of events, CONTRACT §6) or several
scenarios (a list of such lists).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

from backend.app.ir import InputEvent, ParseDiagnostic, TagMapping, VerifyConfig
from backend.app.parser import parse
from backend.app.report import Report, parse_failure_report, verify

MAPPING_KEYS = {"legacy_tag", "target_tag", "kind", "rule", "evidence"}
EVENT_KEYS = {"scan", "tag", "value"}


class InputFileError(Exception):
    """A file that cannot be read as the documented format (exit code 2)."""


def _rows(data, keys: set[str], what: str) -> list[dict]:
    if not isinstance(data, list):
        raise InputFileError(f"{what} must be a JSON list")
    for i, item in enumerate(data):
        if not isinstance(item, dict) or set(item) != keys:
            raise InputFileError(
                f"{what} entry {i} must have exactly the keys {sorted(keys)}, got {item!r}"
            )
    return data


def load_tag_map(data) -> list[TagMapping]:
    return [TagMapping(**row) for row in _rows(data, MAPPING_KEYS, "tag map")]


def load_scenarios(data) -> list[list[InputEvent]]:
    """One scenario (list of events) or several (list of lists)."""
    if isinstance(data, list) and data and all(isinstance(s, list) for s in data):
        scenarios = data
    else:
        scenarios = [data]
    return [
        [InputEvent(**event) for event in _rows(s, EVENT_KEYS, f"inputs scenario {n}")]
        for n, s in enumerate(scenarios)
    ]


def run_verify(legacy_text: str, target_text: str, tag_map: list[TagMapping],
               scenarios: list[list[InputEvent]], config: VerifyConfig) -> Report:
    """Parse both programs and verify them. Pure: no file access."""
    legacy, target = parse(legacy_text), parse(target_text)
    legacy_diags = legacy if isinstance(legacy, list) else []
    target_diags = target if isinstance(target, list) else []
    if legacy_diags or target_diags:
        return parse_failure_report(config, legacy_diags, target_diags)
    return verify(legacy, target, tag_map, config, input_scenarios=scenarios)


def _positive_int(text: str) -> int:
    value = int(text)
    if value < 1:
        raise argparse.ArgumentTypeError(f"must be a positive integer, got {text}")
    return value


def _read_json(path: str):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise InputFileError(f"{path} is not valid JSON: {error}") from error


REPO_ROOT = Path(__file__).resolve().parents[2]
FIXTURES_DIR = REPO_ROOT / "backend" / "tests" / "fixtures"


def suite_location_error(suite: Path, repo_root: Path = REPO_ROOT) -> str | None:
    """Benchmark suites must live outside the repo, so hidden fixtures can't be
    committed by accident. The committed dev fixtures folder is the one exception."""
    suite, repo_root = suite.resolve(), repo_root.resolve()
    fixtures = repo_root / "backend" / "tests" / "fixtures"
    if suite.is_relative_to(repo_root) and not suite.is_relative_to(fixtures):
        return (f"suite folder {suite} is inside the repo; keep benchmark suites outside it "
                f"(only {fixtures} is allowed)")
    return None


def _read_folder(folder: Path) -> dict[str, str | None]:
    """File name -> UTF-8 text, or None when the file can't be decoded."""
    files: dict[str, str | None] = {}
    for path in folder.iterdir():
        if path.is_file():
            try:
                files[path.name] = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                files[path.name] = None
    return files


def _program_folders(suite: Path) -> list[Path]:
    """Every folder under suite (suite included) that holds fixture files, plus
    empty leaf folders (reported as fixture errors, never skipped). Sorted."""
    from backend.app.benchmark import is_program_folder
    found = []
    for folder in sorted([suite, *(p for p in suite.rglob("*") if p.is_dir())],
                         key=lambda p: p.relative_to(suite).as_posix()):
        names = [p.name for p in folder.iterdir()]
        has_subfolders = any(p.is_dir() for p in folder.iterdir())
        if is_program_folder(names) or not has_subfolders:
            found.append(folder)
    return found


def _git_commit() -> dict:
    def git(*args: str) -> str | None:
        try:
            done = subprocess.run(["git", *args], cwd=REPO_ROOT, capture_output=True,
                                  text=True, timeout=10)
        except (OSError, subprocess.SubprocessError):
            return None
        return done.stdout.strip() if done.returncode == 0 else None
    status = git("status", "--porcelain")
    return {"commit": git("rev-parse", "HEAD"),
            "dirty": None if status is None else status != ""}


def run_benchmark(suite: Path, config: VerifyConfig) -> dict:
    from backend.app.benchmark import program_cases
    cases = []
    for folder in _program_folders(suite):
        name = folder.relative_to(suite).as_posix()
        cases += program_cases("." if name == "." else name, _read_folder(folder), config)
    return {
        "suite": suite.name,
        **_git_commit(),
        "run_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "config": {"seed": config.seed, "scenarios": config.scenarios,
                   "scans": config.scans, "dt_ms": config.dt_ms},
        "cases": cases,
    }


def benchmark_main(args) -> int:
    from backend.app.benchmark import summary_line
    suite = Path(args.suite)
    if not suite.is_dir():
        print(f"error: {suite} is not a folder", file=sys.stderr)
        return 2
    problem = suite_location_error(suite)
    if problem:
        print(f"error: {problem}", file=sys.stderr)
        return 2
    result = run_benchmark(suite, VerifyConfig(scans=args.scans))
    for row in result["cases"]:
        print(summary_line(row))
    print(f"{len(result['cases'])} cases, commit {result['commit']}"
          f"{' (dirty)' if result['dirty'] else ''}")
    if args.out:
        Path(args.out).write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m backend.app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    verify_cmd = commands.add_parser("verify", help="compare a legacy and a target program")
    verify_cmd.add_argument("--legacy", required=True, help="legacy SLC mnemonic text file")
    verify_cmd.add_argument("--target", required=True, help="target Logix mnemonic text file")
    verify_cmd.add_argument("--map", required=True, help="confirmed tag map JSON (CONTRACT §6)")
    verify_cmd.add_argument("--inputs", required=True, help="input events JSON (CONTRACT §6)")
    verify_cmd.add_argument(
        "--scans", type=_positive_int, default=VerifyConfig.scans,
        help=f"scans per scenario (default {VerifyConfig.scans})",
    )
    bench_cmd = commands.add_parser("benchmark", help="run every case in a fixture suite")
    bench_cmd.add_argument("suite", help="folder of program folders (outside the repo)")
    bench_cmd.add_argument("--out", help="write the full results JSON here")
    bench_cmd.add_argument("--scans", type=_positive_int, default=VerifyConfig.scans,
                           help=f"scans per scenario (default {VerifyConfig.scans})")
    args = parser.parse_args(argv)
    if args.command == "benchmark":
        return benchmark_main(args)

    try:
        legacy_text = Path(args.legacy).read_text(encoding="utf-8")
        target_text = Path(args.target).read_text(encoding="utf-8")
        tag_map = load_tag_map(_read_json(args.map))
        scenarios = load_scenarios(_read_json(args.inputs))
    except (OSError, InputFileError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    report = run_verify(legacy_text, target_text, tag_map, scenarios,
                        VerifyConfig(scans=args.scans))
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
