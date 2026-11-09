import type { ReactNode } from "react";
import type { FirstDivergence, TraceWindow } from "../report/types";
import { PRESENTATION_STEP_MS, type PlaybackMode } from "../playback/playhead";
import { TIMELINE_ELLIPSIS, gapLabel, hasGapAfterZero, scanCaption } from "../playback/scrubber";

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
      {children}
    </svg>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button type="button" className="icon-btn" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

export default function PlaybackBar({
  enabled,
  playable,
  window,
  index,
  playing,
  mode,
  divergence,
  onIndex,
  onPlaying,
  onMode,
  onShowCode,
}: {
  enabled: boolean;
  playable: number[];
  window: TraceWindow | null;
  index: number;
  playing: boolean;
  mode: PlaybackMode;
  divergence: FirstDivergence | null;
  onIndex: (index: number) => void;
  onPlaying: (playing: boolean) => void;
  onMode: (mode: PlaybackMode) => void;
  onShowCode?: () => void;
}) {
  const scan = playable[index] ?? 0;
  const last = Math.max(0, playable.length - 1);
  const divergenceIndex = divergence ? playable.indexOf(divergence.scan) : -1;

  return (
    <div className="playback">
      <div className="playback-buttons">
        <IconButton
          label={playing ? "Pause" : "Play"}
          disabled={!enabled}
          onClick={() => onPlaying(!playing)}
        >
          {playing ? (
            <Icon>
              <rect x="3" y="2" width="4" height="12" />
              <rect x="9" y="2" width="4" height="12" />
            </Icon>
          ) : (
            <Icon>
              <path d="M3 2.5v11l11-5.5z" />
            </Icon>
          )}
        </IconButton>
        <IconButton
          label="Rewind to start"
          disabled={!enabled}
          onClick={() => {
            onPlaying(false);
            onIndex(0);
          }}
        >
          <Icon>
            <rect x="1.5" y="3" width="2" height="10" />
            <path d="M8 3v10L3.5 8z" />
            <path d="M14.5 3v10L10 8z" />
          </Icon>
        </IconButton>
        <IconButton
          label="Step back"
          disabled={!enabled || index <= 0}
          onClick={() => {
            onPlaying(false);
            onIndex(index - 1);
          }}
        >
          <Icon>
            <rect x="2" y="3" width="2" height="10" />
            <path d="M14 3v10L6 8z" />
          </Icon>
        </IconButton>
        <IconButton
          label="Step forward"
          disabled={!enabled || index >= last}
          onClick={() => {
            onPlaying(false);
            onIndex(index + 1);
          }}
        >
          <Icon>
            <path d="M2 3v10l8-5z" />
            <rect x="12" y="3" width="2" height="10" />
          </Icon>
        </IconButton>
        <button
          type="button"
          disabled={!enabled || divergenceIndex < 0}
          onClick={() => {
            if (divergenceIndex >= 0) {
              onPlaying(false);
              onIndex(divergenceIndex);
            }
          }}
        >
          Jump to first difference
        </button>
        {onShowCode ? (
          <button type="button" onClick={onShowCode}>
            Show the code
          </button>
        ) : null}
        <span className="scan-readout">{enabled ? scanCaption(scan) : "This test was not compared."}</span>
      </div>

      <div className="speed-row">
        <span>Playback</span>
        <button
          type="button"
          disabled={!enabled}
          aria-pressed={mode === "presentation"}
          onClick={() => onMode("presentation")}
        >
          Presentation
        </button>
        <button type="button" disabled={!enabled} aria-pressed={mode === "fast"} onClick={() => onMode("fast")}>
          Fast
        </button>
      </div>
      {enabled ? (
        <p className="footnote">
          {mode === "presentation"
            ? `Presentation waits about ${PRESENTATION_STEP_MS / 1000} seconds per shown step. The test timing is unchanged.`
            : "Fast view may skip steps; results are unchanged."}
        </p>
      ) : null}

      <div className="scrubber" role="group" aria-label="Step timeline">
        {playable.length === 0 || !window ? (
          <button type="button" className="tick" disabled>
            —
          </button>
        ) : (
          playable.flatMap((s, i) => {
            const nodes = [];
            if (i === 1 && hasGapAfterZero(window)) {
              nodes.push(
                <div
                  key="ellipsis"
                  className="scrubber-gap"
                  title={gapLabel(window)}
                  aria-label={gapLabel(window)}
                >
                  {TIMELINE_ELLIPSIS}
                </div>,
              );
            }
            const label = s === 0 ? "0" : String(s);
            nodes.push(
              <button
                key={s}
                type="button"
                className={`tick${i === index ? " current" : ""}${s === divergence?.scan ? " divergence" : ""}`}
                aria-current={i === index ? "true" : undefined}
                aria-label={scanCaption(s)}
                title={scanCaption(s)}
                onClick={() => {
                  onPlaying(false);
                  onIndex(i);
                }}
              >
                {label}
              </button>,
            );
            return nodes;
          })
        )}
      </div>
    </div>
  );
}
