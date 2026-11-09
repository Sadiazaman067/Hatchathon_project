type Props = {
  showBack: boolean;
  primaryLabel: string;
  primaryDisabled: boolean;
  busy: boolean;
  onBack: () => void;
  onPrimary: () => void;
};

export default function StepFooter({
  showBack,
  primaryLabel,
  primaryDisabled,
  busy,
  onBack,
  onPrimary,
}: Props) {
  return (
    <footer className="step-footer">
      {showBack ? (
        <button type="button" className="ink-btn" disabled={busy} onClick={onBack}>
          Back
        </button>
      ) : null}
      <button
        type="button"
        className="ink-btn primary"
        disabled={busy || primaryDisabled}
        onClick={onPrimary}
      >
        {primaryLabel}
      </button>
    </footer>
  );
}
