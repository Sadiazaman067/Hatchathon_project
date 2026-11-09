import type { Bit, InputEvent } from "../report/types";

/** Last counterexample event per tag with scan <= current (held inputs). */
export function heldInputs(events: InputEvent[], scan: number): Record<string, Bit> {
  const latest = new Map<string, { scan: number; index: number; value: Bit }>();
  events.forEach((event, index) => {
    if (event.scan > scan) return;
    const prev = latest.get(event.tag);
    if (!prev || event.scan > prev.scan || (event.scan === prev.scan && index > prev.index)) {
      latest.set(event.tag, { scan: event.scan, index, value: event.value });
    }
  });
  const held: Record<string, Bit> = {};
  for (const [tag, row] of latest) held[tag] = row.value;
  return held;
}

export function eventsAtScan(events: InputEvent[], scan: number): InputEvent[] {
  return events.filter((event) => event.scan === scan);
}

export function bitOn(held: Record<string, Bit>, tag: string | null): boolean {
  if (tag === null) return false;
  return held[tag] === 1;
}
