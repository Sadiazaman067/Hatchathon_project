"""Shared types for LadderProof. Normative spec: CONTRACT.md sections 3, 4, 6 and 7.

Owner: Tami. Change only through the CONTRACT.md change process (team approval).
Field names are frozen: Series.nodes and Parallel.nodes (not children / branches / items).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, Union

# ---------- Rung conditions (CONTRACT §4) ----------

@dataclass
class Contact:
    """XIC is true when the bit is 1. XIO is true when the bit is 0."""
    op: Literal["XIC", "XIO"]
    tag: str            # legacy: "I:1/0"; target: "Start" or "Timer0.DN"


@dataclass
class Series:
    """AND, evaluated in order. An empty Series is true (bare rung)."""
    nodes: list["Node"] = field(default_factory=list)


@dataclass
class Parallel:
    """OR among branches (BST ... NXB ... BND). One level only in v1."""
    nodes: list["Node"] = field(default_factory=list)


Node = Union[Contact, Series, Parallel]

# ---------- Rung outputs (CONTRACT §4) ----------

@dataclass
class OTE:
    """Output Energize: tag = rung power when this instruction executes."""
    tag: str


@dataclass
class TON:
    """Timer on-delay. preset is in native profile units:
    slc_subset_v1: ticks, timebase_ms is 10 or 1000.
    logix_subset_v1: milliseconds, timebase_ms is 1."""
    timer: str          # legacy "T4:0"; target "Timer0"
    preset: int
    timebase_ms: int


Instr = Union[OTE, TON]

# ---------- Program structure (CONTRACT §4) ----------

@dataclass
class Rung:
    id: int             # 1-based position in its routine
    source_text: str    # original text, kept for the side-by-side view
    condition: Node
    outputs: list[Instr] = field(default_factory=list)


@dataclass
class Routine:
    name: str
    rungs: list[Rung] = field(default_factory=list)


@dataclass
class Program:
    routines: list[Routine] = field(default_factory=list)

# ---------- Parser diagnostics (CONTRACT §3) ----------

@dataclass
class ParseDiagnostic:
    line: int           # 1-based
    code: str           # "PARSE_ERROR" or "UNSUPPORTED_*", e.g. "UNSUPPORTED_OPCODE"
    message: str

# ---------- Inputs, mapping, traces (CONTRACT §6, §7) ----------

@dataclass
class InputEvent:
    """scan 0 = initial value before executed scan 1; scan n >= 1 applies just
    before scan n's rungs. Tags use legacy/canonical physical input names."""
    scan: int
    tag: str
    value: Literal[0, 1]


@dataclass
class TagMapping:
    """One unified list covers inputs AND observables (outputs, timer DN/TT)."""
    legacy_tag: str
    target_tag: str
    kind: Literal["input", "observable"]
    rule: str           # e.g. "INPUT_MAP_V1", "OUTPUT_MAP_V1", "TIMER_STATUS_MAP_V1"
    evidence: str       # e.g. "user-confirmed"


@dataclass
class TraceEntry:
    """Observables recorded after executed scan `scan` (1-based; no scan 0 entry).
    Tags are in the program's native names; the comparator canonicalizes them."""
    scan: int
    observables: dict[str, int] = field(default_factory=dict)


Trace = list[TraceEntry]

# ---------- Verification config (CONTRACT §3, the only v1 knobs) ----------

@dataclass
class VerifyConfig:
    seed: int = 42
    scenarios: int = 200
    scans: int = 300    # executed scans per scenario
    dt_ms: int = 10


PROFILES = ("slc_subset_v1", "logix_subset_v1")
STATUSES = ("different", "no_difference_observed", "needs_review")
