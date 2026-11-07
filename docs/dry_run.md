# Dry run: Sat Nov 7, 4:30 pm

One laptop, Wi-Fi OFF. Write every problem in the "Problems" list at the bottom, with who fixes it. Fix only those between now and the 6 pm freeze.

Expected results below were measured on main on Sat Nov 7 (UI path = API with generated scenarios, seed 42, 200 scenarios x 300 scans; CLI path = the fixture `inputs.json`). If you see something else, write it down; don't explain it away.

---

## 1. Before turning Wi-Fi off

- [ ] `git pull` (repo root)
- [ ] `pip install -r requirements.txt`
- [ ] `cd frontend` then `npm install`, then `cd ..`
- [ ] `python -m pytest -q`: all tests pass
- [ ] Turn Wi-Fi OFF. Everything below runs offline.

## 2. Start the API (terminal 1, repo root)

- [ ] `uvicorn backend.app.api:app --port 8000`
- [ ] http://localhost:8000/docs opens (FastAPI's page)

## 3. Start the frontend (terminal 2)

- [ ] `cd frontend` then `npm run dev`
- [ ] http://localhost:5173 opens
- [ ] Fonts are IBM Plex (serif headline, mono tags), not a fallback font. Wi-Fi is off, so this proves they are bundled.

## 4. Demo 1: seal-in, flipped Stop (UI)

Files: `frontend/public/demo/seal_in/` (`legacy.txt`, `target_bug_flipped_stop.txt`, `tag_map.json`), or "Load demo".

- [ ] Upload: legacy 1 rung, target 1 rung, no diagnostics
- [ ] Tag map: 3 rows (I:1/0 Start, I:1/1 Stop, O:2/0 Motor), all confirmed, Run enabled
- [ ] Report: **DIFFERENT** (red), first difference at **executed scan 1**, `O:2/0` (Motor): legacy 0, target 1, rung 1. In words: Stop is pressed and the converted program turns Motor ON.
- [ ] Replay inputs: scan 0 · I:1/0 = 1, scan 0 · I:1/1 = 1
- [ ] Timeline draws, red box on scan 1, "Tested scenarios only. Not a proof of equivalence." is visible

## 5. Demo 2: AI conversion, unscaled preset (UI)

Files: `frontend/public/demo/ai_conversion/` (`legacy.txt`, `target_ai_unscaled_example.txt`, `tag_map.json`).

- [ ] Upload: legacy 4 rungs, target 4 rungs, no diagnostics
- [ ] Tag map: 7 rows (2 inputs, 3 outputs, StartDelay.DN, StartDelay.TT), all confirmed
- [ ] Report: **DIFFERENT**, **executed scan 21**, `O:2/0` (Conveyor_Motor): legacy 0, target 1, rung 4
- [ ] Timeline target rows show target names (Conveyor_Motor, Run_Light, Warning_Horn, StartDelay.DN, StartDelay.TT)
- [ ] Say in the pitch: this target is the AI file with one hand edit (preset 2000 -> 200), not AI output

## 6. Demo 3: AI conversion, as produced (UI)

Same folder, target `target_ai.txt`.

- [ ] Report: **NO DIFFERENCE OBSERVED** (green) on **200 scenarios**, 60000 scans, seed 42
- [ ] The "This is not proof the programs are the same" box is visible
- [ ] No celebration, no banned words on screen (proven, equivalent, safe, pass)

## 7. needs_review case

Files: `frontend/public/demo/needs_review/` (`legacy.txt`, `target.txt`, `tag_map.json`): the seal-in with one OSR added to the target.

- [ ] UI: upload both files. Expected: legacy 1 rung; target 0 rungs with one diagnostic on line 1, `UNSUPPORTED_OPCODE`, "unsupported instruction 'OSR' at column 46"; verify gives **NEEDS REVIEW** (amber) with that warning.
- [ ] Unconfirmed map: on any demo, try to run with a row unconfirmed. Expected: Run stays disabled with the reason shown.

## 8. CLI fallback (if the UI fails, the demo runs here)

Run from the repo root. Each prints the report JSON.

- [ ] Seal-in, flipped Stop. Expected: `different`, scan 1, `O:2/0`, legacy 1, target 0, rung 1 (fixture inputs: Start pressed, Stop not pressed).
  ```
  python -m backend.app.cli verify --legacy backend/tests/fixtures/seal_in/legacy.txt --target backend/tests/fixtures/seal_in/target_bug_flipped_stop.txt --map backend/tests/fixtures/seal_in/tag_map.json --inputs backend/tests/fixtures/seal_in/inputs.json
  ```
- [ ] AI unscaled. Expected: `different`, scan 21, `O:2/0`, legacy 0, target 1, rung 4.
  ```
  python -m backend.app.cli verify --legacy demo/ai_conversion/legacy.txt --target demo/ai_conversion/target_ai_unscaled_example.txt --map demo/ai_conversion/tag_map.json --inputs demo/ai_conversion/inputs.json
  ```
- [ ] AI as produced. Expected: `no_difference_observed`, 3 scenarios, 900 scans.
  ```
  python -m backend.app.cli verify --legacy demo/ai_conversion/legacy.txt --target demo/ai_conversion/target_ai.txt --map demo/ai_conversion/tag_map.json --inputs demo/ai_conversion/inputs.json
  ```
- [ ] needs_review. Expected: `needs_review`, `UNSUPPORTED_OPCODE: target line 1: unsupported instruction 'OSR' at column 46`.
  ```
  python -m backend.app.cli verify --legacy demo/needs_review/legacy.txt --target demo/needs_review/target.txt --map demo/needs_review/tag_map.json --inputs demo/needs_review/inputs.json
  ```
- [ ] Report screen preview with saved reports (no API needed): http://localhost:5173/report-preview.html

Note: the UI and the CLI use different inputs (generated scenarios vs `inputs.json`), so the seal-in values differ (UI: legacy 0, target 1; CLI: legacy 1, target 0). Both are scan 1. Know which one you're showing.

## 9. After the run

- [ ] Stop both servers (Ctrl+C), turn Wi-Fi back on
- [ ] Problems below assigned to an owner

## Problems

| # | What happened | Where (step) | Owner | Fixed? |
| --- | --- | --- | --- | --- |
| 1 | | | | |
