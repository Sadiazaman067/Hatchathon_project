import { useState } from "react";
import type { Report } from "./types";

// The counterexample: the input events (legacy names) that lead to the first difference.
// "Copy inputs.json" gives a file the CLI's --inputs flag accepts. The report has no file
// paths, so we don't build a full CLI command (that would invent data).
export default function ReplayInputs({ report }: { report: Report }) {
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const events = report.counterexample;

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(events, null, 2) + "\n");
      setCopied("done");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <section className="flex flex-col gap-2" aria-labelledby="replay-inputs">
      <h2 id="replay-inputs" className="m-0 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
        Replay inputs
      </h2>
      {events.length === 0 ? (
        <p className="m-0 font-mono text-[13px] text-muted">not available</p>
      ) : (
        <ol className="m-0 list-none border border-hair p-0">
          {events.map((e, i) => (
            <li key={i} className="border-b border-hair-2 px-3 py-1.5 font-mono text-[13px] last:border-b-0">
              <span className="text-muted">scan {e.scan} · </span>
              {e.tag} = {e.value}
            </li>
          ))}
        </ol>
      )}
      {events.length > 0 && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={copy}
            className="cursor-pointer border border-ink bg-transparent px-3 py-1.5 font-sans text-[13px] text-ink transition-colors duration-[120ms] hover:bg-ink hover:text-sheet">
            Copy inputs.json
          </button>
          <span className="text-[13px] text-muted" aria-live="polite">
            {copied === "done" ? "Copied." : copied === "failed" ? "Copy failed; select the list instead." : ""}
          </span>
        </div>
      )}
    </section>
  );
}
