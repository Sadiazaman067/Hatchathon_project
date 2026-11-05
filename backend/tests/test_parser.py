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


# Extra: empty input is a failure, never an empty "passing" program
def test_empty_input_is_diagnostic():
    assert parse("\n   \n") == [
        ParseDiagnostic(line=1, code="PARSE_ERROR", message="no rungs found")
    ]
