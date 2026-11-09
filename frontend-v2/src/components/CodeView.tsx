import { useEffect, useRef } from "react";
import { DiffEditor } from "@monaco-editor/react";
import { monaco } from "../monaco/setup";
import type { TokenSpan } from "../playback/codeLocate";

type Props = {
  original: string;
  converted: string;
  spans: TokenSpan[];
  caption: string;
  locateFailed: boolean;
};

const OPTIONS = {
  readOnly: true,
  renderSideBySide: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
  fontSize: 13,
  lineNumbers: "on" as const,
  wordWrap: "off" as const,
  automaticLayout: true,
  glyphMargin: false,
  folding: false,
  renderOverviewRuler: false,
};

function paint(
  editor: monaco.editor.IStandaloneCodeEditor,
  side: "legacy" | "target",
  spans: TokenSpan[],
): string[] {
  const forSide = spans.filter((span) => span.side === side);
  return editor.deltaDecorations(
    [],
    forSide.map((span) => ({
      range: new monaco.Range(span.line, span.column, span.line, span.column + span.length),
      options: {
        inlineClassName: "code-hl-red",
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    })),
  );
}

export default function CodeView({ original, converted, spans, caption, locateFailed }: Props) {
  const diffRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  useEffect(() => {
    const editor = diffRef.current;
    if (!editor) return;
    paint(editor.getOriginalEditor(), "legacy", spans);
    paint(editor.getModifiedEditor(), "target", spans);
    const first = spans[0];
    if (first) {
      const pane = first.side === "legacy" ? editor.getOriginalEditor() : editor.getModifiedEditor();
      pane.revealLineInCenter(first.line);
      pane.setPosition({ lineNumber: first.line, column: first.column });
    }
  }, [spans, original, converted]);

  return (
    <div className="code-view">
      <p className="footnote">{caption}</p>
      {locateFailed ? (
        <p className="idle-note">
          The problem line could not be named, so both programs are shown with no highlight.
        </p>
      ) : null}
      <div className="code-labels">
        <span>Original</span>
        <span>Converted</span>
      </div>
      <DiffEditor
        height="220px"
        original={original}
        modified={converted}
        language="plaintext"
        options={OPTIONS}
        onMount={(editor) => {
          diffRef.current = editor;
          paint(editor.getOriginalEditor(), "legacy", spans);
          paint(editor.getModifiedEditor(), "target", spans);
          const first = spans[0];
          if (first) {
            const pane =
              first.side === "legacy" ? editor.getOriginalEditor() : editor.getModifiedEditor();
            pane.revealLineInCenter(first.line);
            pane.setPosition({ lineNumber: first.line, column: first.column });
          }
        }}
      />
    </div>
  );
}
