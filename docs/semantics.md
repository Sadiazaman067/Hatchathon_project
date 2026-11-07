# Execution semantics (owner: Arnav)

**Status:** DRAFT rules for P0. The S6 timer implementation is complete, but the timer gate requires team review and acceptance under CONTRACT.md §5. The rules below distinguish documented PLC instruction behavior from LadderProof's fixed-scan modeling assumptions.

**Profiles:** `slc_subset_v1`, `logix_subset_v1`. They differ only in timer units (S7).

## Execution rules

| ID | Rule | Source |
| --- | --- | --- |
| S1 | Fixed scan period `dt_ms = 10`. Input events at scan 0 are initial values; executed scans are numbered from 1. | Team model assumption, not a hardware claim |
| S2 | Each executed scan: apply that scan's input events, execute rungs top to bottom, then record observables after the whole scan. State persists across scans. | Team model assumption |
| S3 | Fresh state at the start of every scenario: internal bits, outputs, and timers start at 0 (`EN=TT=DN=0`, `ACC=0`). Every referenced physical input must receive an explicit scan-0 value; otherwise return `needs_review`. | Team model assumption; CONTRACT.md §§3, 6 |
| S4 | XIC is true when its bit is 1; XIO is true when its bit is 0. Series = AND; one-level Parallel = OR. | SLC 500 Instruction Set Reference Manual, 1747-RM001; Logix instruction reference. Exact page numbers for these instructions remain to be recorded. |
| S5 | OTE writes rung power to its bit when it executes. Later rungs in the same scan observe the updated value. | SLC and Logix instruction references; modeled sequential scan order |
| S6 | **TON first-scan rule.** False rung: reset `EN`, `TT`, `DN`, and `ACC` to 0. First true scan: `EN=1`, `ACC=0`, `TT=1`, `DN=0` for supported positive presets. On each subsequent consecutive true scan, advance accumulated time by `dt_ms`; `DN=1` when `ACC >= PRE`, and `TT=EN and not DN`. | Reviewed against Rockwell's Logix TON flowchart. Applying the same first-scan convention to SLC is a fixed-step model assumption, not a proven physical scan boundary. |
| S7 | SLC profile counts ACC/PRE in timebase ticks (10 ms or 1000 ms, carrying residual milliseconds for the 1000 ms timebase). Logix profile counts milliseconds. | 1756-RM085I-EN-P, pp. 31–32, regarding conversion of timer PRE/ACC units |
| S8 | Compare mapped physical outputs and timer DN/TT status bits only. Do not compare raw ACC/PRE values because their native units differ. | Team comparison contract and S7 |

## S6 validation and limitations

### SLC source check

**Reference:** Rockwell Automation, *SLC 500 Instruction Set Reference Manual*, 1747-RM001G-EN-P, printed pp. 2-7 through 2-9.

The SLC manual describes the TON instruction's operation:

- Supported timebases include 0.01 seconds and 1 second.
- The timer accumulates elapsed time in timebase units while its rung remains true.
- The done bit (`DN`) becomes true when the accumulated value reaches the preset.
- The timer timing bit (`TT`) is true while timing is in progress.
- A false rung resets the nonretentive timer's accumulated value and status.
- Actual timing accuracy depends on program scans and the timing mechanism.

The manual does **not unambiguously establish a universal first-enabled-scan ACC timestamp** sufficient to prove that every physical SLC controller will assert `DN` on a particular executed scan.

Therefore, LadderProof uses this explicit S6 convention:

1. The first true scan initializes the timer and contributes 0 ms of elapsed time.
2. Each later consecutive true scan contributes one `dt_ms` interval.
3. Timer state updates before downstream rungs execute.
4. Observables are recorded after the entire scan.

This convention is applied consistently to both supported simulation profiles.

**Important distinction:** The Logix TON flowchart provides support for initializing the timing reference on the first enabled execution. The SLC documentation establishes timebase counting and timer status behavior, but does not independently prove exact scan-number alignment with the Logix model.

