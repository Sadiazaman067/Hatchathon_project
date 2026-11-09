# LadderProof — Four-Person Integration Contract

**Document:** `CONTRACT.md` · **Proposed contract version:** `v1.0` · **Prepared:** November 5, 2026  
**Applies to:** Arnav, Tami, Sadia and Adaora  
**Status:** **Ready for team sign-off, not yet ratified.** Once all active teammates acknowledge it, lock the `v1` interfaces. Unresolved timer semantics must pass the stated gate before timer behavior is advertised.

> **Purpose:** Each contributor can implement and test their own module independently. Integration must not require last-minute changes to shared data structures, function signatures, field names, scan numbering, or endpoints.

## 0. Hierarchy, acceptance, and change control

1. **`README.md`** explains the product, intended UX, limitations, and user questions. This file is the **normative v1 handoff contract** for signatures and serialized payloads. **`CLAUDE.md`** remains the coding-agent/workflow policy. If any documents conflict, **stop and resolve with the team**; do not silently override an instruction.
2. The contract has **four fixed boundaries**: `IR`, `input events + mapping`, `trace + report`, and `FastAPI HTTP endpoints`. All four must be approved by Arnav, Tami, Sadia and Adaora **before parallel implementation**.
3. A proposed change to a frozen field or function signature must include: problem, old/new examples, downstream affected owners, migration/test impact, approval from each impacted owner, and a single coordinated pull request. No silent renames or ad-hoc schema fields.
4. **Additive fields** can be introduced only after an explicit team agreement and a consumer test. No owner can change the meaning of an existing field. Use one `v1` schema throughout the demo.
5. When the team cannot confirm a required behavior, the safe result is `needs_review`, not guessed behavior or an invented result.

### Sign-off tracker (fill in at kickoff)

| Owner | Acceptance | Date / commit |
|---|---|---|
| Arnav — simulator | Pending | — |
| Tami — parser/translator/comparator | Pending | — |
| Sadia — fixtures/evaluation/pitch | Pending | — |
| Adaora — API/UI (Sadia as fallback) | Pending | — |

**Freeze gate:** no feature development against the old, larger build-plan schema after approving this contract.

## 1. Product and scope invariants

**Product:** A **legacy SLC 500 mnemonic-text → converted Logix behavior checker**, not a full code migration platform or formal proof system. The UI may accept the target program or request a deterministic rule conversion. The same physical input events are replayed through **two separate execution profiles** and mapped observables are compared after each full scan.

**P0 instructions:** `XIC`, `XIO`, `OTE`, series contacts, one-level parallel OR branches (`BST`/`NXB`/`BND`), and `TON` with explicit timebase. Nothing else is silently accepted.

**Stretch 1:** optional Claude/LLM *candidate conversion* **after P0 passes**, never an AI verdict. **Stretch 2:** restricted `GRT(timer.ACC, threshold)` **after Stretch 1 and the core gate**. AI-driven adaptive configurations or repair recommendations are **future work**, not v1.

**Out of scope:** PLC-5 model, full `.RSS`/`.L5X` imports, PID, motion, MSG, indirect addressing, arbitrary math/counters/one-shots, hardware-level claims. Unrecognized syntax yields a line-level diagnostic and `needs_review`; invalid HTTP envelopes yield validation errors.

**Outcomes (exact strings):** `different`, `no_difference_observed`, `needs_review`. Never use `match`, `passed`, `equivalent`, `proven`, or `safe` as the report-level status. `no_difference_observed` is a bounded observation, **not certification**.

## 2. Ownership and read/write boundaries

| Member | Exclusive code/files | What they provide | What they must not change unilaterally |
|---|---|---|---|
| **Arnav** | `backend/app/semantics.py`, `backend/app/scenarios.py`, `backend/tests/golden/`, `docs/semantics.md` | `run()` and deterministic scenario fixtures with independent golden traces | `ir.py`, parser grammar, mapper schema, comparator, API DTOs |
| **Tami** | `backend/app/grammar.lark`, `ir.py`, `parser.py`, `translator.py`, `comparator.py`, `report.py`, `cli.py`, benchmark runner | `parse()`, `convert()`, `verify()`, map suggestions, typed report | Simulator rules, frontend, held-out answer key |
| **Sadia** | `backend/tests/fixtures/` practice/demo cases, externally held hidden fixtures, evaluation worksheet, pitch/video | Demo pair(s), hidden answer key, benchmark execution and analysis | Semantic engine or benchmark runner's expected outcomes |
| **Adaora** | `backend/app/api.py`, `frontend/`, frontend tests, offline packaging | Thin API adapter, upload/confirm-map/verify/report workflow | Parser, IR, semantics, translator, comparison logic |

