import pytest

from backend.app.ir import (
    OTE, TON, Contact, Parallel, ParseDiagnostic, Program, Routine, Rung, Series,
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


def _rungs(program):
    return program.routines[0].rungs


# Test 6: legacy TON (timebase 0.01 s -> 10 ms), and timer bits as contact tags
def test_legacy_ton():
    source = (
        "SOR XIC I:1/0 TON T4:0 0.01 50 0 EOR\n"
        "SOR XIC T4:0/DN XIO T4:0/TT OTE O:2/1 EOR\n"
    )
    first, second = _rungs(parse(source))
    assert first.condition == Series(nodes=[Contact(op="XIC", tag="I:1/0")])
    assert first.outputs == [TON(timer="T4:0", preset=50, timebase_ms=10)]
    assert second.condition == Series(nodes=[
        Contact(op="XIC", tag="T4:0/DN"), Contact(op="XIO", tag="T4:0/TT"),
    ])


# Test 6b: timebase 1 and 1.0 s both -> 1000 ms (exact decimal compare)
@pytest.mark.parametrize("timebase", ["1", "1.0"])
def test_legacy_ton_one_second_timebase(timebase):
    rung, = _rungs(parse(f"SOR TON T4:1 {timebase} 5 0 EOR"))
    assert rung.outputs == [TON(timer="T4:1", preset=5, timebase_ms=1000)]


# Test 7: target TON (preset in ms, timebase_ms = 1), and timer bits as tags
def test_target_ton():
    source = (
        "SOR XIC Start TON Timer0 500 0 EOR\n"
        "SOR XIC Timer0.DN XIO Timer0.TT OTE Lamp EOR\n"
    )
    first, second = _rungs(parse(source))
    assert first.outputs == [TON(timer="Timer0", preset=500, timebase_ms=1)]
    assert second.condition == Series(nodes=[
        Contact(op="XIC", tag="Timer0.DN"), Contact(op="XIO", tag="Timer0.TT"),
    ])


# One test per TON diagnostic
@pytest.mark.parametrize("rung, code, message", [
    ("SOR TON T4:0 0.5 50 0 EOR", "UNSUPPORTED_TIMEBASE",
     "TON timebase '0.5' s is not supported (only 0.01 and 1.0)"),
    ("SOR TON T4:0 0.01 50 7 EOR", "UNSUPPORTED_TIMER_ACC",
     "TON accumulator must be 0 (timers are modeled from zero), got 7"),
    ("SOR TON Timer0 500 3 EOR", "UNSUPPORTED_TIMER_ACC",
     "TON accumulator must be 0 (timers are modeled from zero), got 3"),
    ("SOR TON T4:0 0.01 -5 0 EOR", "PARSE_ERROR",
     "TON preset must be a non-negative integer, got '-5'"),
    ("SOR TON Timer0 2.5 0 EOR", "PARSE_ERROR",
     "TON preset must be a non-negative integer, got '2.5'"),
    ("SOR TON T4:0 0.01 32768 0 EOR", "PARSE_ERROR",
     "TON preset 32768 is above the SLC maximum of 32767"),
    ("SOR TON T4:0 0.01 50 0.5 EOR", "PARSE_ERROR",
     "TON accumulator must be a non-negative integer, got '0.5'"),
    ("SOR TON T4:0 500 0 EOR", "PARSE_ERROR",
     "TON T4:0 is an SLC timer address, so it needs the legacy form "
     "TON <timer> <timebase> <preset> <acc> (got 2 numbers)"),
    ("SOR TON Timer0 0.01 50 0 EOR", "PARSE_ERROR",
     "TON Timer0 is a tag name, so it needs the target form "
     "TON <timer> <preset> <acc> (got 3 numbers)"),
    ("SOR TON O:2/0 500 0 EOR", "PARSE_ERROR",
     "TON timer 'O:2/0' is neither an SLC timer address (like T4:0) "
     "nor a tag name (like Timer0)"),
])
def test_ton_diagnostics(rung, code, message):
    assert parse(rung) == [ParseDiagnostic(line=1, code=code, message=message)]


# Boundary: SLC max preset itself is accepted
def test_legacy_ton_max_preset_accepted():
    rung, = _rungs(parse("SOR TON T4:0 0.01 32767 0 EOR"))
    assert rung.outputs == [TON(timer="T4:0", preset=32767, timebase_ms=10)]


# Extra: empty input is a failure, never an empty "passing" program
def test_empty_input_is_diagnostic():
    assert parse("\n   \n") == [
        ParseDiagnostic(line=1, code="PARSE_ERROR", message="no rungs found")
    ]
