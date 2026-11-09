Demo samples for frontend-v2. Same `inputs.json` and `tag_map.json` for all three.

- `match/` — identical seal-in logic. `no_difference_observed` on 30 scans.
- `dropped_stop/` — converted rung omits Stop. First difference at scan 21 (Stop pressed).
- `unsupported_osr/` — converted rung uses OSR. `needs_review`.

Generate reports:

```
python -m backend.app.cli verify --legacy match/legacy.txt --target match/target.txt --map tag_map.json --inputs inputs.json --scans 30
```
