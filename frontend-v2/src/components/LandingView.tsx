import { useEffect } from "react";

type Props = {
  onTry: () => void;
};

// The landing page is the pitch page (public/pitch.html), shown full screen.
// Its "Try it" button posts a message here, which opens the checker with the demo prefilled.
export default function LandingView({ onTry }: Props) {
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data && event.data.type === "ladderproof:try") onTry();
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onTry]);

  return (
    <iframe
      className="landing-frame"
      src={`${import.meta.env.BASE_URL}pitch.html`}
      title="LadderProof"
    />
  );
}
