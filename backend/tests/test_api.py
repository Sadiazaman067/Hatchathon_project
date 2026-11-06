import pytest
from fastapi.testclient import TestClient

from backend.app.api import create_app

LEGACY = "SOR BST XIC I:1/0 NXB XIC O:2/0 BND XIO I:1/1 OTE O:2/0 EOR\n"
CORRECT = "SOR BST XIC Start NXB XIC Motor BND XIO Stop OTE Motor EOR\n"
FLIPPED = "SOR BST XIC Start NXB XIC Motor BND XIC Stop OTE Motor EOR\n"


def row(legacy, target, kind):
    rule = "INPUT_MAP_V1" if kind == "input" else "OUTPUT_MAP_V1"
    return {"legacy_tag": legacy, "target_tag": target, "kind": kind,
            "rule": rule, "evidence": "user-confirmed"}


TAG_MAP = [row("I:1/0", "Start", "input"), row("I:1/1", "Stop", "input"),
           row("O:2/0", "Motor", "observable")]
SMALL = {"seed": 42, "scenarios": 5, "scans": 20, "dt_ms": 10}


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(tmp_path / "projects"))


def new_project(client, legacy=LEGACY, target=None):
    response = client.post("/api/projects", json={"legacy_text": legacy, "target_text": target})
    assert response.status_code == 200
    return response.json()


def test_create_project_counts_rungs_on_both_sides(client):
    body = new_project(client, target=CORRECT)
    assert set(body) == {"project_id", "rung_count", "diagnostics",
                         "target_rung_count", "target_diagnostics"}
    assert (body["rung_count"], body["diagnostics"]) == (1, [])
    assert (body["target_rung_count"], body["target_diagnostics"]) == (1, [])


def test_create_project_keeps_diagnostics_per_side(client):
    body = new_project(client, target="SOR XIC Start ADD N7:0 OTE Motor EOR\n")
    assert body["rung_count"] == 1
    assert body["target_rung_count"] == 0
    assert body["target_diagnostics"] == [{
        "line": 1, "code": "UNSUPPORTED_OPCODE",
        "message": "unsupported instruction 'ADD' at column 15"}]


def test_create_project_without_target(client):
    body = new_project(client)
    assert (body["target_rung_count"], body["target_diagnostics"]) == (0, [])


def test_convert_returns_proposal(client):
    pid = new_project(client)["project_id"]
    response = client.post(f"/api/projects/{pid}/convert", json={})
    assert response.status_code == 200
    assert response.json() == {
        "converted_text": "SOR BST XIC I_1_0 NXB XIC O_2_0 BND XIO I_1_1 OTE O_2_0 EOR\n",
        "tag_map": [
            {"legacy_tag": "I:1/0", "target_tag": "I_1_0", "kind": "input",
             "rule": "INPUT_MAP_V1", "evidence": "proposed: INPUT_MAP_V1"},
            {"legacy_tag": "I:1/1", "target_tag": "I_1_1", "kind": "input",
             "rule": "INPUT_MAP_V1", "evidence": "proposed: INPUT_MAP_V1"},
            {"legacy_tag": "O:2/0", "target_tag": "O_2_0", "kind": "observable",
             "rule": "OUTPUT_MAP_V1", "evidence": "proposed: OUTPUT_MAP_V1"},
        ],
        "rule_ids": ["INPUT_MAP_V1", "OUTPUT_MAP_V1"],
        "unresolved": [],
    }


def test_convert_then_confirm_then_verify(client):
    pid = new_project(client)["project_id"]
    proposed = client.post(f"/api/projects/{pid}/convert", json={}).json()["tag_map"]
    confirmed = [{**r, "evidence": f"user-confirmed · {r['evidence']}"} for r in proposed]
    report = client.post(f"/api/projects/{pid}/verify",
                         json={**SMALL, "tag_map": confirmed, "confirmed_tag_map": True}).json()
    assert report["status"] == "no_difference_observed"
    assert report["coverage"] == {"scenarios": 5, "scans": 100, "seed": 42}
    assert report["rules_used"] == ["INPUT_MAP_V1", "OUTPUT_MAP_V1"]


def test_convert_with_unresolved_then_verify_is_needs_review(client):
    pid = new_project(client, legacy="SOR XIC B3:0/1 OTE O:2/0 EOR\n")["project_id"]
    body = client.post(f"/api/projects/{pid}/convert", json={}).json()
    assert body["converted_text"] == ""
    assert body["unresolved"] == ["UNRESOLVED_ADDRESS: rung 1: B3:0/1 has no P0 naming rule"]
    report = client.post(f"/api/projects/{pid}/verify",
                         json={**SMALL, "tag_map": [], "confirmed_tag_map": True}).json()
    assert report["status"] == "needs_review"
    assert report["warnings"] == body["unresolved"]


