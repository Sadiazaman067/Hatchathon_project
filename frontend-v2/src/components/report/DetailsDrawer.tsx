import { useEffect, useRef } from "react";
import CoverageAssumptions from "./CoverageAssumptions";
import MappingEvidence from "./MappingEvidence";
import WarningsList from "./WarningsList";
import { coverageStepsNote, detailsWarning, everydayName, pressedReleased } from "../../playback/plainLanguage";
import type { TagMapping } from "../../api/client";
import type { InputEvent, Report } from "../../report/types";

type Props = {
  report: Report;
  open: boolean;
  onClose: () => void;
  legacyText?: string;
  targetText?: string;
  inputs?: InputEvent[];
  tagMap?: TagMapping[];
};

export default function DetailsDrawer({
  report,
  open,
  onClose,
  legacyText,
  targetText,
  inputs,
  tagMap,
}: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const warning = detailsWarning(report);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const rung = report.first_divergence?.rung ?? null;
  const events = inputs ?? [];

  return (
    <div className="drawer-root">
      <button type="button" className="drawer-backdrop" aria-label="Close details" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-labelledby="details-title">
        <div className="drawer-head">
          <h2 id="details-title">Details</h2>
          <button ref={closeRef} type="button" className="ink-btn" onClick={onClose}>
            Close
          </button>
        </div>
        {warning ? (
          <p className="details-warn" role="alert">
            {warning}
          </p>
        ) : null}
        <p className="footnote">{coverageStepsNote(report)}</p>
        <p className="footnote">
          <span tabIndex={0} title="XIC is true when its bit is 1.">
            XIC
          </span>
          {", "}
          <span tabIndex={0} title="XIO is true when its bit is 0.">
            XIO
          </span>
          {", "}
          <span tabIndex={0} title="OTE writes the rung power to an output bit.">
            OTE
          </span>
          {" are the contact and output instructions used in these samples."}
        </p>
        {rung !== null ? (
          <p className="footnote">
            Written by original rung <span className="mono">{rung}</span> (named only when exactly
            one rung writes that tag).
          </p>
        ) : null}

        {events.length > 0 ? (
          <section className="panel" aria-labelledby="inputs-heading">
            <h3 id="inputs-heading">Input sequence</h3>
            <p className="footnote">Both programs received exactly this sequence.</p>
            <table className="kv">
              <thead>
                <tr>
                  <th scope="col">Scan</th>
                  <th scope="col">Input</th>
                  <th scope="col">Value</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event, index) => (
                  <tr key={`${event.scan}-${event.tag}-${index}`}>
                    <td className="mono">{event.scan}</td>
                    <td>{everydayName(report, event.tag)}</td>
                    <td>{pressedReleased(event.value)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {legacyText || targetText ? (
          <section className="panel" aria-labelledby="programs-heading">
            <h3 id="programs-heading">Programs</h3>
            {legacyText ? (
              <>
                <p className="footnote">Original</p>
                <pre className="program-text">{legacyText}</pre>
              </>
            ) : null}
            {targetText ? (
              <>
                <p className="footnote">Converted</p>
                <pre className="program-text">{targetText}</pre>
              </>
            ) : null}
          </section>
        ) : null}

        {tagMap && tagMap.length > 0 ? (
          <section className="panel" aria-labelledby="namemap-heading">
            <h3 id="namemap-heading">Name map</h3>
            <table className="draft-table">
              <thead>
                <tr>
                  <th scope="col">Original</th>
                  <th scope="col">Converted</th>
                  <th scope="col">Kind</th>
                </tr>
              </thead>
              <tbody>
                {tagMap.map((row) => (
                  <tr key={`${row.legacy_tag}-${row.target_tag}`}>
                    <td className="mono">{row.legacy_tag}</td>
                    <td className="mono">{row.target_tag}</td>
                    <td>{row.kind}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        <CoverageAssumptions report={report} />
        <MappingEvidence report={report} />
        <WarningsList report={report} />
      </aside>
    </div>
  );
}
