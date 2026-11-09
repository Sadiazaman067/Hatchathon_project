import { FIXTURES } from "../../report/fixtures";
import { STATUS_LABEL } from "../../playback/plainLanguage";

type Props = {
  onOpen: (id: string) => void;
};

export default function ExamplesView({ onOpen }: Props) {
  return (
    <div className="flow-stack">
      <header className="verdict">
        <p className="eyebrow">Samples</p>
        <h2 className="verdict-title">Three demonstration reports</h2>
        <p className="verdict-body">
          Stored results from the same checker a live test uses. Open one to replay the compared
          scans. This is not a proof the programs are the same.
        </p>
      </header>

      <div className="example-grid">
        {FIXTURES.map((fixture) => (
          <article key={fixture.id} className={`example-card status-${fixture.status}`}>
            <p className="eyebrow">{STATUS_LABEL[fixture.status]}</p>
            <h3>{fixture.title}</h3>
            <p>{fixture.summary}</p>
            <p className="footnote">Category: {fixture.category}</p>
            <button type="button" className="ink-btn primary" onClick={() => onOpen(fixture.id)}>
              Try
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
