import { useRef } from "react";

type Props = {
  onTry: () => void;
};

const PLACEHOLDERS = [
  {
    title: "Same inputs on both programs",
    body: "Placeholder. The checker applies one input sequence to the original program and the converted program. It records mapped outputs after each full scan. Replace this block with real copy later.",
  },
  {
    title: "A first difference, not a proof",
    body: "Placeholder. If a mapped output disagrees, the report names the first scan and tag. Agreement on the tested scans is not a claim the programs are the same. Replace this block with real copy later.",
  },
  {
    title: "Names must be confirmed",
    body: "Placeholder. Comparison uses the name map you confirm. Unmapped, unsupported, or ambiguous instructions return needs review. Replace this block with real copy later.",
  },
  {
    title: "Replay follows the report",
    body: "Placeholder. The pictures follow compared scans around a finding. They are not a live plant. Replace this block with real copy later.",
  },
  {
    title: "Try the checker next",
    body: "Placeholder. Open a sample, or start a new session with mnemonic text. Replace this block with real copy later.",
  },
];

export default function LandingView({ onTry }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tryRef = useRef<HTMLDivElement>(null);

  return (
    <div className="landing-layout" ref={rootRef}>
      <div className="landing-copy">
        <section className="landing-hero">
          <h2 className="landing-title">Compare an original program with a converted one</h2>
          <p className="landing-body">
            Run the same test inputs on both, then watch where a compared output first differs. This is
            not a proof the programs are the same.
          </p>
        </section>
        {PLACEHOLDERS.map((block) => (
          <section key={block.title} className="landing-placeholder">
            <p className="eyebrow">Placeholder</p>
            <h3>{block.title}</h3>
            <p>{block.body}</p>
          </section>
        ))}
        <div className="landing-try-wrap" ref={tryRef}>
          <button type="button" className="ink-btn primary landing-try" onClick={onTry}>
            Try it
          </button>
        </div>
      </div>
      <aside className="landing-stage" aria-hidden="true">
      </aside>
    </div>
  );
}
