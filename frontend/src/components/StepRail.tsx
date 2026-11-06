import { STEPS } from "../steps";

type Props = {
  current: number;
  onSelect: (index: number) => void;
  /** One short line under each step. Later screens pass real text like "3 of 3 confirmed". */
  statusLines?: string[];
};

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="2,7.5 5.5,11 12,3" stroke="var(--ink)" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

// The coil symbol ( ) marks the step you are on.
function Coil() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
      <path d="M7 1.5 Q2 8 7 14.5" stroke="var(--ink)" strokeWidth="2" />
      <path d="M13 1.5 Q18 8 13 14.5" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

function Hollow() {
  return <span className="block h-2.5 w-2.5 border-[1.5px] border-ink bg-paper" style={{ borderRadius: "50%" }} aria-hidden="true" />;
}

export default function StepRail({ current, onSelect, statusLines }: Props) {
  return (
    <nav aria-label="Steps">
      <ol className="m-0 flex list-none gap-6 overflow-x-auto p-0 md:flex-col md:gap-7 md:overflow-visible">
        {STEPS.map((step, i) => {
          const state = i < current ? "done" : i === current ? "current" : "todo";
          const fallback = state === "done" ? "done" : state === "current" ? "in progress" : "not started";
          return (
            <li key={step.number} className="relative min-w-[112px] pt-8 md:min-w-0 md:pl-9 md:pt-0">
              {/* the ladder's left power rail: a line from this step down (or across) to the next one */}
              {i < STEPS.length - 1 && (
                <span
                  aria-hidden="true"
                  className="absolute left-5 right-[-24px] top-[9px] h-[2px] bg-ink md:bottom-[-28px] md:left-[9px] md:right-auto md:top-5 md:h-auto md:w-[2px]"
                />
              )}
              <span className="absolute left-0 top-0 z-10 flex h-5 w-5 items-center justify-center bg-paper">
                {state === "done" ? <Check /> : state === "current" ? <Coil /> : <Hollow />}
              </span>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={state === "current" ? "step" : undefined}
                className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-ink"
              >
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-[11px] tracking-[0.12em] text-muted">{step.number}</span>
                  <span className={`text-[15px] ${state === "current" ? "font-semibold" : "font-medium"}`}>{step.name}</span>
                  {state === "current" && <span className="font-mono text-[11px] tracking-[0.12em] text-muted">here</span>}
                </span>
                <span className="mt-0.5 block text-[13px] text-muted">{statusLines?.[i] ?? fallback}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
