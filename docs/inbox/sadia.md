# Inbox: Sadia

Newest notes at the top. Add new notes above older ones; don't edit someone else's notes.
Each note: at most 2 lines, plain English, action first. Details live in docs/interfaces.md.

---

- **2026-11-06 · Tami:** Use `demo/ai_conversion/` as the AI demo program in the pitch (Stretch 1, recorded AI conversion). The unscaled file is a hand edit, not AI output; say so. See its README.
- **2026-11-06 · Tami:** Benchmark runner is ready: `python -m backend.app.cli benchmark <suite> --out results/<name>.json`. Keep the hidden suite outside the repo (in-repo folders are refused); see "Benchmark runner" in [docs/interfaces.md](../interfaces.md).
- **2026-11-06 · Tami:** For TON fixtures, the converted target of `TON T4:0 0.01 50 0` is `TON T4_0 500 0`, with tags `T4_0.DN` and `T4_0.TT`. See "convert() and render()" in [docs/interfaces.md](../interfaces.md).
- **2026-11-06 · Tami:** Please push the seal-in fixtures to main.
- **2026-11-06 · Tami:** Use only I:, O: and T4: addresses in fixtures. B3 and other internal bits are unsupported.
- **2026-11-06 · Tami:** Swapped-output-tag bug: the expected result is needs_review with a MISSING_OBSERVABLE warning naming the tag, not different. Put that in the answer key.
- **2026-11-06 · Tami:** Follow "Fixture formats" in [docs/interfaces.md](../interfaces.md), and tell Tami the file names so test_e2e.py can use them.