**Fallback if Adaora's API/UI integration isn't working by Friday evening:** Sadia maintains only a minimal fixture-driven React view + thin API. All other ownership and all contracts remain identical. A fourth contributor does **not** trigger extra MVP requirements.

**Cross-file edits:** file owner reviews every change; pair if an interface needs adjustment. Each person reviews at least one other person's test. Hidden results stay unknown to Arnav and Tami until the prescribed held-out run.

## 3. Pure Python function contracts

Use **Python 3.14** (whole team, same version) and **shared dataclasses** in `ir.py` (see the file for exact classes, including `ParseDiagnostic`, `TagMapping` and `VerifyConfig`). Use Pydantic only at the HTTP boundary in `api.py` or a separately agreed DTO module. No file or network access in core functions, and no AI in `run()`/`verify()`.

```python
# Arnav — same signature for both PLC profiles, no global mutable state
run(program_ir: Program, input_events: list[InputEvent],
    profile: str, dt_ms: int) -> Trace

# Tami — parse failure returns diagnostics; never silently discard lines
parse(source_text: str) -> Program | list[ParseDiagnostic]

# Tami — tuple order is fixed; only valid, supported rule conversions
convert(program: Program) -> tuple[
    Program, list[TagMapping], list[str], list[str]
]  # (target_ir, tag_map, rule_ids, unresolved)

# Tami — orchestrates scenarios, calls Arnav's run() twice, compares observables
verify(legacy_ir: Program, target_ir: Program,
       tag_map: list[TagMapping], config: VerifyConfig) -> Report
```

**`run()` accepts a *fresh initial state per scenario*.** Calling it twice with the same program, events, profile and `dt_ms` must return byte-for-byte equivalent serialized traces. `run()` cannot choose a seed or mutate input arguments. Tami owns producing the report; Arnav does not need to know about the frontend.

**`parse()` contract:** success is a `Program`; failure is a **nonempty diagnostic list**, each with `line` (1-based integer), `code` (string), and `message` (string). Unsupported opcode/constructs use `UNSUPPORTED_*` diagnostics. Syntax errors use `PARSE_ERROR`. The app returns `needs_review` for analyzable but unsupported programs and surfaces diagnostics; malformed HTTP request structure instead uses `422`.

**`convert()` contract:** Tami provides a deterministic target-text renderer from `Program` to the supported *demonstration mnemonic form* for `/convert`; this is not a claim of an import-ready Studio 5000 `.L5X` project. The renderer is an internal helper, not a fifth public engine method. `unresolved` is a list of string diagnostics, not silently dropped instructions. If anything is unresolved, verification must not issue `no_difference_observed` for the affected program. Rule IDs are stable, e.g. `TON_TIMEBASE_MAP_V1`.

**`verify()` contract:** converts user-confirmed mappings into a canonical comparison space, checks coverage prerequisites, executes *identical event histories* on both profiles, compares after every scan, and returns the first divergence or `needs_review` as a typed `Report`. It never rewrites the simulator profiles or delegates the verdict to an AI.

### VerifyConfig (the only v1 knobs)

```json
{
  "seed": 42,
  "scenarios": 200,
  "scans": 300,
  "dt_ms": 10
}
```

- `seed`: non-negative integer; identical seeds/scenarios produce the same generated event streams.
- `scenarios`: positive integer; counts actual tested scenarios, not promised coverage.
- `scans`: positive executed scans **per scenario**, with scan numbers `1..scans`.
- `dt_ms`: **10 for the hackathon's validated default**. Any other positive interval requires both profiles' boundary tests to pass; otherwise `needs_review`. Do not allow AI to silently select arbitrary timing semantics.
- Initial states must be explicit and shared. For the demo fixture, all declared bits/timer states start at zero unless explicitly initialized in the fixture metadata. Undefined starting states are **not** assumed zero in arbitrary user uploads.

