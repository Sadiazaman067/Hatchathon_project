import type { Report } from "../../report/types";

export default function TitleBlock({ report }: { report: Report }) {
  const { coverage: c, assumptions: a } = report;
  const rows: [string, string][] = [
    ["Profiles", a.profiles.join(" / ")],
    ["Seed", String(c.seed)],
    ["Scan period", `${a.dt_ms} ms`],
    [
      "Scan numbering",
      a.executed_scan_index === "1_based" ? "executed scans from 1" : a.executed_scan_index,
    ],
    ["Scenarios", String(c.scenarios)],
    ["Scans run", String(c.scans)],
    ["Rules used", report.rules_used.length ? report.rules_used.join(", ") : "none listed"],
    ["Warnings", String(report.warnings.length)],
  ];
  return (
    <section className="panel title-block" aria-labelledby="title-block-heading">
      <h3 id="title-block-heading">Title block · run details</h3>
      <table className="draft-table ink">
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
