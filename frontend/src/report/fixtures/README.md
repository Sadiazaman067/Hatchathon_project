# Report fixtures (real CLI output, Sat Nov 7)

Each file is the unedited JSON printed by `python -m backend.app.cli verify ...` from the repo root:

| File | Legacy / target / map / inputs | Status |
| --- | --- | --- |
| `ai_unscaled_different.json` | `demo/ai_conversion/`: `legacy.txt`, `target_ai_unscaled_example.txt`, `tag_map.json`, `inputs.json` | different |
| `ai_no_difference.json` | `demo/ai_conversion/`: `legacy.txt`, `target_ai.txt`, `tag_map.json`, `inputs.json` | no_difference_observed |
| `seal_in_flipped_stop.json` | `backend/tests/fixtures/seal_in/`: `legacy.txt`, `target_bug_flipped_stop.txt`, `tag_map.json`, `inputs.json` | different |
| `swapped_output_needs_review.json` | `backend/tests/fixtures/practice/a03_swapped_output_tag/`: `legacy.txt`, `target.txt`, `tag_map.json`, `inputs.json` | needs_review |

Re-generate them if the engine changes. The preview shows them with a SAMPLE DATA stamp.
