from backend.app.ir import (
    OTE, Contact, Parallel, ParseDiagnostic, Program, Routine, Rung, Series,
)
from backend.app.parser import parse


def _one_rung_program(text, condition, outputs):
    return Program(routines=[Routine(name="MainRoutine", rungs=[
        Rung(id=1, source_text=text, condition=condition, outputs=outputs)
    ])])


# Test 1: one simple rung
def test_simple_rung():
    text = "SOR XIC I:1/0 OTE O:2/0 EOR"
    assert parse("  " + text + "  \n") == _one_rung_program(
        text,
        Series(nodes=[Contact(op="XIC", tag="I:1/0")]),
        [OTE(tag="O:2/0")],
    )


# Test 2: seal-in rung, legacy SLC addresses
def test_seal_in_branch():
    text = "SOR BST XIC I:1/0 NXB XIC O:2/0 BND XIO I:1/1 OTE O:2/0 EOR"
    assert parse(text) == _one_rung_program(
        text,
        Series(nodes=[
            Parallel(nodes=[
                Series(nodes=[Contact(op="XIC", tag="I:1/0")]),
                Series(nodes=[Contact(op="XIC", tag="O:2/0")]),
            ]),
            Contact(op="XIO", tag="I:1/1"),
        ]),
        [OTE(tag="O:2/0")],
    )


# Test 3: same rung with Logix target tag names
def test_target_tag_names():
    text = "SOR BST XIC Start NXB XIC Motor BND XIO Stop OTE Motor EOR"
    assert parse(text) == _one_rung_program(
        text,
        Series(nodes=[
            Parallel(nodes=[
                Series(nodes=[Contact(op="XIC", tag="Start")]),
                Series(nodes=[Contact(op="XIC", tag="Motor")]),
            ]),
            Contact(op="XIO", tag="Stop"),
        ]),
        [OTE(tag="Motor")],
    )


# Test 4: unknown opcode -> UNSUPPORTED_OPCODE on the right (1-based) line.
# Line 1 is valid, line 2 is blank, line 3 has the unknown opcode.
def test_unknown_opcode_reports_line():
    source = (
        "SOR XIC I:1/0 OTE O:2/0 EOR\n"
        "\n"
        "SOR XIC I:1/0 ADD N7:0 OTE O:2/0 EOR\n"
    )
    assert parse(source) == [ParseDiagnostic(
        line=3, code="UNSUPPORTED_OPCODE",
        message="unsupported instruction 'ADD' at column 15",
    )]


# Test 5: nested branch -> diagnostic, never a guess
def test_nested_branch_is_unsupported():
    source = "SOR BST XIC A NXB BST XIC B NXB XIC C BND BND OTE D EOR"
    assert parse(source) == [ParseDiagnostic(
        line=1, code="UNSUPPORTED_NESTED_BRANCH",
        message="nested branch (BST inside a branch) is not supported",
    )]


# Extra: empty branch path is valid RSLogix (shorted wire) but not P0
def test_empty_branch_path_is_unsupported():
    assert parse("SOR BST NXB XIC A BND OTE B EOR") == [ParseDiagnostic(
        line=1, code="UNSUPPORTED_EMPTY_BRANCH",
        message="empty branch path (always-true shorted wire) is not supported",
    )]


# Extra: plain syntax error (missing EOR) is PARSE_ERROR
def test_missing_eor_is_parse_error():
    assert parse("SOR XIC A OTE B") == [ParseDiagnostic(
        line=1, code="PARSE_ERROR", message="rung ended early (missing EOR?)",
    )]


# Extra: empty input is a failure, never an empty "passing" program
def test_empty_input_is_diagnostic():
    assert parse("\n   \n") == [
        ParseDiagnostic(line=1, code="PARSE_ERROR", message="no rungs found")
    ]
