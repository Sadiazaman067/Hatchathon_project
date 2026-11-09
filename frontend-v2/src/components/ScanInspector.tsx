import { inspectScan } from "../playback/inspector";
import {
  convertedOutputChange,
  disagreeLine,
  everydayName,
  originalOutputChange,
  pressedReleased,
  stepSentence,
  technicalName,
} from "../playback/plainLanguage";
import { heldInputs } from "../playback/inputs";
import type { Report } from "../report/types";

export default function ScanInspector({
  report,
  scan,
  inputEvents,
}: {
  report: Report;
  scan: number;
  inputEvents?: Report["counterexample"];
}) {
  const events = inputEvents ?? report.counterexample;
  const model = inspectScan(report, scan, events);
  const previousHeld = heldInputs(events, Math.max(0, scan - 1));
  const heldKeys = Object.keys(model.held).sort();
  const outputKeys = [
    ...new Set([
      ...Object.keys(model.legacyOutputs ?? {}),
      ...Object.keys(model.targetOutputs ?? {}),
    ]),
  ].sort();

  const inputLine =
    model.inputsChanged.length === 0
      ? "No input change"
      : model.inputsChanged
          .map((event) => {
            const prior = scan === 0 ? undefined : previousHeld[event.tag];
            return prior !== undefined && prior !== event.value
              ? `${everydayName(report, event.tag)}: ${pressedReleased(prior)} → ${pressedReleased(event.value)}`
              : `${everydayName(report, event.tag)}: ${pressedReleased(event.value)}`;
          })
          .join("; ");

  return (
    <div className="panel">
      <h3>This scan</h3>
      <table className="kv inspect-cols">
        <thead>
          <tr>
            <th scope="col"> </th>
            <th scope="col">Original</th>
            <th scope="col">Converted</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">
              <span tabIndex={0} title="A button or other input that changed on this scan, not its current held value.">
                Inputs changed?
              </span>
            </th>
            <td>{inputLine}</td>
            <td>{inputLine}</td>
          </tr>
          <tr>
            <th scope="row">
              <span tabIndex={0} title="An output that changed from the previous compared scan.">
                Outputs changed?
              </span>
            </th>
            <td>{originalOutputChange(report, model)}</td>
            <td>{convertedOutputChange(report, model)}</td>
          </tr>
          <tr>
            <th scope="row">
              <span tabIndex={0} title="Whether original and converted outputs differ on this scan.">
                Do they disagree?
              </span>
            </th>
            <td colSpan={2}>{disagreeLine(report, model)}</td>
          </tr>
        </tbody>
      </table>
      <p className="footnote">Both programs received the same inputs on this scan.</p>
      <p className="step-sentence" tabIndex={0} title={stepSentence(report, model)}>
        {stepSentence(report, model)}
      </p>
      <details className="tech-names">
        <summary>Technical names</summary>
        <p className="footnote">
          Addresses and values from the report. A changed input does not imply a changed output.
        </p>
        <table className="kv">
          <tbody>
            <tr>
              <th scope="row">Inputs this scan</th>
              <td>
                {model.inputsChanged.length === 0
                  ? "none"
                  : model.inputsChanged
                      .map((event) => `${technicalName(report, event.tag)} = ${event.value}`)
                      .join(" · ")}
              </td>
            </tr>
            <tr>
              <th scope="row">Held inputs</th>
              <td>
                {heldKeys.length === 0
                  ? "none yet"
                  : heldKeys
                      .map((tag) => `${technicalName(report, tag)} = ${model.held[tag]}`)
                      .join(" · ")}
              </td>
            </tr>
            <tr>
              <th scope="row">Outputs</th>
              <td>
                {outputKeys.length === 0
                  ? "— (no outputs on this scan)"
                  : outputKeys
                      .map((tag) => {
                        const oldBit = model.legacyOutputs?.[tag];
                        const newBit = model.targetOutputs?.[tag];
                        return `${technicalName(report, tag)}: original ${oldBit ?? "—"} / converted ${newBit ?? "—"}`;
                      })
                      .join(" · ")}
              </td>
            </tr>
          </tbody>
        </table>
      </details>
    </div>
  );
}
