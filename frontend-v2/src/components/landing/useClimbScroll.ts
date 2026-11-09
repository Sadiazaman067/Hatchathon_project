import { useEffect, type RefObject } from "react";
import { JUMP_EXIT, clamp, jumpTFromProgress } from "./climbPose";

export const PAUSE_MS = 180;

export type ClimbFrame = {
  progress: number;
  hangT: number;
  jumpT: number;
  reduced: boolean;
};

export function useClimbScroll(
  rootRef: RefObject<HTMLElement | null>,
  tryRef: RefObject<HTMLElement | null>,
  onFrame: (frame: ClimbFrame) => void,
) {
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let follow = 0;
    let hangT = 0;
    let jumping = false;
    let lastRaw = 0;
    let idleMs = 0;
    let lastTs = performance.now();
    let lastScrollY = window.scrollY;
    let hasScrolled = false;

    const rawProgress = () => {
      const root = rootRef.current;
      const tryEl = tryRef.current;
      if (!root || !tryEl) return 0;
      const rootBox = root.getBoundingClientRect();
      const tryBox = tryEl.getBoundingClientRect();
      const start = 0;
      const end = Math.max(80, tryBox.top - rootBox.top - window.innerHeight * 0.28);
      const scrolled = -rootBox.top;
      return clamp((scrolled - start) / end);
    };

    const tick = (ts: number) => {
      const dt = Math.min(48, ts - lastTs);
      lastTs = ts;
      const raw = rawProgress();
      follow += (raw - follow) * 0.22;
      const moved = Math.abs(raw - lastRaw) > 0.0007 || Math.abs(window.scrollY - lastScrollY) > 1;
      lastScrollY = window.scrollY;
      if (moved) {
        idleMs = 0;
        lastRaw = raw;
        hasScrolled = true;
      } else {
        idleMs += dt;
      }
      const hangTarget =
        !reduced && hasScrolled && idleMs >= PAUSE_MS && follow < JUMP_EXIT ? 1 : 0;
      const hangRate = hangTarget > hangT ? 0.012 : 0.02;
      hangT += (hangTarget - hangT) * Math.min(1, hangRate * dt);
      const jump = reduced ? { jumpT: 0, jumping: false } : jumpTFromProgress(follow, jumping);
      jumping = jump.jumping;
      onFrame({ progress: follow, hangT: reduced ? 0 : hangT, jumpT: jump.jumpT, reduced });
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [onFrame, rootRef, tryRef]);
}
