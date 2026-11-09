import {
  differenceSummary,
  statusLabel,
  stepReadout,
  whatThisMeans,
} from "../../playback/plainLanguage";
import type { Report } from "../../report/types";

/** Renders report.status only. Does not compute a verdict. */
export default function VerdictBlock({
  report,
  onOpenDetails,
}: {
  report: Report;
  onOpenDetails: () => void;
}) {
  const readout = stepReadout(report);
  const summary =
    report.status === "different" && report.first_divergence
      ? differenceSummary(report)
      : statusLabel(report.status);

  return (
    <header className="verdict">
      <div className="verdict-row">
        <span className={`status-tag ${report.status}`}>{statusLabel(report.status)}</span>
        {readout ? <p className="eyebrow">{readout}</p> : null}
        <button type="button" className="ink-btn" onClick={onOpenDetails}>
          Details
        </button>
      </div>
      <h2 className="verdict-title">{summary}</h2>
      {report.first_divergence ? (
        <p className="footnote">
          Motor output at that scan: original {report.first_divergence.legacy}, converted{" "}
          {report.first_divergence.target}
          {report.first_divergence.rung !== null
            ? `. Written by original rung ${report.first_divergence.rung}.`
            : "."}{" "}
          Seed, scan period, and addresses are in Details.
        </p>
      ) : null}
      <details className="what-means">
        <summary>What this result means</summary>
        <p>{whatThisMeans(report)}</p>
      </details>
    </header>
  );
}
