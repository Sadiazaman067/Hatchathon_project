"""Compare a legacy trace and a target trace. Owner: Tami. Contract: CONTRACT.md
sections 6 and 7 (comparison) and 8 (first_divergence and trace_window shapes).

All functions are pure. Anything that stops a full comparison raises
ComparisonError; verify() turns that into needs_review with a warning.
The comparator never returns "no difference" for a tag it did not compare.
"""
from __future__ import annotations

from backend.app.ir import TagMapping, Trace, TraceEntry

WINDOW_RADIUS = 5  # CONTRACT §8: up to 5 scans before and 5 after
MATCHING_WINDOW = 30  # CONTRACT §8: matching-run clip, first scenario only
_SIDES = ("legacy", "target")


class ComparisonError(Exception):
    """str(error) is the warning text, with its stable code first,
    e.g. 'MISSING_OBSERVABLE: target never writes Motor (mapped from O:2/0)'."""

    def __init__(self, code: str, message: str):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


def _observable_rows(tag_map: list[TagMapping]) -> list[TagMapping]:
    """The observable mapping rows, sorted by legacy (canonical) tag."""
    rows = [m for m in tag_map if m.kind == "observable"]
    if not rows:
        raise ComparisonError(
            "NO_OBSERVABLE_MAPPINGS", "the tag map has no observable rows to compare"
        )
    for side in _SIDES:
        seen: set[str] = set()
        for row in rows:
            tag = getattr(row, f"{side}_tag")
            if tag in seen:
                raise ComparisonError(
                    "AMBIGUOUS_MAPPING",
                    f"{side} tag {tag} appears in more than one observable mapping",
                )
            seen.add(tag)
    return sorted(rows, key=lambda m: m.legacy_tag)


def _native_and_link(row: TagMapping, side: str) -> tuple[str, str]:
    if side == "legacy":
        return row.legacy_tag, f"mapped to {row.target_tag}"
    return row.target_tag, f"mapped from {row.legacy_tag}"


def missing_observable(row: TagMapping, side: str) -> ComparisonError:
    """The error for a mapped observable that one program never writes, e.g.
    'MISSING_OBSERVABLE: target never writes Motor (mapped from O:2/0)'.
    Shared with verify()'s pre-run check so both say exactly the same thing."""
    native, link = _native_and_link(row, side)
    return ComparisonError("MISSING_OBSERVABLE", f"{side} never writes {native} ({link})")


def canonical_observables(trace: Trace, tag_map: list[TagMapping], side: str) -> Trace:
    """Rewrite one side's trace into legacy (canonical) tag names, keeping only
    mapped observables. Raises MISSING_OBSERVABLE if a mapped tag is absent."""
    if side not in _SIDES:
        raise ValueError(f"side must be 'legacy' or 'target', got {side!r}")
    rows = _observable_rows(tag_map)

    for row in rows:
        native, link = _native_and_link(row, side)
        if not any(native in entry.observables for entry in trace):
            raise missing_observable(row, side)
        for entry in trace:
            if native not in entry.observables:
                raise ComparisonError(
                    "MISSING_OBSERVABLE",
                    f"{side} trace has no {native} at scan {entry.scan} ({link})",
                )

    return [
        TraceEntry(
            scan=entry.scan,
            observables={
                row.legacy_tag: entry.observables[getattr(row, f"{side}_tag")]
                for row in rows
            },
        )
        for entry in trace
    ]


def _check_scans(legacy_trace: Trace, target_trace: Trace) -> None:
    if not legacy_trace or not target_trace:
        raise ComparisonError("EMPTY_TRACE", "a trace has no executed scans to compare")
    legacy_scans = [e.scan for e in legacy_trace]
    target_scans = [e.scan for e in target_trace]
    if legacy_scans != target_scans:
        raise ComparisonError(
            "TRACE_SCAN_MISMATCH",
            f"legacy has scans {legacy_scans[0]}..{legacy_scans[-1]} "
            f"({len(legacy_scans)} entries), target has scans "
            f"{target_scans[0]}..{target_scans[-1]} ({len(target_scans)} entries)",
        )


def _canonical_pair(legacy_trace, target_trace, tag_map) -> tuple[Trace, Trace]:
    _check_scans(legacy_trace, target_trace)
    return (
        canonical_observables(legacy_trace, tag_map, "legacy"),
        canonical_observables(target_trace, tag_map, "target"),
    )


def first_divergence(
    legacy_trace: Trace, target_trace: Trace, tag_map: list[TagMapping]
) -> dict | None:
    """First difference: lowest scan, then alphabetically first legacy tag.
    Returns the CONTRACT §8 first_divergence shape (rung is filled by verify()),
    or None when every mapped observable matched on every scan."""
    legacy_c, target_c = _canonical_pair(legacy_trace, target_trace, tag_map)
    for legacy_entry, target_entry in zip(legacy_c, target_c):
        for tag in sorted(legacy_entry.observables):
            legacy_value = legacy_entry.observables[tag]
            target_value = target_entry.observables[tag]
            if legacy_value != target_value:
                return {
                    "scan": legacy_entry.scan, "tag": tag,
                    "legacy": legacy_value, "target": target_value, "rung": None,
                }
    return None


def trace_window(
    legacy_trace: Trace, target_trace: Trace, tag_map: list[TagMapping], scan: int
) -> dict:
    """Up to WINDOW_RADIUS scans before and after `scan`, clipped to the scans
    that exist, in legacy tag names, with identical scan numbers on both sides."""
    legacy_c, target_c = _canonical_pair(legacy_trace, target_trace, tag_map)
    scans = [e.scan for e in legacy_c]
    if scan not in scans:
        raise ValueError(f"scan {scan} is not in the traces")
    i = scans.index(scan)
    lo, hi = max(0, i - WINDOW_RADIUS), min(len(scans) - 1, i + WINDOW_RADIUS)
    return {
        "start_scan": scans[lo],
        "end_scan": scans[hi],
        "legacy": legacy_c[lo:hi + 1],
        "target": target_c[lo:hi + 1],
    }


def matching_trace_window(
    legacy_trace: Trace, target_trace: Trace, tag_map: list[TagMapping]
) -> dict:
    """First MATCHING_WINDOW executed scans of this scenario, canonical names."""
    legacy_c, target_c = _canonical_pair(legacy_trace, target_trace, tag_map)
    n = min(len(legacy_c), len(target_c), MATCHING_WINDOW)
    if n == 0:
        raise ComparisonError("EMPTY_TRACE", "matching clip needs at least one executed scan")
    return {
        "start_scan": legacy_c[0].scan,
        "end_scan": legacy_c[n - 1].scan,
        "legacy": legacy_c[:n],
        "target": target_c[:n],
    }
