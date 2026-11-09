import type { TagMapping } from "../../api/client";
import { confirmRow, isRowConfirmed } from "../../workflow/tagMap";

type Props = {
  rows: TagMapping[];
  lockTargetNames: boolean;
  onRows: (rows: TagMapping[]) => void;
};

export default function TagMapStep({ rows, lockTargetNames, onRows }: Props) {
  const confirmed = rows.filter(isRowConfirmed).length;
  const patch = (index: number, next: Partial<TagMapping>) => {
    onRows(
      rows.map((row, i) => {
        if (i !== index) return row;
        const merged: TagMapping = { ...row, ...next };
        if (isRowConfirmed(row)) {
          merged.evidence = `proposed: ${merged.rule}`;
        }
        return merged;
      }),
    );
  };

  return (
    <div className="flow-stack">
      <header className="verdict">
        <p className="eyebrow">03 · Confirm names</p>
        <h2 className="verdict-title">Confirm every name</h2>
        <p className="verdict-body">
          Comparison runs only after every row is confirmed.
          {lockTargetNames
            ? " Converted names are confirm-only."
            : " Converted names may be edited."}
        </p>
      </header>

      <p className="footnote">
        {confirmed} of {rows.length} confirmed
      </p>

      {rows.length === 0 ? (
        <p className="footnote">No rows yet. Convert first, or add a row by hand.</p>
      ) : (
        <table className="draft-table ink tag-table">
          <thead>
            <tr>
              <th scope="col">legacy_tag</th>
              <th scope="col">target_tag</th>
              <th scope="col">kind</th>
              <th scope="col">rule</th>
              <th scope="col">evidence</th>
              <th scope="col"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={`${i}-${row.legacy_tag}`}>
                <td>
                  <input
                    className="cell-input"
                    value={row.legacy_tag}
                    onChange={(e) => patch(i, { legacy_tag: e.target.value })}
                  />
                </td>
                <td>
                  {lockTargetNames ? (
                    <span className="mono">{row.target_tag}</span>
                  ) : (
                    <input
                      className="cell-input"
                      value={row.target_tag}
                      onChange={(e) => patch(i, { target_tag: e.target.value })}
                    />
                  )}
                </td>
                <td>
                  <select
                    className="cell-input"
                    value={row.kind}
                    onChange={(e) =>
                      patch(i, { kind: e.target.value === "observable" ? "observable" : "input" })
                    }
                  >
                    <option value="input">input</option>
                    <option value="observable">observable</option>
                  </select>
                </td>
                <td>
                  <input
                    className="cell-input"
                    value={row.rule}
                    onChange={(e) => patch(i, { rule: e.target.value })}
                  />
                </td>
                <td className="mono muted">{row.evidence || "—"}</td>
                <td>
                  <div className="action-row compact">
                    <button
                      type="button"
                      className="ink-btn"
                      disabled={isRowConfirmed(row)}
                      onClick={() =>
                        onRows(rows.map((r, j) => (j === i ? confirmRow(r) : r)))
                      }
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      className="ink-btn"
                      onClick={() => onRows(rows.filter((_, j) => j !== i))}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="action-row">
        <button
          type="button"
          className="ink-btn"
          onClick={() =>
            onRows([
              ...rows,
              {
                legacy_tag: "",
                target_tag: "",
                kind: "input",
                rule: "",
                evidence: "",
              },
            ])
          }
        >
          Add row
        </button>
        <button
          type="button"
          className="ink-btn primary"
          disabled={rows.length === 0 || confirmed === rows.length}
          onClick={() => onRows(rows.map(confirmRow))}
        >
          Confirm all
        </button>
      </div>
    </div>
  );
}
