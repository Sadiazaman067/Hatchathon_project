// Typed client for the four HTTP endpoints in CONTRACT.md section 9 (plus the
// target_* upload keys from its changelog). No UI here. The UI never computes a
// verdict; it shows the Report these calls return.
import type { Report } from "../report/types";

export const API_BASE = "http://localhost:8000";

export interface ParseDiagnostic {
  line: number; // 1-based
  code: string; // "PARSE_ERROR" or "UNSUPPORTED_*"
  message: string;
}

export interface TagMapping {
  legacy_tag: string;
  target_tag: string;
  kind: "input" | "observable";
  rule: string;
  evidence: string; // "proposed: RULE" from convert; "user-confirmed · proposed: RULE" once confirmed
}

export interface CreateProjectResponse {
  project_id: string;
  rung_count: number;
  diagnostics: ParseDiagnostic[];
  target_rung_count: number;
  target_diagnostics: ParseDiagnostic[];
}

export interface ConvertResponse {
  converted_text: string;
  tag_map: TagMapping[];
  rule_ids: string[];
  unresolved: string[];
}

export interface VerifySettings {
  seed: number;
  scenarios: number;
  scans: number;
  dt_ms: number;
}

export const DEFAULT_SETTINGS: VerifySettings = { seed: 42, scenarios: 200, scans: 300, dt_ms: 10 };

/**
 * A non-200 response, or no response at all.
 * status: HTTP status (404 unknown project or no report yet, 422 bad body,
 * 500 server fault), or 0 when the API could not be reached (is uvicorn running?).
 * detail: the API's "detail" field as text, or a short description.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(status === 0 ? `API not reachable: ${detail}` : `API error ${status}: ${detail}`);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function detailText(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      // FastAPI 422: [{loc: [...], msg: "..."}]
      return detail
        .map((d) => (d && typeof d === "object" && "msg" in d
          ? `${Array.isArray(d.loc) ? d.loc.join(".") + ": " : ""}${String(d.msg)}`
          : JSON.stringify(d)))
        .join("; ");
    }
    return JSON.stringify(detail);
  }
  return fallback;
}

async function request<T>(method: "GET" | "POST", path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new ApiError(0, error instanceof Error ? error.message : String(error));
  }
  let parsed: unknown = null;
  try {
    parsed = await response.json();
  } catch {
    parsed = null;
  }
  if (!response.ok) {
    throw new ApiError(response.status, detailText(parsed, response.statusText || "no detail"));
  }
  return parsed as T;
}

const projectPath = (id: string) => `/api/projects/${encodeURIComponent(id)}`;

/** POST /api/projects. Texts are the uploaded .txt files read as UTF-8. */
export function createProject(legacyText: string, targetText: string | null): Promise<CreateProjectResponse> {
  return request("POST", "/api/projects", { legacy_text: legacyText, target_text: targetText });
}

/** POST /api/projects/{id}/convert. Replaces a stored target if nothing is unresolved: ask the user first. */
export function convertProject(projectId: string): Promise<ConvertResponse> {
  return request("POST", `${projectPath(projectId)}/convert`, {});
}

/**
 * POST /api/projects/{id}/verify with the user-confirmed tag map.
 * Send confirmed=true only after the user has confirmed every row.
 */
export function verifyProject(
  projectId: string,
  tagMap: TagMapping[],
  confirmed: boolean,
  settings: VerifySettings = DEFAULT_SETTINGS,
): Promise<Report> {
  return request("POST", `${projectPath(projectId)}/verify`, {
    ...settings,
    tag_map: tagMap,
    confirmed_tag_map: confirmed,
  });
}

/** GET /api/projects/{id}/report. ApiError 404 before the first verify. */
export function getReport(projectId: string): Promise<Report> {
  return request("GET", `${projectPath(projectId)}/report`);
}
