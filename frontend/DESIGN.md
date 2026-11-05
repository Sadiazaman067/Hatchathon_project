# LadderProof UI design rules

Read this whole file before writing any frontend code. If a request conflicts with this file, CLAUDE.md or CONTRACT.md, stop and ask. CONTRACT.md wins on data; this file wins on looks.

Reference mockup (two screens, plus video title cards): ask Tami for the link.

**Relationship to CLAUDE.md:** this file expands CLAUDE.md's "UI look" section. Two proposed stack changes (pending the team's OK in the group chat; until then, ask before dropping Recharts or Monaco): the signal timeline is plain SVG instead of Recharts (simpler, and it has to look like a logic analyzer, not a chart), and the Monaco diff is optional: use it only for a "Full program" tab under the report, after the five core pieces work.

## 1. The idea in one line

LadderProof looks like an **electrical drawing sheet**: drafting-grid paper, thin construction lines, a title block, and the ladder diagram's own shapes (two vertical rails, rungs, contacts, coils). Color appears only when something needs attention.

Why: generic AI UIs are dark dashboards with glowing cards and one accent color. Ours borrows from the world the product lives in, so it can't be mistaken for a template.

## 2. Hard rules

1. **Color means status, nothing else.** Red = `different`. Amber = `needs_review`. Green = `no_difference_observed`. Everything else is ink, grey and paper. No blue links, no purple buttons, no colored icons for decoration.
2. **Every status color also has a text label** (the word DIFFERENT, NEEDS REVIEW, NO DIFFERENCE OBSERVED). Never color alone.
3. **Wording:** never "proven", "equivalent", "safe", "verified correct", "pass". Say "no difference observed on N scenarios". Every report shows: "Tested scenarios only. Not a proof of equivalence."
4. **The UI never decides anything.** It shows the `Report` JSON from CONTRACT.md section 8. It never computes a verdict, a first difference, or a number that isn't in the report.
5. **Never invent data.** If a field is missing or null, show "not available", not a guess. Demo data is labeled SAMPLE DATA until it is a measured result.
6. **No:** gradients, glows, drop shadows on cards, glassmorphism, emoji, rounded pill cards everywhere, stock illustrations, icon libraries for decoration, dark mode (not needed for P0).
7. **Works offline.** The expo may have no Wi-Fi. Fonts are installed as packages, not loaded from Google.

## 3. Tokens

Put these in one place (`src/styles/tokens.css`) as CSS variables and map them in Tailwind's `@theme`. Don't type hex codes anywhere else.

| Token | Value | Use |
|---|---|---|
| `--paper` | `#F3F1EB` | page background (with grid, see below) |
| `--sheet` | `#FBFAF6` | the drawing sheet, inputs |
| `--ink` | `#1C1B19` | text, rails, rules, primary button |
| `--muted` | `#5C584F` | secondary text (passes 4.5:1 on paper and sheet) |
| `--hair` | `#CFC9BD` | thin borders, zone strips |
| `--hair-2` | `#E3DED3` | row dividers, grid lines |
| `--red` | `#B42318` | `different` only |
| `--red-tint` | `rgba(180,35,24,0.09)` | shading where legacy and target disagree |
| `--amber` | `#B54708` | `needs_review` only (text on tint: `#8A3A06`) |
| `--amber-tint` | `rgba(181,71,8,0.07)` | |
| `--green` | `#067647` | `no_difference_observed` only |

**Grid paper background:** `background-image: linear-gradient(var(--hair-2) 1px, transparent 1px), linear-gradient(90deg, var(--hair-2) 1px, transparent 1px); background-size: 24px 24px;`

**Type** (one family, three cuts; install `@fontsource/ibm-plex-sans`, `@fontsource/ibm-plex-mono`, `@fontsource/ibm-plex-serif`):
- IBM Plex Serif 400: the one big plain-English headline per screen (36 to 40px, line-height 1.15).
- IBM Plex Sans 400/500/600: all body text (15 to 16px body, 13px secondary, never under 12px).
- IBM Plex Mono 400/500/600: tags, addresses, rung text, numbers, and small uppercase labels ("eyebrows": 11px, letter-spacing 0.12em).

**Spacing:** multiples of 4px. Sheet padding 32 to 36px. Gap between sections 28 to 32px.

**Corners:** square (0 radius) for the sheet, tables and buttons. This is a drawing, not an app store.

**Buttons:** primary = solid ink with paper text. Secondary = ink outline, transparent fill. Disabled = `--hair-2` fill, `--muted` text, `cursor: not-allowed`, plus a sentence saying why it's locked.

## 4. Layout shell (every screen)

```
[ top bar: logo · project name ("Conveyor seal-in · SLC 500 → Logix") ·          DWG LP-001 · REV A ]
[ step rail ] [ drawing sheet                                                                    ]
```

