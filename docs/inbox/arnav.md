# Inbox: Arnav

Newest notes at the top. Add new notes above older ones; don't edit someone else's notes.
Each note: at most 2 lines, plain English, action first. Details live in docs/interfaces.md.

---

- **2026-11-06 · Tami:** convert() now outputs target timers as `T4_0` with status tags `T4_0.DN` / `T4_0.TT`. Please trace them under exactly those names once timers run.
- **2026-11-06 · Tami:** Timer gate is today: confirm S6 against the TON flowchart, then ping Tami to review.
- **2026-11-06 · Tami:** Please add an optional `scans` argument to run() (default = current behavior), so scenarios can run a fixed number of scans.
- **2026-11-06 · Tami:** When timers run, trace DN and TT under native names (`T4:0/DN`, `Timer0.DN`). The tag map uses exactly those names.
- **2026-11-06 · Tami:** Check in your golden traces that a scaled preset (legacy PRE x timebase_ms) gives the same DN scan at dt = 10 ms. Until then we don't quote it.
