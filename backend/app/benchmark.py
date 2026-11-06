"""Benchmark runner core. Owner: Tami. Pure: no file access (cli.py reads the folders).

A suite is a folder of program folders. A program folder holds:
    legacy.txt, tag_map.json, inputs.json (optional), and one or more targets:
    target.txt and/or target_<name>.txt. Each target is one benchmark case.

The runner records what LadderProof reported, per case: status, first divergence,
coverage, warning codes and seconds taken. It never reads an answer key
(expected.json and anything else is ignored) and never decides "caught" or "missed";
scoring against the answer key happens outside this code.

A folder that cannot be read as fixtures gets `fixture_error` and `status: None`.
It is never turned into one of the three statuses.
"""
from __future__ import annotations

import json
import time
from typing import Callable, TypedDict

from backend.app.cli import InputFileError, load_scenarios, load_tag_map, run_verify
from backend.app.ir import VerifyConfig
from backend.app.report import Divergence

FIXTURE_FILES = ("legacy.txt", "tag_map.json", "inputs.json")


class CaseResult(TypedDict):
    program: str
    target: str | None
    status: str | None
    first_divergence: Divergence | None
    coverage: dict | None
    warning_codes: list[str]
    seconds: float | None
    fixture_error: str | None


def is_target_file(name: str) -> bool:
    return name == "target.txt" or (name.startswith("target_") and name.endswith(".txt"))


def is_program_folder(names: list[str]) -> bool:
    """A folder with any fixture file or target file is a program folder."""
    return any(n in FIXTURE_FILES or is_target_file(n) for n in names)


def warning_code(warning: str) -> str:
    return warning.split(":", 1)[0]


def fixture_error(program: str, target: str | None, message: str) -> CaseResult:
    return {"program": program, "target": target, "status": None,
            "first_divergence": None, "coverage": None, "warning_codes": [],
            "seconds": None, "fixture_error": message}


def program_cases(program: str, files: dict[str, str | None], config: VerifyConfig,
                  clock: Callable[[], float] = time.perf_counter) -> list[CaseResult]:
    """Run every target in one program folder.

    files maps file name -> text, or None for a file that exists but could not be
    read as UTF-8 text. Only legacy.txt, tag_map.json, inputs.json and target files
    are looked at."""
    targets = sorted(n for n in files if is_target_file(n))
    if not targets:
        return [fixture_error(program, None, "no target.txt or target_*.txt")]

    def all_fail(message: str) -> list[CaseResult]:
        return [fixture_error(program, t, message) for t in targets]

    for name in ("legacy.txt", "tag_map.json"):
        if name not in files:
            return all_fail(f"missing {name}")
    for name in ("legacy.txt", "tag_map.json", "inputs.json"):
        if name in files and files[name] is None:
            return all_fail(f"{name} is not readable UTF-8 text")
    try:
        tag_map = load_tag_map(_json(files["tag_map.json"], "tag_map.json"))
        scenarios = (load_scenarios(_json(files["inputs.json"], "inputs.json"))
                     if "inputs.json" in files else None)
    except InputFileError as error:
        return all_fail(str(error))

    results = []
    for target in targets:
        if files[target] is None:
            results.append(fixture_error(program, target, f"{target} is not readable UTF-8 text"))
            continue
        start = clock()
        report = run_verify(files["legacy.txt"], files[target], tag_map, scenarios, config)
        seconds = clock() - start
        results.append({
            "program": program, "target": target, "status": report["status"],
            "first_divergence": report["first_divergence"],
            "coverage": report["coverage"],
            "warning_codes": [warning_code(w) for w in report["warnings"]],
            "seconds": round(seconds, 4), "fixture_error": None,
        })
    return results


def _json(text: str, name: str):
    try:
        return json.loads(text)
    except json.JSONDecodeError as error:
        raise InputFileError(f"{name} is not valid JSON: {error}") from error


def summary_line(row: CaseResult) -> str:
    """One line per case for the terminal table."""
    case = f"{row['program']}/{row['target'] or '-'}"
    if row["fixture_error"] is not None:
        return f"{case:<50} fixture_error  {row['fixture_error']}"
    d = row["first_divergence"]
    where = (f"scan {d['scan']} {d['tag']} L{d['legacy']} T{d['target']}"
             if d is not None else ", ".join(row["warning_codes"]) or "-")
    return f"{case:<50} {row['status']:<23} {where:<40} {row['seconds']:.3f}s"
