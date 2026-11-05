"""Mnemonic text -> IR. Owner: Tami. Contract: CONTRACT.md sections 3 and 4.

parse(source_text) returns a Program on success, or a NONEMPTY list of
ParseDiagnostic on failure. Every non-blank line is one rung; no line is
ever silently dropped.
"""
from __future__ import annotations

from lark import Lark, Transformer, UnexpectedInput

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


class _ToIR(Transformer):
    """Turns Lark's parse tree for one rung into (condition, outputs)."""

    def xic(self, items):
        return Contact(op="XIC", tag=str(items[0]))

    def xio(self, items):
        return Contact(op="XIO", tag=str(items[0]))

    def condition(self, items):
        return Series(nodes=list(items))

    def path(self, items):
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
    column = getattr(error, "column", "?")
    return ParseDiagnostic(
        line=line_no,
        code="PARSE_ERROR",
        message=f"syntax error at column {column}",
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
        condition, outputs = _ToIR().transform(tree)
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
