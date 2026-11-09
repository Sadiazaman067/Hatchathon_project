import { useEffect } from "react";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return target.isContentEditable;
}

/** Space / arrows only while conveyor replay is enabled, and never in form fields. */
export function useReplayKeyboard({
  enabled,
  length,
  onTogglePlay,
  onStep,
}: {
  enabled: boolean;
  length: number;
  onTogglePlay: () => void;
  onStep: (delta: -1 | 1) => void;
}): void {
  useEffect(() => {
    if (!enabled || length === 0) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;
      if (event.key === " ") {
        event.preventDefault();
        onTogglePlay();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        onStep(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        onStep(1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled, length, onTogglePlay, onStep]);
}