The v1 profile strings are **exactly** `slc_subset_v1` and `logix_subset_v1`. These profiles are selected internally for the respective programs; clients cannot invent new profile names.

## 4. Frozen intermediate representation (IR)

The Python dataclasses below express the **agreed shape and meaning**. No frontend component depends on a private implementation of these classes; the API serializes only the documented JSON. Preserve rung order and source text. **Exact class names and field names:** `Program.routines`, `Routine.name`, `Routine.rungs`, `Rung.id`, `Rung.source_text`, `Rung.condition`, `Rung.outputs`, `Contact.op`, `Contact.tag`, `Series.nodes`, `Parallel.nodes`, `OTE.tag`, `TON.timer`, `TON.preset`, `TON.timebase_ms`. `routines`, `rungs`, `outputs`, and `nodes` use Python lists, as in the existing `CLAUDE.md` sketch. Do not rename `nodes` to `children` or `branches` in an individual implementation.

```text
Program  { routines: [Routine] }
Routine  { name: str, rungs: [Rung] }
Rung     { id: int, source_text: str, condition: Node, outputs: [Instr] }
Node     = Contact(op: XIC|XIO, tag: str)
         | Series([Node])
         | Parallel([Node])             # one-level OR only in v1
Instr    = OTE(tag: str)
         | TON(timer: str, preset: int, timebase_ms: int)
```

- `XIC(tag)` is true for bit `1`; `XIO(tag)` is true for bit `0`. `Series` means AND in order; `Parallel` means OR among branches. No arbitrary nested branch depth in P0.
- `OTE(tag)` writes the rung's current boolean power when its rung executes. Later rungs can read the updated bit *in the same scan*.
- `TON` stores `preset` in the native profile units. In the SLC subset `timebase_ms` is `10` or `1000`; in Logix it is `1` (milliseconds). The translator must preserve the represented duration, not merely copy the numeric preset. Disallow invalid or negative presets via diagnostics.
- Routine and rung ordering is significant. No unsupported opcode can be coerced into `Contact`/`OTE` by guesswork.
- Stretch-2 addition (`GRT` against timer accumulation) needs **a separate approved additive IR update**, with an example and semantic tests; it is not part of the frozen P0 IR.

## 5. Scan ordering and timers — binding, with one explicit gate

**Model and numbering:** `scan=0` means *initial input events before execution*, not an executed scan. Executed scans are `1`, `2`, …, with `dt_ms=10` in the hackathon default.

For each scenario and executed scan `n`:

1. Begin with the prior scan's persistent program state (freshly initialized at scenario start).
2. Apply input events scheduled for `n` (and apply scan-0 initial events before scan 1).
3. Execute routines/rungs in their defined order, from top to bottom. An `OTE` update is visible to later rungs in that same scan.
4. Update supported `TON` state according to the selected profile's **validated** timing convention.
5. After the full scan, record mapped observables for scan `n`.

**TON state:** when enabled, `.EN` follows rung truth, `.DN` indicates `ACC >= PRE`, and `.TT` is enabled and not done; when disabled, accumulator and status bits reset. In `slc_subset_v1`, accumulator units follow the timer timebase (10 ms/1000 ms ticks, with elapsed-millisecond carry as needed); in `logix_subset_v1` they are milliseconds.

**Blocking issue that must not be guessed:** whether the **first scan on which a TON rung becomes true** accumulates elapsed time. **Arnav must document and independently validate the precise convention against the applicable Rockwell instruction manuals, including the first `.DN`/`.TT` transition and downstream OTE visibility.** Save positive, false-transition, preset-boundary, and re-enable golden traces in `backend/tests/golden/`. Obtain Tami's review *before* introducing timer divergence fixtures or quoting a precise timer scan number. (`docs/semantics.md` rule S6 is the *proposed* convention awaiting this gate.) Until then, the timer branch is **not accepted** and must return `needs_review` or be removed from the demo.

