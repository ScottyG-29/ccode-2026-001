import * as vscode from "vscode";
import type { QueryResult } from "./observe-client.js";

/**
 * Webview panel that displays OPAL query results in a table.
 */
export class QueryResultsPanel {
  public static currentPanel: QueryResultsPanel | undefined;
  private static readonly viewType = "opalQueryResults";

  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  public static show(
    extensionUri: vscode.Uri,
    result: QueryResult,
    pipeline: string
  ): void {
    const column = vscode.ViewColumn.Beside;

    if (QueryResultsPanel.currentPanel) {
      QueryResultsPanel.currentPanel.panel.reveal(column);
      QueryResultsPanel.currentPanel.update(result, pipeline);
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      QueryResultsPanel.viewType,
      "OPAL Results",
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    QueryResultsPanel.currentPanel = new QueryResultsPanel(panel);
    QueryResultsPanel.currentPanel.update(result, pipeline);
  }

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private dispose(): void {
    QueryResultsPanel.currentPanel = undefined;
    this.panel.dispose();
    while (this.disposables.length) {
      const d = this.disposables.pop();
      if (d) d.dispose();
    }
  }

  private update(result: QueryResult, pipeline: string): void {
    this.panel.title = `OPAL Results (${result.rowCount} rows)`;
    this.panel.webview.html = this.getHtml(result, pipeline);
  }

  private getHtml(result: QueryResult, pipeline: string): string {
    const escapeHtml = (str: string): string =>
      str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

    const headerCells = result.columns
      .map((col) => `<th>${escapeHtml(col)}</th>`)
      .join("");

    const bodyRows = result.rows
      .slice(0, 1000) // Cap rendering at 1000 rows for performance
      .map((row) => {
        const cells = result.columns
          .map((col) => {
            const val = row[col];
            const display =
              val === null || val === undefined
                ? '<span class="null">null</span>'
                : typeof val === "object"
                  ? `<code>${escapeHtml(JSON.stringify(val))}</code>`
                  : escapeHtml(String(val));
            return `<td>${display}</td>`;
          })
          .join("");
        return `<tr>${cells}</tr>`;
      })
      .join("");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>OPAL Query Results</title>
  <style>
    body {
      font-family: var(--vscode-font-family, 'Segoe UI', sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      margin: 0;
      padding: 12px;
    }
    .meta {
      margin-bottom: 12px;
      padding: 8px 12px;
      background: var(--vscode-textBlockQuote-background, #1e1e1e);
      border-left: 3px solid var(--vscode-textLink-foreground, #3794ff);
      border-radius: 3px;
      font-size: 12px;
    }
    .meta code {
      display: block;
      white-space: pre-wrap;
      margin-top: 4px;
      color: var(--vscode-textPreformat-foreground, #d7ba7d);
    }
    .stats {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th {
      position: sticky;
      top: 0;
      background: var(--vscode-editor-background);
      border-bottom: 2px solid var(--vscode-panel-border, #333);
      text-align: left;
      padding: 6px 10px;
      font-weight: 600;
      white-space: nowrap;
    }
    td {
      padding: 4px 10px;
      border-bottom: 1px solid var(--vscode-panel-border, #222);
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    tr:hover td {
      background: var(--vscode-list-hoverBackground, #2a2d2e);
    }
    .null {
      color: var(--vscode-descriptionForeground);
      font-style: italic;
    }
    code {
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 11px;
    }
    .truncated {
      color: var(--vscode-errorForeground, #f44747);
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="meta">
    <strong>Pipeline:</strong>
    <code>${escapeHtml(pipeline)}</code>
  </div>
  <div class="stats">
    ${result.rowCount} rows returned in ${result.executionTimeMs}ms
    ${result.truncated ? '<span class="truncated"> (results truncated)</span>' : ""}
    ${result.rowCount > 1000 ? " — showing first 1,000 rows" : ""}
  </div>
  <div style="overflow: auto; max-height: calc(100vh - 120px);">
    <table>
      <thead><tr>${headerCells}</tr></thead>
      <tbody>${bodyRows}</tbody>
    </table>
  </div>
</body>
</html>`;
  }
}
