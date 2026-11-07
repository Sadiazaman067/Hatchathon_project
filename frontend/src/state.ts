import type { ParseDiagnostic, TagMapping } from "./api/client";

/** A text file the user picked (or the demo loaded). */
export interface LoadedText {
  name: string;
  text: string;
}

export interface LoadedMap {
  name: string;
  rows: TagMapping[];
}

export interface UploadFiles {
  legacy: LoadedText | null;
  target: LoadedText | null;
  map: LoadedMap | null;
}

export const EMPTY_FILES: UploadFiles = { legacy: null, target: null, map: null };

/** What POST /api/projects (and the optional convert) told us. */
export interface ProjectInfo {
  id: string;
  rungCount: number;
  targetRungCount: number;
  diagnostics: ParseDiagnostic[];
  targetDiagnostics: ParseDiagnostic[];
}