**No real-hardware claim:** these are deliberately modeled semantics on a constrained subset, not full hardware timing, event scheduling, or safety behavior.

## 6. Events and mappings — explicit, never inferred at comparison time

### Input event schema

```json
[
  {"scan": 0, "tag": "I:1/0", "value": 1},
  {"scan": 8, "tag": "I:1/0", "value": 0}
]
```

- Every event has exactly `scan: int >= 0`, `tag: str`, and `value: 0 | 1`. Events are sorted by scan ascending and use **legacy/canonical source-side physical input names**.
- The runner translates the *same* physical event to target-side tag names via **confirmed input mapping** before running the target profile. `scan=0` sets the initial input value. Events on executed scan `n` apply immediately before that scan's rungs.
- If two events write the same tag at the same scan, treat as an invalid scenario. If an input is referenced without an initial value and there is no explicit initial state, return `needs_review`.

### Unified tag mapping list (includes inputs AND observables)

This is an **explicit clarification to the older `CLAUDE.md` sketch**, which listed only observable mappings but also required identical physical inputs. `convert()` returns a `list[TagMapping]` under its historical `tag_map`/`observable_map` handoff; both consumers use this **same unified list** and no one invents an additional translation schema.

```json
[
  {"legacy_tag": "I:1/0",  "target_tag": "Start",     "kind": "input",      "rule": "INPUT_MAP_V1", "evidence": "user-confirmed"},
  {"legacy_tag": "O:2/0",  "target_tag": "Motor",     "kind": "observable", "rule": "OUTPUT_MAP_V1", "evidence": "user-confirmed"},
  {"legacy_tag": "T4:0/DN","target_tag": "Timer0.DN", "kind": "observable", "rule": "TIMER_STATUS_MAP_V1", "evidence": "user-confirmed"},
  {"legacy_tag": "T4:0/TT","target_tag": "Timer0.TT", "kind": "observable", "rule": "TIMER_STATUS_MAP_V1", "evidence": "user-confirmed"}
]
```

**Required fields:** `legacy_tag`, `target_tag`, `kind` (`input|observable`), `rule`, `evidence` (strings). The translator proposes these mappings. The UI must visibly show them for engineer confirmation/editing. `verify()` accepts only the **confirmed** map supplied in its request. No duplicate source tags or ambiguous one-to-many mappings. Missing/unconfirmed required mappings → `needs_review`.

**Important:** Timer status bits (`DN`, `TT`) are mapped **explicitly**. Do not ask the comparator to guess `.DN` or `.TT` from a parent timer name. **Do not compare raw `ACC` or `PRE` values across different units.**

## 7. Trace and comparator contract

### Trace (one output element per executed scan)

```json
[
  {"scan": 1, "observables": {"O:2/0": 1, "T4:0/DN": 0, "T4:0/TT": 1}},
  {"scan": 2, "observables": {"O:2/0": 1, "T4:0/DN": 0, "T4:0/TT": 1}}
]
```

- `Trace = list[ { scan: int, observables: { tag: 0|1 } } ]` with strictly increasing executed scans, no scan 0 entry.
- The engine produces trace tags in **its program's native names**. **Tami's comparator** normalizes them through confirmed `TagMapping` rows into the legacy/canonical names, so the UI can display both native names and correspondence.
- Compare **every required mapped observable** after each **complete** scan. No comparing text diffs as a verdict. A difference in `DN` or `TT` matters even if the motor output has not yet changed. Multiple differences on a scan are listed in deterministic tag order; report `first_divergence` as the lowest scan, then lexicographically first canonical tag.
- `rung` attribution is only an optional integer when the differing tag has exactly one writer. Else use `null`.

## 8. Report JSON — **canonical frontend/backend interface**

The original `CLAUDE.md` report already required `status`, `coverage`, `assumptions`, `first_divergence`, `mapping_evidence`, `counterexample`, `rules_used`, and `warnings`. This contract **adds one mandatory `trace_window` field** because the planned timeline cannot be rendered reliably from just a divergence index. This is an agreed-for-signoff **v1 refinement**, not permission for individual teammates to add fields freely.

