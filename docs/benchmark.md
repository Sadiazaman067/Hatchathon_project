# Manual vs. automated verification benchmark (owner: Sadia)

**Purpose:** measure whether LadderProof finds migration bugs faster and more completely than checking by hand. This supports the innovation and problem-market-fit claims with our own numbers.

**Set:** 3 legacy programs, each with a converted version containing 1 to 2 seeded bugs. These are separate from the practice set and the hidden set.

**Reviewer:** Adaora, who did not write the seeded bugs. Record their experience level honestly (for example "beginner, 3 days of ladder logic").

**Manual run (timed):** the reviewer gets the legacy text, the converted text and the tag map, and must decide whether they behave the same, using hand-written input cases and stepping through scans on paper or a spreadsheet. No LadderProof. Stop at 30 minutes per program.

**LadderProof run (timed):** same programs: upload, confirm tag map, verify, read the report.

**Order:** to reduce learning effects, do the manual run first on all programs, then LadderProof, and don't tell the reviewer the bug count.

| Program | Method | Minutes to first finding | Total minutes | Bugs found / seeded | False findings |
| --- | --- | --- | --- | --- | --- |
| P1 | Manual | | | / | |
| P1 | LadderProof | | | / | |
| P2 | Manual | | | / | |
| P2 | LadderProof | | | / | |
| P3 | Manual | | | / | |
| P3 | LadderProof | | | / | |

**How to state it in the pitch:** "In our own timed test, a [experience level] reviewer took X minutes by hand and found A of B bugs; LadderProof took Y minutes and found C of B." Never present it as an industry-wide efficiency figure.
