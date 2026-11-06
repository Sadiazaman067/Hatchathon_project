import { DRAWING_NO, PROJECT_NAME, REVISION } from "../data/shell";

// Two rails and two rungs: the ladder diagram's own shape.
function LadderMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <g stroke="var(--ink)" strokeWidth="2" strokeLinecap="square">
        <line x1="5" y1="2" x2="5" y2="20" />
        <line x1="17" y1="2" x2="17" y2="20" />
      </g>
      <g stroke="var(--ink)" strokeWidth="1.5">
        <line x1="5" y1="8" x2="17" y2="8" />
        <line x1="5" y1="14" x2="17" y2="14" />
      </g>
    </svg>
  );
}

export default function TopBar() {
  return (
    <header className="border-b border-hair bg-sheet">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-4 px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <LadderMark />
          <span className="text-[17px] font-semibold tracking-tight">LadderProof</span>
        </div>
        <span className="h-5 w-px shrink-0 bg-hair" aria-hidden="true" />
        <span className="min-w-0 truncate font-mono text-[13px] text-muted">{PROJECT_NAME}</span>
        <span className="ml-auto shrink-0 whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          DWG {DRAWING_NO} · REV {REVISION}
        </span>
      </div>
    </header>
  );
}
