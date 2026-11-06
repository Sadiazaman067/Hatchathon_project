import { useState } from "react";
import type { InputEvent } from "../../types/report";

// Command from docs/interfaces.md. File names are placeholders because the report doesn't know them.
const CLI_COMMAND =
  "python -m backend.app.cli verify --legacy <legacy.txt> --target <target.txt> --map <tag_map.json> --inputs <inputs.json>";

function CopyButton({ text, children }: { text: string; children: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="cursor-pointer border border-ink bg-transparent px-3 py-1.5 font-sans text-[13px] font-medium text-ink transition-colors duration-[120ms] hover:bg-hair-2"
    >
      {copied ? "Copied" : children}
    </button>
  );
}

export default function ReplayInputs({ events }: { events: InputEvent[] }) {
  return (
    <section aria-labelledby="replay-inputs">
      <h2 id="replay-inputs" className="m-0 mb-2 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
        Replay inputs
      </h2>
      <div className="border border-hair bg-sheet p-3">
        {events.length === 0 ? (
          <p className="m-0 font-mono text-[13px] text-muted">not available</p>
        ) : (
          <ul className="m-0 list-none p-0 font-mono text-[13px] text-ink">
            {events.map((e) => (
              <li key={`${e.scan}-${e.tag}`} className="py-0.5">
                scan {e.scan} · {e.tag} = {e.value}
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 mt-3 text-[13px] leading-[1.5] text-muted">
          Use these inputs to repeat the run yourself. Save them as inputs.json, then replace the file names in the
          command.
        </p>
        <pre className="m-0 mt-2 whitespace-pre-wrap break-all border border-hair bg-paper p-2 font-mono text-[12px] leading-[1.5] text-ink">
          {CLI_COMMAND}
        </pre>
        <div className="mt-3 flex flex-wrap gap-2">
          <CopyButton text={CLI_COMMAND}>Copy CLI command</CopyButton>
          <CopyButton text={JSON.stringify(events, null, 2)}>Copy inputs.json</CopyButton>
        </div>
      </div>
    </section>
  );
}
