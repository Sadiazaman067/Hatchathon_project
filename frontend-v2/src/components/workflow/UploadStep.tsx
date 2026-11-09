import { ApiErrorBox, BusyLine } from "./ApiStatus";
import DiagnosticsList from "./DiagnosticsList";
import type { ApiError, CreateProjectResponse } from "../../api/client";

type Props = {
  legacyText: string;
  targetText: string;
  busy: string | null;
  error: ApiError | null;
  result: CreateProjectResponse | null;
  onLegacy: (text: string) => void;
  onTarget: (text: string) => void;
  onSubmit: () => void;
};

async function readUtf8(file: File | undefined, apply: (text: string) => void) {
  if (!file) return;
  apply(await file.text());
}

export default function UploadStep({
  legacyText,
  targetText,
  busy,
  error,
  result,
  onLegacy,
  onTarget,
  onSubmit,
}: Props) {
  const canSubmit = legacyText.trim().length > 0 && !busy;
  return (
    <div className="flow-stack">
      <header className="verdict">
        <p className="eyebrow">01 · Upload</p>
        <h2 className="verdict-title">Original and converted programs</h2>
        <p className="verdict-body">
          Paste mnemonic text. The converted program may be omitted; convert can supply one later.
        </p>
      </header>

      <div className="upload-grid">
        <section className="panel">
          <h3>Original program (required)</h3>
          <label className="file-label">
            .txt file
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(e) => void readUtf8(e.target.files?.[0], onLegacy)}
            />
          </label>
          <textarea
            className="rung-input"
            spellCheck={false}
            value={legacyText}
            onChange={(e) => onLegacy(e.target.value)}
            placeholder="SOR … EOR"
          />
        </section>
        <section className="panel">
          <h3>Converted program (optional)</h3>
          <label className="file-label">
            .txt file
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(e) => void readUtf8(e.target.files?.[0], onTarget)}
            />
          </label>
          <textarea
            className="rung-input"
            spellCheck={false}
            value={targetText}
            onChange={(e) => onTarget(e.target.value)}
            placeholder="Leave empty to convert later"
          />
        </section>
      </div>

      <div className="action-row">
        <button type="button" className="ink-btn primary" disabled={!canSubmit} onClick={onSubmit}>
          Upload programs
        </button>
      </div>
      <BusyLine label={busy} />
      <ApiErrorBox error={error} />

      {result ? (
        <div className="flow-stack">
          <p className="footnote">
            project_id <span className="mono">{result.project_id}</span>
            {" · "}
            original rungs {result.rung_count}
            {" · "}
            converted rungs {result.target_rung_count}
          </p>
          <DiagnosticsList title="Original diagnostics" diagnostics={result.diagnostics} />
          <DiagnosticsList title="Converted diagnostics" diagnostics={result.target_diagnostics} />
        </div>
      ) : null}
    </div>
  );
}
