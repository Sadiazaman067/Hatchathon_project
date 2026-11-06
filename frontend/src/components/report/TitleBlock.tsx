import { splitWarning } from "../../lib/report";
import type { Report } from "../../types/report";

// Like the box in the corner of a real electrical drawing: tiny labels, mono values.
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[112px_minmax(0,1fr)] border-b border-hair last:border-b-0">
      <dt className="m-0 border-r border-hair px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        {label}
      </dt>
      <dd className="m-0 break-words px-3 py-2 font-mono text-[13px] text-ink">{children}</dd>
    </div>
  );
}

export default function TitleBlock({ report }: { report: Report }) {
  const { coverage, assumptions, rules_used, warnings } = report;
  return (
    <section aria-labelledby="title-block">
      <h2 id="title-block" className="m-0 mb-2 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
        Run details
      </h2>
      <dl className="m-0 border border-hair bg-sheet">
        <Row label="Profiles">{assumptions.profiles.join(", ")}</Row>
        <Row label="Seed">{coverage.seed}</Row>
        <Row label="Scan period">{assumptions.dt_ms} ms</Row>
        <Row label="Scenarios">{coverage.scenarios}</Row>
        <Row label="Scans total">{coverage.scans}</Row>
        <Row label="Scan numbers">{assumptions.executed_scan_index === "1_based" ? "start at 1" : assumptions.executed_scan_index}</Row>
        <Row label="Rules used">{rules_used.length ? rules_used.join(", ") : "none listed"}</Row>
        <Row label="Warnings">
          {warnings.length === 0 ? (
            "none"
          ) : (
            <ul className="m-0 list-none p-0">
              {warnings.map((w) => {
                const { code, message } = splitWarning(w);
                return (
                  <li key={w} className="mb-1 last:mb-0">
                    {code && <span className="font-semibold">{code}</span>}
                    {code ? " " : ""}
                    {message}
                  </li>
                );
              })}
            </ul>
          )}
        </Row>
      </dl>
    </section>
  );
}
