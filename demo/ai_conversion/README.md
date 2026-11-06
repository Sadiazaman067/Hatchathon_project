# AI conversion demo (Stretch 1, recorded)

**Program:** delayed conveyor start (SLC 500). Start/Stop latch a Run light; a 2-second timer (T4:0, 200 ticks of 0.01 s) sounds a warning horn, then starts the conveyor motor.

**Conversion:** `target_ai.txt` was produced by Claude (Anthropic) on Fri Nov 6, 2026, from this prompt:

> Convert this Allen-Bradley SLC 500 ladder program to Studio 5000 Logix. Keep the same mnemonic text format, one rung per line (SOR ... EOR), and use descriptive tag names. Logix timer format: TON <timer> <preset> <accum>.
> (followed by the four rungs in legacy.txt)

**LadderProof result** (CLI, inputs.json, 3 scripted scenarios x 300 scans):
- `target_ai.txt` -> `no_difference_observed` (3 scenarios, 900 scans). Claude multiplied the preset correctly: 200 ticks x 10 ms = 2000 ms.
- `target_ai_unscaled_example.txt` -> `different` at scan 21, Conveyor_Motor (O:2/0): legacy 0, target 1, rung 4.
  This file is NOT AI output. It is the AI file with one hand edit (preset 2000 -> 200), showing the mistake a converter or AI could make: the motor starts after 0.2 s instead of 2 s.

Run it:
```
python -m backend.app.cli verify --legacy demo/ai_conversion/legacy.txt --target demo/ai_conversion/target_ai.txt --map demo/ai_conversion/tag_map.json --inputs demo/ai_conversion/inputs.json
```
