import type { Report, Status } from "../report/types";
import { differenceSummary, statusLabel } from "../playback/plainLanguage";

export interface SessionRun {
  projectId: string;
  status: Status;
  headline: string;
}

export function sessionEntry(projectId: string, report: Report): SessionRun {
  const headline =
    report.status === "different" ? differenceSummary(report) : statusLabel(report.status);
  return { projectId, status: report.status, headline };
}

export function rememberSession(runs: SessionRun[], next: SessionRun): SessionRun[] {
  return [next, ...runs.filter((run) => run.projectId !== next.projectId)];
}
