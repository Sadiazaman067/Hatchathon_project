import { STEPS, type StepId } from "../../workflow/steps";

type Props = {
  current: StepId;
  enabled: Record<StepId, boolean>;
  done: Record<StepId, boolean>;
  statusLines: Record<StepId, string>;
  onSelect: (id: StepId) => void;
};

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <polyline points="2,7.5 5.5,11 12,3" stroke="var(--ink)" strokeWidth="2" strokeLinecap="square" />
    </svg>
  );
}

function Coil() {
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
      <path d="M7 1.5 Q2 8 7 14.5" stroke="var(--ink)" strokeWidth="2" />
      <path d="M13 1.5 Q18 8 13 14.5" stroke="var(--ink)" strokeWidth="2" />
    </svg>
  );
}

function Hollow() {
  return <span className="step-hollow" aria-hidden="true" />;
}

export default function StepRail({ current, enabled, done, statusLines, onSelect }: Props) {
  return (
    <nav aria-label="Workflow steps">
      <ol className="step-rail">
        {STEPS.map((step) => {
          const isCurrent = step.id === current;
          const state = isCurrent ? "current" : done[step.id] ? "done" : "todo";
          const canOpen = enabled[step.id];
          return (
            <li key={step.id} className={`step-item ${state}`}>
              <span className="step-mark">
                {state === "done" ? <Check /> : state === "current" ? <Coil /> : <Hollow />}
              </span>
              <button
                type="button"
                disabled={!canOpen}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(step.id)}
              >
                <span className="step-name">
                  <span className="eyebrow">{step.number}</span>
                  <span>{step.name}</span>
                </span>
                <span className="step-status">{statusLines[step.id]}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
