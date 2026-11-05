# LadderProof: project instructions for AI coding tools

Read this whole file before writing code. If a request conflicts with this file, stop and ask.

## What we are building

LadderProof is a behavior checker for legacy-to-Logix PLC migrations. Input: an old Allen-Bradley SLC 500 ladder program (mnemonic text) and a converted Logix version (from our rule translator, an AI, or a person). LadderProof runs both on the same input sequences in a simulated scan cycle and reports the first scan where observable outputs differ, with a replayable input trace.

It is NOT a general translator and NOT a formal proof system.

Hackathon project (Hatchathon x VOXO 2026, Legacy Tech track). Expo Monday Nov 9. Reliability over features.

## Wording rules (code, UI, docs, pitch)

- Statuses are exactly: `different`, `no_difference_observed`, `needs_review`.
- Never write "proven", "equivalent", "safe", or "verified correct". Write "no difference observed on N scenarios under profile X".
- Anything unsupported, unmapped, ambiguous, or unverified returns `needs_review`. Never default to a pass. Never silently skip.

## Scope

P0 (must ship): mnemonic text subset of SLC 500: XIC, XIO, OTE, series contacts, one-level OR branch (BST/NXB/BND), TON with explicit timebase. Rule-based translator. Comparator. Report JSON. CLI and UI.

