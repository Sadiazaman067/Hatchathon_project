import { useState } from "react";
import TopBar from "./components/TopBar";
import StepRail from "./components/StepRail";
import DrawingSheet from "./components/DrawingSheet";
import { STEPS } from "./steps";

// Step 2: the layout shell. Clicking a step in the rail is only here so you can see
// the done / here / not-yet looks. Real screens take over in later steps.
export default function App() {
  const [current, setCurrent] = useState(1);

  return (
    <div className="min-h-screen">
      <TopBar />
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6 px-6 py-8 md:flex-row md:gap-8">
        <aside className="md:w-[180px] md:shrink-0">
          <StepRail current={current} onSelect={setCurrent} />
        </aside>
        <main className="min-w-0 flex-1">
          <DrawingSheet>
            <p className="m-0 font-mono text-[13px] text-muted">
              {STEPS[current].name} screen: built in a later step.
            </p>
          </DrawingSheet>
        </main>
      </div>
    </div>
  );
}
