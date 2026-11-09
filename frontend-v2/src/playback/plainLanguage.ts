import type { Bit, Report, Status } from "../report/types";
import { targetName } from "../report/types";
import type { InspectorModel } from "./inspector";
import { heldInputs } from "./inputs";
import { mapRoles } from "./roles";

export const STATUS_LABEL: Record<Status, string> = {
  different: "Difference found",
  no_difference_observed: "No difference observed",
  needs_review: "Needs review",
};

const NOT_A_PROOF = "This is not a proof the programs are the same.";

function norm(name: string): string {
  return name.trim().toLowerCase();
}

/** Everyday name from mapping target names (or the tag if unmapped). Never invents a cause. */
export function everydayName(report: Report, tag: string): string {
  const mapped = targetName(report, tag);
  const source = mapped ?? tag;
  const n = norm(source);
  if (n.endsWith("/dn") || n.endsWith(".dn")) return "timer done bit";
  if (n.endsWith("/tt") || n.endsWith(".tt")) return "timer timing bit";
  if (n === "start" || n === "start_pb" || n === "start button") return "Start button";
  if (n === "stop" || n === "stop_pb" || n === "stop button") return "Stop button";
  if (n.includes("motor") || n === "conveyor" || n === "conveyor_motor") return "conveyor";
  if (n.includes("light")) return mapped ? mapped.replaceAll("_", " ") : "light";
  if (n.includes("horn")) return mapped ? mapped.replaceAll("_", " ") : "horn";
  if (mapped) return mapped.replaceAll("_", " ");
  return tag;
}

export function pressedReleased(value: Bit): string {
  return value === 1 ? "Pressed" : "Released";
}

export function onOffWord(value: Bit): string {
  return value === 1 ? "on" : "off";
}

export function technicalName(report: Report, tag: string): string {
  const mapped = targetName(report, tag);
  return mapped ? `${tag} → ${mapped}` : tag;
}

export function stepReadout(report: Report): string | null {
  const d = report.first_divergence;
  if (report.status !== "different" || !d) return null;
  if (report.coverage.scenarios === 1) {
    return `Scan number ${d.scan} of ${report.coverage.scans}`;
  }
  return `Scan number ${d.scan}`;
}

export function coverageStepsNote(report: Report): string {
  const { scenarios, scans } = report.coverage;
  if (scenarios === 1) return `${scans} scans in this test`;
  return `${scans} scans across ${scenarios} scenarios`;
}

function heldPhrase(report: Report, scan: number): string | null {
  const held = heldInputs(report.counterexample, scan);
  const roles = mapRoles(report);
  const parts: string[] = [];
  if (roles.start && held[roles.start] !== undefined) {
    parts.push(`Start button ${pressedReleased(held[roles.start]!)}`);
  }
  if (roles.stop && held[roles.stop] !== undefined) {
    parts.push(`Stop button ${pressedReleased(held[roles.stop]!)}`);
  }
  if (parts.length === 0) {
    const tags = Object.keys(held).sort();
    if (tags.length === 0) return null;
    return tags
      .map((tag) => `${everydayName(report, tag)} ${pressedReleased(held[tag]!)}`)
      .join(", ");
  }
  return parts.join(", ");
}

export function differenceSummary(report: Report): string {
  const d = report.first_divergence;
  if (!d) return "";
  const name = everydayName(report, d.tag);
  const roles = mapRoles(report);
  const heldAt = heldInputs(report.counterexample, d.scan);
  const stopPressed = roles.stop !== null && heldAt[roles.stop] === 1;
  if (stopPressed && d.legacy === 0 && d.target === 1) {
    return `When the Stop button was pressed, the original program stopped the ${name}. The converted program kept it running. This first occurred at scan ${d.scan}.`;
  }
  const held = heldPhrase(report, d.scan);
  const heldClause = held ? ` With ${held.toLowerCase()}.` : "";
  if (d.legacy === 0 && d.target === 1) {
    return `The converted program turns the ${name} on; the original leaves it ${onOffWord(0)}.${heldClause}`;
  }
  if (d.legacy === 1 && d.target === 0) {
    return `The original program turns the ${name} on; the converted one leaves it ${onOffWord(0)}.${heldClause}`;
  }
  return `The original and converted ${name} values differ at this scan.${heldClause}`;
}

