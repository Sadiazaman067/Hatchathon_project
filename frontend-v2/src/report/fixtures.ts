import type { InputEvent, Status } from "./types";
import type { TagMapping } from "../api/client";
import matchNoDifference from "./fixtures/match_no_difference.json";
import droppedStopDifferent from "./fixtures/dropped_stop_different.json";
import unsupportedOsrNeedsReview from "./fixtures/unsupported_osr_needs_review.json";
import sampleInputs from "./fixtures/sample_inputs.json";
import sampleTagMap from "./fixtures/sample_tag_map.json";
import matchLegacy from "./fixtures/match_legacy.txt?raw";
import matchTarget from "./fixtures/match_target.txt?raw";
import droppedStopLegacy from "./fixtures/dropped_stop_legacy.txt?raw";
import droppedStopTarget from "./fixtures/dropped_stop_target.txt?raw";
import osrLegacy from "./fixtures/unsupported_osr_legacy.txt?raw";
import osrTarget from "./fixtures/unsupported_osr_target.txt?raw";

export interface FixtureOption {
  id: string;
  title: string;
  summary: string;
  category: string;
  /** Kept for tests and status coloring. Not shown as the card title. */
  label: string;
  status: Status;
  data: unknown;
  /** Same scripted inputs both programs received. Not a report field. */
  inputs: InputEvent[];
  legacyText: string;
  targetText: string;
  tagMap: TagMapping[];
}

const SHARED_INPUTS = sampleInputs as InputEvent[];
const SHARED_MAP = sampleTagMap as TagMapping[];

function trimProgram(text: string): string {
  return text.replace(/\n+$/, "");
}

export const FIXTURES: FixtureOption[] = [
  {
    id: "match_no_difference",
    title: "No difference observed",
    summary:
      "Same seal-in on both sides. Start, then Stop. Both motors follow the same inputs. Replay uses this tested sequence only.",
    category: "matching seal-in",
    label: "no_difference_observed",
    status: "no_difference_observed",
    data: matchNoDifference,
    inputs: SHARED_INPUTS,
    legacyText: trimProgram(matchLegacy),
    targetText: trimProgram(matchTarget),
    tagMap: SHARED_MAP,
  },
  {
    id: "dropped_stop_different",
    title: "Difference found: conveyor fails to stop",
    summary:
      "Converted program dropped the Stop check. Same inputs as the matching sample. Original motor turns off when Stop is pressed; converted stays on.",
    category: "dropped Stop contact",
    label: "different · dropped stop",
    status: "different",
    data: droppedStopDifferent,
    inputs: SHARED_INPUTS,
    legacyText: trimProgram(droppedStopLegacy),
    targetText: trimProgram(droppedStopTarget),
    tagMap: SHARED_MAP,
  },
  {
    id: "unsupported_osr_needs_review",
    title: "Needs review",
    summary:
      "The converted rung uses OSR, which this checker does not model. It will not guess a pass or a difference.",
    category: "unsupported instruction",
    label: "needs_review · OSR",
    status: "needs_review",
    data: unsupportedOsrNeedsReview,
    inputs: SHARED_INPUTS,
    legacyText: trimProgram(osrLegacy),
    targetText: trimProgram(osrTarget),
    tagMap: SHARED_MAP,
  },
];