As a result, the scan numbers in the worked examples are **deterministic LadderProof simulation results**, not guarantees about physical SLC or ControlLogix hardware timing.

Rockwell SLC manual:

https://literature.rockwellautomation.com/idc/groups/literature/documents/rm/1747-rm001_-en-p.pdf

Rockwell Logix TON reference:

https://www.rockwellautomation.com/en-us/docs/studio-5000-logix-designer/38-01/contents-ditamap/instruction-set/timer-and-counter-instructions/timer-on-delay--ton-.html

## Worked example under S6: timer-scaling bug

**Timer gate status:** This example is valid under the implemented fixed-scan S6 model. Do not present its scan numbers as measured physical-controller behavior.

Legacy timer:

`TON T4:0 0.01 50 0`

- Timer: `T4:0`
- Preset: 50 ticks
- Timebase: 10 ms per tick
- Effective delay: 500 ms

Buggy converted target:

`TON T4_0 50 0`

- Timer: `T4_0`
- Preset: 50 ms
- Timebase: 1 ms
- Effective delay: 50 ms

The start input is held at 1 beginning with the scan-0 initialization event.

The following rung reads the timer done bit:

Legacy:

`XIC T4:0/DN OTE O:2/0`

Target:

`XIC T4_0.DN OTE Motor`

The timer executes before the motor rung, so the motor rung reads the current scan's updated `DN` state.

With `dt_ms=10`:

| Executed scan | Target ACC (ms) | Target DN / Motor | Legacy ACC (ticks) | Legacy DN / Motor |
| --- | ---: | ---: | ---: | ---: |
| 1 | 0 | 0 | 0 | 0 |
| 2 | 10 | 0 | 1 | 0 |
| 5 | 40 | 0 | 4 | 0 |
| **6** | **50** | **1** | **5** | **0** |
| 51 | 500 (saturated or still done) | 1 | 50 | 1 |

**First observed divergence:** Executed scan **6**, output `Motor`, legacy value **0**, target value **1**.

This result depends on S6's first-true-scan convention. If that convention changes, the golden traces and expected divergence scan must be recalculated.

## Converter timer naming

Per Tami's November 6 integration note, the current `convert()` implementation emits target timer names using underscores.

For example:

| Legacy name | Converted target name |
| --- | --- |
| `T4:0` | `T4_0` |
| `T4:0/DN` | `T4_0.DN` |
| `T4:0/TT` | `T4_0.TT` |

The simulator must derive native timer status names from `TON.timer`.

For `TON(timer="T4_0", ...)`, the target trace must use:

- `T4_0.DN`
- `T4_0.TT`

For a legacy `TON(timer="T4:0", ...)`, the legacy trace must use:

- `T4:0/DN`
- `T4:0/TT`

These are the native observable names used by the comparator and the confirmed tag map.

Other explicitly supported target timer names remain valid. The simulator must not hardcode a single name such as `Timer0`.

Timer status bits generated by TON are internal state, not physical inputs. Scenario generation must not require scan-0 input events for these status bits.

## Correct preset scaling oracle

A correctly converted timer must preserve the represented delay.

Legacy configuration:
```python
TON(
    timer="T4:0",
    preset=50,
    timebase_ms=10,
)
```

Effective delay:

`50 × 10 ms = 500 ms`

Correct target configuration:
```python
TON(
    timer="T4_0",
    preset=500,
    timebase_ms=1,
)
```

Effective delay:

`500 × 1 ms = 500 ms`

With `Start=1` from scan 0 and `dt_ms=10`, the S6 simulation gives:

| Executed scan | Legacy DN | Correct target DN | Buggy target DN (PRE=50) |
| --- | ---: | ---: | ---: |
| 1 | 0 | 0 | 0 |
| 5 | 0 | 0 | 0 |
| 6 | 0 | 0 | 1 |
| 50 | 0 | 0 | 1 |
| 51 | 1 | 1 | 1 |

**Correct scaling:** Both the legacy 500 ms timer and the correctly converted target 500 ms timer first assert `DN` at executed scan **51** under S6.

**Incorrect scaling:** A target preset of 50 ms instead asserts `DN` at executed scan **6**.

