# Execution semantics (owner: Arnav)

Status: DRAFT rules for P0. Timer rules (S6) are PROPOSED and not accepted until the timer gate in CONTRACT.md section 5 passes. Each rule cites its source. Rules marked "TO CONFIRM" must be checked by Arnav before Friday's timer work.

Profiles: `slc_subset_v1`, `logix_subset_v1`. They differ ONLY in timer units (S7 below).

| ID | Rule | Source |
| --- | --- | --- |
| S1 | Fixed scan period `dt_ms = 10`. Input events at scan 0 are the initial values; executed scans are numbered from 1. | Team model assumption (not a hardware claim) |
| S2 | Each executed scan: apply that scan's input events, execute rungs top to bottom, record observables after the whole scan. State persists across scans. | Team model assumption |
| S3 | Fresh state at the start of every scenario: internal bits, outputs and timers start at 0 (EN/TT/DN = 0, ACC = 0). Every referenced INPUT must get an explicit scan-0 value; if not, the result is needs_review (CONTRACT §3, §6). | Team model assumption + CONTRACT.md |
| S4 | XIC true when bit = 1; XIO true when bit = 0. Series = AND; one-level Parallel = OR. | 1747-RM001 / Logix instruction reference, TO CONFIRM page numbers |
| S5 | OTE writes rung power to its bit when it executes; later rungs in the same scan see the new value. | Same as S4 |
| S6 | **TON first-scan rule.** Rung false: EN = TT = DN = 0, ACC = 0. First scan the rung is true: EN = 1, timing starts, ACC stays 0 (no time has elapsed since timing started); TT = 1 unless ACC >= PRE. Each later consecutive true scan: ACC += elapsed time since the previous scan (dt), then DN = (ACC >= PRE), TT = EN and not DN. | Logix TON doc: ACC = ACC + (current_time - last_time_scanned); false/prescan rows clear EN, TT, DN, ACC. First-scan step derived from that formula. **TO CONFIRM against the TON flowchart image** on https://www.rockwellautomation.com/en-us/docs/studio-5000-logix-designer/38-01/contents-ditamap/instruction-set/timer-and-counter-instructions/timer-on-delay--ton-.html and the SLC TON section of 1747-RM001. If the flowchart differs, change S6 for BOTH profiles and recompute golden traces. |
| S7 | Units: SLC profile counts ACC/PRE in ticks of the timebase (10 ms or 1000 ms; for 1000 ms carry leftover ms between scans). Logix profile counts ms. | 1756-RM085I-EN-P pp.31-32 (converter scales PRE/ACC to 1 ms) |
| S8 | Compared observables: mapped outputs and timer DN/TT only. Never raw ACC/PRE. | Units differ by design (S7) |

## Worked example under PROPOSED S6 (timer-scaling bug; do not quote until the timer gate passes)

Legacy `TON T4:0 0.01 50 0` (500 ms) vs buggy target `TON Timer0 50 0` (50 ms). Start = 1 from scan 0; the next rung is `XIC T4:0/DN OTE O:2/0` (target: `XIC Timer0.DN OTE Motor`).

| Executed scan | Target ACC (ms) | Target DN / Motor | Legacy ACC (ticks) | Legacy DN / Motor |
| --- | --- | --- | --- | --- |
| 1 | 0 | 0 | 0 | 0 |
| 2 | 10 | 0 | 1 | 0 |
| 5 | 40 | 0 | 4 | 0 |
| 6 | 50 | **1** | 5 | 0 |
| 51 | (stays on) | 1 | 50 | **1** |

First difference: **executed scan 6**, Motor, legacy 0, target 1. This number depends on S6; recompute if S6 changes.

## Friday implementation update — pending independent S6 sign-off

**Status:** The following describes the implemented **model**, not a claim of exact SLC or ControlLogix hardware timing. Tami must review S6 and the hand-calculated golden fixtures before the timer demo is accepted. Keep timer results labeled *modeled behavior under `slc_subset_v1` / `logix_subset_v1`*.

### Scan horizon (additive `run()` API)

`run(program_ir, input_events, profile, dt_ms, scans: int | None = None) -> Trace`

- The original four positional arguments are unchanged; old bit-only callers still work.
- With `scans=N`, execute **exactly N** scans numbered `1..N`, regardless of when the last input event occurs. Report one `TraceEntry` per executed scan.
- `scan=0` is an initialization event, not an executed scan. A scan `n` input change takes effect before evaluating rung 1 on scan `n`.
- With `scans=None`, retain Thursday's bit-only compatibility behavior: execute through the highest input-event scan, minimum 1. **This is not the recommended path for measured coverage.**
- `TON` requires an explicit positive `scans` value to prevent incomplete-duration test runs from looking like complete verification. An invalid/short horizon produces `NeedsReviewError`; Tami's `verify()` must report `needs_review`.
- For the benchmark with 200 scenarios and 300 scans each, Tami must invoke `run(..., scans=config.scans)` for each profile and scenario and count **actual** trace entries: `200 × 300 = 60,000` on each side. Document explicitly whether reported `coverage.scans` counts one side's scenario-scan positions (recommended) or both simulator calls; never claim both as one figure.

### S6 as encoded in `semantics.py`

- Supported v1 timer presets are **positive integers**; `PRE=0` returns `needs_review` pending separate treatment. Negative values also return `needs_review`.
- On a false rung, `EN=TT=DN=0`, and elapsed time resets to 0.
- On the **first true scan**, `EN=1`, `TT=1`, `DN=0`, and accumulated time remains 0.
- On each **subsequent consecutive true scan**, add `dt_ms=10` to elapsed time. SLC native ACC is the integer number of full 10-ms or 1000-ms timebase intervals; Logix native ACC is milliseconds. Set `DN=1, TT=0` once native ACC reaches preset. Preserve `DN=1` until the rung becomes false.
- The next rung in the same executed scan sees the updated timer `DN` and `TT` bits; the trace records both after all rungs have run.
- The publicly compared timer values are **DN and TT**, not the incomparable native ACC/PRE integers. Internal elapsed-millisecond values are not serialized as a trace observable.
- This simplified first-scan convention is supported by the Logix flowchart (an initially false EN sets the current time reference), while the SLC manual documents counting timebase intervals and status transitions but not a general exact scan boundary for all models. Treat SLC-vs-Logix scan alignment as a **modeling assumption**, not a hardware-fidelity guarantee.

### Manual review references

- Rockwell, *Studio 5000 Logix Designer — Timer On Delay (TON)*: https://www.rockwellautomation.com/en-us/docs/studio-5000-logix-designer/38-01/contents-ditamap/instruction-set/timer-and-counter-instructions/timer-on-delay--ton-.html (How a Timer Runs; TON Flow Chart (True); Execution table).
- Rockwell, *SLC 500 Instruction Set Reference Manual*, 1747-RM001G-EN-P, Chapter 2, printed pp. 2-7 through 2-9: https://literature.rockwellautomation.com/idc/groups/literature/documents/rm/1747-rm001_-en-p.pdf .
- Independently computed fixtures (not generated from engine output): `backend/tests/golden/expected_timer_traces.json`. Test runner: `backend/tests/golden/test_timer_golden.py`.

**Known limitation:** real controllers may have scan-time jitter, asynchronous I/O/task behavior, controller-specific timer resolution, restarts, or other semantics excluded from these profiles. No industrial safety or hardware equivalence claims.