- **Step rail (left, about 180px):** a vertical 2px ink line (the ladder's left power rail). Four steps: 01 Upload, 02 Tag map, 03 Replay, 04 Report. Done = check mark. Current = a coil symbol `( )` and "here". Not yet = hollow dot. Each step has one short status line under it ("3 of 3 confirmed"). On narrow screens the rail goes on top.
- **Drawing sheet:** `--sheet` fill, 1px `--hair` border, a 24px zone strip on top (1 to 6) and on the left (A, B, C...), and four small square corner handles (7px). Content sits inside with 32 to 36px padding.
- **Title block:** a bordered two-column table with tiny uppercase mono labels and mono values, like the box in the corner of a real electrical drawing. Used for run details.
- Max content width about 1400px. Design and check at **1920×1080** (the size we record the video at) and at 1440 wide.

## 5. Screens

The UI state flow is fixed by CONTRACT.md section 9: upload → parse result → optional convert → tag-map confirmation → verify → report.

Each screen has **one focal element** that a video headline can point at. Build that element first and make it obvious.

### 01 Upload
- Focal element: two drop zones side by side, "Legacy · SLC 500" and "Converted · Logix (optional)". After dropping, each shows the file name, rung count and the first rungs in mono.
- Parse diagnostics (`diagnostics` from `POST /api/projects`) show as amber rows: line number, code, message. Any diagnostic means the result can't be a clean pass, so say so.
- Button: "Continue to tag map".

### 02 Tag map
- Serif headline: "Which old address is which new tag?" plus one sentence: nothing runs until every row is confirmed.
- Focal element: the mapping table. Columns: confirm checkbox, legacy tag, arrow, target tag, kind (`input` / `observable`), rule, evidence. Whole row is clickable. Confirmed rows add "user-confirmed" to the evidence text.
- Unmatched or ambiguous rows: amber tint, italic "no match", checkbox disabled, plus an amber note explaining that unmatched means `needs_review`, never a pass.
- "Confirm all matched" (secondary) and "Run replay" (primary). "Run replay" stays disabled until every row is confirmed, with the reason written next to it.
- On Run replay, send the confirmed list as `tag_map` with `confirmed_tag_map: true` (CONTRACT.md section 9).

### 03 Replay (running)
- Focal element: a large mono counter of what's being run (scenarios, scans per scenario, seed, dt). Show the settings being sent; don't show fake progress percentages. A simple "running" state is fine; it is fast.

### 04 Report
Three versions, chosen only by `report.status`:

**`different` (the demo screen):**
1. Verdict block: red DIFFERENT tag plus eyebrow "First difference · executed scan N". Serif headline in plain English, written from `first_divergence` and the confirmed tag map, e.g. "The old program turns Motor on. The converted one doesn't." (template: if legacy=1 and target=0, "The old program turns {target_tag} on. The converted one doesn't."; reverse for 0/1). Under it: "At scan {scan}, {target_tag} ({legacy tag}) is {legacy} in the legacy program and {target} in the target." Then a mono line from `coverage` and `assumptions`, and the not-a-proof sentence.
2. **Signal timeline (the signature element).** Logic-analyzer style, drawn as plain SVG step lines (no chart library needed). Data comes ONLY from `trace_window`:
   - One pair of rows per observable tag: "{tag} · legacy" and "{tag} · target". High = 1, low = 0, light fill under high.
   - Columns = scans `start_scan..end_scan`. Ruler on top with scan numbers.
   - Columns where legacy and target differ get `--red-tint` shading.
   - The first-difference column gets a 1.5px red box with four small square corner handles, and the header label "N first difference".
   - Input events from `counterexample` appear as small mono markers on an "Inputs" lane (e.g. "scan 0 · I:1/0 = 1"). Do NOT draw input waveforms; the report doesn't contain them.
   - One sentence under it in plain English.
3. **Rung, as drawn** (only when `first_divergence.rung` is not null): the legacy rung and the target rung with the same number, drawn as ladder symbols (rails, `─| |─` XIC, `─|/|─` XIO, `─( )─` OTE, one-level branch). Changed instructions get the red box with corner handles and a small "XIO → XIC" label. Caption: "Drawn from the rung text to help you look. The verdict comes from the replay." Rungs are matched by position; say so. Fallback if the drawing isn't ready: two rows of mono token chips with the changed token outlined in red.
4. Right column: title block (profiles, seed, scan period, scenarios, scans, rules used, warnings), "Replay inputs" (the `counterexample` list) with a "Copy CLI command" button, and the relevant `mapping_evidence`.

**`needs_review`:** amber NEEDS REVIEW tag. Serif headline: "We can't give a result for this yet." List every `warnings` entry (code in mono, then the message) and any unmatched tags. No timeline.

**`no_difference_observed`:** green tag. Serif headline: "No difference observed on {scenarios} scenarios." A visible box: "This is not proof the programs are the same. It means these tested inputs produced the same outputs under profile X." Title block and coverage. No celebration, no confetti, no big check mark.

## 6. Motion (small, for the video)

CSS only. Respect `prefers-reduced-motion` (show the final state immediately).
- Report load: waveforms draw left to right (`stroke-dashoffset`, 600ms, ease-out). Then the red first-difference box fades in and settles (150ms, after the draw).
- Tag map: a confirmed row's evidence text changes instantly. No bouncing.
- Button press: 120ms color change. Nothing else moves. No looping animations.

## 7. Demo mode

- The repo ships fixed demo fixtures so every recording plays out the same. `sample_report.json` (CONTRACT.md section 8 example) is the first fixture: build every screen against it before the API exists.
- Show a small "SAMPLE DATA" stamp on the report whenever it is loaded from a fixture and not from a real `verify()` run.

## 8. Video title cards

The pitch video uses title cards in this same style (grid paper, sheet, serif headline, mono eyebrow) between screen recordings, so the video and the app look like one product. One headline sentence per beat, and at most two lines of text on a card. Numbers on cards come only from measured results (`docs/benchmark.md`); until measured, they say "to be measured".

## 9. Before you call a screen done

- [ ] Every color used means a status, and every status has its word.
- [ ] No banned words (proven, equivalent, safe, pass).
- [ ] Every number on screen traces to a field in the report or the request.
- [ ] Readable at 1920×1080 from across a room: headline, verdict tag and timeline.
- [ ] Keyboard: every control reachable with Tab, visible focus ring (2px ink outline).
- [ ] Works with Wi-Fi off.
