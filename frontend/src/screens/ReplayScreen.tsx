import { DEFAULT_SETTINGS } from "../api/client";
import { SecondaryButton } from "../components/Buttons";

type Props = { error: string | null; onBack: () => void };

// 03 Replay: shows the settings being sent. No progress bar: the run is quick and we don't invent progress.
export default function ReplayScreen({ error, onBack }: Props) {
  const s = DEFAULT_SETTINGS;
  return (
    <div>
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">03 Replay</p>
      <p className="m-0 mt-6 font-mono text-[40px] font-medium leading-[1.2] text-ink">
        {s.scenarios} scenarios × {s.scans} scans
      </p>
      <p className="m-0 mt-2 font-mono text-[18px] text-muted">
        seed {s.seed} · dt {s.dt_ms} ms
      </p>
      {error ? (
        <div className="mt-8 max-w-[72ch]" role="alert">
          <p className="m-0 border border-amber bg-amber-tint px-4 py-3 font-mono text-[13px] leading-[1.5] text-amber-text">{error}</p>
          {error.startsWith("API not reachable") && (
            <p className="m-0 mt-3 text-[13px] text-muted">
              Start the API from the repo folder: uvicorn backend.app.api:app --port 8000
            </p>
          )}
          <div className="mt-4">
            <SecondaryButton onClick={onBack}>Back to tag map</SecondaryButton>
          </div>
        </div>
      ) : (
        <p className="m-0 mt-8 font-mono text-[13px] uppercase tracking-[0.12em] text-muted" role="status">
          Running the replay…
        </p>
      )}
    </div>
  );
}
