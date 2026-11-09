import type { Report } from "../../report/types";

/** "CODE: message" → code in mono, then the rest. Strings without a code show whole. */
export function splitWarning(warning: string): [string | null, string] {
  const match = /^([A-Z][A-Z0-9_]+): (.*)$/s.exec(warning);
  return match ? [match[1] ?? null, match[2] ?? warning] : [null, warning];
}

export default function WarningsList({ report }: { report: Report }) {
  return (
    <section className="panel" aria-labelledby="warnings-heading">
      <h3 id="warnings-heading">Warnings · {report.warnings.length}</h3>
      {report.warnings.length === 0 ? (
        <p className="footnote">No warnings were given.</p>
      ) : (
        <ul className="warn-stack">
          {report.warnings.map((warning, i) => {
            const [code, message] = splitWarning(warning);
            return (
              <li key={`${i}-${warning}`} className="warn-item">
                {code ? <span className="warn-code">{code}</span> : null}
                <span className="mono">{message}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
