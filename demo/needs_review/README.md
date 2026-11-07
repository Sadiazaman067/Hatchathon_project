# needs_review demo

Seal-in program (same legacy as `backend/tests/fixtures/seal_in`). The target is the correct seal-in plus one OSR (one-shot), which is outside our subset.

Expected: `needs_review`, `UNSUPPORTED_OPCODE: target line 1: unsupported instruction 'OSR' at column 46`. The upload response shows the same diagnostic in `target_diagnostics` and `target_rung_count` 0.

Point for the pitch: an unsupported instruction is never skipped and never counted as no difference.
