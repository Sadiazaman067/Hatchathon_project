import pytest

from backend.app.ir import OTE, Contact, Parallel, Program, Routine, Rung, Series, TagMapping
from backend.app.parser import parse
from backend.app.translator import convert, render, target_name

SEAL_IN = "SOR BST XIC I:1/0 NXB XIC O:2/0 BND XIO I:1/1 OTE O:2/0 EOR"
SEAL_IN_TARGET = "SOR BST XIC I_1_0 NXB XIC O_2_0 BND XIO I_1_1 OTE O_2_0 EOR"


def test_target_name_rule():
    assert target_name("I:1/0") == "I_1_0"
    assert target_name("O:12/15") == "O_12_15"
    for bad in ("B3:0/1", "T4:0/DN", "I:1.0/0", "I:01/0", "Start"):
        assert target_name(bad) is None


def test_convert_seal_in():
    target, tag_map, rule_ids, unresolved = convert(parse(SEAL_IN))
    assert target == Program(routines=[Routine(name="MainRoutine", rungs=[Rung(
        id=1, source_text=SEAL_IN_TARGET,
        condition=Series(nodes=[
            Parallel(nodes=[
                Series(nodes=[Contact(op="XIC", tag="I_1_0")]),
                Series(nodes=[Contact(op="XIC", tag="O_2_0")]),
            ]),
            Contact(op="XIO", tag="I_1_1"),
        ]),
        outputs=[OTE(tag="O_2_0")],
    )])])
    assert tag_map == [
        TagMapping("I:1/0", "I_1_0", "input", "INPUT_MAP_V1", "proposed: INPUT_MAP_V1"),
        TagMapping("I:1/1", "I_1_1", "input", "INPUT_MAP_V1", "proposed: INPUT_MAP_V1"),
        TagMapping("O:2/0", "O_2_0", "observable", "OUTPUT_MAP_V1", "proposed: OUTPUT_MAP_V1"),
    ]
    assert rule_ids == ["INPUT_MAP_V1", "OUTPUT_MAP_V1"]
    assert unresolved == []


def test_converted_target_renders_and_parses_back():
    target, *_ = convert(parse(SEAL_IN))
    assert render(target) == SEAL_IN_TARGET + "\n"
    assert parse(render(target)) == target


@pytest.mark.parametrize("text", [
    SEAL_IN,
    "SOR XIC I:1/0 XIO I:1/1 OTE O:2/0 OTE O:2/1 EOR",
    "SOR OTE O:2/0 EOR",
    "SOR XIC I:1/0 TON T4:0 0.01 50 0 EOR",
    "SOR XIC I:1/0 TON T4:1 1.0 5 0 EOR",
    "SOR XIC Start TON Timer0 500 0 EOR",
])
def test_render_round_trip(text):
    assert render(parse(text)) == text + "\n"


def test_tag_map_is_in_numeric_order_inputs_first():
    _, tag_map, _, _ = convert(parse("SOR XIC I:1/10 XIC I:1/2 OTE O:2/0 EOR"))
    assert [row.legacy_tag for row in tag_map] == ["I:1/2", "I:1/10", "O:2/0"]


@pytest.mark.parametrize("text, message", [
    ("SOR XIC B3:0/1 OTE O:2/0 EOR",
     "UNRESOLVED_ADDRESS: rung 1: B3:0/1 has no P0 naming rule"),
    ("SOR XIC T4:0/DN OTE O:2/0 EOR",
     "UNRESOLVED_ADDRESS: rung 1: T4:0/DN has no P0 naming rule"),
    ("SOR XIC I:01/0 OTE O:2/0 EOR",
     "UNRESOLVED_ADDRESS: rung 1: I:01/0 has no P0 naming rule"),
    ("SOR XIC I:1/0 OTE B3:0/1 EOR",
     "UNRESOLVED_ADDRESS: rung 1: B3:0/1 has no P0 naming rule"),
    ("SOR XIC I:1/0 TON T4:0 0.01 50 0 EOR",
     "UNRESOLVED_INSTRUCTION: rung 1: TON T4:0 is not converted yet"),
    ("SOR XIC I:1/0 OTE I:1/1 EOR",
     "UNRESOLVED_INPUT_WRITE: rung 1: OTE writes input I:1/1"),
    ("SOR XIC O:2/1 OTE O:2/0 EOR",
     "UNRESOLVED_OUTPUT_READ: rung 1: O:2/1 is read but never written"),
])
def test_unresolved_is_all_or_nothing(text, message):
    assert convert(parse(text)) == (Program(routines=[]), [], [], [message])


def test_all_unresolved_collected_in_rung_order_without_duplicates():
    text = ("SOR XIC I:1/0 OTE O:2/0 EOR\n"
            "SOR XIC B3:0/1 XIO B3:0/1 TON T4:0 0.01 50 0 EOR\n"
            "SOR XIC N7:0/2 OTE O:2/1 EOR\n")
    assert convert(parse(text))[3] == [
        "UNRESOLVED_ADDRESS: rung 2: B3:0/1 has no P0 naming rule",
        "UNRESOLVED_INSTRUCTION: rung 2: TON T4:0 is not converted yet",
        "UNRESOLVED_ADDRESS: rung 3: N7:0/2 has no P0 naming rule",
    ]
