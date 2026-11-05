# Today's Plan: Thu Nov 5

**Today's gate (checked together tonight):** from the command line, LadderProof parses the legacy seal-in program and the flipped-Stop target, runs both, and reports `different` at **executed scan 1, Motor, legacy 1, target 0**.

The rule translator is NOT needed for this gate: the target program is a fixture file. The translator comes right after.

**Check-ins in the group chat:** 6 pm (progress or blocker) and 10 pm (gate status). Post a blocker after 20 minutes stuck.

**First, everyone (10 min):** read `CONTRACT.md` and add your name and today's date to its sign-off table (or post "I sign off on CONTRACT v1.0" in the group chat). `CONTRACT.md` is the source of truth for every shared format.

**Rules:** `CONTRACT.md`, `CLAUDE.md` and `backend/app/ir.py` are frozen after sign-off. Don't edit another person's files. Start your AI tool inside the repo folder so it reads `CLAUDE.md`.

---

## Finish Wednesday's work first

If your Wednesday checklist (from yesterday's plan) isn't done, finish it before anything below. The gate needs:

- Tami's `parse()`
- Arnav's `run()` for bits
- Sadia's seal-in fixtures

---

## Tami: comparator, verify() and CLI (owns the gate)

**Done today when:**
- [ ] `verify(legacy_ir, target_ir, tag_map, config)` returns the report from `CONTRACT.md` section 8, including `trace_window`
- [ ] the CLI prints that report, run from the repo root: `python -m backend.app.cli verify --legacy <file> --target <file> --map <file> --inputs <file>`
- [ ] `test_e2e.py`: the flipped-Stop fixture gives `different` at scan 1, tag `O:2/0` (canonical legacy name), legacy 1, target 0
- [ ] `test_e2e.py`: the correct target gives `no_difference_observed` on the same inputs
- [ ] a missing or unconfirmed mapping (input or output) gives `needs_review`, never a pass
- [ ] pushed

**Steps:**
1. **Comparator.** Takes two traces and the tag map, translates target tag names back to legacy names through the `observable` mappings, walks scan by scan, and returns the first difference (lowest scan, then alphabetically first tag), or none.
2. **verify().**
   - Translate legacy input events to target tags with the `input` mappings.
   - Call Arnav's `run()` on both programs with the same inputs, `dt_ms=10`.
   - Compare the traces.
   - Build the report exactly as in `CONTRACT.md` section 8: status, coverage, assumptions, `first_divergence`, counterexample (input events up to that scan), `mapping_evidence`, `rules_used`, warnings and `trace_window` (up to 5 scans before and after).
3. **Today, scenarios = the fixture `inputs.json`.** Arnav's generator plugs in later through one `config` field.
4. **CLI.** Reads the files and prints the JSON.
5. **Next, if the gate passes early:** the bit translator. `convert(program)` renames SLC addresses to target tags using the tag map, and records rule IDs.

**Starter prompt:**
> Read CLAUDE.md, CONTRACT.md, docs/today_plan.md, backend/app/ir.py and the existing parser and semantics code. I'm Tami. Today I own comparator.py, the verify() function and cli.py, and my goal is the "Tami" checklist in today_plan.md. Explain each step in plain English and let me write parts myself. Do not change ir.py or files owned by others. Show me a short plan for the comparator first and wait for my OK.

---

## Arnav: engine checks, timer rule and scenarios

**Done today when:**
- [ ] bit and branch golden traces exist with positive, negative and boundary cases (written by hand)
- [ ] `run()` passes all of them, and Tami can import it
- [ ] timer gate prep: check proposed rule S6 in `docs/semantics.md` against the TON flowchart (link in that file) and the SLC manual, then ask Tami to review (CONTRACT.md section 5). Until both agree, timers stay `needs_review`.
- [ ] `scenarios.py` produces, for a given program, scripted input cases plus seeded random input toggles (same seed = same output)
- [ ] pushed

**Next, if there's time:** draft TON golden traces by hand (first true scan, preset boundary, false reset, re-enable) for both profiles. These are for the Friday timer gate, not a demo number yet.

**Starter prompt:**
> Read CLAUDE.md, CONTRACT.md, docs/today_plan.md, docs/semantics.md and backend/app/ir.py. I'm Arnav. Today I own the golden traces, confirming the TON first-scan rule, and scenarios.py, following the "Arnav" checklist in today_plan.md. Explain in plain English. Do not change ir.py or files owned by others. Start with a plan for the scenario generator and wait for my OK.

---

## Sadia: fixtures, practice bugs, handoff to Adaora

**Done today when:**
- [ ] seal-in fixtures exist (`legacy.txt`, `target_correct.txt`, `target_bug_flipped_stop.txt`, `tag_map.json`, `inputs.json`). `tag_map.json` uses the unified format from `CONTRACT.md` section 6, with `kind` (`input` or `observable`) and `evidence` on every row
- [ ] 3 bit/branch practice bugs exist as fixtures: dropped branch, swapped output tag, and one more, each with an expected first difference written by hand
- [ ] program 2 (tank fill with one TON) exists as legacy and correct-target text plus a timer-scaling bug version
- [ ] UI shell handed to Adaora: branch, how to run it, `sample_report.json`, API table from `CLAUDE.md` (**not** the hidden set)
- [ ] hidden-set folder started **outside the repo**
- [ ] pushed (except the hidden set)

**Starter prompt:**
> Read CLAUDE.md, CONTRACT.md, docs/today_plan.md and docs/ladder_cheatsheet.md. I'm Sadia. Today I own the test fixtures and practice bugs, following the "Sadia" checklist in today_plan.md. Explain in plain English. For each bug fixture, help me work out the expected first difference by hand, scan by scan, and show the table.

---

## Adaora: onboarding, then UI and API

**Done today when:**
- [ ] Python 3.14 and Node.js LTS installed; repo cloned; frontend runs locally
- [ ] read `CLAUDE.md`, `CONTRACT.md` (especially sections 8 and 9), `docs/ladder_cheatsheet.md` sections 1 to 6, and `sample_report.json`
- [ ] UI renders `sample_report.json` with:
    - status badge: red = different, amber = needs review, green = no difference observed
    - first-difference card
    - tag-map table
    - counterexample input list
    - divergence timeline drawn from `trace_window` (legacy vs target per scan)
- [ ] `backend/app/api.py` skeleton: the four routes with the exact request and response bodies from `CONTRACT.md` section 9, returning `sample_report.json` for now (real wiring to `verify()` on Friday)
- [ ] pushed

**Rules:**
- Don't change the IR, the engine, or how results are decided.
- If the UI needs a field the report doesn't have, ask Tami. Don't invent it.
- Adaora is the reviewer for the manual-vs-automated benchmark (`docs/benchmark.md`), so **don't look at the bug fixtures**.

**Starter prompt:**
> Read CLAUDE.md, CONTRACT.md, docs/today_plan.md and sample_report.json. I'm Adaora, joining today. I own the frontend and api.py. I'm a beginner, so explain in plain English. Today's goal is the "Adaora" checklist in today_plan.md. Do not change files owned by others, the IR or the report format. Start by showing me how the frontend is organized and a plan for the five UI pieces, then wait for my OK.
