import type { MappingEvidence as Row } from "../../types/report";

export default function MappingEvidence({ rows }: { rows: Row[] }) {
  return (
    <section aria-labelledby="mapping-evidence">
      <h2 id="mapping-evidence" className="m-0 mb-2 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
        Tag mapping used
      </h2>
      <div className="border border-hair bg-sheet">
        {rows.length === 0 ? (
          <p className="m-0 p-3 font-mono text-[13px] text-muted">not available</p>
        ) : (
          <ul className="m-0 list-none p-0">
            {rows.map((r) => (
              <li key={r.legacy_tag} className="border-b border-hair p-3 font-mono text-[13px] last:border-b-0">
                <div className="text-ink">
                  {r.legacy_tag} → {r.target_tag}
                </div>
                <div className="mt-0.5 text-[12px] text-muted">{r.rule}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
