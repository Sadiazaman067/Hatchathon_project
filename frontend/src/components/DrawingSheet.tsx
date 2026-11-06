import type { ReactNode } from "react";

const ZONE_NUMBERS = ["1", "2", "3", "4", "5", "6"];
const ZONE_LETTERS = ["A", "B", "C", "D"];

// Four small square handles, one on each corner of the sheet.
const HANDLES = ["-left-1 -top-1", "-right-1 -top-1", "-bottom-1 -left-1", "-bottom-1 -right-1"];

export default function DrawingSheet({ children }: { children: ReactNode }) {
  return (
    <section aria-label="Drawing sheet" className="relative min-h-[560px] border border-hair bg-sheet">
      {HANDLES.map((pos) => (
        <span key={pos} aria-hidden="true" className={`absolute z-10 h-[7px] w-[7px] border border-ink bg-sheet ${pos}`} />
      ))}
      <div className="grid min-h-[inherit] grid-cols-[24px_1fr] grid-rows-[24px_1fr]">
        <div className="border-b border-r border-hair" aria-hidden="true" />
        <div className="grid grid-cols-6 border-b border-hair" aria-hidden="true">
          {ZONE_NUMBERS.map((n, i) => (
            <span
              key={n}
              className={`flex items-center justify-center font-mono text-[11px] text-muted ${i < ZONE_NUMBERS.length - 1 ? "border-r border-hair" : ""}`}
            >
              {n}
            </span>
          ))}
        </div>
        <div className="flex flex-col border-r border-hair" aria-hidden="true">
          {ZONE_LETTERS.map((l, i) => (
            <span
              key={l}
              className={`flex flex-1 items-center justify-center font-mono text-[11px] text-muted ${i < ZONE_LETTERS.length - 1 ? "border-b border-hair" : ""}`}
            >
              {l}
            </span>
          ))}
        </div>
        <div className="min-w-0 p-8 md:p-9">{children}</div>
      </div>
    </section>
  );
}
