"""HTTP API: the four CONTRACT §9 routes, thin wrappers over parse/convert/verify.

Run from the repo root:
    uvicorn backend.app.api:app --reload --port 8000

Projects are JSON files on disk (data/projects/<id>.json); no database.
This is the only backend file besides cli.py that touches the file system.
No parser, simulator or comparison logic lives here.
"""
from __future__ import annotations

import json
import re
import uuid
from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict

from backend.app.ir import ParseDiagnostic, Program, TagMapping, VerifyConfig
from backend.app.parser import parse
from backend.app.report import (
    needs_review_report, parse_failure_report, unresolved_report, verify, with_rules_used,
)
from backend.app.translator import convert, render

DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "data" / "projects"
DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]
_PROJECT_ID = re.compile(r"[0-9a-f]{32}")


# ---------- Request bodies (unknown keys are a 422) ----------

class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CreateProject(Strict):
    legacy_text: str
    target_text: str | None = None


class ConvertRequest(Strict):
    pass


class TagMappingBody(Strict):
    legacy_tag: str
    target_tag: str
    kind: str          # a wrong kind is a needs_review outcome (INVALID_MAPPING_KIND), not a 422
    rule: str
    evidence: str


class VerifyRequest(Strict):
    seed: int = 42
    scenarios: int = 200
    scans: int = 300
    dt_ms: int = 10
    tag_map: list[TagMappingBody]
    confirmed_tag_map: bool = False


# ---------- Pure helpers ----------

def parsed(text: str | None) -> tuple[Program | None, list[ParseDiagnostic]]:
    """(program, []) or (None, diagnostics). None text gives (None, [])."""
    if text is None:
        return None, []
    result = parse(text)
    return (None, result) if isinstance(result, list) else (result, [])


def rung_count(program: Program | None) -> int:
    return 0 if program is None else sum(len(r.rungs) for r in program.routines)


def verify_project(project: dict, body: VerifyRequest) -> dict:
    """Decide the report for a stored project and a verify request."""
    config = VerifyConfig(seed=body.seed, scenarios=body.scenarios,
                          scans=body.scans, dt_ms=body.dt_ms)
    if not body.confirmed_tag_map:
        return needs_review_report(config, ["UNCONFIRMED_MAPPING: confirmed_tag_map is false"])
    if project["target_text"] is None:
        if project["unresolved"]:
            return unresolved_report(config, project["unresolved"])
        return needs_review_report(config, ["NO_TARGET: upload or convert a target first"])
    legacy, legacy_diags = parsed(project["legacy_text"])
    target, target_diags = parsed(project["target_text"])
    if legacy_diags or target_diags:
        return parse_failure_report(config, legacy_diags, target_diags)
    tag_map = [TagMapping(**row.model_dump()) for row in body.tag_map]
    report = verify(legacy, target, tag_map, config)
    if project["target_source"] == "converted":
        report = with_rules_used(report, project["rule_ids"])
    return report


# ---------- App ----------

def create_app(data_dir: Path = DEFAULT_DATA_DIR) -> FastAPI:
    app = FastAPI(title="LadderProof API")
    app.add_middleware(CORSMiddleware, allow_origins=DEV_ORIGINS,
                       allow_methods=["*"], allow_headers=["*"])

    @app.exception_handler(Exception)
    async def internal_error(request: Request, error: Exception):
        return JSONResponse(status_code=500, content={"detail": "internal server error"})

    def path_for(project_id: str) -> Path:
        return data_dir / f"{project_id}.json"

    def load(project_id: str) -> dict:
        path = path_for(project_id)
        if not _PROJECT_ID.fullmatch(project_id) or not path.is_file():
            raise HTTPException(status_code=404, detail="project not found")
        return json.loads(path.read_text(encoding="utf-8"))

    def save(project_id: str, project: dict) -> None:
        data_dir.mkdir(parents=True, exist_ok=True)
        path_for(project_id).write_text(json.dumps(project, indent=2), encoding="utf-8")

    @app.post("/api/projects")
    def create_project(body: CreateProject) -> dict:
        legacy, legacy_diags = parsed(body.legacy_text)
        target, target_diags = parsed(body.target_text)
        project_id = uuid.uuid4().hex
        save(project_id, {
            "legacy_text": body.legacy_text,
            "target_text": body.target_text,
            "target_source": None if body.target_text is None else "uploaded",
            "tag_map": [], "rule_ids": [], "unresolved": [], "report": None,
        })
        return {
            "project_id": project_id,
            "rung_count": rung_count(legacy),
            "diagnostics": [asdict(d) for d in legacy_diags],
            "target_rung_count": rung_count(target),
            "target_diagnostics": [asdict(d) for d in target_diags],
        }

    @app.post("/api/projects/{project_id}/convert")
    def convert_project(project_id: str, body: ConvertRequest) -> dict:
        project = load(project_id)
        legacy, diags = parsed(project["legacy_text"])
        if legacy is None:
            converted_text, tag_map, rule_ids = "", [], []
            unresolved = [f"{d.code}: legacy line {d.line}: {d.message}" for d in diags]
        else:
            target, tag_map, rule_ids, unresolved = convert(legacy)
            converted_text = render(target) if not unresolved else ""
        if not unresolved:
            # The UI asks the user before calling convert on a project with an uploaded target.
            project["target_text"], project["target_source"] = converted_text, "converted"
        project.update(tag_map=[asdict(r) for r in tag_map], rule_ids=rule_ids,
                       unresolved=unresolved)
        save(project_id, project)
        return {"converted_text": converted_text, "tag_map": project["tag_map"],
                "rule_ids": rule_ids, "unresolved": unresolved}

    @app.post("/api/projects/{project_id}/verify")
    def verify_route(project_id: str, body: VerifyRequest) -> dict:
        project = load(project_id)
        project["report"] = verify_project(project, body)
        save(project_id, project)
        return project["report"]

    @app.get("/api/projects/{project_id}/report")
    def get_report(project_id: str) -> dict:
        report = load(project_id)["report"]
        if report is None:
            raise HTTPException(status_code=404, detail="no report yet; run verify first")
        return report

    return app


app = create_app()
