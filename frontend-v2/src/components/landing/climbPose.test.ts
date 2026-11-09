import { describe, expect, it } from "vitest";
import {
  JUMP_ENTER,
  JUMP_EXIT,
  LADDER,
  contactPoints,
  distToNearestRung,
  figurePose,
  jumpTFromProgress,
  reducedPose,
} from "./climbPose";

describe("jump hysteresis", () => {
  it("stays off until enter, then stays on until below exit", () => {
    expect(jumpTFromProgress(0.9, false).jumping).toBe(false);
    const entered = jumpTFromProgress(JUMP_ENTER, false);
    expect(entered.jumping).toBe(true);
    expect(entered.jumpT).toBeGreaterThan(0);
    const hold = jumpTFromProgress(0.9, true);
    expect(hold.jumping).toBe(true);
    expect(jumpTFromProgress(JUMP_EXIT - 0.01, true).jumping).toBe(false);
  });

  it("jumpT increases with progress inside the window", () => {
    const a = jumpTFromProgress(0.94, true).jumpT;
    const b = jumpTFromProgress(0.99, true).jumpT;
    expect(b).toBeGreaterThan(a);
  });
});

describe("hang contacts", () => {
  it("keeps the right hand and right foot near a rung", () => {
    const pose = figurePose(0.4, 1, 0, false);
    const { rHand, rFoot } = contactPoints(pose);
    expect(distToNearestRung(rHand.y)).toBeLessThan(LADDER.spacing * 0.55);
    expect(distToNearestRung(rFoot.y)).toBeLessThan(LADDER.spacing * 0.7);
    expect(rHand.x).toBeGreaterThan(LADDER.railL - 8);
  });
});

describe("reduced motion", () => {
  it("returns a static climb pose", () => {
    expect(reducedPose()).toEqual(figurePose(0, 1, 1, true));
  });
});