Stretch (only after Friday's P0 gate passes, in this order; drop both if core validation is incomplete):
1. AI proposes a candidate conversion; the deterministic checker judges it. The checker never depends on the AI. If the API fails, everything else still works.
2. GRT against a timer's .ACC with properly converted thresholds, motivated by Rockwell's PRE/ACC PCE warning (1756-RM085I-EN-P, p.32). IR addition: GRT(timer.ACC, threshold), Stretch 2 only.

Out: PLC-5, math, file ops, PID, motion, MSG, indirect addressing, full L5X, any hardware claim. These return `needs_review`.

## Text format (P0)

- Legacy and target programs use the SAME mnemonic syntax, one rung per line: `SOR ... EOR`.
- Legacy uses SLC addresses (`I:1/0`, `O:2/0`, `T4:0/DN`); target uses tag names (`Start`, `Motor`, `Timer0.DN`).
- Branches: `BST <path> NXB <path> BND`, one level only. Nested branches -> parse diagnostic.
- Timers: legacy `TON T4:0 0.01 50 0` (timer, timebase in seconds, PRE, ACC); target `TON Timer0 500 0` (timer, PRE in ms, ACC). Confirm against Rockwell exports before Friday.
- Example legacy: `SOR BST XIC I:1/0 NXB XIC O:2/0 BND XIO I:1/1 OTE O:2/0 EOR`
- Example target: `SOR BST XIC Start NXB XIC Motor BND XIO Stop OTE Motor EOR`
- PCE = "Possible Conversion Error" (1756-RM085I-EN-P p.16 defining sentence; the manual's chapter titles say "Programming Conversion Errors"; cite p.16).

## Execution semantics (one engine, two profiles)

Profiles: `slc_subset_v1` and `logix_subset_v1`. They differ ONLY in documented settings (timer units). Put every rule in `docs/semantics.md` with its Rockwell manual reference.

1. Time: fixed scan period `dt_ms = 10`. Input events at scan 0 are the initial inputs. Executed scans are numbered from 1. Report executed scan numbers.
2. Scan order: apply this scan's input events, execute rungs top to bottom, then record observables after the whole scan. State persists across scans.
   - TON first-scan rule: PROPOSED in docs/semantics.md S6 (first true scan: EN = 1, ACC stays 0; ACC grows by dt on LATER consecutive true scans). It is NOT accepted until the timer gate in CONTRACT.md section 5 passes (Arnav validates, Tami reviews). Until then, timer results are needs_review and no timer scan number may be quoted.
3. XIC true when bit == 1; XIO true when bit == 0. OTE writes rung power to its bit when it executes; later rungs in the same scan see the new value.
4. TON (proposed rule, pending the timer gate: docs/semantics.md S6): first true scan EN = 1, ACC stays 0; each later consecutive true scan ACC += dt in profile units; DN = ACC >= PRE; TT = EN and not DN. When rung is false: ACC = 0, DN = 0, TT = 0, EN = 0.
   - SLC profile: units are ticks of the timer's timebase (10 ms or 1000 ms). For 1000 ms timebase, carry leftover milliseconds between scans.
   - Logix profile: units are milliseconds.
   - Rockwell 1756-RM085I-EN-P (Sep 2025) p.31-32: the official converter scales PRE and ACC to 1 ms (e.g. 0.01 s preset 20 -> 200), and each logic reference to PRE or ACC generates a PCE instruction. Use the manual's exact expansion of PCE; do not guess it.
   - Our seeded timer-scaling bugs are NOT claims that Rockwell's converter makes that error.
5. Compare ONLY mapped physical outputs and timer status bits (DN, TT) after each full scan. NEVER compare raw ACC or PRE values; their units differ by design.
6. Blame: report the first differing scan and tag. Name a rung only if that tag is written by exactly one rung.

These are modeled semantics for a defined subset, not a claim about real hardware timing.

## Document hierarchy

- `CONTRACT.md` is the NORMATIVE source for every shared interface: IR field names, function signatures, input events, the unified tag map, traces, the report JSON (including `trace_window`) and the four HTTP endpoints. If this file and CONTRACT.md ever disagree on an interface, CONTRACT.md wins and you STOP and tell the team.
- `backend/app/ir.py` implements CONTRACT.md's shared types exactly. Do not create competing types.
- `README.md` explains the product and its limits. `docs/semantics.md` holds execution rules.
- This file (CLAUDE.md) governs how coding agents work.

## Contract quick reference (details in CONTRACT.md)

- `run(program_ir, input_events, profile, dt_ms) -> Trace` (Arnav): fresh state per scenario, deterministic, no seeds or AI inside.
- `parse(source_text) -> Program | list[ParseDiagnostic]` (Tami): diagnostics have 1-based `line`, `code` (`PARSE_ERROR` or `UNSUPPORTED_*`) and `message`.
- `convert(program) -> (target_ir, tag_map, rule_ids, unresolved)` (Tami).
- `verify(legacy_ir, target_ir, tag_map, config) -> Report` (Tami): only a user-confirmed tag map.
- Tag map = ONE list of `TagMapping` covering inputs AND observables: `legacy_tag`, `target_tag`, `kind` (`input`|`observable`), `rule`, `evidence`. Timer `DN`/`TT` are mapped explicitly.
- `VerifyConfig`: `seed`, `scenarios`, `scans` (per scenario), `dt_ms` (10).
- Report keys: `status`, `coverage`, `assumptions`, `first_divergence` (null unless different), `mapping_evidence`, `counterexample`, `rules_used`, `warnings`, `trace_window` (up to 5 scans before and after the first divergence; null unless different).
- Endpoints: `POST /api/projects`, `POST /api/projects/{id}/convert`, `POST /api/projects/{id}/verify` (the request carries the confirmed tag map), `GET /api/projects/{id}/report`. JSON bodies only; uploaded `.txt` is sent as UTF-8 text inside JSON.
- `sample_report.json` at the repo root is the CONTRACT §8 example, for building the UI before the engine exists.

## Stack

- Backend: Python 3.14 (whole team on 3.14; check with `python --version`; do NOT use 3.15 yet, Pydantic does not publish 3.15 wheels), Lark, pytest, FastAPI + Pydantic v2. Plain dataclasses for IR.
- Frontend: React + Vite + TypeScript, Tailwind CSS, Monaco diff view, Recharts timeline.
- AI (stretch only): Claude API behind one function with a timeout and an offline fallback.
- No hosting, no CI, no database. JSON files on disk. Demo runs locally.

```
backend/app/    grammar.lark ir.py parser.py semantics.py translator.py
                scenarios.py comparator.py report.py api.py cli.py
backend/tests/  fixtures/ golden/ test_semantics.py test_translator.py test_e2e.py
frontend/src/   api/ components/ pages/
docs/           semantics.md limitations.md benchmark.md ladder_cheatsheet.md today_plan.md
```

## Owners (stay inside your files unless coordinating)

- Arnav: semantics.py, both profiles, golden traces in tests/golden, scenarios.py, docs/semantics.md.
- Tami: grammar.lark, parser.py, ir.py, translator.py (incl. observable map), comparator.py, report.py, cli.py, benchmark runner.
- Sadia: demo programs, practice and hidden mutation fixtures plus answer key (hidden set kept outside the repo), benchmark execution, user interview, pitch, backup video. Until handing off to Adaora: fixture-driven UI shell and thin API stub.
- Adaora (confirmed team member, joined Thu Nov 5): api.py (four thin routes over parse/convert/verify), frontend integration, tag-map confirmation screen, divergence view, offline demo packaging, frontend tests. Also the reviewer for the manual-vs-automated benchmark (docs/benchmark.md), because they did not write the seeded bugs. Must not change verification semantics or the IR. Handoff (Thu Nov 5): Sadia passes over the UI shell, sample_report.json and the API contract, never the hidden set or answer key.
- Safety net: if API/UI integration isn't working by Friday evening, the demo runs on the fixture UI plus the CLI. The engine, parser and comparator never depend on the UI.

## Testing and evaluation rules (do not break)

- Golden traces are computed BY HAND from the Rockwell manuals and stored as fixtures. Never generate golden traces with our own engine.
- Every instruction needs positive, negative and boundary golden cases in both profiles before any `no_difference_observed` result is shown.
- Scenarios: scripted cases, boundary cases near timer presets (PRE-1, PRE, PRE+1 in scan terms), and seeded random toggles. Default 200 scenarios x 300 scans. Record seed, dt_ms, initial state and input trace.
- Practice mutations are for development. Hidden mutations are written by Sadia, stored outside the repo, and run once after Saturday's 6 pm code freeze. Never tune on hidden results.
- The benchmark runner takes fixture folders as input and must not contain expected answers in code.
- Manual-vs-automated benchmark (supports the innovation claim; protocol in docs/benchmark.md): on 3 programs with seeded bugs NOT in the hidden set, a reviewer who did not write the bugs checks each program by hand (today's practice: hand-written test cases, stepping through scans on paper or a spreadsheet), timed. The same programs then go through LadderProof (upload, confirm tag map, verify, read report), timed. Record per program: minutes to first finding, total minutes, bugs found / bugs seeded, false findings. Report as our own measurement with the reviewer's experience level stated; never as an industry-wide claim.
- Same seed must produce identical output on any laptop.

## How to work in this repo

- Before changing more than one file, state a short plan and wait for approval.
- Small pure functions; file I/O only at the edges (cli.py, api.py).
- Every function gets a pytest test with a tiny hand-made input and exact expected output.
- Parse errors are explicit and point to the line; never guess intent.
- Do not add dependencies without saying why.
- Do not invent data, results, manual page numbers, or citations.
- Explain non-obvious code in plain English when asked; the team is learning ladder logic as it builds.
- Commit after each working step.

## UI look

- Calm, technical, readable. Plenty of white space. No gradients.
- Colors: neutral grays; red only for `different`, amber only for `needs_review`, green only for `no_difference_observed`.
- Type: IBM Plex Sans for text, IBM Plex Mono for rungs and tags.
- Screens: Upload, Side-by-side rungs (Monaco diff), Tag map confirmation, Divergence timeline (legacy vs target per scan), Summary.