export function whatThisMeans(report: Report): string {
  if (report.status === "different") {
    return [
      "The checker found a first difference on the tested inputs.",
      "The pictures follow the compared scans around that difference, not every scan of a longer test.",
      NOT_A_PROOF,
    ].join(" ");
  }
  if (report.status === "no_difference_observed") {
    return [
      `No difference was observed on ${report.coverage.scenarios} scenario${report.coverage.scenarios === 1 ? "" : "s"} under the listed profiles.`,
      "This applies only to the tested input sequence.",
      NOT_A_PROOF,
    ].join(" ");
  }
  return "This checker cannot confidently assess the program. An unsupported or ambiguous instruction stopped the comparison. That is not a confirmed difference.";
}

function inputChangePhrase(report: Report, model: InspectorModel): string {
  if (model.inputsChanged.length === 0) return "No input change";
  return model.inputsChanged
    .map((event) => {
      const fromHeld = model.held[event.tag];
      const to = pressedReleased(event.value);
      if (fromHeld !== undefined && fromHeld !== event.value) {
        return `${everydayName(report, event.tag)}: ${pressedReleased(fromHeld)} → ${to}`;
      }
      return `${everydayName(report, event.tag)}: ${to}`;
    })
    .join("; ");
}

export function inputChangeLine(report: Report, model: InspectorModel): string {
  if (model.inputsChanged.length === 0) return "No input change";
  return model.inputsChanged
    .map((event) => `${everydayName(report, event.tag)}: ${pressedReleased(event.value)}`)
    .join("; ");
}

function sideOutputChange(
  report: Report,
  tags: string[],
  observables: Record<string, 0 | 1> | null,
): string {
  if (observables === null) return "Outputs have not been recorded yet";
  if (tags.length === 0) return "No change";
  return tags
    .map((tag) => {
      const bit = observables[tag];
      if (bit === 1) return `${everydayName(report, tag)} turned on`;
      if (bit === 0) return `${everydayName(report, tag)} turned off`;
      return everydayName(report, tag);
    })
    .join("; ");
}

export function originalOutputChange(report: Report, model: InspectorModel): string {
  return sideOutputChange(report, model.outputsChangedLegacy, model.legacyOutputs);
}

export function convertedOutputChange(report: Report, model: InspectorModel): string {
  return sideOutputChange(report, model.outputsChangedTarget, model.targetOutputs);
}

export function outputChangeLine(report: Report, model: InspectorModel): string {
  return `Original: ${originalOutputChange(report, model)}. Converted: ${convertedOutputChange(report, model)}`;
}

export function disagreeLine(report: Report, model: InspectorModel): string {
  if (model.scan === 0 || model.legacyOutputs === null) return "No compared outputs on this scan";
  if (model.disagree.length === 0) return "No";
  return model.disagree
    .map(
      (row) =>
        `Yes: ${everydayName(report, row.tag)} is ${onOffWord(row.legacy)} in the original and ${onOffWord(row.target)} in the converted`,
    )
    .join("; ");
}

export function detailsWarning(report: Report): string | null {
  const d = report.first_divergence;
  if (report.status !== "different" || !d) return null;
  return `Difference found at scan ${d.scan}: ${everydayName(report, d.tag)} original ${onOffWord(d.legacy)}, converted ${onOffWord(d.target)}.`;
}

/** One sentence from the inspector model. Does not invent a cause. */
export function stepSentence(report: Report, model: InspectorModel): string {
  if (model.scan === 0) {
    const inputs =
      model.inputsChanged.length === 0
        ? "No input events are listed for the start of this clip."
        : `Starting inputs: ${model.inputsChanged
            .map((event) => `${everydayName(report, event.tag)} ${pressedReleased(event.value)}`)
            .join(", ")}.`;
    return `${inputs} Outputs have not been recorded yet.`;
  }
  const inputBit =
    model.inputsChanged.length === 0
      ? "No input change on this scan."
      : `${inputChangePhrase(report, model)}.`;
  if (model.disagree.length > 0) {
    const bits = model.disagree
      .map(
        (row) =>
          `the original ${everydayName(report, row.tag)} is ${onOffWord(row.legacy)} and the converted one is ${onOffWord(row.target)}`,
      )
      .join("; ");
    return `${inputBit} They disagree: ${bits}.`;
  }
  const outputBit =
    model.outputsChangedLegacy.length === 0 && model.outputsChangedTarget.length === 0
      ? "Compared outputs did not change."
      : `Outputs changed (${outputChangeLine(report, model)}).`;
  return `${inputBit} ${outputBit} The original and converted programs agree on this scan.`;
}

export function statusLabel(status: Status): string {
  return STATUS_LABEL[status];
}
