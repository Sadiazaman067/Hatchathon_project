"""Command line for LadderProof. Owner: Tami. The only file reading is here.

    python -m backend.app.cli verify --legacy L.txt --target T.txt --map tag_map.json --inputs inputs.json

Prints the CONTRACT §8 report as JSON on stdout and exits 0, whatever the status.
Malformed input files (bad JSON or wrong fields) print an error on stderr and exit 2.

inputs.json is either one scenario (a list of events, CONTRACT §6) or several
scenarios (a list of such lists).
"""
from __future__ import annotations

import argparse
import json
import sys
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


def _read_json(path: str):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise InputFileError(f"{path} is not valid JSON: {error}") from error


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m backend.app.cli")
    commands = parser.add_subparsers(dest="command", required=True)
    verify_cmd = commands.add_parser("verify", help="compare a legacy and a target program")
    verify_cmd.add_argument("--legacy", required=True, help="legacy SLC mnemonic text file")
    verify_cmd.add_argument("--target", required=True, help="target Logix mnemonic text file")
    verify_cmd.add_argument("--map", required=True, help="confirmed tag map JSON (CONTRACT §6)")
    verify_cmd.add_argument("--inputs", required=True, help="input events JSON (CONTRACT §6)")
    args = parser.parse_args(argv)

    try:
        legacy_text = Path(args.legacy).read_text(encoding="utf-8")
        target_text = Path(args.target).read_text(encoding="utf-8")
        tag_map = load_tag_map(_read_json(args.map))
        scenarios = load_scenarios(_read_json(args.inputs))
    except (OSError, InputFileError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    report = run_verify(legacy_text, target_text, tag_map, scenarios, VerifyConfig())
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
