import { useCallback, useRef } from "react";
import { LADDER, LIMB, figurePose, lastRungY, rungY, type Pose } from "./climbPose";
import { useClimbScroll } from "./useClimbScroll";

type Props = {
  rootRef: React.RefObject<HTMLElement | null>;
  tryRef: React.RefObject<HTMLElement | null>;
};

function rungs() {
  const end = lastRungY();
  const nodes = [];
  for (let i = 0; i < LADDER.count; i += 1) {
    const y = rungY(i);
    if (y > end + 0.1) break;
    nodes.push(<line key={i} x1={LADDER.railL} y1={y} x2={LADDER.railR} y2={y} />);
  }
  return nodes;
}

function limbTransform(angle: number): string {
  return `rotate(${angle})`;
}

export default function Climber({ rootRef, tryRef }: Props) {
  const bodyRef = useRef<SVGGElement>(null);
  const torsoRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const lArmRef = useRef<SVGGElement>(null);
  const lForeRef = useRef<SVGGElement>(null);
  const rArmRef = useRef<SVGGElement>(null);
  const rForeRef = useRef<SVGGElement>(null);
  const lLegRef = useRef<SVGGElement>(null);
  const lShinRef = useRef<SVGGElement>(null);
  const rLegRef = useRef<SVGGElement>(null);
  const rShinRef = useRef<SVGGElement>(null);

  const paint = useCallback((pose: Pose) => {
    const body = bodyRef.current;
    if (!body) return;
    body.setAttribute("transform", `translate(${pose.x} ${pose.y}) scale(${pose.scaleX} 1)`);
    torsoRef.current?.setAttribute("transform", `rotate(${pose.torsoAngle})`);
    headRef.current?.setAttribute("transform", `translate(0 ${-LIMB.torso}) rotate(${pose.headAngle})`);
    lArmRef.current?.setAttribute("transform", `translate(${-LIMB.shoulderX} ${-LIMB.torso}) ${limbTransform(pose.lShoulder)}`);
    lForeRef.current?.setAttribute("transform", `translate(0 ${LIMB.ua}) ${limbTransform(pose.lElbow)}`);
    rArmRef.current?.setAttribute("transform", `translate(${LIMB.shoulderX} ${-LIMB.torso}) ${limbTransform(pose.rShoulder)}`);
    rForeRef.current?.setAttribute("transform", `translate(0 ${LIMB.ua}) ${limbTransform(pose.rElbow)}`);
    lLegRef.current?.setAttribute("transform", `translate(${-LIMB.hipX} 0) ${limbTransform(pose.lHip)}`);
    lShinRef.current?.setAttribute("transform", `translate(0 ${LIMB.ul}) ${limbTransform(pose.lKnee)}`);
    rLegRef.current?.setAttribute("transform", `translate(${LIMB.hipX} 0) ${limbTransform(pose.rHip)}`);
    rShinRef.current?.setAttribute("transform", `translate(0 ${LIMB.ul}) ${limbTransform(pose.rKnee)}`);
  }, []);

  const onFrame = useCallback(
    (frame: { progress: number; hangT: number; jumpT: number; reduced: boolean }) => {
      paint(figurePose(frame.progress, frame.hangT, frame.jumpT, frame.reduced));
    },
    [paint],
  );

  useClimbScroll(rootRef, tryRef, onFrame);

  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 9,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg
      className="climber-svg"
      viewBox={`0 0 ${LADDER.viewW} ${LADDER.viewH}`}
      aria-hidden="true"
    >
      <g className="climber-ladder" stroke="currentColor" strokeWidth="3" strokeLinecap="square">
        <line x1={LADDER.railL} y1={32} x2={LADDER.railL} y2={lastRungY() + 8} />
        <line x1={LADDER.railR} y1={32} x2={LADDER.railR} y2={lastRungY() + 8} />
        {rungs()}
      </g>
      <g ref={bodyRef} className="climber-body" {...stroke}>
        <g ref={torsoRef}>
          <line x1={0} y1={0} x2={0} y2={-LIMB.torso} />
          <g ref={headRef}>
            <circle cx={0} cy={-LIMB.headR} r={LIMB.headR} />
          </g>
        </g>
        <g ref={lArmRef}>
          <line x1={0} y1={0} x2={0} y2={LIMB.ua} />
          <g ref={lForeRef}>
            <line x1={0} y1={0} x2={0} y2={LIMB.la} />
          </g>
        </g>
        <g ref={rArmRef}>
          <line x1={0} y1={0} x2={0} y2={LIMB.ua} />
          <g ref={rForeRef}>
            <line x1={0} y1={0} x2={0} y2={LIMB.la} />
          </g>
        </g>
        <g ref={lLegRef}>
          <line x1={0} y1={0} x2={0} y2={LIMB.ul} />
          <g ref={lShinRef}>
            <line x1={0} y1={0} x2={0} y2={LIMB.ll} />
          </g>
        </g>
        <g ref={rLegRef}>
          <line x1={0} y1={0} x2={0} y2={LIMB.ul} />
          <g ref={rShinRef}>
            <line x1={0} y1={0} x2={0} y2={LIMB.ll} />
          </g>
        </g>
      </g>
    </svg>
  );
}
