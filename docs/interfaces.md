# Interface additions and details

Owner: Tami. CONTRACT.md stays normative; this file records additions made while building, plus the details the inbox notes point to. Items marked **pending ratification** change a CONTRACT interface and need team approval.

## Setup and running

- `pip install -r requirements.txt` (pinned versions), Python 3.14.
- Run `pytest` from the repo root. The root `pytest.ini` sets `pythonpath = .`; imports are `from backend.app...`.
- CLI, from the repo root:
  `python -m backend.app.cli verify --legacy <file> --target <file> --map <file> --inputs <file> [--scans N]`
  It prints the §8 report as JSON and exits 0, whatever the status. Malformed files print `error: ...` and exit 2. `--scans N` turns on the `SCAN_HORIZON` check (see below).

## verify() additions (pending ratification)

`verify(legacy_ir, target_ir, tag_map, config, *, input_scenarios=None, check_horizon=None)`

- `input_scenarios`: a list of scenarios, each a list of `InputEvent` in legacy names. `None` means verify() calls `generate_scenarios(legacy_ir, seed, scenarios, scans)` from the config.
- `check_horizon`: warn `SCAN_HORIZON` when a scenario ran fewer than `config.scans` scans. `None` means only when verify() generated the scenarios itself.
- verify() catches `NeedsReviewError` from run() and adds `(legacy program)` or `(target program)` to the warning.
- `coverage.scans` always counts scans actually executed.

## Report

- `Report` is a `TypedDict` in `backend/app/report.py`. verify() returns a plain dict with exactly the CONTRACT §8 keys; `ir.py` is unchanged.
- Everything in the report uses legacy (canonical) tag names. `first_divergence.rung` is the legacy rung, and only when exactly one legacy rung writes that tag; otherwise `null`.
- Helpers in `report.py`:
  - `parse_failure_report(config, legacy_diags, target_diags)`: `needs_review` with warnings like `UNSUPPORTED_OPCODE: legacy line 3: ...`.
  - `unresolved_report(config, unresolved)`: `needs_review` for a conversion with unresolved items.
  - `with_rules_used(report, rule_ids)`: returns a copy with `rules_used` filled, for a target that came from convert().

## Tag-map evidence

- A row counts as confirmed when `evidence` starts with `user-confirmed`. Anything else gives `needs_review` (`UNCONFIRMED_MAPPING`).
- convert() proposes rows with `proposed: <RULE_ID>`. The UI confirms them as `user-confirmed · proposed: <RULE_ID>`.

## convert() and render()

- `convert(program) -> (target_ir, tag_map, rule_ids, unresolved)` in `backend/app/translator.py`. All-or-nothing: if `unresolved` is not empty, `target_ir` is an empty Program and `tag_map`/`rule_ids` are empty.
- Naming rules (no leading zeros): `I:1/0 -> I_1_0` (`INPUT_MAP_V1`), `O:2/0 -> O_2_0` (`OUTPUT_MAP_V1`). B3 and other internal bits are `UNRESOLVED_ADDRESS` in P0.
- `render(program)` gives the demonstration mnemonic text, one `SOR ... EOR` line per rung. `parse(render(p)) == p`.

## API wiring (for api.py)

- `/convert`: `converted_text = render(target_ir)`; return `tag_map`, `rule_ids`, `unresolved` as convert() gives them.
- `/verify`: if either program has parse diagnostics, return `parse_failure_report(...)`. If the conversion left anything unresolved, return `unresolved_report(...)`. Otherwise call verify(); for a converted target, wrap it with `with_rules_used(report, rule_ids)`.
- In v1, target names of a converted program are confirm-only (renaming would break the converted text).

## Fixture formats

- `tag_map.json`: a list of rows with exactly the keys `legacy_tag`, `target_tag`, `kind` (`input` | `observable`), `rule`, `evidence`.
- `inputs.json`: one scenario (a list of `{"scan", "tag", "value"}` events) or several (a list of such lists).

## Warning codes

- Mapping (before running): `UNCONFIRMED_MAPPING`, `AMBIGUOUS_MAPPING`, `INVALID_MAPPING_KIND`, `UNMAPPED_INPUT`, `UNMAPPED_OUTPUT`, `MISSING_OBSERVABLE`.
- Running and comparing: `UNMAPPED_INPUT_EVENT`, `TRACE_SCAN_MISMATCH`, `NO_OBSERVABLE_MAPPINGS`, `EMPTY_TRACE`, `NO_SCENARIOS`, `SCAN_HORIZON`, plus run()'s own `NeedsReviewError` codes.
- Parser: `PARSE_ERROR`, `UNSUPPORTED_OPCODE`, `UNSUPPORTED_NESTED_BRANCH`, `UNSUPPORTED_EMPTY_BRANCH`, `UNSUPPORTED_TIMEBASE`, `UNSUPPORTED_TIMER_ACC`.
- Translator: `UNRESOLVED_ADDRESS`, `UNRESOLVED_INSTRUCTION`, `UNRESOLVED_INPUT_WRITE`, `UNRESOLVED_OUTPUT_READ`.

## Open issues

- **Scan horizon.** run() stops at the last input event. In a trial of 200 generated scenarios x 300 scans on the seal-in program, 194 ran short (52,951 of 60,000 scans). Requested fix: an optional `scans` argument to run() (default = current behavior), **pending ratification**.
