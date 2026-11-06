# Fixtures (owner: Sadia)

Every folder uses the formats in docs/interfaces.md "Fixture formats". Only I:, O: and T4: addresses.
Run any case from the repo root:

```
python -m backend.app.cli verify --legacy <dir>/legacy.txt --target <dir>/target.txt --map <dir>/tag_map.json --inputs <dir>/inputs.json
```

## Folders

- `seal_in/`: the Thursday gate pair. `legacy.txt`, `target_correct.txt`, `target_bug_flipped_stop.txt`, `tag_map.json`, `inputs.json`.
- `delayed_start_ton/`: program 2 (one TON, 500 ms). `legacy.txt`, `target_correct.txt`, `target_bug_preset_not_scaled.txt`, `tag_map.json`, `inputs.json`. Returns needs_review until the timer gate passes.
- `practice/<case>/`: practice bugs and clean controls. Each has `legacy.txt`, `target.txt`, `tag_map.json`, `inputs.json`, `expected.json` (hand-computed). Developers may use these. The hidden set is NOT here.

## Programs

- **A, seal-in:** `I:1/0` Start, `I:1/1` Stop, `O:2/0` Motor. Motor = (Start OR Motor) AND NOT Stop.
- **B, pump with guard:** adds `I:1/2` Guard and `O:2/1` RunLight. Rung 1: Pump = (Start OR Pump) AND NOT Stop AND Guard. Rung 2: RunLight = Pump.
- **C, delayed start:** `I:1/0` Start; rung 1 `TON T4:0 0.01 50 0` (50 ticks x 10 ms = 500 ms); rung 2 Motor = T4:0/DN.

Standard inputs. A: Start=1, Stop=0 at scan 0; Start=0 at 2; Stop=1 at 3; Stop=0 at 4; repeat at 6 so 6 scans run.
B: Start=1, Stop=0, Guard=1 at 0; Start=0 at 2; Guard=0 at 4; repeat at 6. C: Start=1 at 0, repeat at 60.

## Hand-computed answer key (practice)

Scan = executed scan (1-based). L = legacy, T = target.

| Case | Bug | Hand trace that shows it | Expected |
| --- | --- | --- | --- |
| a01_flipped_stop | `XIO Stop` became `XIC Stop` | scan 1: L Motor = (1 or 0) and not 0 = 1; T = (1 or 0) and 0 = 0 | different, scan 1, O:2/0, L1 T0, rung 1 |
| a02_dropped_seal_branch | seal branch removed | scan 1 both 1. Scan 2 Start=0: L = (0 or 1) and 1 = 1; T = 0 and 1 = 0 | different, scan 2, O:2/0, L1 T0, rung 1 |
| a03_swapped_output_tag | target writes `Conveyor` instead of `Motor` | Motor is never written, so it can't be compared | needs_review, MISSING_OBSERVABLE (also UNMAPPED_INPUT, UNMAPPED_OUTPUT) |
| a04_seal_on_start_not_motor | seal contact reads Start, not Motor | scan 2 Start=0: L 1, T = (0 or 0) and 1 = 0 | different, scan 2, O:2/0, L1 T0, rung 1 |
| a05_stop_in_wrong_branch | Stop only guards the seal path | own inputs: Start=1 and Stop=1 at 0. scan 1: L = 1 and not 1 = 0; T = 1 or (0 and 0) = 1 | different, scan 1, O:2/0, L0 T1, rung 1 |
| b01_guard_inside_start_branch | Guard moved into the Start path | scans 1-3 both on. Scan 4 Guard=0: L = (0 or 1) and 1 and 0 = 0; T = (0 and 0) or 1, and 1 = 1 | different, scan 4, O:2/0, L0 T1, rung 1 (O:2/1 also differs) |
| b02_rungs_swapped | RunLight rung moved above Pump rung | scan 1: L Pump=1 then RunLight=1; T RunLight reads old Pump=0, then Pump=1 | different, scan 1, O:2/1, L1 T0, rung 2 |
| b03_inverted_guard | `XIC Guard` became `XIO Guard` | scan 1 Guard=1: L Pump 1, T Pump 0 | different, scan 1, O:2/0, L1 T0, rung 1 |
| b04_unsupported_opcode | target uses OSR | not in P0 subset | needs_review, UNSUPPORTED_OPCODE |
| b05_nested_branch | BST inside a branch | not in P0 subset | needs_review, UNSUPPORTED_NESTED_BRANCH |
| c01_timer_preset_not_scaled | preset 50 copied as 50 ms instead of 500 ms | proposed S6: T DN when (n-1) x 10 >= 50, n = 6; L DN when n-1 >= 50, n = 51 | today needs_review (UNVALIDATED_TON_S6); after gate: different, scan 6, O:2/0, L0 T1, rung 2 |
| c02_timer_wrong_timebase | 0.01 s read as 1.0 s, preset 50000 ms | L DN at scan 51; T not until scan 5001 | today needs_review; after gate: different, scan 51, O:2/0, L1 T0, rung 2 |
| ok01_seal_in_correct | none | | no_difference_observed |
| ok02_pump_correct | none | | no_difference_observed |
| ok03_pump_reordered_same_logic | none (branch paths and contacts reordered) | AND and OR don't depend on order | no_difference_observed |
| ok04_timer_correct | none | | today needs_review; after gate: no_difference_observed |

Timer scans (c01, c02) follow the PROPOSED S6 in docs/semantics.md. If Arnav changes S6, recompute them. Note: the 4-person build plan says scan 5 for c01; semantics.md S6 gives scan 6. Don't quote either until the gate passes.
