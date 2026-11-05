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
