"""Mnemonic text -> IR. Owner: Tami. Contract: CONTRACT.md sections 3 and 4.

parse(source_text) returns a Program on success, or a NONEMPTY list of
ParseDiagnostic on failure. Every non-blank line is one rung; no line is
ever silently dropped.
"""
from __future__ import annotations

import re
from decimal import Decimal

from lark import Lark, Transformer, UnexpectedInput, UnexpectedToken
from lark.exceptions import VisitError

from backend.app.ir import (
    OTE,
    TON,
    Contact,
    Parallel,
    ParseDiagnostic,
    Program,
    Routine,
    Rung,
    Series,
)

ROUTINE_NAME = "MainRoutine"

# "basic" lexer: keywords like XIC/OTE always lex as keywords, never as tag names.
_PARSER = Lark.open("grammar.lark", rel_to=__file__, parser="lalr", lexer="basic")

# A word that looks like a Rockwell mnemonic (ADD, MOV, OSR, ...): 3+ capitals.
_MNEMONIC = re.compile(r"[A-Z]{3,}")

NESTED_BRANCH_MSG = "nested branch (BST inside a branch) is not supported"
EMPTY_BRANCH_MSG = "empty branch path (always-true shorted wire) is not supported"


# Timer names decide the TON form (team decision, step 4).
_SLC_TIMER = re.compile(r"T[0-9]+:[0-9]+")          # T4:0 -> legacy form
_LOGIX_TAG = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")  # Timer0 -> target form
_UINT = re.compile(r"[0-9]+")

# SLC timebase in seconds (exact decimal) -> milliseconds.
_SLC_TIMEBASES = {Decimal("0.01"): 10, Decimal("1"): 1000}
SLC_MAX_PRESET = 32767


class _RungError(Exception):
    """A problem found while building the IR for one rung. Becomes a
    ParseDiagnostic: UNSUPPORTED_* for valid-but-unsupported ladder,
    PARSE_ERROR for invalid ladder."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def _uint_field(text: str, what: str) -> int:
    if not _UINT.fullmatch(text):
        raise _RungError(
            "PARSE_ERROR", f"TON {what} must be a non-negative integer, got '{text}'"
        )
    return int(text)


def _build_ton(timer: str, fields: list[str]) -> TON:
    """Check a TON's fields against its form and convert them to the IR."""
    if _SLC_TIMER.fullmatch(timer):
        if len(fields) != 3:
            raise _RungError(
                "PARSE_ERROR",
                f"TON {timer} is an SLC timer address, so it needs the legacy form "
                f"TON <timer> <timebase> <preset> <acc> (got {len(fields)} numbers)",
            )
        timebase_text, preset_text, acc_text = fields
        timebase_ms = _SLC_TIMEBASES.get(Decimal(timebase_text))
        if timebase_ms is None:
            raise _RungError(
                "UNSUPPORTED_TIMEBASE",
                f"TON timebase '{timebase_text}' s is not supported (only 0.01 and 1.0)",
            )
        preset = _uint_field(preset_text, "preset")
        if preset > SLC_MAX_PRESET:
            raise _RungError(
                "PARSE_ERROR",
                f"TON preset {preset} is above the SLC maximum of {SLC_MAX_PRESET}",
            )
    elif _LOGIX_TAG.fullmatch(timer):
        if len(fields) != 2:
            raise _RungError(
                "PARSE_ERROR",
                f"TON {timer} is a tag name, so it needs the target form "
                f"TON <timer> <preset> <acc> (got {len(fields)} numbers)",
            )
        preset_text, acc_text = fields
        preset = _uint_field(preset_text, "preset")
        timebase_ms = 1
    else:
        raise _RungError(
            "PARSE_ERROR",
            f"TON timer '{timer}' is neither an SLC timer address (like T4:0) "
            f"nor a tag name (like Timer0)",
        )

    acc = _uint_field(acc_text, "accumulator")
    if acc != 0:
        raise _RungError(
            "UNSUPPORTED_TIMER_ACC",
            f"TON accumulator must be 0 (timers are modeled from zero), got {acc}",
        )
    return TON(timer=timer, preset=preset, timebase_ms=timebase_ms)


class _ToIR(Transformer):
    """Turns Lark's parse tree for one rung into (condition, outputs)."""

    def xic(self, items):
        return Contact(op="XIC", tag=str(items[0]))

    def xio(self, items):
        return Contact(op="XIO", tag=str(items[0]))

    def condition(self, items):
        return Series(nodes=list(items))

    def path(self, items):
        if not items:
            raise _RungError("UNSUPPORTED_EMPTY_BRANCH", EMPTY_BRANCH_MSG)
        if any(isinstance(node, Parallel) for node in items):
            raise _RungError("UNSUPPORTED_NESTED_BRANCH", NESTED_BRANCH_MSG)
        # Every branch path is a Series, even with one contact (team decision).
        return Series(nodes=list(items))

    def branch(self, items):
        return Parallel(nodes=list(items))

    def ote(self, items):
        return OTE(tag=str(items[0]))

    def ton(self, items):
        timer, *fields = items
        return _build_ton(str(timer), [str(f) for f in fields])

    def outputs(self, items):
        return list(items)

    def start(self, items):
        condition, outputs = items
        return condition, outputs


def _diagnostic(line_no: int, error: UnexpectedInput) -> ParseDiagnostic:
    """Turn a Lark syntax error into a diagnostic. An unknown mnemonic where an
    instruction belongs is UNSUPPORTED_OPCODE; everything else is PARSE_ERROR."""
    column = getattr(error, "column", "?")
    if isinstance(error, UnexpectedToken):
        token = error.token
        if token.type == "$END":
            return ParseDiagnostic(
                line_no, "PARSE_ERROR", "rung ended early (missing EOR?)"
            )
        if token.type == "TAG" and _MNEMONIC.fullmatch(str(token)):
            return ParseDiagnostic(
                line_no, "UNSUPPORTED_OPCODE",
                f"unsupported instruction '{token}' at column {column}",
            )
        return ParseDiagnostic(
            line_no, "PARSE_ERROR", f"unexpected '{token}' at column {column}"
        )
    return ParseDiagnostic(
        line_no, "PARSE_ERROR", f"unexpected character at column {column}"
    )


def parse(source_text: str) -> Program | list[ParseDiagnostic]:
    rungs: list[Rung] = []
    diagnostics: list[ParseDiagnostic] = []

    for line_no, raw in enumerate(source_text.splitlines(), start=1):
        text = raw.strip()
        if not text:
            continue
        try:
            tree = _PARSER.parse(text)
        except UnexpectedInput as error:
            diagnostics.append(_diagnostic(line_no, error))
            continue
        try:
            condition, outputs = _ToIR().transform(tree)
        except VisitError as error:
            # Lark wraps exceptions raised inside the transformer; unwrap ours.
            if not isinstance(error.orig_exc, _RungError):
                raise
            diagnostics.append(ParseDiagnostic(
                line_no, error.orig_exc.code, error.orig_exc.message
            ))
            continue
        rungs.append(
            Rung(id=len(rungs) + 1, source_text=text,
                 condition=condition, outputs=outputs)
        )

    if not rungs and not diagnostics:
        diagnostics.append(
            ParseDiagnostic(line=1, code="PARSE_ERROR", message="no rungs found")
        )
    if diagnostics:
        return diagnostics
    return Program(routines=[Routine(name=ROUTINE_NAME, rungs=rungs)])
