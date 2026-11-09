import { STATUS_LABEL } from "../../playback/plainLanguage";
import type { SessionRun } from "../../workflow/session";

type Props = {
  runs: SessionRun[];
  busy: string | null;
  onOpen: (projectId: string) => void;
};

export default function SessionView({ runs, busy, onOpen }: Props) {
  return (
    <div className="flow-stack">
      <header className="verdict">
        <p className="eyebrow">Past runs</p>
        <h2 className="verdict-title">Reports from this tab</h2>
        <p className="verdict-body">
          LadderProof does not keep a project library. These are only the comparisons you ran in
          this browser tab. Closing the tab clears the list.
        </p>
      </header>

      {runs.length === 0 ? (
        <p className="idle-note">No comparisons in this session yet. Run a new test first.</p>
      ) : (
        <ul className="session-list">
          {runs.map((run) => (
            <li key={run.projectId}>
              <button
                type="button"
                className="session-card"
                disabled={!!busy}
                onClick={() => onOpen(run.projectId)}
              >
                <span className={`status-tag ${run.status}`}>{STATUS_LABEL[run.status]}</span>
                <span className="mono">{run.projectId}</span>
                <span className="footnote">{run.headline}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
