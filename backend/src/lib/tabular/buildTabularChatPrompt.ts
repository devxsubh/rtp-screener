import type { ColumnConfig } from "../../types/tabular";

type GridRow = { id: string; name: string; meta?: Record<string, unknown> };
type GridCell = {
  documentId: string;
  columnIndex: number;
  content: { summary?: string; flag?: string } | null;
  status: string;
};

const MAX_ROWS = 80;
const MAX_CELL_CHARS = 180;

function cellSummary(content: GridCell["content"]): string {
  if (!content?.summary?.trim()) return "—";
  const s = content.summary.trim().replace(/\|/g, "\\|").replace(/\n/g, " ");
  return s.length <= MAX_CELL_CHARS ? s : `${s.slice(0, MAX_CELL_CHARS)}…`;
}

/** Compact markdown table of the current tabular grid for the chat system prompt. */
export function buildTabularContextPrompt(params: {
  title: string;
  reviewKind: string;
  projectName?: string | null;
  columns: ColumnConfig[];
  rows: GridRow[];
  cells: GridCell[];
}): string {
  const { title, reviewKind, projectName, columns, rows, cells } = params;
  const colNames = [...columns].sort((a, b) => a.index - b.index);

  const parts: string[] = [
    "## Tabular review context",
    `Title: ${title}`,
    `Review type: ${reviewKind}`,
  ];
  if (projectName) parts.push(`Project: ${projectName}`);

  if (reviewKind === "portfolio_monitoring") {
    parts.push(
      "This grid lists portfolio companies. Values sync from each startup's latest cap-table sanctions screen. " +
        '"Co-investor risk" shows "Not screened" until a co-investor/vendor roster screen is run on that startup. ' +
        "Use @StartupName to pull full screening detail via tools.",
    );
  } else if (reviewKind === "entity_screening") {
    parts.push(
      "This grid lists entities from a cap-table sanctions screen. Cells are machine-filled from Watchman screening.",
    );
  } else {
    parts.push(
      "This is a document-based tabular review. Answer from the grid data below; use screening tools when the user @-mentions a startup.",
    );
  }

  if (rows.length === 0) {
    parts.push("The grid has no rows yet.");
    return parts.join("\n");
  }

  const displayRows = rows.slice(0, MAX_ROWS);
  if (rows.length > MAX_ROWS) {
    parts.push(`(Showing first ${MAX_ROWS} of ${rows.length} rows.)`);
  }

  const header = ["Document", ...colNames.map((c) => c.name)].join(" | ");
  const sep = ["---", ...colNames.map(() => "---")].join(" | ");
  const tableLines = [header, sep];

  for (const row of displayRows) {
    const rowCells = colNames.map((col) => {
      const cell = cells.find(
        (c) => c.documentId === row.id && c.columnIndex === col.index,
      );
      return cellSummary(cell?.content ?? null);
    });
    tableLines.push([row.name, ...rowCells].join(" | "));
  }

  parts.push("Current grid:\n" + tableLines.join("\n"));
  return parts.join("\n");
}
