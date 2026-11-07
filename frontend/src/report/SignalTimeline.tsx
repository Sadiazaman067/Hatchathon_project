import { targetName, type Report, type TraceEntry, type TraceWindow } from "./types";

// Logic-analyzer view drawn from trace_window only (DESIGN.md section 5, "04 Report").
const LABEL_W = 210;
const COL_W = 60;
const RULER_H = 40;
const ROW_H = 30;
const PAIR_GAP = 14;
const INPUT_H = 34;
const HIGH = 6; // y offset of the high level inside a row
const LOW = ROW_H - 6;

type Value = number | undefined;

function valuesFor(entries: TraceEntry[], scans: number[], tag: string): Value[] {
  const byScan = new Map(entries.map((e) => [e.scan, e.observables[tag]]));
  return scans.map((s) => byScan.get(s));
}

/** Step line for one row. Missing values break the line (nothing is drawn there). */
function stepPath(values: Value[], x0: number, y0: number): string {
  let d = "";
  let prev: Value;
  values.forEach((v, i) => {
    const x = x0 + i * COL_W;
    if (v === undefined) {
      prev = undefined;
      return;
    }
    const y = y0 + (v === 1 ? HIGH : LOW);
    if (prev === undefined) d += `M${x},${y}`;
    else if (prev !== v) d += `V${y}`;
    d += `H${x + COL_W}`;
    prev = v;
  });
  return d;
}

/** Observable tags in the window: the first-difference tag first, the rest alphabetical. */
function tagsOf(window: TraceWindow, first: string | null): string[] {
  const tags = new Set<string>();
  for (const e of [...window.legacy, ...window.target]) Object.keys(e.observables).forEach((t) => tags.add(t));
  return [...tags].sort((a, b) => (a === first ? -1 : b === first ? 1 : a.localeCompare(b)));
}

