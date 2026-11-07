import { plural, targetName, type Report } from "./types";

export const NOT_A_PROOF = "Tested scenarios only. Not a proof the programs are the same.";

// Solid status fill with sheet-colored text (the near-white token; no hex outside tokens.css).
const TAG_STYLE = {
  different: { word: "DIFFERENT", className: "border-red bg-red text-sheet" },
  needs_review: { word: "NEEDS REVIEW", className: "border-amber bg-amber text-sheet" },
  no_difference_observed: { word: "NO DIFFERENCE OBSERVED", className: "border-green bg-green text-sheet" },
} as const;

export function StatusTag({ status }: { status: Report["status"] }) {
  const { word, className } = TAG_STYLE[status];
  return (
    <span className={`inline-block border-[1.5px] px-2.5 py-1 font-mono text-[13px] font-semibold tracking-[0.12em] ${className}`}>
      {word}
    </span>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{children}</p>;
}

export function runLine(report: Report): string {
  const { coverage: c, assumptions: a } = report;
  return [
    plural(c.scenarios, "scenario"),
    `${c.scans} scans`,
    `seed ${c.seed}`,
    `scan period ${a.dt_ms} ms`,
    `profiles ${a.profiles.join(" / ")}`,
  ].join(" · ");
}

function onOff(value: number): string {
  return value === 1 ? "on (1)" : "off (0)";
}

export default function VerdictBlock({ report }: { report: Report }) {
  const d = report.first_divergence;

  if (report.status === "different" && d) {
    const name = targetName(report, d.tag);
    const shown = name ?? d.tag;
    const headline =
      d.legacy === 1 && d.target === 0
        ? `The old program turns ${shown} on. The converted one doesn't.`
        : d.legacy === 0 && d.target === 1
          ? `The converted program turns ${shown} on. The old one doesn't.`
          : `${shown} has a different value in the two programs.`;
    return (
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <StatusTag status="different" />
          <Eyebrow>First difference · executed scan {d.scan}</Eyebrow>
        </div>
        <h1 className="m-0 max-w-[30ch] font-serif text-[38px] font-normal leading-[1.15]">{headline}</h1>
        <p className="m-0 text-[16px]">
          At scan <span className="font-mono">{d.scan}</span>,{" "}
          <span className="font-mono">{shown}</span>
          {name && <> (<span className="font-mono">{d.tag}</span>)</>} is {onOff(d.legacy)} in the legacy
          program and {onOff(d.target)} in the target.
          {d.rung !== null && <> It is written by legacy rung <span className="font-mono">{d.rung}</span>.</>}
        </p>
        <p className="m-0 font-mono text-[13px] text-muted">{runLine(report)}</p>
        <p className="m-0 text-[13px] text-muted">{NOT_A_PROOF}</p>
      </header>
    );
  }

  if (report.status === "no_difference_observed") {
    return (
      <header className="flex flex-col gap-3">
        <div><StatusTag status="no_difference_observed" /></div>
        <h1 className="m-0 font-serif text-[38px] font-normal leading-[1.15]">
          No difference observed on {plural(report.coverage.scenarios, "scenario")}.
        </h1>
        <p className="m-0 font-mono text-[13px] text-muted">{runLine(report)}</p>
        <div className="max-w-[64ch] border border-ink bg-sheet px-4 py-3 text-[15px]">
          This is not proof the programs are the same. It means these tested inputs produced the same
          outputs under profiles <span className="font-mono">{report.assumptions.profiles.join(" and ")}</span>.
        </div>
      </header>
    );
  }

  // needs_review, or a "different" report with no first_divergence (shown as review, never guessed).
  return (
    <header className="flex flex-col gap-3">
      <div><StatusTag status="needs_review" /></div>
      <h1 className="m-0 font-serif text-[38px] font-normal leading-[1.15]">
        We can't give a result for this yet.
      </h1>
      <p className="m-0 text-[16px]">
        Each item below has to be fixed or confirmed before the programs can be compared.
      </p>
      <p className="m-0 text-[13px] text-muted">{NOT_A_PROOF}</p>
    </header>
  );
}