This provides two independent regression expectations:

1. A correctly scaled conversion produces matching timer status behavior for the tested input history.
2. An incorrectly scaled conversion produces a first observable difference at scan 6.

Matching behavior means `no_difference_observed` for the tested inputs and supported model. It does not establish general equivalence.

## Friday implementation update

### Scan horizon: additive `run()` API

The simulator signature is:
```python
run(
    program_ir,
    input_events,
    profile,
    dt_ms,
    scans: int | None = None,
) -> Trace
```

The original four positional arguments remain unchanged.

**Explicit scan horizon**

With `scans=N`:

- Execute exactly `N` scans, numbered `1` through `N`.
- Emit exactly one `TraceEntry` per executed scan.
- Do not shorten execution because no further input events are scheduled.
- Apply scan-0 events before executed scan 1.
- Apply events scheduled for scan `n` before evaluating rung 1 of scan `n`.

**Compatibility behavior**

With `scans=None`, preserve Thursday's bit-only behavior:

- Execute through the highest input-event scan.
- Execute at least one scan.
- Do not interpret the resulting trace length as full requested verification coverage.

**TON horizon requirement**

TON programs require an explicit positive `scans` value so that a short input-event history cannot silently truncate the timer observation period.

An invalid or insufficient horizon raises `NeedsReviewError`, which Tami's `verify()` must translate into `needs_review`.

### Coverage accounting

For the standard configuration:

- `config.scenarios = 200`
- `config.scans = 300`
- `config.dt_ms = 10`

The verifier must call:
```python
run(
    program_ir,
    input_events,
    profile,
    config.dt_ms,
    scans=config.scans,
)
```

for each profile and scenario.

The executed scan count on **each profile** is:

`200 × 300 = 60,000 scenario-scan positions`

The two profiles together execute 120,000 simulator scan steps, but this should not be reported as 120,000 distinct tested scenario-scan positions.

Coverage should distinguish:

- Generated scenario count
- Requested scan count per scenario
- Actual completed trace entries
- Supported instruction coverage
- Cases requiring review

Never count a requested scan as executed unless the simulator produced the corresponding trace entry.

## S6 as implemented in semantics.py

### Supported timer presets

Supported v1 presets are positive integers.

- `PRE > 0`: supported within the documented subset.
- `PRE = 0`: returns `needs_review` pending a separately defined zero-preset rule.
- `PRE < 0`: returns `needs_review`.

Unsupported or ambiguous timer configurations must not be silently simulated.

### Timer state transitions

**False rung:**

- `EN = 0`
- `TT = 0`
- `DN = 0`
- `ACC = 0`
- Elapsed-time state resets.

**First true scan:**

- `EN = 1`
- `TT = 1`
- `DN = 0`
- `ACC = 0`
- Timing reference initializes.

**Subsequent consecutive true scans:**

- Add `dt_ms` to elapsed time.
- Convert elapsed time into native profile units.
- Set `DN=1` once the native accumulated value reaches `PRE`.
- Set `TT=0` when `DN=1`.
- Preserve the done state while the rung remains true.

### Native accumulated time

For `slc_subset_v1`:

- ACC is expressed in the timer's native timebase ticks.
- Timebases supported by the model are 10 ms and 1000 ms.
- For 1000 ms timebases, fractional intervals accumulate internally until a full native tick has elapsed.

For `logix_subset_v1`:

- ACC is expressed in milliseconds.
- Target timer timebase is 1 ms.

The simulator may maintain internal elapsed milliseconds for its calculation, but raw ACC and PRE are not compared between profiles.

### Same-scan visibility

When a TON instruction updates its status bits:

1. The current rung executes the timer update.
2. Subsequent rungs read the updated DN/TT values.
3. The trace records observable values after all rungs have completed.

Thus, when the buggy 50 ms target reaches DN on scan 6, a later motor rung can also energize on scan 6.

## Scenario-generation integration

`generate_scenarios()` must support programs containing TON instructions.

Its physical input discovery logic must:

