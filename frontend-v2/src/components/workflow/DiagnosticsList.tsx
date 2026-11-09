import type { ParseDiagnostic } from "../../api/client";

export default function DiagnosticsList({
  title,
  diagnostics,
}: {
  title: string;
  diagnostics: ParseDiagnostic[];
}) {
  return (
    <section className="panel" aria-label={title}>
      <h3>
        {title} · {diagnostics.length}
      </h3>
      {diagnostics.length === 0 ? (
        <p className="footnote">None — supported input.</p>
      ) : (
        <ul className="warn-stack">
          {diagnostics.map((d, i) => (
            <li key={`${d.line}-${d.code}-${i}`} className="warn-item">
              <span className="warn-code">
                {d.code} · line {d.line}
              </span>
              <span className="mono">{d.message}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
