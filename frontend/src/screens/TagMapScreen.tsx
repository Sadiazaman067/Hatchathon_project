import type { TagMapping } from "../api/client";
import { PrimaryButton, SecondaryButton } from "../components/Buttons";
import { evidenceFor } from "../lib/files";
import type { ProjectInfo } from "../state";

type Props = {
  project: ProjectInfo;
  rows: TagMapping[];
  confirmed: boolean[];
  setConfirmed: (next: boolean[]) => void;
  /** Gets the rows with evidence "user-confirmed · proposed: RULE". Only called when every row is confirmed. */
  onRun: (confirmedRows: TagMapping[]) => void;
};

const isUnmatched = (row: TagMapping) => row.target_tag.trim() === "";

export default function TagMapScreen({ project, rows, confirmed, setConfirmed, onRun }: Props) {
  const done = confirmed.filter(Boolean).length;
  const unmatched = rows.some(isUnmatched);
  const allConfirmed = rows.length > 0 && done === rows.length;

  function toggle(i: number) {
    if (isUnmatched(rows[i])) return;
    setConfirmed(confirmed.map((c, j) => (j === i ? !c : c)));
  }

  function confirmAllMatched() {
    setConfirmed(rows.map((r) => !isUnmatched(r)));
  }

  function run() {
    if (!allConfirmed) return;
    onRun(rows.map((r) => ({ ...r, evidence: evidenceFor(r, true) })));
  }

  let reason: string | null = null;
  if (rows.length === 0) reason = "There are no mapping rows to confirm.";
  else if (unmatched) reason = "Rows with no match can’t be confirmed, so nothing can run.";
  else if (!allConfirmed) reason = `Confirm every row to run (${done} of ${rows.length} confirmed).`;

  return (
    <div>
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">02 Tag map</p>
      <h1 className="m-0 mt-3 max-w-[26ch] font-serif text-[40px] font-normal leading-[1.15] text-ink">
        Which old address is which new tag?
      </h1>
      <p className="m-0 mt-3 max-w-[64ch] text-[16px] leading-[1.5] text-ink">
        Nothing runs until every row is confirmed.
      </p>
      <p className="m-0 mt-2 font-mono text-[13px] text-muted">
        legacy rungs {project.rungCount} · converted rungs {project.targetRungCount}
      </p>

      <div className="mt-6 overflow-x-auto border border-hair bg-sheet">
        <table className="w-full border-collapse text-left font-mono text-[13px]">
          <thead>
            <tr className="border-b border-hair">
              {["Confirm", "Legacy tag", "", "Target tag", "Kind", "Rule", "Evidence"].map((h, i) => (
                <th key={i} scope="col" className="px-3 py-2 text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const missing = isUnmatched(row);
              return (
                <tr
                  key={`${row.legacy_tag}-${i}`}
                  onClick={() => toggle(i)}
                  className={`border-b border-hair last:border-b-0 ${missing ? "bg-amber-tint" : "cursor-pointer hover:bg-paper"}`}
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={confirmed[i] ?? false}
                      disabled={missing}
                      onChange={() => toggle(i)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Confirm ${row.legacy_tag} maps to ${missing ? "no tag" : row.target_tag}`}
                      className="h-[18px] w-[18px] cursor-pointer accent-[var(--ink)] disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-ink">{row.legacy_tag}</td>
                  <td className="px-1 py-2.5 text-muted" aria-hidden="true">
                    →
                  </td>
                  <td className="px-3 py-2.5 text-ink">
                    {missing ? <em className="text-amber-text">no match</em> : row.target_tag}
                  </td>
                  <td className="px-3 py-2.5 text-muted">{row.kind}</td>
                  <td className="px-3 py-2.5 text-muted">{row.rule}</td>
                  <td className="px-3 py-2.5 text-ink">{evidenceFor(row, confirmed[i] ?? false)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-4 text-muted">
                  No mapping rows: not available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {unmatched && (
        <p className="m-0 mt-3 max-w-[72ch] border border-amber bg-amber-tint px-4 py-3 text-[14px] leading-[1.5] text-amber-text">
          Unmatched means needs review, never a clean result. A tag with no match can’t be confirmed.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <SecondaryButton onClick={confirmAllMatched} disabled={rows.length === 0}>
          Confirm all
        </SecondaryButton>
        <PrimaryButton onClick={run} disabled={!allConfirmed}>
          Run replay
        </PrimaryButton>
        {reason && <span className="text-[13px] text-muted">{reason}</span>}
      </div>
    </div>
  );
}
