import { useWidth } from "../../hooks/useWidth";
import { targetNameFor } from "../../lib/report";
import type { Bit, Report, TraceEntry } from "../../types/report";

// Logic-analyzer style timeline, plain SVG. Data comes ONLY from report.trace_window
// (plus counterexample for the Inputs lane and first_divergence for the red box).

const LABEL_W = 184;
const ROW_H = 40;
const GROUP_GAP = 10;
const DIFF_LABEL_H = 22;
const RULER_H = 26;
const LANE_H = 36;
const HI = 9; // y of a "1" inside a row
const LO = 31; // y of a "0" inside a row
const CHAR_W = 7.3; // width of one 12px mono character, for placing labels

function valueAt(entries: TraceEntry[], scan: number, tag: string): Bit | undefined {
  return entries.find((e) => e.scan === scan)?.observables[tag];
}

/** Step line: hold the level across each scan column, jump straight up or down between columns. */
function stepPath(values: (Bit | undefined)[], x0: number, cw: number, rowTop: number): string {
  const y = (v: Bit) => rowTop + (v === 1 ? HI : LO);
  let d = "";
  let prev: Bit | undefined;
  values.forEach((v, i) => {
    if (v === undefined) {
      prev = undefined;
      return;
    }
    const xs = x0 + i * cw;
    if (prev === undefined) d += `M${xs} ${y(v)}`;
    else if (prev !== v) d += `V${y(v)}`;
    d += `H${xs + cw}`;
    prev = v;
  });
  return d;
}

/** Runs of consecutive high columns, as [firstIndex, lastIndex]. */
function highRuns(values: (Bit | undefined)[]): [number, number][] {
  const runs: [number, number][] = [];
  let start = -1;
  values.forEach((v, i) => {
    if (v === 1 && start < 0) start = i;
    if (v !== 1 && start >= 0) {
      runs.push([start, i - 1]);
      start = -1;
    }
  });
  if (start >= 0) runs.push([start, values.length - 1]);
  return runs;
}

