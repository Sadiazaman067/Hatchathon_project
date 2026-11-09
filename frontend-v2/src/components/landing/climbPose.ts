/** Joint angles in degrees. 0 is straight down (+y). Negative is up toward the head. */

export const LADDER = {
  railL: 78,
  railR: 142,
  rungTop: 56,
  spacing: 36,
  count: 22,
  viewW: 220,
  viewH: 640,
} as const;

export const LIMB = {
  torso: 42,
  headR: 13,
  ua: 26,
  la: 24,
  ul: 30,
  ll: 28,
  shoulderX: 11,
  hipX: 8,
} as const;

export const JUMP_ENTER = 0.92;
export const JUMP_EXIT = 0.88;

export type Pose = {
  x: number;
  y: number;
  scaleX: number;
  torsoAngle: number;
  headAngle: number;
  lShoulder: number;
  lElbow: number;
  rShoulder: number;
  rElbow: number;
  lHip: number;
  lKnee: number;
  rHip: number;
  rKnee: number;
};

export function clamp(n: number, a = 0, b = 1): number {
  return Math.min(b, Math.max(a, n));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function easeInOut(t: number): number {
  const x = clamp(t);
  return x * x * (3 - 2 * x);
}

export function rungY(index: number): number {
  return LADDER.rungTop + index * LADDER.spacing;
}

export function lastRungY(): number {
  return rungY(LADDER.count - 1);
}

export function climbY(progress: number): number {
  const p = clamp(progress);
  return lerp(LADDER.rungTop + 8, lastRungY() - 10, p);
}

export function jumpTFromProgress(progress: number, wasJumping: boolean): { jumpT: number; jumping: boolean } {
  const jumping = wasJumping ? progress >= JUMP_EXIT : progress >= JUMP_ENTER;
  if (!jumping) return { jumpT: 0, jumping: false };
  const jumpT = clamp((progress - JUMP_EXIT) / (1 - JUMP_EXIT));
  return { jumpT, jumping: true };
}

function mixPose(a: Pose, b: Pose, t: number): Pose {
  const k = easeInOut(t);
  return {
    x: lerp(a.x, b.x, k),
    y: lerp(a.y, b.y, k),
    scaleX: lerp(a.scaleX, b.scaleX, k),
    torsoAngle: lerp(a.torsoAngle, b.torsoAngle, k),
    headAngle: lerp(a.headAngle, b.headAngle, k),
    lShoulder: lerp(a.lShoulder, b.lShoulder, k),
    lElbow: lerp(a.lElbow, b.lElbow, k),
    rShoulder: lerp(a.rShoulder, b.rShoulder, k),
    rElbow: lerp(a.rElbow, b.rElbow, k),
    lHip: lerp(a.lHip, b.lHip, k),
    lKnee: lerp(a.lKnee, b.lKnee, k),
    rHip: lerp(a.rHip, b.rHip, k),
    rKnee: lerp(a.rKnee, b.rKnee, k),
  };
}

function climbPose(progress: number): Pose {
  const y = climbY(progress);
  const phase = (y / LADDER.spacing) * Math.PI;
  const s = Math.sin(phase);
  const c = Math.cos(phase);
  return {
    x: 110,
    y,
    scaleX: 0.42,
    torsoAngle: s * 4,
    headAngle: -s * 6,
    lShoulder: -128 + s * 48,
    lElbow: 18 + c * 10,
    rShoulder: -128 - s * 48,
    rElbow: 18 - c * 10,
    lHip: 12 - s * 42,
    lKnee: 28 + Math.abs(s) * 18,
    rHip: 12 + s * 42,
    rKnee: 28 + Math.abs(c) * 18,
  };
}

function hangPose(progress: number): Pose {
  const y = climbY(progress);
  const rung = nearestRung(y + 8);
  return {
    x: 78,
    y: rung - 6,
    scaleX: 1,
    torsoAngle: -8,
    headAngle: 12,
    lShoulder: 28,
    lElbow: 16,
    rShoulder: -158,
    rElbow: 8,
    lHip: 14,
    lKnee: 8,
    rHip: -38,
    rKnee: 52,
  };
}

function nearestRung(y: number): number {
  const i = Math.round((y - LADDER.rungTop) / LADDER.spacing);
  return rungY(clamp(i, 0, LADDER.count - 1));
}

function applyJump(base: Pose, jumpT: number): Pose {
  if (jumpT <= 0) return base;
  const t = clamp(jumpT);
  let lift = 0;
  let xOff = 0;
  let crouch = 0;
  if (t < 0.18) {
    const u = t / 0.18;
    lift = lerp(0, 6, u);
    xOff = lerp(0, 4, u);
  } else if (t < 0.32) {
    const u = (t - 0.18) / 0.14;
    lift = lerp(6, -8, u);
    xOff = lerp(4, 10, u);
  } else if (t < 0.7) {
    const u = (t - 0.32) / 0.38;
    lift = lerp(-8, 90, easeInOut(u));
    xOff = lerp(10, 48, u);
  } else {
    const u = (t - 0.7) / 0.3;
    lift = lerp(90, 118, easeInOut(u));
    xOff = lerp(48, 56, u);
    crouch = easeInOut(u);
  }
  return {
    ...base,
    x: base.x + xOff,
    y: base.y + lift,
    scaleX: lerp(base.scaleX, 1, clamp(t * 2)),
    torsoAngle: lerp(base.torsoAngle, crouch * 12, t),
    lShoulder: lerp(base.lShoulder, crouch ? 40 : -20, t),
    rShoulder: lerp(base.rShoulder, crouch ? 40 : -30, t),
    lHip: lerp(base.lHip, crouch ? 55 : 8, t),
    rHip: lerp(base.rHip, crouch ? 55 : 8, t),
    lKnee: lerp(base.lKnee, crouch ? 70 : 20, t),
    rKnee: lerp(base.rKnee, crouch ? 70 : 20, t),
  };
}

export function reducedPose(): Pose {
  return climbPose(0.08);
}

export function figurePose(progress: number, hangT: number, jumpT: number, reduced: boolean): Pose {
  if (reduced) return reducedPose();
  const climb = climbPose(progress);
  const hung = mixPose(climb, hangPose(progress), hangT);
  return applyJump(hung, jumpT);
}

export type Point = { x: number; y: number };

function end(from: Point, angle: number, length: number): Point {
  const a = (angle * Math.PI) / 180;
  return { x: from.x + length * Math.sin(a), y: from.y + length * Math.cos(a) };
}

/** World-space hand and foot tips for tests and rung alignment. */
export function contactPoints(pose: Pose): { rHand: Point; rFoot: Point; lHand: Point; lFoot: Point } {
  const hip: Point = { x: pose.x, y: pose.y };
  const shoulder: Point = end(hip, pose.torsoAngle + 180, LIMB.torso);
  const rShoulder: Point = { x: shoulder.x + LIMB.shoulderX * pose.scaleX, y: shoulder.y };
  const lShoulder: Point = { x: shoulder.x - LIMB.shoulderX * pose.scaleX, y: shoulder.y };
  const rElbow = end(rShoulder, pose.rShoulder, LIMB.ua);
  const rHand = end(rElbow, pose.rShoulder + pose.rElbow, LIMB.la);
  const lElbow = end(lShoulder, pose.lShoulder, LIMB.ua);
  const lHand = end(lElbow, pose.lShoulder + pose.lElbow, LIMB.la);
  const rHip = { x: hip.x + LIMB.hipX * pose.scaleX, y: hip.y };
  const lHip = { x: hip.x - LIMB.hipX * pose.scaleX, y: hip.y };
  const rKnee = end(rHip, pose.rHip, LIMB.ul);
  const rFoot = end(rKnee, pose.rHip + pose.rKnee, LIMB.ll);
  const lKnee = end(lHip, pose.lHip, LIMB.ul);
  const lFoot = end(lKnee, pose.lHip + pose.lKnee, LIMB.ll);
  return { rHand, rFoot, lHand, lFoot };
}

export function distToNearestRung(y: number): number {
  let best = Infinity;
  for (let i = 0; i < LADDER.count; i += 1) {
    best = Math.min(best, Math.abs(y - rungY(i)));
  }
  return best;
}
