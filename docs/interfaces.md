# Interface additions and details

Owner: Tami. CONTRACT.md stays normative; this file records additions made while building, plus the details the inbox notes point to. Items marked **pending ratification** change a CONTRACT interface and need team approval.

## Setup and running

- `pip install -r requirements.txt` (pinned versions), Python 3.14.
- Run `pytest` from the repo root. The root `pytest.ini` sets `pythonpath = .`; imports are `from backend.app...`.
- CLI, from the repo root:
  `python -m backend.app.cli verify --legacy <file> --target <file> --map <file> --inputs <file> [--scans N]`
  It prints the §8 report as JSON and exits 0, whatever the status. Malformed files print `error: ...` and exit 2. `--scans N` sets `config.scans`, the scans every scenario runs (default 300).

## verify() additions (pending ratification)

`verify(legacy_ir, target_ir, tag_map, config, *, input_scenarios=None)`

- `input_scenarios`: a list of scenarios, each a list of `InputEvent` in legacy names. `None` means verify() calls `generate_scenarios(legacy_ir, seed, scenarios, scans)` from the config.
- verify() calls `run(..., scans=config.scans)` on both sides, so every scenario runs exactly `config.scans` scans. An input event after that scan gives `needs_review` (`INPUT_EVENT_OUTSIDE_HORIZON` from run()).
- If `generate_scenarios()` raises anything, verify() returns `needs_review` with `SCENARIO_GENERATION_FAILED: <message>`.
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
- TON (`TON_TIMEBASE_MAP_V1`): `TON T4:0 0.01 50 0 -> TON T4_0 500 0`. Target preset in ms = legacy preset x timebase_ms (10 or 1000), exact integers, so the duration is unchanged.
- Timer status bits (`TIMER_STATUS_MAP_V1`): `T4:0/DN -> T4_0.DN`, `T4:0/TT -> T4_0.TT`. Every TON gets both observable rows, even if no rung reads them.
- Timer cases left unresolved: a leading-zero timer like `T4:00`, `/EN`, `/ACC`, `/PRE` (`UNRESOLVED_ADDRESS`); a DN/TT read with no TON for that timer (`UNRESOLVED_TIMER_READ`); two TONs on one timer (`UNRESOLVED_DUPLICATE_TIMER`); an OTE on a timer bit (`UNRESOLVED_TIMER_WRITE`).
- TON runs under S6 (Arnav's PR #2). Converted timer programs verify end to end; an unscaled preset (`TON T4_0 50 0`) shows `different` at scan 6.
- `render(program)` gives the demonstration mnemonic text, one `SOR ... EOR` line per rung. `parse(render(p)) == p`.

## HTTP API (backend/app/api.py)

- Start it from the repo root: `uvicorn backend.app.api:app --reload --port 8000`. CORS allows the Vite dev server (`http://localhost:5173`, `http://127.0.0.1:5173`).
- Projects are stored as `data/projects/<id>.json` (git-ignored).
- `POST /api/projects` `{legacy_text, target_text|null}` -> `{project_id, rung_count, diagnostics, target_rung_count, target_diagnostics}` (CONTRACT §9, changelog 2026-11-06).
- `POST /api/projects/{id}/convert` `{}` -> `{converted_text, tag_map, rule_ids, unresolved}`. If nothing is unresolved, the converted text **replaces** the stored target, so the UI asks first when a target was uploaded.
- `POST /api/projects/{id}/verify` `{seed, scenarios, scans, dt_ms, tag_map, confirmed_tag_map}` -> Report. Scenarios are generated from the config. `confirmed_tag_map` false/missing -> `needs_review` (`UNCONFIRMED_MAPPING: confirmed_tag_map is false`); no target -> `needs_review` (`NO_TARGET`).
- `GET /api/projects/{id}/report` -> the last report, or 404 before the first verify.
- Unknown project: 404. Bad body (missing/wrong-type/unknown keys): 422. Server fault: 500 `{"detail": "internal server error"}`.

## API wiring (for api.py)

- `/convert`: `converted_text = render(target_ir)`; return `tag_map`, `rule_ids`, `unresolved` as convert() gives them.
- `/verify`: if either program has parse diagnostics, return `parse_failure_report(...)`. If the conversion left anything unresolved, return `unresolved_report(...)`. Otherwise call verify(); for a converted target, wrap it with `with_rules_used(report, rule_ids)`.
- In v1, target names of a converted program are confirm-only (renaming would break the converted text).

## Fixture formats

- `tag_map.json`: a list of rows with exactly the keys `legacy_tag`, `target_tag`, `kind` (`input` | `observable`), `rule`, `evidence`.
- `inputs.json`: one scenario (a list of `{"scan", "tag", "value"}` events) or several (a list of such lists).

## Benchmark runner

- `python -m backend.app.cli benchmark <suite_folder> [--out results/<name>.json] [--scans N]`
- A suite is a folder of program folders (nesting allowed). A program folder holds `legacy.txt`, `tag_map.json`, optional `inputs.json` (without it, verify() generates scenarios) and one or more targets: `target.txt` or `target_<name>.txt`. Each target is one case. Every other file (including `expected.json`) is ignored.
- Per case: `program`, `target`, `status`, `first_divergence`, `coverage`, `warning_codes`, `seconds`, `fixture_error`. Top level: `suite`, `commit`, `dirty`, `run_at`, `config`, `cases`.
- No answer key is read and nothing is scored; compare the results file with the answer key by hand or outside the repo.
- A folder that can't be read as fixtures (missing file, bad JSON, wrong keys, no target, empty folder) gets `fixture_error` with `status: null`, never one of the three statuses.
- Suite folders inside the repo are refused (exit 2), except under `backend/tests/fixtures/`. Keep the hidden set outside the repo.
- Same suite, seed and commit give identical results except `seconds` and `run_at`.

## Warning codes

- Mapping (before running): `UNCONFIRMED_MAPPING`, `AMBIGUOUS_MAPPING`, `INVALID_MAPPING_KIND`, `UNMAPPED_INPUT`, `UNMAPPED_OUTPUT`, `MISSING_OBSERVABLE`.
- Running and comparing: `UNMAPPED_INPUT_EVENT`, `TRACE_SCAN_MISMATCH`, `NO_OBSERVABLE_MAPPINGS`, `EMPTY_TRACE`, `NO_SCENARIOS`, `SCENARIO_GENERATION_FAILED`, `NO_TARGET` (API), plus run()'s own `NeedsReviewError` codes.
- Parser: `PARSE_ERROR`, `UNSUPPORTED_OPCODE`, `UNSUPPORTED_NESTED_BRANCH`, `UNSUPPORTED_EMPTY_BRANCH`, `UNSUPPORTED_TIMEBASE`, `UNSUPPORTED_TIMER_ACC`.
- Translator: `UNRESOLVED_ADDRESS`, `UNRESOLVED_INSTRUCTION`, `UNRESOLVED_INPUT_WRITE`, `UNRESOLVED_OUTPUT_READ`, `UNRESOLVED_TIMER_READ`, `UNRESOLVED_TIMER_WRITE`, `UNRESOLVED_DUPLICATE_TIMER`.

## Open issues

- **Scan horizon: resolved.** run() takes `scans`; verify() always passes `config.scans`. `SCAN_HORIZON` and `check_horizon` are gone.
- **Generated scenarios for timer programs.** `generate_scenarios()` still refuses TON programs, so verify() without passed-in scenarios gives `needs_review` (`SCENARIO_GENERATION_FAILED`) for them. Waiting on Arnav.
