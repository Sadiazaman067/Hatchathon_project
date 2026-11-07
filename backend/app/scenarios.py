"""Deterministic, scripted and seeded input scenarios (Arnav-owned).

Each scenario is a list of the shared ir.InputEvent objects. A scenario
is *not* its own execution trace; semantics.run() performs the execution.
Pass the requested scan count to semantics.run(..., scans=scans) to ensure
that the requested execution horizon is actually covered.
"""

from __future__ import annotations

import random
from collections.abc import Sequence
from typing import Any

from . import ir


def _read_inputs(program_ir: ir.Program) -> list[str]:
    """Infer external contacts by excluding coils and generated timer bits.

    A TON owns its EN, TT and DN status bits, just as OTE owns its coil.
    Timer status contacts must never be emitted as physical InputEvents.
    For production verification, prefer explicitly confirmed input_tags.
    """
    read: set[str] = set()
    written: set[str] = set()

    def visit(node: Any) -> None:
        if isinstance(node, ir.Contact):
            read.add(node.tag)
        elif isinstance(node, (ir.Series, ir.Parallel)):
            for child in node.nodes:
                visit(child)
        else:
            raise ValueError(f"Unsupported condition node: {type(node).__name__}")

    for routine in program_ir.routines:
        for rung in routine.rungs:
            visit(rung.condition)
            for instr in rung.outputs:
                if isinstance(instr, ir.OTE):
                    written.add(instr.tag)
                elif isinstance(instr, ir.TON):
                    if not isinstance(instr.timer, str) or not instr.timer:
                        raise ValueError("Timer name must be a nonempty string")
                    # The generator is profile-agnostic. Recognize both native
                    # tag spellings; semantics.run() validates the chosen
                    # profile and the instruction's timebase/preset.
                    for bit in ("EN", "TT", "DN"):
                        written.add(f"{instr.timer}/{bit}")  # SLC
                        written.add(f"{instr.timer}.{bit}")  # Logix
                else:
                    raise ValueError(f"Unsupported output: {type(instr).__name__}")
    return sorted(read - written)


def generate_scenarios(
    program_ir: ir.Program,
    *,
    seed: int = 42,
    scenarios: int = 200,
    scans: int = 300,
    input_tags: Sequence[str] | None = None,
) -> list[list[ir.InputEvent]]:
    """Generate input histories for a known PLC test program.

    The first cases are deterministic boundaries (all-low, all-high, and
    a one-scan pulse for each input); remaining cases contain seeded
    random toggles. Each scenario explicitly initializes every input at
    scan 0. No global PRNG state is used.

    `scans` bounds event timestamps; it does NOT execute the program.
    The caller must separately run each history through
    semantics.run(..., scans=scans) for full-horizon coverage.
    """
    if type(seed) is not int or seed < 0:
        raise ValueError("seed must be a nonnegative integer")
    if type(scenarios) is not int or scenarios < 1:
        raise ValueError("scenarios must be a positive integer")
    if type(scans) is not int or scans < 2:
        raise ValueError("scans must be at least 2")

    tags = sorted(set(input_tags)) if input_tags is not None else _read_inputs(program_ir)
    if not tags or any(not isinstance(tag, str) or not tag for tag in tags):
        raise ValueError("At least one explicit physical input tag is required")

    rng = random.Random(seed)
    histories: list[list[ir.InputEvent]] = []

    def to_events(initial: dict[str, int], changes: list[tuple[int, str, int]]):
        rows = [(0, tag, initial[tag]) for tag in tags] + changes
        rows.sort(key=lambda item: (item[0], item[1]))
        return [ir.InputEvent(scan=n, tag=tag, value=value) for n, tag, value in rows]

    # Scripted: all inputs off, all inputs on, then one short pulse/tag.
    histories.append(to_events(dict.fromkeys(tags, 0), []))
    if len(histories) < scenarios:
        histories.append(to_events(dict.fromkeys(tags, 1), []))
    for pulse_tag in tags:
        if len(histories) >= scenarios:
            break
        histories.append(to_events(dict.fromkeys(tags, 0), [(1, pulse_tag, 1), (2, pulse_tag, 0)]))

    # Seeded: begin with explicit scan-0 values; toggle a small number of times.
    while len(histories) < scenarios:
        initial = {tag: rng.randrange(2) for tag in tags}
        state = dict(initial)
        changes: list[tuple[int, str, int]] = []
        slots = min(scans, max(1, len(tags) * 4))
        for n in sorted(rng.sample(range(1, scans + 1), k=slots)):
            tag = rng.choice(tags)
            state[tag] ^= 1
            changes.append((n, tag, state[tag]))
        histories.append(to_events(initial, changes))

    return histories