def test_uploaded_flipped_target_is_different_and_report_is_stored(client):
    pid = new_project(client, target=FLIPPED)["project_id"]
    report = client.post(f"/api/projects/{pid}/verify",
                         json={**SMALL, "tag_map": TAG_MAP, "confirmed_tag_map": True}).json()
    assert report["status"] == "different"
    assert report["first_divergence"]["tag"] == "O:2/0"
    assert report["rules_used"] == []
    stored = client.get(f"/api/projects/{pid}/report")
    assert stored.status_code == 200
    assert stored.json() == report


def test_report_survives_a_new_app_on_the_same_folder(tmp_path):
    first = TestClient(create_app(tmp_path))
    pid = new_project(first, target=CORRECT)["project_id"]
    report = first.post(f"/api/projects/{pid}/verify",
                        json={**SMALL, "tag_map": TAG_MAP, "confirmed_tag_map": True}).json()
    second = TestClient(create_app(tmp_path))
    assert second.get(f"/api/projects/{pid}/report").json() == report


@pytest.mark.parametrize("confirmed", [{"confirmed_tag_map": False}, {}])
def test_unconfirmed_map_is_needs_review(client, confirmed):
    pid = new_project(client, target=CORRECT)["project_id"]
    report = client.post(f"/api/projects/{pid}/verify",
                         json={**SMALL, "tag_map": TAG_MAP, **confirmed}).json()
    assert report["status"] == "needs_review"
    assert report["warnings"] == ["UNCONFIRMED_MAPPING: confirmed_tag_map is false"]


def test_no_target_is_needs_review(client):
    pid = new_project(client)["project_id"]
    report = client.post(f"/api/projects/{pid}/verify",
                         json={**SMALL, "tag_map": TAG_MAP, "confirmed_tag_map": True}).json()
    assert report["status"] == "needs_review"
    assert report["warnings"] == ["NO_TARGET: upload or convert a target first"]


def test_target_parse_error_is_needs_review(client):
    pid = new_project(client, target="SOR XIC Start ADD N7:0 OTE Motor EOR\n")["project_id"]
    report = client.post(f"/api/projects/{pid}/verify",
                         json={**SMALL, "tag_map": TAG_MAP, "confirmed_tag_map": True}).json()
    assert report["status"] == "needs_review"
    assert report["warnings"] == [
        "UNSUPPORTED_OPCODE: target line 1: unsupported instruction 'ADD' at column 15"]


def test_report_before_verify_is_404(client):
    pid = new_project(client)["project_id"]
    response = client.get(f"/api/projects/{pid}/report")
    assert response.status_code == 404
    assert response.json() == {"detail": "no report yet; run verify first"}


@pytest.mark.parametrize("method, path", [
    ("post", "/convert"), ("post", "/verify"), ("get", "/report")])
@pytest.mark.parametrize("pid", ["0" * 32, "..%2Fsecret", "not-a-project"])
def test_unknown_project_is_404(client, method, path, pid):
    body = {"tag_map": [], "confirmed_tag_map": True} if path == "/verify" else {}
    kwargs = {} if method == "get" else {"json": body}
    response = getattr(client, method)(f"/api/projects/{pid}{path}", **kwargs)
    assert response.status_code == 404


@pytest.mark.parametrize("path, body", [
    ("", {"target_text": CORRECT}),                         # missing legacy_text
    ("", {"legacy_text": 5}),                               # wrong type
    ("", {"legacy_text": LEGACY, "extra": 1}),              # unknown key
    ("/verify", {"confirmed_tag_map": True}),               # missing tag_map
    ("/verify", {"tag_map": [{"legacy_tag": "I:1/0"}], "confirmed_tag_map": True}),
    ("/convert", {"replace": True}),
])
def test_bad_body_is_422(client, path, body):
    url = "/api/projects" if path == "" else f"/api/projects/{new_project(client)['project_id']}{path}"
    assert client.post(url, json=body).status_code == 422


def test_server_fault_is_500_without_stack_trace(tmp_path, monkeypatch):
    from backend.app import api

    def boom(text):
        raise RuntimeError("secret internals")
    monkeypatch.setattr(api, "parse", boom)
    client = TestClient(create_app(tmp_path), raise_server_exceptions=False)
    response = client.post("/api/projects", json={"legacy_text": LEGACY})
    assert response.status_code == 500
    assert response.json() == {"detail": "internal server error"}


def test_cors_allows_vite_dev_server(client):
    response = client.options("/api/projects", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"})
    assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    other = client.options("/api/projects", headers={
        "Origin": "http://evil.example", "Access-Control-Request-Method": "POST"})
    assert "access-control-allow-origin" not in other.headers