export default function SignalTimeline({ report }: { report: Report }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const tw = report.trace_window;
  const fd = report.first_divergence;

  if (!tw || !fd) {
    return <p className="m-0 font-mono text-[13px] text-muted">Signal timeline: not available</p>;
  }

  const scans = Array.from({ length: tw.end_scan - tw.start_scan + 1 }, (_, i) => tw.start_scan + i);
  const tags: string[] = [];
  for (const entry of [...tw.legacy, ...tw.target]) {
    for (const k of Object.keys(entry.observables)) if (!tags.includes(k)) tags.push(k);
  }

  const plotX = LABEL_W;
  const plotW = Math.max(width - LABEL_W - 4, 160);
  const cw = plotW / scans.length;
  const top = DIFF_LABEL_H + RULER_H;
  const groupsTop = top + LANE_H;
  const groupH = 2 * ROW_H + GROUP_GAP;
  const height = groupsTop + tags.length * groupH + 4;

  // Columns where the two programs show different values (shading only; the verdict is the report's).
  const differing = scans
    .map((s, i) => ({ s, i }))
    .filter(({ s }) =>
      tags.some((t) => {
        const a = valueAt(tw.legacy, s, t);
        const b = valueAt(tw.target, s, t);
        return a !== undefined && b !== undefined && a !== b;
      }),
    );

  const fdIndex = fd.scan - tw.start_scan;
  const fdInWindow = fdIndex >= 0 && fdIndex < scans.length;
  const fdX = plotX + fdIndex * cw;
  const fdLabel = `${fd.scan} first difference`;
  const fdLabelW = fdLabel.length * CHAR_W;
  let fdLabelX = fdX + cw / 2;
  let fdAnchor: "middle" | "start" | "end" = "middle";
  if (fdLabelX - fdLabelW / 2 < plotX) {
    fdLabelX = fdX;
    fdAnchor = "start";
  } else if (fdLabelX + fdLabelW / 2 > plotX + plotW) {
    fdLabelX = fdX + cw;
    fdAnchor = "end";
  }

  // Inputs lane: an event on scan n applies right before scan n's rungs, so its tick sits on that column's left edge.
  let nextFree = plotX;
  const markers = report.counterexample
    .filter((e) => e.scan <= tw.end_scan)
    .map((e) => {
      const label = `scan ${e.scan} · ${e.tag} = ${e.value}`;
      const desired = e.scan < tw.start_scan ? plotX + 1 : plotX + (e.scan - tw.start_scan) * cw + 1;
      const x = Math.max(desired, nextFree);
      nextFree = x + 8 + label.length * CHAR_W + 14;
      return { label, x };
    });

  const summary = `Signal timeline for scans ${tw.start_scan} to ${tw.end_scan}. The first difference is at scan ${fd.scan}.`;

  return (
    <section aria-labelledby="timeline-title">
      <h2 id="timeline-title" className="m-0 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
        Signal timeline
      </h2>
      <div ref={ref} className="mt-3 w-full">
        <svg width={width} height={height} role="img" aria-label={summary} className="block">
          <title>{summary}</title>

          {/* red shading where the programs disagree */}
          {differing.map(({ s, i }) => (
            <rect key={`d${s}`} x={plotX + i * cw} y={top} width={cw} height={height - top} fill="var(--red-tint)" />
          ))}

          {/* column lines */}
          {Array.from({ length: scans.length + 1 }, (_, i) => (
            <line key={`g${i}`} x1={plotX + i * cw} x2={plotX + i * cw} y1={top} y2={height} stroke="var(--hair-2)" strokeWidth="1" />
          ))}

          {/* ruler */}
          <line x1={0} x2={plotX + plotW} y1={top} y2={top} stroke="var(--hair)" strokeWidth="1" />
          {scans.map((s, i) => (
            <text
              key={`r${s}`}
              x={plotX + i * cw + cw / 2}
              y={DIFF_LABEL_H + 17}
              textAnchor="middle"
              fontSize="12"
              className="font-mono"
              fill={s === fd.scan ? "var(--ink)" : "var(--muted)"}
              fontWeight={s === fd.scan ? 600 : 400}
            >
              {s}
            </text>
          ))}

          {/* inputs lane */}
          <text x={0} y={top + LANE_H / 2 + 4} fontSize="12" className="font-mono" fill="var(--muted)">
            Inputs
          </text>
          {markers.map((m) => (
            <g key={m.label}>
              <line x1={m.x} x2={m.x} y1={top + 8} y2={top + LANE_H - 8} stroke="var(--ink)" strokeWidth="1.5" />
              <text x={m.x + 6} y={top + LANE_H / 2 + 4} fontSize="12" className="font-mono" fill="var(--ink)">
                {m.label}
              </text>
            </g>
          ))}

          {/* one pair of rows per observable tag */}
          {tags.map((tag, gi) => {
            const groupTop = groupsTop + gi * groupH;
            const rows = [
              { key: "legacy", entries: tw.legacy, label: `${tag} · legacy`, top: groupTop },
              {
                key: "target",
                entries: tw.target,
                label: `${targetNameFor(report, tag) ?? tag} · target`,
                top: groupTop + ROW_H,
              },
            ];
            return (
              <g key={tag}>
                {gi > 0 && (
                  <line x1={0} x2={plotX + plotW} y1={groupTop - GROUP_GAP / 2} y2={groupTop - GROUP_GAP / 2} stroke="var(--hair)" strokeWidth="1" />
                )}
                {rows.map((row) => {
                  const values = scans.map((s) => valueAt(row.entries, s, tag));
                  return (
                    <g key={row.key}>
                      <text x={0} y={row.top + 24} fontSize="12" className="font-mono" fill="var(--ink)">
                        {row.label}
                      </text>
                      <line x1={plotX} x2={plotX + plotW} y1={row.top + LO} y2={row.top + LO} stroke="var(--hair)" strokeWidth="1" />
                      {highRuns(values).map(([a, b]) => (
                        <rect
                          key={`f${a}`}
                          className="wave-fill"
                          x={plotX + a * cw}
                          y={row.top + HI}
                          width={(b - a + 1) * cw}
                          height={LO - HI}
                          fill="var(--hair-2)"
                        />
                      ))}
                      <path
                        className="wave"
                        pathLength={1}
                        d={stepPath(values, plotX, cw, row.top)}
                        fill="none"
                        stroke="var(--ink)"
                        strokeWidth="2"
                      />
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* the first-difference column: label, red box, four small corner handles */}
          {fdInWindow && (
            <g className="diff-box">
              <text x={fdLabelX} y={DIFF_LABEL_H - 6} textAnchor={fdAnchor} fontSize="12" fontWeight={600} className="font-mono" fill="var(--red)">
                {fdLabel}
              </text>
              <rect x={fdX} y={DIFF_LABEL_H} width={cw} height={height - DIFF_LABEL_H - 1} fill="none" stroke="var(--red)" strokeWidth="1.5" />
              {[
                [fdX, DIFF_LABEL_H],
                [fdX + cw, DIFF_LABEL_H],
                [fdX, height - 1],
                [fdX + cw, height - 1],
              ].map(([cx, cy]) => (
                <rect key={`${cx}-${cy}`} x={cx - 3} y={cy - 3} width={6} height={6} fill="var(--sheet)" stroke="var(--red)" strokeWidth="1.5" />
              ))}
            </g>
          )}
        </svg>
      </div>
      <p className="m-0 mt-3 max-w-[64ch] text-[13px] leading-[1.5] text-muted">
        Each pair of rows is one output: the legacy program on top, the converted program below. Red shading marks the
        scans where the two disagree. Showing scans {tw.start_scan} to {tw.end_scan}.
      </p>
    </section>
  );
}
