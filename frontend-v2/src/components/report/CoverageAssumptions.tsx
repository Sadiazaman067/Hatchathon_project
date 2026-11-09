import type { Report } from "../../report/types";

export default function CoverageAssumptions({ report }: { report: Report }) {
  const { coverage: c, assumptions: a } = report;
  const rows: [string, string][] = [
    ["Scenarios", String(c.scenarios)],
    ["Scans recorded", String(c.scans)],
    ["Seed", String(c.seed)],
    ["Scan period", `${a.dt_ms} ms`],
    [
      "Scan numbering",
      a.executed_scan_index === "1_based"
        ? "Executed scans from 1; scan 0 is starting inputs"
        : a.executed_scan_index,
    ],
    ["Profiles", a.profiles.join(" / ")],
    ["Rules used", report.rules_used.length ? report.rules_used.join(", ") : "none listed"],
    ["Warnings", String(report.warnings.length)],
  ];
  return (
    <section className="panel" aria-labelledby="coverage-heading">
      <h3 id="coverage-heading">Run details</h3>
      <table className="kv">
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
