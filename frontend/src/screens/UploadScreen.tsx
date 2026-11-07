import { useState } from "react";
import { ApiError, convertProject, createProject, type ParseDiagnostic, type TagMapping } from "../api/client";
import { PrimaryButton, SecondaryButton } from "../components/Buttons";
import { DEMOS, loadDemo } from "../lib/demos";
import { countLines, firstLines, parseTagMap, resetEvidence } from "../lib/files";
import type { LoadedMap, LoadedText, ProjectInfo, UploadFiles } from "../state";

type Props = {
  files: UploadFiles;
  setFiles: (files: UploadFiles) => void;
  /** Called when the project exists and the user can move on to the tag map. */
  onReady: (project: ProjectInfo, rows: TagMapping[]) => void;
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const API_HELP = "Start the API from the repo folder: uvicorn backend.app.api:app --port 8000";

function problemText(error: unknown): string {
  if (error instanceof ApiError && error.status === 0) return `The API isn’t reachable. ${API_HELP}`;
  return error instanceof Error ? error.message : String(error);
}

/** A file area: click it or drop a file on it. Shows the file name, line count and the first lines in mono. */
function DropZone(props: {
  title: string;
  hint: string;
  accept: string;
  file: { name: string } | null;
  detail?: string;
  preview?: string[];
  onFile: (file: File) => void;
  onClear: () => void;
}) {
  const { title, hint, accept, file, detail, preview, onFile, onClear } = props;
  const [over, setOver] = useState(false);
  return (
    <div className="min-w-0">
      <h2 className="m-0 mb-2 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">{title}</h2>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        className={`flex min-h-[168px] cursor-pointer flex-col justify-center gap-2 border border-dashed p-5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink ${
          over ? "border-ink bg-hair-2" : "border-muted bg-sheet"
        }`}
      >
        <input
          type="file"
          accept={accept}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
        {file ? (
          <>
            <span className="break-all font-mono text-[14px] font-semibold text-ink">{file.name}</span>
            {detail && <span className="font-mono text-[12px] text-muted">{detail}</span>}
            {preview && (
              <pre className="m-0 overflow-x-auto border border-hair bg-paper p-2 font-mono text-[12px] leading-[1.5] text-ink">
                {preview.join("\n")}
              </pre>
            )}
          </>
        ) : (
          <>
            <span className="text-[15px] font-medium text-ink">Drop a file here, or click to choose</span>
            <span className="font-mono text-[12px] text-muted">{hint}</span>
          </>
        )}
      </label>
      {file && (
        <button
          type="button"
          onClick={onClear}
          className="mt-2 cursor-pointer border-0 bg-transparent p-0 font-sans text-[13px] text-muted underline hover:text-ink"
        >
          Remove file
        </button>
      )}
    </div>
  );
}

function Diagnostics({ which, items }: { which: string; items: ParseDiagnostic[] }) {
  return (
    <>
      {items.map((d, i) => (
        <li key={`${which}-${i}`} className="border-b border-hair bg-amber-tint px-4 py-2.5 last:border-b-0">
          <span className="font-mono text-[13px] font-semibold text-amber-text">{d.code}</span>
          <span className="font-mono text-[13px] text-ink">
            {" "}
            · {which} line {d.line} · {d.message}
          </span>
        </li>
      ))}
    </>
  );
}

export default function UploadScreen({ files, setFiles, onReady }: Props) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [result, setResult] = useState<{ project: ProjectInfo; rows: TagMapping[]; unresolved: string[] } | null>(null);

  async function pickText(kind: "legacy" | "target", file: File) {
    setProblem(null);
    setResult(null);
    const loaded: LoadedText = { name: file.name, text: await file.text() };
    setFiles({ ...files, [kind]: loaded });
  }

  async function pickMap(file: File) {
    setProblem(null);
    setResult(null);
    try {
      const rows = parseTagMap(await file.text());
      setFiles({ ...files, map: { name: file.name, rows } });
    } catch (e) {
      setProblem(`Tag map not loaded: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  async function demo(chosen: (typeof DEMOS)[number]) {
    setProblem(null);
    setResult(null);
    try {
      const loaded = await loadDemo(chosen);
      const map: LoadedMap = { name: loaded.mapName, rows: parseTagMap(loaded.mapText) };
      setFiles({ legacy: loaded.legacy, target: loaded.target, map });
    } catch (e) {
      setProblem(problemText(e));
    }
  }

  async function next() {
    if (!files.legacy) return;
    if (files.target && !files.map) {
      setProblem("Add a tag map file for the converted program, or remove the converted program so it can be converted for you.");
      return;
    }
    setBusy(true);
    setProblem(null);
    setResult(null);
    try {
      const created = await createProject(files.legacy.text, files.target?.text ?? null);
      const project: ProjectInfo = {
        id: created.project_id,
        rungCount: created.rung_count,
        targetRungCount: created.target_rung_count,
        diagnostics: created.diagnostics,
        targetDiagnostics: created.target_diagnostics,
      };
      let rows: TagMapping[] | null = files.map?.rows ?? null;
      let unresolved: string[] = [];
      if (!rows) {
        // No converted program was given: ask the API to convert (it has nothing to overwrite).
        const converted = await convertProject(created.project_id);
        rows = resetEvidence(converted.tag_map);
        unresolved = converted.unresolved;
      }
      const hasDiagnostics = project.diagnostics.length > 0 || project.targetDiagnostics.length > 0;
      if (hasDiagnostics || unresolved.length > 0 || rows.length === 0) {
        setResult({ project, rows, unresolved });
      } else {
        onReady(project, rows);
      }
    } catch (e) {
      setProblem(problemText(e));
    } finally {
      setBusy(false);
    }
  }

  const reason = !files.legacy ? "Load the legacy program first." : null;

  return (
    <div>
      <p className="m-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted">01 Upload</p>
      <h1 className="m-0 mt-3 max-w-[26ch] font-serif text-[40px] font-normal leading-[1.15] text-ink">
        Which two programs should we compare?
      </h1>
      <p className="m-0 mt-3 max-w-[64ch] text-[16px] leading-[1.5] text-ink">
        Load the old program and the converted one, plus the tag map that says which old address became which new tag.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <DropZone
          title="Legacy · SLC 500"
          hint=".txt mnemonic file"
          accept=".txt,text/plain"
          file={files.legacy}
          detail={files.legacy ? plural(countLines(files.legacy.text), "line") : undefined}
          preview={files.legacy ? firstLines(files.legacy.text) : undefined}
          onFile={(f) => pickText("legacy", f)}
          onClear={() => setFiles({ ...files, legacy: null })}
        />
        <DropZone
          title="Converted · Logix (optional)"
          hint=".txt mnemonic file"
          accept=".txt,text/plain"
          file={files.target}
          detail={files.target ? plural(countLines(files.target.text), "line") : undefined}
          preview={files.target ? firstLines(files.target.text) : undefined}
          onFile={(f) => pickText("target", f)}
          onClear={() => setFiles({ ...files, target: null })}
        />
      </div>

      <div className="mt-6 max-w-[520px]">
        <DropZone
          title="Tag map · JSON"
          hint=".json list of mappings"
          accept=".json,application/json"
          file={files.map}
          detail={files.map ? plural(files.map.rows.length, "row") : undefined}
          onFile={pickMap}
          onClear={() => setFiles({ ...files, map: null })}
        />
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <PrimaryButton onClick={next} disabled={!files.legacy || busy}>
          {busy ? "Reading programs…" : "Continue to tag map"}
        </PrimaryButton>
        {reason && <span className="text-[13px] text-muted">{reason}</span>}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Load demo</span>
        {DEMOS.map((d) => (
          <SecondaryButton key={d.id} onClick={() => demo(d)}>
            {d.label}
          </SecondaryButton>
        ))}
      </div>

      {problem && (
        <p role="alert" className="m-0 mt-5 max-w-[72ch] border border-amber bg-amber-tint px-4 py-3 font-mono text-[13px] leading-[1.5] text-amber-text">
          {problem}
        </p>
      )}

      {result && (
        <section aria-labelledby="parse-result" className="mt-8">
          <h2 id="parse-result" className="m-0 mb-2 font-mono text-[11px] font-normal uppercase tracking-[0.12em] text-muted">
            Parse result
          </h2>
          <p className="m-0 mb-3 font-mono text-[13px] text-ink">
            legacy rungs {result.project.rungCount} · converted rungs {result.project.targetRungCount}
          </p>
          {(result.project.diagnostics.length > 0 || result.project.targetDiagnostics.length > 0) && (
            <ul className="m-0 list-none border border-amber p-0">
              <Diagnostics which="legacy" items={result.project.diagnostics} />
              <Diagnostics which="converted" items={result.project.targetDiagnostics} />
            </ul>
          )}
          {result.unresolved.length > 0 && (
            <ul className="m-0 mt-3 list-none border border-amber p-0">
              {result.unresolved.map((u) => (
                <li key={u} className="border-b border-hair bg-amber-tint px-4 py-2.5 font-mono text-[13px] last:border-b-0">
                  {u}
                </li>
              ))}
            </ul>
          )}
          {result.rows.length === 0 && result.unresolved.length > 0 && (
            <p className="m-0 mt-3 max-w-[64ch] text-[13px] leading-[1.5] text-muted">
              The legacy program couldn’t be converted automatically, so there is no tag map to confirm. Load a converted
              program and a tag map, or fix the items above.
            </p>
          )}
          {(result.project.diagnostics.length > 0 || result.project.targetDiagnostics.length > 0) && (
            <p className="m-0 mt-3 max-w-[64ch] text-[13px] leading-[1.5] text-muted">
              Any error here means the result can’t be a clean one. The report will say needs review.
            </p>
          )}
          {result.rows.length > 0 && (
            <div className="mt-4">
              <PrimaryButton onClick={() => onReady(result.project, result.rows)}>Continue with these errors</PrimaryButton>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