### Example: a deliberately inverted contact (no timer-order dependency)

```json
{
  "status": "different",
  "coverage": {"scenarios": 1, "scans": 2, "seed": 42},
  "assumptions": {
    "dt_ms": 10,
    "executed_scan_index": "1_based",
    "profiles": ["slc_subset_v1", "logix_subset_v1"]
  },
  "first_divergence": {
    "scan": 1, "tag": "O:2/0", "legacy": 1, "target": 0, "rung": 1
  },
  "mapping_evidence": [
    {"legacy_tag": "O:2/0", "target_tag": "Motor", "rule": "OUTPUT_MAP_V1"}
  ],
  "counterexample": [{"scan": 0, "tag": "I:1/0", "value": 1}],
  "rules_used": [],
  "warnings": [],
  "trace_window": {
    "start_scan": 1,
    "end_scan": 2,
    "legacy": [
      {"scan": 1, "observables": {"O:2/0": 1}},
      {"scan": 2, "observables": {"O:2/0": 1}}
    ],
    "target": [
      {"scan": 1, "observables": {"O:2/0": 0}},
      {"scan": 2, "observables": {"O:2/0": 0}}
    ]
  }
}
```

The example assumes old logic energizes Motor for `Start=1` and the seeded target has an inverted contact; outputs are **canonicalized** under the mapping. It is **illustrative fixture data**, not a measured benchmark.

### Required shapes and null cases

| Field | Type and invariant |
|---|---|
| `status` | Exact enum: `different` \| `no_difference_observed` \| `needs_review` |
| `coverage` | `scenarios: int`, `scans: int` (**total executed scans across all scenarios**), `seed: int`; actual measurements only |
| `assumptions` | `dt_ms: int`, `executed_scan_index: "1_based"`, `profiles: ["slc_subset_v1","logix_subset_v1"]` |
| `first_divergence` | Object `{scan:int,tag:str,legacy:0\|1,target:0\|1,rung:int\|null}` when `different`, else `null` |
| `mapping_evidence` | Array of `{legacy_tag, target_tag, rule}` for mappings relevant to the finding; may be `[]` |
| `counterexample` | Sorted input-event prefix sufficient to reproduce a difference; `[]` if none found / review-only |
| `rules_used` | List of deterministic conversion rule identifiers; `[]` when comparing user-supplied target |
| `warnings` | List of human-readable diagnostic strings with leading stable code, e.g. `UNSUPPORTED_OPCODE: line 3 ...` |
| `trace_window` | On `different`, `{start_scan:int,end_scan:int,legacy:[TraceEntry],target:[TraceEntry]}` covering the first divergence. On `no_difference_observed`, the same shape for the first `MATCHING_WINDOW` (30) executed scans of scenario 1. On `needs_review`, `null` |

**Trace-window policy:** on `different`, emit at most **5 scans before and 5 after** the first divergent scan (bounded to the available executed-scan range), with legacy and target entries having **identical scan numbers**. Include the earliest divergence in the window. On `no_difference_observed`, emit the first **30** executed scans of scenario 1 (or fewer if that scenario is shorter). This is bounded UI data—not the full 60,000-scan benchmark stream. On `needs_review`, use `null`.

**Failure precedence:** if unsupported/ambiguous/unvalidated behavior prevents comprehensive comparison of the requested program, return `needs_review` with warnings, not a misleading green `no_difference_observed`. The app may show partial observations as supplementary diagnostics, but `status` still reflects incomplete coverage.

## 9. Four HTTP endpoints — no new endpoint needed for mapping confirmation

All endpoints use prefix `/api` and JSON request/response bodies. **The browser reads uploaded `.txt` mnemonic files as UTF-8 and sends their contents as JSON** (so FastAPI stays a thin adapter; no separate multipart protocol). No backend parser, simulator or comparator logic may be duplicated in `api.py`.

