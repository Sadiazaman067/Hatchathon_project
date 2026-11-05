"""Mnemonic text -> IR. Owner: Tami. Contract: CONTRACT.md sections 3 and 4.

parse(source_text) returns a Program on success, or a NONEMPTY list of
ParseDiagnostic on failure. Every non-blank line is one rung; no line is
ever silently dropped.
"""
from __future__ import annotations

import re

from lark import Lark, Transformer, UnexpectedInput, UnexpectedToken
from lark.exceptions import VisitError

from backend.app.ir import (
    OTE,
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


class _Unsupported(Exception):
    """Valid ladder that P0 does not support. Becomes an UNSUPPORTED_* diagnostic."""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


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
            raise _Unsupported("UNSUPPORTED_EMPTY_BRANCH", EMPTY_BRANCH_MSG)
        if any(isinstance(node, Parallel) for node in items):
            raise _Unsupported("UNSUPPORTED_NESTED_BRANCH", NESTED_BRANCH_MSG)
        # Every branch path is a Series, even with one contact (team decision).
        return Series(nodes=list(items))

    def branch(self, items):
        return Parallel(nodes=list(items))

    def ote(self, items):
        return OTE(tag=str(items[0]))

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
            if not isinstance(error.orig_exc, _Unsupported):
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