- Identify contacts that read physical inputs.
- Exclude tags written by OTE instructions.
- Exclude timer-generated status tags, including `DN`, `TT`, and `EN`.
- Support both legacy timer names such as `T4:0` and converted names such as `T4_0`.
- Initialize each required physical input explicitly at scan 0.

A timer program is not inherently unsupported merely because it contains TON.

The generator creates input histories; it does not execute scans. The verifier must pass the requested scan horizon to `run()`.

For a timer-scaling example with a held start input, the scripted all-high scenario should retain `Start=1` long enough for the explicit execution horizon to expose the timing difference.

## Validation artifacts

Independent golden expectations:

- `backend/tests/golden/expected_timer_traces.json`
- `backend/tests/golden/expected_bit_traces.json`

Regression tests:

- `backend/tests/golden/test_timer_golden.py`
- `backend/tests/golden/test_bit_golden.py`
- `backend/tests/golden/test_timer_scenarios.py`

The timer golden tests cover:

- First-true-scan behavior
- Preset boundaries
- False-rung reset
- Re-enabling
- SLC 10 ms and 1000 ms timebases
- Target Logix millisecond timebase
- Correct preset scaling
- Incorrect preset scaling
- Native timer status names
- Explicit scan horizon
- Repeatable scenario generation

Expected results must be independently calculated rather than copied from simulator outputs.

## Manual review references

1. **Rockwell Automation — Studio 5000 Logix Designer, Timer On Delay (TON).**

   Relevant sections: *How a Timer Runs*, *TON Flow Chart (True)*, and the execution table.

   https://www.rockwellautomation.com/en-us/docs/studio-5000-logix-designer/38-01/contents-ditamap/instruction-set/timer-and-counter-instructions/timer-on-delay--ton-.html

2. **Rockwell Automation — SLC 500 Instruction Set Reference Manual, 1747-RM001G-EN-P.**

   Chapter 2, printed pages 2-7 through 2-9: TON behavior, timebase, accumulated value, status bits, and timing accuracy limitations.

   https://literature.rockwellautomation.com/idc/groups/literature/documents/rm/1747-rm001_-en-p.pdf

3. **Rockwell Automation — Logix conversion guidance, 1756-RM085I-EN-P.**

   Pages 31–32: scaling of timer PRE/ACC values during conversion to millisecond-based Logix timers.

4. **LadderProof CONTRACT.md.**

   Sections 3–7: supported instruction subset, execution interface, timer gate, input events, tag mapping, and trace format.

## Known limitations

LadderProof implements a deterministic, bounded PLC instruction subset.

It is not a cycle-accurate SLC 500 or ControlLogix emulator.

The model does not claim to reproduce every hardware-dependent behavior, including:

- Scan-time jitter and variable scan duration
- Asynchronous I/O updates
- Controller task scheduling and interrupts
- Controller-specific timer accuracy and resolution
- Prescan, startup, and restart behavior beyond explicitly modeled initialization
- All timer edge cases and unsupported instructions
- Real-world safety interlocks or industrial safety validation

The S6 first-true-scan rule is a disclosed simulation convention. Rockwell's Logix flowchart supports its timing-reference interpretation; the SLC manual does not prove universal exact scan-number alignment.

The correct public interpretation is:

**"No difference observed on the tested scenarios under LadderProof's documented execution profiles."**

Do not claim that a migration is proven safe, mathematically equivalent, or validated on physical PLC hardware.

## Pending timer-gate acceptance

Before the timer gate is considered closed:

1. Tami reviews and accepts S6 as the team's explicit fixed-step simulation convention.
2. The correctly scaled timer fixture matches DN/TT behavior under both profiles.
3. The incorrectly scaled timer fixture produces the documented scan-6 counterexample.
4. Generated timer scenarios reach the verifier through the API without an unnecessary `needs_review`.
5. The UI presents the result and the model's limitations accurately.
6. The team confirms the offline demo reproduces the same result.

Approval of this gate establishes that the bounded simulator and its fixtures are consistent with the agreed model. It does not establish physical PLC equivalence.