| Method | Endpoint | Request JSON | 200 response JSON | Owner |
|---|---|---|---|---|
| POST | `/api/projects` | `{ "legacy_text": str, "target_text": str|null }` | `{ "project_id": str, "rung_count": int, "diagnostics": [ParseDiagnostic], "target_rung_count": int, "target_diagnostics": [ParseDiagnostic] }` | Adaora |
| POST | `/api/projects/{id}/convert` | `{}` | `{ "converted_text": str, "tag_map": [TagMapping], "rule_ids": [str], "unresolved": [str] }` | Adaora |
| POST | `/api/projects/{id}/verify` | `{ "seed":42, "scenarios":200, "scans":300, "dt_ms":10, "tag_map":[TagMapping], "confirmed_tag_map":true }` | `Report` (§8) | Adaora |
| GET | `/api/projects/{id}/report` | none | Most recent `Report` | Adaora |

**Endpoint behavior:**

- `POST /api/projects` stores original text and optional converted text under a generated project ID. `rung_count` and `diagnostics` are for the legacy program; `target_rung_count` and `target_diagnostics` for the uploaded target (0 and `[]` when there is none). Rung counts are 0 when that program has diagnostics; `diagnostics` is empty for supported input. If syntax is unsupported, keep diagnostics and prevent an unqualified pass during verification.
- `POST /convert` calls Tami's `parse()`/`convert()` and stores the target IR/text and proposed `tag_map`; if a user-uploaded target exists, the endpoint is **optional**, not implicitly called or used to overwrite it. The UI explicitly asks before replacing a target.
- `POST /verify` requires a user-confirmed mapping list. This is how the **existing endpoint** supports map editing; **no fifth endpoint**. If `confirmed_tag_map` is false/missing or required tags are ambiguous, respond with `needs_review` + warnings, not a fabricated match.
- `GET /report` returns `404` if no report was generated yet. Project not found is `404`; malformed JSON/schema is `422`; unexpected server faults are `500` with no stack traces in the UI. Unsupported **PLC semantics** are valid application outcomes (`needs_review`) rather than server crashes.
- The API preserves the exact response keys, Python enum spellings and case; React TypeScript DTOs must be generated from or hand-mirrored to these definitions with sample fixture tests.
- All target program and report artifacts are persisted in local project-specific JSON files; no database or cloud calls in P0.

### UI state contract

`upload → parse result → optional convert → tag-map confirmation → verify → report`. On `different`, show `first_divergence`, the two trace-window series, and `counterexample`. On `needs_review`, show warnings and the unresolved mapping list. On `no_difference_observed`, show coverage assumptions and a prominent *not proof of safety* explanation. Frontend never calculates the engineering verdict itself.

## 10. Independent tests / integration handshake

**Before any API/UI integration**, these acceptance tests must pass against the same **contract fixture**:

| Test | Owner | Observable success criterion |
|---|---|---|
| Contact truth and OTE order | Arnav | Positive/negative `XIC` and `XIO`, later-rung reads see prior `OTE` writes, exact scan trace matches hand-calculated goldens |
| OR branch | Arnav + Tami | One-level branch parses to the specified IR and runs correct truth tables |
| Timer gate | Arnav + Tami | Independently checked first-scan/threshold/reset traces, both timebases and profiles |
| Rule translator | Tami | Known SLC preset converts to equivalent Logix milliseconds; tagged rule IDs and explicit `DN`/`TT` maps |
| Mapping review | Tami + Adaora | Missing/ambiguous/unconfirmed input or status mapping produces `needs_review` |
| Comparator | Tami | First mismatch scan and tag deterministic; `counterexample` reproduces same result; no raw `ACC` comparison |
| JSON/API contract | Tami + Adaora | API serializes exactly §8 fields and frontend can render the fixture without running the engine |
| Full UI flow | Adaora (or Sadia) | Upload text → confirm/edit map → verify → see correct mismatch timeline completely offline |
| Hidden mutation benchmark | Sadia | Code frozen before hidden cases; runner contains no answer key, actual caught/missed/false alarm counts recorded |
| Cross-laptop reproducibility | All | Same seed/config/fixture yields identical status, first divergence, and replay trace |

**Start with a bit-inversion fixture that diverges at scan 1**, because it does not depend on unconfirmed TON timing. Add the timer showcase only after its independent golden gate passes.

### Minimal contract smoke-test (before real implementation)

