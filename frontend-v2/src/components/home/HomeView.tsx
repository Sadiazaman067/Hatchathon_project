type Props = {
  sessionCount: number;
  onNewTest: () => void;
  onExamples: () => void;
  onSession: () => void;
};

export default function HomeView({ sessionCount, onNewTest, onExamples, onSession }: Props) {
  return (
    <div className="flow-stack home-view">
      <header className="verdict">
        <p className="eyebrow">LadderProof</p>
        <h2 className="verdict-title">Compare an original program with a converted one</h2>
        <p className="verdict-body">
          Run the same test inputs on both, then watch where a compared output first differs. This
          is not a proof the programs are the same.
        </p>
      </header>

      <div className="home-actions">
        <button type="button" className="ink-btn primary" onClick={onNewTest}>
          New test
        </button>
        <button type="button" className="ink-btn" onClick={onExamples}>
          Examples
        </button>
        <button type="button" className="ink-btn" onClick={onSession}>
          This session{sessionCount > 0 ? ` (${sessionCount})` : ""}
        </button>
      </div>
      <p className="footnote">
        This session lists reports from this browser tab only. There is no saved archive.
      </p>
    </div>
  );
}