function Handles({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const s = 6;
  return (
    <>
      {[[x, y], [x + w, y], [x, y + h], [x + w, y + h]].map(([cx, cy]) => (
        <rect key={`${cx},${cy}`} x={cx - s / 2} y={cy - s / 2} width={s} height={s}
          fill="var(--sheet)" stroke="var(--red)" strokeWidth={1.5} />
      ))}
    </>
  );
}

export default function SignalTimeline({ report }: { report: Report }) {
  const window = report.trace_window;
  if (!window) {
    return <p className="m-0 font-mono text-[13px] text-muted">Signal timeline: not available.</p>;
  }
  const first = report.first_divergence;
  const scans: number[] = [];
  for (let s = window.start_scan; s <= window.end_scan; s++) scans.push(s);
  const tags = tagsOf(window, first?.tag ?? null);

  const pairH = 2 * ROW_H + PAIR_GAP;
  const rowsTop = RULER_H;
  const inputsTop = rowsTop + tags.length * pairH + 4;
  const width = LABEL_W + scans.length * COL_W + 8;
  const height = inputsTop + INPUT_H + 4;
  const colX = (scan: number) => LABEL_W + (scan - window.start_scan) * COL_W;

  const inWindow = report.counterexample.filter((e) => e.scan >= window.start_scan && e.scan <= window.end_scan);
  const before = report.counterexample.filter((e) => e.scan < window.start_scan);
  const firstX = first ? colX(first.scan) : null;

  return (
    <figure className="m-0 flex flex-col gap-3">
      <figcaption className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        Signal timeline · scans {window.start_scan} to {window.end_scan} · legacy vs target
      </figcaption>
      <div className="overflow-x-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
          aria-label={`Legacy and target outputs for scans ${window.start_scan} to ${window.end_scan}`}
          className="block font-mono">
          {/* Ruler */}
          {scans.map((s) => (
            <g key={s}>
              <line x1={colX(s)} x2={colX(s)} y1={RULER_H - 8} y2={height - 4} stroke="var(--hair-2)" />
              <text x={colX(s) + COL_W / 2} y={RULER_H - 14} textAnchor="middle" fontSize={12}
                fill={first?.scan === s ? "var(--red)" : "var(--muted)"} fontWeight={first?.scan === s ? 600 : 400}>
                {s}
              </text>
            </g>
          ))}
          <line x1={LABEL_W} x2={width - 8} y1={RULER_H - 8} y2={RULER_H - 8} stroke="var(--hair)" />
          {firstX !== null && first && (
            <text x={firstX + COL_W / 2} y={11} textAnchor="middle" fontSize={11} fill="var(--red)"
              fontWeight={600} letterSpacing="0.08em" className="lp-fade">
              {first.scan} FIRST DIFFERENCE
            </text>
          )}

          {tags.map((tag, i) => {
            const top = rowsTop + i * pairH;
            const legacy = valuesFor(window.legacy, scans, tag);
            const target = valuesFor(window.target, scans, tag);
            const name = targetName(report, tag);
            return (
              <g key={tag}>
                {/* Red tint where legacy and target disagree */}
                {scans.map((s, k) =>
                  legacy[k] !== undefined && target[k] !== undefined && legacy[k] !== target[k] ? (
                    <rect key={s} x={colX(s)} y={top} width={COL_W} height={2 * ROW_H} fill="var(--red-tint)" />
                  ) : null,
                )}
                {[{ side: "legacy", values: legacy, y: top }, { side: "target", values: target, y: top + ROW_H }].map(
                  ({ side, values, y }) => (
                    <g key={side}>
                      {/* light fill under high */}
                      {values.map((v, k) =>
                        v === 1 ? (
                          <rect key={k} x={LABEL_W + k * COL_W} y={y + HIGH} width={COL_W} height={LOW - HIGH}
                            fill="var(--hair-2)" opacity={0.7} />
                        ) : null,
                      )}
                      <path d={stepPath(values, LABEL_W, y)} fill="none" stroke="var(--ink)" strokeWidth={1.75}
                        pathLength={1} className="lp-draw" />
                      <text x={0} y={y + ROW_H / 2 + 4} fontSize={12} fill="var(--ink)">
                        {side === "legacy" ? tag : (name ?? tag)}
                        <tspan fill="var(--muted)"> · {side}</tspan>
                      </text>
                    </g>
                  ),
                )}
                <line x1={0} x2={width - 8} y1={top + 2 * ROW_H + PAIR_GAP / 2} y2={top + 2 * ROW_H + PAIR_GAP / 2}
                  stroke="var(--hair-2)" />
              </g>
            );
          })}

          {/* Inputs lane: markers from counterexample only (no input waveforms) */}
          <text x={0} y={inputsTop + INPUT_H / 2 + 4} fontSize={12} fill="var(--ink)">Inputs</text>
          {inWindow.map((e, k) => (
            <g key={`${e.scan}-${e.tag}`}>
              <line x1={colX(e.scan)} x2={colX(e.scan)} y1={inputsTop + 4} y2={inputsTop + INPUT_H - 4}
                stroke="var(--ink)" strokeWidth={1.5} />
              <text x={colX(e.scan) + 4} y={inputsTop + 14 + (k % 2) * 12} fontSize={11} fill="var(--ink)">
                {e.tag} = {e.value}
              </text>
            </g>
          ))}

          {/* First-difference box over the whole column, with corner handles */}
          {firstX !== null && (
            <g className="lp-fade">
              <rect x={firstX} y={RULER_H - 8} width={COL_W} height={inputsTop - RULER_H + 8}
                fill="none" stroke="var(--red)" strokeWidth={1.5} />
              <Handles x={firstX} y={RULER_H - 8} w={COL_W} h={inputsTop - RULER_H + 8} />
            </g>
          )}
        </svg>
      </div>
      {before.length > 0 && (
        <p className="m-0 font-mono text-[12px] text-muted">
          Inputs before scan {window.start_scan}:{" "}
          {before.map((e) => `scan ${e.scan} · ${e.tag} = ${e.value}`).join("   ")}
        </p>
      )}
      {first && (
        <p className="m-0 text-[15px]">
          {first.scan > 1
            ? `Every compared output matches until scan ${first.scan}. `
            : "The outputs differ from the first executed scan. "}
          Shaded cells are scans where legacy and target differ; the boxed column is the first difference.
        </p>
      )}
    </figure>
  );
}