1. The static report fixture is `sample_report.json` at the repo root (the §8 example) and a `Program` containing one rung.
2. Arnav calls `run()` on a hand-constructed one-rung IR program and records exact expected `Trace` entries; no parser required.
3. The API owner returns the static fixture at the report path so the React UI can be built in parallel.
4. Tami connects `verify()` to Arnav's `run()` without changing arguments or field names; swap fixture for real output.
5. Sadia runs a small independent positive/negative suite and compares reported outcomes with her answer key.

**Definition of integrated:** no schema translations in the frontend beyond displaying tag names; no implicit field renames; no on-the-fly timer semantics; end-to-end test through the four endpoints; offline reproducible reporting.

## 11. AI boundary — proposals are untrusted inputs

**P0:** no AI dependency. The deterministic translator and checker work with network disabled.

**Stretch 1:** Tami may call Claude behind a timeout to generate *candidate* target text; the text is parsed through exactly the same strict grammar and then evaluated by the **same** deterministic verifier. If AI produces unknown instructions, invalid mappings, missing conditions, or contradictory parameter guesses, return `needs_review`. Never auto-expand the execution profiles to make the AI candidate work.

**Future configurable-assistant idea:** AI may later *suggest* timer metadata, tag maps, new input scenarios, or recommended new-PLC features. Every such suggestion requires schema validation and human approval. It must not alter authoritative semantics, hidden answer keys, or pass/fail results. This is intentionally **not** added to the November 9 P0 contract.

## 12. Branching, deadlines, and freeze procedures

- Each teammate works on an isolated feature branch / owned files. Commit after one tested change. Open small pull requests with: files touched, contract boundary used, fixture/test output, and known unsupported cases.
- Only a coordinated team review may merge changes to `ir.py`, `CONTRACT.md`, `report.py` public fields, API endpoint models, or timer semantics after sign-off.
- **Thursday Nov 5:** sign off interface and complete bit/branch golden + CLI smoke-test.
- **Friday Nov 6:** timer validation gate and end-to-end `needs_review`; Adaora integrates frontend and API (started Thursday on the fixture UI). If timer fails, retain only validated bit/branch scope; do not restart a different project automatically.
- **Saturday Nov 7, 6 pm:** feature freeze. Sadia runs held-out cases **once** after freeze; hidden answer key remains outside repo.
- **Sunday Nov 8:** fix only correctness/integration issues, complete offline demo and backup video. No new instruction categories.
- **Monday Nov 9:** present only confirmed performance metrics and documented limitations.

**Escalation:** if blocked for >1 integration attempt, share a failing *minimal fixture*, expected vs actual JSON, owning function, and commit hash. Resolve the spec with all affected owners before changing shared types.

## 13. Explicit decisions to ratify at kickoff

These refine omissions in the uploaded plans and current `CLAUDE.md`. They are **proposals made in this file, not previously approved facts**:

| New explicit contract decision | Why it is necessary | Must approve |
|---|---|---|
| Unified `TagMapping` entries include inputs as well as `DN`/`TT` and outputs | Same physical events must reach both differently named programs | Tami, Arnav, Adaora/Sadia |
| Report includes mandatory `trace_window` with bounded per-scan series | UI cannot render an actual divergence timeline from `first_divergence` alone | Tami, Adaora/Sadia |
| Upload API uses UTF-8 text as JSON, not multipart binary | Prevents two different frontend/backend upload protocols | Tami, Adaora/Sadia |
| Map is confirmed inside the existing `/verify` request, not a new endpoint | Avoids a late fifth-endpoint redesign | Tami, Adaora/Sadia |
| Timer first-enabled scan behavior requires an independent golden gate | Prevents invented `scan=5`/`scan=51` examples from becoming code | Arnav, Tami |

**Acceptance standard:** active teammates mark sign-off and implement the fixtures before treating this document as frozen. The contract is designed to avoid late integration changes, but it cannot guarantee zero changes if a tested technical assumption proves wrong.

## Changelog

- 2026-11-06 (Tami, approved by Tami): §9 `POST /api/projects` response adds `target_rung_count` and `target_diagnostics` (additive).
