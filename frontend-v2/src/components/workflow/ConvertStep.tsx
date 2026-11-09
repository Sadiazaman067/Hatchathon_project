import { ApiErrorBox, BusyLine } from "./ApiStatus";
import type { ApiError, ConvertResponse } from "../../api/client";

type Props = {
  hasUploadedTarget: boolean;
  asking: boolean;
  busy: string | null;
  error: ApiError | null;
  result: ConvertResponse | null;
  onAsk: () => void;
  onCancelAsk: () => void;
  onConvert: () => void;
  onSkip: () => void;
};

export default function ConvertStep({
  hasUploadedTarget,
  asking,
  busy,
  error,
  result,
  onAsk,
  onCancelAsk,
  onConvert,
  onSkip,
}: Props) {
  return (
    <div className="flow-stack">
      <header className="verdict">
        <p className="eyebrow">02 · Convert</p>
        <h2 className="verdict-title">Optional rule translator</h2>
        <p className="verdict-body">
          Convert is optional when a target was uploaded. Calling it with an uploaded target
          replaces that target if nothing is unresolved.
        </p>
      </header>

      {asking ? (
        <div className="ask-box">
          <p>
            This project already has an uploaded target. Convert will replace it with the
            translator output. Continue?
          </p>
          <div className="action-row">
            <button type="button" className="ink-btn primary" disabled={!!busy} onClick={onConvert}>
              Replace target
            </button>
            <button type="button" className="ink-btn" onClick={onCancelAsk}>
              Keep uploaded target
            </button>
          </div>
        </div>
      ) : (
        <div className="action-row">
          <button
            type="button"
            className="ink-btn primary"
            disabled={!!busy}
            onClick={hasUploadedTarget ? onAsk : onConvert}
          >
            Convert original program
          </button>
          <button type="button" className="ink-btn" disabled={!hasUploadedTarget || !!busy} onClick={onSkip}>
            Skip convert
          </button>
        </div>
      )}

      <BusyLine label={busy} />
      <ApiErrorBox error={error} />

      {result ? (
        <div className="flow-stack">
          {result.unresolved.length > 0 ? (
            <section className="panel">
              <h3>Unresolved · {result.unresolved.length}</h3>
              <ul className="warn-stack">
                {result.unresolved.map((item) => (
                  <li key={item} className="warn-item">
                    <span className="mono">{item}</span>
                  </li>
                ))}
              </ul>
              <p className="footnote">Unresolved conversion does not replace an uploaded target.</p>
            </section>
          ) : (
            <p className="footnote">Nothing unresolved. Stored target is the converted text.</p>
          )}
          <section className="panel">
            <h3>Rules · {result.rule_ids.length}</h3>
            <p className="mono">{result.rule_ids.length ? result.rule_ids.join(", ") : "none listed"}</p>
          </section>
          <section className="panel">
            <h3>converted_text</h3>
            <pre className="rung-input preview">{result.converted_text || "(empty)"}</pre>
          </section>
        </div>
      ) : null}
    </div>
  );
}
