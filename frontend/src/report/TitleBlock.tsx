import type { Report } from "./types";

// Run details as an electrical-drawing title block: tiny mono labels, mono values.
export default function TitleBlock({ report }: { report: Report }) {
  const { coverage: c, assumptions: a } = report;
  const rows: [string, string][] = [
    ["Profiles", a.profiles.join(" / ")],
    ["Seed", String(c.seed)],
    ["Scan period", `${a.dt_ms} ms`],
    ["Scan numbering", a.executed_scan_index === "1_based" ? "executed scans from 1" : a.executed_scan_index],
    ["Scenarios", String(c.scenarios)],
    ["Scans run", String(c.scans)],
    ["Rules used", report.rules_used.length ? report.rules_used.join(", ") : "none listed"],
    ["Warnings", String(report.warnings.length)],
  ];
  return (
    <table className="w-full border-collapse border border-ink text-left">
      <caption className="mb-2 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        Title block · run details
      </caption>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-hair last:border-b-0">
            <th scope="row" className="w-[42%] border-r border-hair px-3 py-2 align-top font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
              {label}
            </th>
            <td className="break-words px-3 py-2 font-mono text-[13px]">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MappingEvidenceTable({ report }: { report: Report }) {
  if (report.mapping_evidence.length === 0) return null;
  return (
    <table className="w-full border-collapse border border-hair text-left">
      <caption className="mb-2 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        Mapping evidence
      </caption>
      <tbody>
        {report.mapping_evidence.map((m) => (
          <tr key={`${m.legacy_tag}-${m.target_tag}`} className="border-b border-hair-2 last:border-b-0">
            <td className="px-3 py-1.5 font-mono text-[13px]">{m.legacy_tag}</td>
            <td className="px-1 py-1.5 font-mono text-[13px] text-muted" aria-label="maps to">→</td>
            <td className="px-3 py-1.5 font-mono text-[13px]">{m.target_tag}</td>
            <td className="px-3 py-1.5 font-mono text-[11px] text-muted">{m.rule}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
