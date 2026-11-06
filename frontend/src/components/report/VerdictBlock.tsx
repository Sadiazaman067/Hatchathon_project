import type { Report } from "../../types/report";
import { targetNameFor } from "../../lib/report";

type Props = { report: Report; fromFixture: boolean };

export default function VerdictBlock({ report, fromFixture }: Props) {
  const fd = report.first_divergence;
  if (!fd) {
    return <p className="m-0 font-mono text-[13px] text-muted">First difference: not available</p>;
  }
  const name = targetNameFor(report, fd.tag);
  const shown = name ?? fd.tag;

  // Plain-English headline, written from first_divergence and the mapping (DESIGN.md section 5).
  let headline = "The two programs give different results.";
  if (name && fd.legacy === 1 && fd.target === 0) {
    headline = `The old program turns ${name} on. The converted one doesn’t.`;
  } else if (name && fd.legacy === 0 && fd.target === 1) {
    headline = `The converted program turns ${name} on. The old one doesn’t.`;
  }

  const { coverage, assumptions } = report;

  return (
    <section aria-labelledby="verdict-headline">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="bg-red px-3 py-1 font-mono text-[13px] font-semibold tracking-[0.12em] text-sheet">
          DIFFERENT
        </span>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
          First difference · executed scan {fd.scan}
        </span>
        {fromFixture && (
          <span className="ml-auto border border-ink px-2 py-1 font-mono text-[11px] tracking-[0.12em] text-ink">
            SAMPLE DATA
          </span>
        )}
      </div>

      <h1
        id="verdict-headline"
        className="m-0 mt-5 max-w-[26ch] font-serif text-[40px] font-normal leading-[1.15] text-ink"
      >
        {headline}
      </h1>

      <p className="m-0 mt-4 max-w-[64ch] text-[16px] leading-[1.5] text-ink">
        At scan {fd.scan}, {shown}
        {name ? ` (${fd.tag})` : ""} is {fd.legacy} in the legacy program and {fd.target} in the target.
      </p>

      <p className="m-0 mt-4 font-mono text-[13px] leading-[1.6] text-muted">
        scenarios {coverage.scenarios} · scans {coverage.scans} total · seed {coverage.seed} · dt{" "}
        {assumptions.dt_ms} ms · profiles {assumptions.profiles.join(", ")}
      </p>

      <p className="m-0 mt-2 text-[13px] text-muted">
        Tested scenarios only. Not a proof the programs are the same.
      </p>
    </section>
  );
}
