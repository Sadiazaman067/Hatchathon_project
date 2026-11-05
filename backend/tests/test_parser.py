from backend.app.ir import OTE, Contact, ParseDiagnostic, Program, Routine, Rung, Series
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


# Extra: empty input is a failure, never an empty "passing" program
def test_empty_input_is_diagnostic():
    assert parse("\n   \n") == [
        ParseDiagnostic(line=1, code="PARSE_ERROR", message="no rungs found")
    ]
