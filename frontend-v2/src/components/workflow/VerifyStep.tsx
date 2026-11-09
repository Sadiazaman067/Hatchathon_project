import { ApiErrorBox, BusyLine } from "./ApiStatus";
import type { ApiError, VerifySettings } from "../../api/client";

type Props = {
  settings: VerifySettings;
  canVerify: boolean;
  blockedReason: string | null;
  busy: string | null;
  error: ApiError | null;
  onSettings: (next: VerifySettings) => void;
  onVerify: () => void;
};

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <label className="num-field">
      <span>{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export default function VerifyStep({
  settings,
  canVerify,
  blockedReason,
  busy,
  error,
  onSettings,
  onVerify,
}: Props) {
  return (
    <div className="flow-stack">
      <header className="verdict">
        <p className="eyebrow">04 · Run comparison</p>
        <h2 className="verdict-title">Run comparison</h2>
        <p className="verdict-body">
          Defaults are seed 42, 200 scenarios, 300 steps, 10 ms scan period. A needs-review result
          is valid, not a network error.
        </p>
      </header>

      <section className="panel">
        <h3>Test settings</h3>
        <div className="settings-grid">
          <NumberField
            label="seed"
            value={settings.seed}
            onChange={(seed) => onSettings({ ...settings, seed })}
          />
          <NumberField
            label="scenarios"
            value={settings.scenarios}
            onChange={(scenarios) => onSettings({ ...settings, scenarios })}
          />
          <NumberField
            label="steps (scans)"
            value={settings.scans}
            onChange={(scans) => onSettings({ ...settings, scans })}
          />
          <NumberField
            label="dt_ms"
            value={settings.dt_ms}
            onChange={(dt_ms) => onSettings({ ...settings, dt_ms })}
          />
        </div>
      </section>

      {blockedReason ? <p className="idle-note">{blockedReason}</p> : null}

      <div className="action-row">
        <button type="button" className="ink-btn primary" disabled={!canVerify || !!busy} onClick={onVerify}>
          Run comparison
        </button>
      </div>
      <BusyLine label={busy} />
      <ApiErrorBox error={error} />
    </div>
  );
}
