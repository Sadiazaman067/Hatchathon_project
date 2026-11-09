import type { ReactNode } from "react";

const ZONE_NUMBERS = ["1", "2", "3", "4", "5", "6"];
const ZONE_LETTERS = ["A", "B", "C", "D"];

export default function DrawingSheet({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Drawing sheet" className="sheet">
      <span className="sheet-handle tl" aria-hidden="true" />
      <span className="sheet-handle tr" aria-hidden="true" />
      <span className="sheet-handle bl" aria-hidden="true" />
      <span className="sheet-handle br" aria-hidden="true" />
      <div className="sheet-grid">
        <div className="sheet-corner" aria-hidden="true" />
        <div className="sheet-cols" aria-hidden="true">
          {ZONE_NUMBERS.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        <div className="sheet-rows" aria-hidden="true">
          {ZONE_LETTERS.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
        <div className="sheet-body">{children}</div>
      </div>
    </section>
  );
}
