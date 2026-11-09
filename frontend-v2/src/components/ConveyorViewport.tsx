import { useEffect, useRef } from "react";
import { mountConveyor, type ConveyorVisual } from "../scene/conveyor";

export default function ConveyorViewport({
  title,
  visual,
  scanLabel,
  comparedName,
  disagree,
}: {
  title: string;
  visual: ConveyorVisual;
  scanLabel: string;
  comparedName: string;
  disagree: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handleRef = useRef<ReturnType<typeof mountConveyor> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handle = mountConveyor(canvas);
    handleRef.current = handle;

    const wrap = wrapRef.current;
    const resize = () => {
      if (!wrap) return;
      handle.setSize(wrap.clientWidth, Math.max(180, wrap.clientHeight));
    };
    resize();
    const observer = new ResizeObserver(resize);
    if (wrap) observer.observe(wrap);

    return () => {
      observer.disconnect();
      handle.dispose();
      handleRef.current = null;
    };
  }, []);

  useEffect(() => {
    handleRef.current?.setVisual(visual);
  }, [visual]);

  return (
    <div className={`viewport${disagree ? " disagree" : ""}`} ref={wrapRef}>
      <div className="viewport-label">{title}</div>
      <div className="viewport-scan">{scanLabel}</div>
      <canvas ref={canvasRef} aria-label={`${title}, ${scanLabel}`} />
      <div className="viewport-note">
        {visual.stacked > 0 || visual.fall > 0
          ? `Boxes pile at the end because this ${comparedName} stayed on.`
          : `The box moves while the ${comparedName} is on.`}
      </div>
    </div>
  );
}
