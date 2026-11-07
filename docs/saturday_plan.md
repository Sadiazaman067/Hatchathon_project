# Saturday Plan: Sat Nov 7

**Code freeze at 6 pm.** After 12 pm: only fixes, no new features.

**First, everyone:** run `git pull`.

---

## Morning

**Adaora:**
- [ ] connect the UI to the API: upload -> tag map -> verify -> report
- [ ] all three report states
- [ ] fonts work offline

**Arnav:**
- [ ] `scenarios.py` supports timer programs
- [ ] confirm the SLC TON first-scan rule (1747-RM001) and cite it in `docs/semantics.md` S6

**Tami:**
- [ ] integration support and bug fixes
- [ ] Stretch 1 live (Claude API, offline fallback to `demo/ai_conversion/`): ONLY if everything above works by 12 pm

**Sadia:**
- [ ] the 3 benchmark programs
- [ ] reviewer sheet: a blank checking table + one worked example that is not in the test
- [ ] slide deck draft

---

## Midday (time agreed with Adaora)

Manual-vs-LadderProof benchmark, about 1.5 h. Sadia runs it, Adaora is the reviewer. Record the results in `docs/benchmark.md`.

---

## 3 pm: full demo dry run

On ONE laptop, with Wi-Fi OFF:
1. seal-in (flipped Stop)
2. timer (unscaled preset)
3. AI conversion
4. one `needs_review` case

Note every problem.

---

## 3 to 5:30 pm

Fix only what the dry run found. Update `README.md` and `docs/limitations.md`.

---

## 6 pm: freeze

Tag the commit `freeze-sat` and push the tag. After this: only demo-breaking fixes the whole team agrees on.

---

## After the freeze

Sadia runs the hidden set once, from outside the repo:
`python -m backend.app.cli benchmark <hidden folder>`
Then she fills the results into the pitch.

---

## Evening and Sunday

- **Saturday evening:** slide deck complete.
- **Sunday:** two rehearsals and a backup video.
