import { ApiError } from "../../api/client";

export function BusyLine({ label }: { label: string | null }) {
  if (!label) return null;
  return (
    <p className="busy" role="status">
      {label}
    </p>
  );
}

export function ApiErrorBox({ error }: { error: ApiError | null }) {
  if (!error) return null;
  const kind =
    error.status === 0
      ? "Network"
      : error.status === 404
        ? "404"
        : error.status === 422
          ? "422"
          : error.status === 500
            ? "500"
            : `HTTP ${error.status}`;
  const hint =
    error.status === 0
      ? "Start the engine from the repo root: uvicorn backend.app.api:app --reload --port 8000"
      : error.status === 404
        ? null
        : error.status === 422
          ? "The request body was rejected."
          : error.status === 500
            ? "Server fault. This is not a needs_review result."
            : null;
  return (
    <div className={`api-error status-${error.status === 0 ? "network" : error.status}`} role="alert">
      <p className="eyebrow">{kind}</p>
      <p className="mono">{error.detail}</p>
      {hint ? <p className="footnote">{hint}</p> : null}
    </div>
  );
}
