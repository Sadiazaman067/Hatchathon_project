import type { Report } from "../../report/types";

export default function MappingEvidence({ report }: { report: Report }) {
  return (
    <section className="panel" aria-labelledby="mapping-heading">
      <h3 id="mapping-heading">Mapping evidence</h3>
      {report.mapping_evidence.length === 0 ? (
        <p className="footnote">None listed.</p>
      ) : (
        <table className="draft-table">
          <thead>
            <tr>
              <th scope="col">legacy_tag</th>
              <th scope="col">
                <span className="visually-hidden">maps to</span>
              </th>
              <th scope="col">target_tag</th>
              <th scope="col">rule</th>
            </tr>
          </thead>
          <tbody>
            {report.mapping_evidence.map((row) => (
              <tr key={`${row.legacy_tag}-${row.target_tag}-${row.rule}`}>
                <td className="mono">{row.legacy_tag}</td>
                <td className="map-arrow" aria-label="maps to">
                  →
                </td>
                <td className="mono">{row.target_tag}</td>
                <td className="mono muted">{row.rule}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
