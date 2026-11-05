# Ladder Logic Cheat Sheet (LadderProof edition)

Plain-English basics for the team. Everything here is only what our P0 subset needs.
Exact behavior rules live in `docs/semantics.md` (Arnav) and come from the Rockwell manuals listed at the bottom.

---

## 1. What a PLC does

A PLC (programmable logic controller) is a small industrial computer that runs a machine.
It runs its program over and over in a loop called a **scan**:

1. **Read inputs** (buttons, sensors).
2. **Solve the program** one rung at a time, top to bottom.
3. **Write outputs** (motors, lights, valves).
4. Repeat, many times per second.

**Our model:** every scan is exactly 10 ms. Scan 0 sets the starting inputs; executed scans are numbered from 1. We record outputs after the whole scan finishes.

---

## 2. Rungs

A ladder program looks like a ladder: two side rails with horizontal **rungs** between them.
Each rung has **conditions** on the left and an **output** on the right.

> If the conditions on the left are true, power "flows" across the rung and the output turns on.

Rungs run top to bottom. A later rung sees the values an earlier rung wrote **in the same scan**.

---

## 3. Addresses: old vs new

| Thing | Old SLC 500 address | New Logix tag |
| --- | --- | --- |
| Input bit (e.g. Start button) | `I:1/0` (slot 1, bit 0) | `Start` |
| Output bit (e.g. Motor) | `O:2/0` (slot 2, bit 0) | `Motor` |
| Internal bit | `B3:0/0` | `RunLatch` (any name) |
| Timer | `T4:0` | `Timer0` |
| Timer done bit | `T4:0/DN` | `Timer0.DN` |
| Timer timing bit | `T4:0/TT` | `Timer0.TT` |

Old controllers use **numbered addresses**. New ones use **names**. The tag map connects them, and the user confirms it in the UI.

---

## 4. The instructions we support

| Instruction | Name | Plain English | True when / does |
| --- | --- | --- | --- |
| `XIC tag` | Examine If Closed | "Is this bit ON?" | true when bit = 1 |
| `XIO tag` | Examine If Open | "Is this bit OFF?" | true when bit = 0 |
| `OTE tag` | Output Energize | "Set this bit to whatever the rung is" | bit = 1 if rung true, else 0 |
| Series | (contacts in a row) | AND | all must be true |
| Branch `BST ... NXB ... BND` | Branch Start / Next Branch / Branch End | OR | any path true |
| `TON` | Timer On-Delay | "Wait this long while the rung is true, then say done" | see section 5 |

Tip: **XIC = is it on? XIO = is it off?** Think of XIO as "NOT".

---

## 5. The timer (TON), the part that breaks in migrations

A TON counts time while its rung is true.

| Field | Meaning |
| --- | --- |
| `PRE` (preset) | how long to wait |
| `ACC` (accumulator) | how long it has counted so far |
| `EN` (enabled) | the rung is true |
| `TT` (timer timing) | counting, not done yet (EN and not DN) |
| `DN` (done) | ACC has reached PRE |

- Rung true: ACC goes up, and DN turns on when ACC >= PRE.
- Rung false: ACC resets to 0 and DN, TT, EN turn off.

**The unit difference (this is the whole reason LadderProof exists):**

| | Old SLC 500 | New Logix |
| --- | --- | --- |
| Units for PRE and ACC | **ticks** of a timebase: 0.01 s or 1.0 s | **milliseconds** |
| Half a second | timebase 0.01 s, PRE = 50 | PRE = 500 |

If someone copies `PRE = 50` straight across, the new timer fires after **50 ms instead of 500 ms**, 10 times too early. The code still looks fine and still compiles.

Rockwell's own converter scales PRE and ACC automatically, and flags any logic that **reads** a timer's PRE or ACC value with a PCE instruction for an engineer to check (1756-RM085I-EN-P, p.32). Our seeded timer bugs represent manual or AI conversion mistakes, **not** Rockwell's converter.

Open rule (Arnav decides and documents it): does ACC grow on the very first scan the rung becomes true? It shifts both programs equally, but it changes the exact scan numbers in golden traces.

---

## 6. Reading the text format

Old SLC text, one rung:

```
SOR XIC I:1/0 OTE O:2/0 EOR
```

`SOR` = start of rung, `EOR` = end of rung. In English: "If input I:1/0 is on, turn on output O:2/0."

### Example: motor start/stop with seal-in

Press Start and the motor runs. Release Start and it **keeps** running (it "seals in" through its own output). Press Stop and it stops.

```
SOR BST XIC I:1/0 NXB XIC O:2/0 BND XIO I:1/1 OTE O:2/0 EOR
```

In English: "If (Start is on OR Motor is already on) AND Stop is off, then Motor is on."

| Address | Meaning |
| --- | --- |
| `I:1/0` | Start button |
| `I:1/1` | Stop button (1 = pressed) |
| `O:2/0` | Motor |

(Real plants usually wire Stop buttons the other way for safety. Our demo keeps it simple: 1 = pressed.)

### Trace of that rung

| Executed scan | Start | Stop | Motor after scan |
| --- | --- | --- | --- |
| 1 | 1 | 0 | 1 (started) |
| 2 | 0 | 0 | 1 (sealed in) |
| 3 | 0 | 1 | 0 (stopped) |
| 4 | 0 | 0 | 0 (stays off) |

**The flipped-contact bug:** change `XIO I:1/1` to `XIC I:1/1`, and now the motor only runs while Stop is pressed. LadderProof should catch it at scan 1.

---

## 7. The bug types we seed (practice set)

| Bug | What changes | Why it's realistic |
| --- | --- | --- |
| Flipped contact | XIC becomes XIO or the reverse | easy typo during manual rewrite |
| Dropped branch | one OR path disappears | branch structure is the hardest part for translators |
| Swapped output tag | output goes to the wrong name | tag mapping mistakes |
| Timer preset not scaled | PRE 50 stays 50 instead of 500 | the unit difference in section 5 |
| Wrong timebase | 0.01 s treated as 1.0 s | same unit problem, 100x off |
| Stretch 2: timer value compare | `GRT T4:0.ACC 30` keeps 30 after ACC becomes ms | exactly what Rockwell flags with PCE |

---

## 8. Mini glossary

- **Scan:** one pass through the whole program.
- **Rung:** one line of logic.
- **Seal-in:** an output that keeps itself on through its own contact.
- **Tag map:** the list pairing old addresses with new names.
- **Golden trace:** the correct output for each scan, worked out **by hand**, used to check our engine.
- **PCE:** Rockwell's marker for a spot in converted code an engineer must review. Use the manual's exact wording for what the letters stand for.

---

## 9. Sources (pull these, cite pages)

- Rockwell 1747-RM001: SLC 500 Instruction Set Reference (XIC, XIO, OTE, TON, timebases)
- Rockwell 1756-RM003: Logix 5000 General Instructions Reference (TON in milliseconds)
- Rockwell 1756-RM085I-EN-P (Sep 2025): Converting PLC-5 or SLC 500 Logic to Logix-Based Logic, Chapter 3, pp.31-32
  https://literature.rockwellautomation.com/idc/groups/literature/documents/rm/1756-rm085_-en-p.pdf
