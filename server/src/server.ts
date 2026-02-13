import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentSyncKind,
  CompletionItem,
  CompletionItemKind,
  Hover,
  MarkupKind,
  Diagnostic,
  DiagnosticSeverity,
  TextDocumentPositionParams,
  DidChangeConfigurationNotification,
  InsertTextFormat,
} from "vscode-languageserver/node.js";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
  OPAL_VERBS,
  OPAL_FUNCTIONS,
  OPAL_KEYWORDS,
  OPAL_DATA_TYPES,
  findOpalItem,
  OpalItem,
} from "./opal-language.js";

// ---------------------------------------------------------------------------
// Connection & document manager
// ---------------------------------------------------------------------------

const connection = createConnection(ProposedFeatures.all);
const documents = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

interface OpalSettings {
  diagnosticsEnable: boolean;
  completionAutoTrigger: boolean;
}

const defaultSettings: OpalSettings = {
  diagnosticsEnable: true,
  completionAutoTrigger: true,
};

let globalSettings: OpalSettings = defaultSettings;
const documentSettings: Map<string, Thenable<OpalSettings>> = new Map();

function getDocumentSettings(resource: string): Thenable<OpalSettings> {
  if (!hasConfigurationCapability) {
    return Promise.resolve(globalSettings);
  }
  let result = documentSettings.get(resource);
  if (!result) {
    result = connection.workspace.getConfiguration({
      scopeUri: resource,
      section: "observeOpal",
    });
    documentSettings.set(resource, result);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

connection.onInitialize((params: InitializeParams): InitializeResult => {
  const capabilities = params.capabilities;

  hasConfigurationCapability = !!(
    capabilities.workspace && capabilities.workspace.configuration
  );
  hasDiagnosticRelatedInformationCapability = !!(
    capabilities.textDocument &&
    capabilities.textDocument.publishDiagnostics &&
    capabilities.textDocument.publishDiagnostics.relatedInformation
  );

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        resolveProvider: true,
        triggerCharacters: ["|", ".", " ", "(", ","],
      },
      hoverProvider: true,
    },
  };
});

connection.onInitialized(() => {
  if (hasConfigurationCapability) {
    connection.client.register(
      DidChangeConfigurationNotification.type,
      undefined
    );
  }
});

// ---------------------------------------------------------------------------
// Configuration changes
// ---------------------------------------------------------------------------

connection.onDidChangeConfiguration((change) => {
  if (hasConfigurationCapability) {
    documentSettings.clear();
  } else {
    globalSettings = change.settings.observeOpal || defaultSettings;
  }
  documents.all().forEach(validateTextDocument);
});

documents.onDidClose((e) => {
  documentSettings.delete(e.document.uri);
});

documents.onDidChangeContent((change) => {
  validateTextDocument(change.document);
});

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

async function validateTextDocument(textDocument: TextDocument): Promise<void> {
  const settings = await getDocumentSettings(textDocument.uri);
  if (!settings.diagnosticsEnable) {
    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics: [] });
    return;
  }

  const text = textDocument.getText();
  const lines = text.split(/\r?\n/);
  const diagnostics: Diagnostic[] = [];

  const verbNames = new Set(OPAL_VERBS.map((v) => v.name));

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed === "" || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
      continue;
    }

    // Check for pipe-only lines (common mistake)
    if (trimmed === "|") {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: line.indexOf("|") },
          end: { line: i, character: line.indexOf("|") + 1 },
        },
        message: "Empty pipe — expected a verb after '|'.",
        source: "opal",
      });
    }

    // Check for unmatched parentheses on this line
    let parenDepth = 0;
    let inString = false;
    let stringChar = "";
    for (let j = 0; j < line.length; j++) {
      const ch = line[j];
      if (inString) {
        if (ch === stringChar && line[j - 1] !== "\\") {
          inString = false;
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        inString = true;
        stringChar = ch;
        continue;
      }
      if (ch === "/" && line[j + 1] === "/") break; // line comment
      if (ch === "(") parenDepth++;
      if (ch === ")") parenDepth--;
    }
    if (parenDepth > 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length },
        },
        message: `Unmatched parenthesis — ${parenDepth} unclosed '(' on this line.`,
        source: "opal",
      });
    } else if (parenDepth < 0) {
      diagnostics.push({
        severity: DiagnosticSeverity.Warning,
        range: {
          start: { line: i, character: 0 },
          end: { line: i, character: line.length },
        },
        message: `Unmatched parenthesis — ${-parenDepth} extra ')' on this line.`,
        source: "opal",
      });
    }

    // Check for potentially unknown verbs at the start of a pipeline stage
    // A pipeline stage starts after a pipe or at the beginning of the script
    const stageMatch = trimmed.match(/^\|?\s*([a-z_][a-z0-9_]*)/);
    if (stageMatch) {
      const word = stageMatch[1];
      // Only flag it if it looks like it should be a verb (line starts with | or is a top-level statement)
      const lineStartsWithPipe = trimmed.startsWith("|");
      if (lineStartsWithPipe && !verbNames.has(word)) {
        const wordStart = line.indexOf(word);
        diagnostics.push({
          severity: DiagnosticSeverity.Information,
          range: {
            start: { line: i, character: wordStart },
            end: { line: i, character: wordStart + word.length },
          },
          message: `Unknown OPAL verb '${word}'. Did you mean one of: filter, make_col, statsby, join?`,
          source: "opal",
        });
      }
    }
  }

  connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// ---------------------------------------------------------------------------
// Completions
// ---------------------------------------------------------------------------

connection.onCompletion(
  (params: TextDocumentPositionParams): CompletionItem[] => {
    const doc = documents.get(params.textDocument.uri);
    if (!doc) return [];

    const line = doc
      .getText({
        start: { line: params.position.line, character: 0 },
        end: params.position,
      })
      .trimStart();

    const items: CompletionItem[] = [];

    // After pipe or at line start → suggest verbs
    const afterPipe = line.match(/\|\s*(\w*)$/);
    const atLineStart = line.match(/^(\w*)$/);

    if (afterPipe || atLineStart) {
      OPAL_VERBS.forEach((verb, idx) => {
        items.push({
          label: verb.name,
          kind: CompletionItemKind.Keyword,
          detail: `[${verb.category}] ${verb.signature || ""}`,
          documentation: {
            kind: MarkupKind.Markdown,
            value: formatItemDoc(verb),
          },
          sortText: `0-${String(idx).padStart(3, "0")}`,
          insertText: verb.name,
        });
      });
    }

    // After function context (inside parens, after comma, or general expression) → suggest functions
    const inExpression =
      line.includes(":") ||
      line.includes("(") ||
      line.includes(",") ||
      line.match(/\b(filter|make_col|set_col|statsby|timechart|align|aggregate)\b/);

    if (inExpression) {
      OPAL_FUNCTIONS.forEach((func, idx) => {
        items.push({
          label: func.name,
          kind: CompletionItemKind.Function,
          detail: `[${func.category}] ${func.signature || ""}`,
          documentation: {
            kind: MarkupKind.Markdown,
            value: formatItemDoc(func),
          },
          sortText: `1-${String(idx).padStart(3, "0")}`,
          insertText: func.name + "($1)",
          insertTextFormat: InsertTextFormat.Snippet,
        });
      });
    }

    // Always suggest keywords in filter expressions
    if (line.match(/\b(filter|ever|never|always|where)\b/) || line.includes("=")) {
      OPAL_KEYWORDS.forEach((kw, idx) => {
        items.push({
          label: kw.name,
          kind: CompletionItemKind.Operator,
          detail: kw.description,
          sortText: `2-${String(idx).padStart(3, "0")}`,
        });
      });
    }

    // Suggest data types in cast/type contexts
    if (line.match(/\b(cast|typeof|to_)\b/) || line.includes(":")) {
      OPAL_DATA_TYPES.forEach((dt, idx) => {
        items.push({
          label: dt.name,
          kind: CompletionItemKind.TypeParameter,
          detail: dt.description,
          sortText: `3-${String(idx).padStart(3, "0")}`,
        });
      });
    }

    return items;
  }
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
  const opalItem = findOpalItem(item.label);
  if (opalItem) {
    item.detail = opalItem.signature || opalItem.description;
    item.documentation = {
      kind: MarkupKind.Markdown,
      value: formatItemDoc(opalItem),
    };
  }
  return item;
});

// ---------------------------------------------------------------------------
// Hover
// ---------------------------------------------------------------------------

connection.onHover((params: TextDocumentPositionParams): Hover | null => {
  const doc = documents.get(params.textDocument.uri);
  if (!doc) return null;

  const wordRange = getWordRangeAtPosition(doc, params.position);
  if (!wordRange) return null;

  const word = doc.getText(wordRange);
  const item = findOpalItem(word);
  if (!item) return null;

  return {
    contents: {
      kind: MarkupKind.Markdown,
      value: formatItemDoc(item),
    },
    range: wordRange,
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWordRangeAtPosition(doc: TextDocument, position: { line: number; character: number }) {
  const line = doc.getText({
    start: { line: position.line, character: 0 },
    end: { line: position.line + 1, character: 0 },
  });

  const wordPattern = /[a-zA-Z_][a-zA-Z0-9_]*/g;
  let match;
  while ((match = wordPattern.exec(line)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (position.character >= start && position.character <= end) {
      return {
        start: { line: position.line, character: start },
        end: { line: position.line, character: end },
      };
    }
  }
  return null;
}

function formatItemDoc(item: OpalItem): string {
  const lines: string[] = [];

  // Header with kind badge
  const kindLabel =
    item.kind === "verb"
      ? "Verb"
      : item.kind === "function"
        ? "Function"
        : item.kind === "type"
          ? "Type"
          : item.kind === "keyword"
            ? "Keyword"
            : "Operator";

  lines.push(`**${item.name}** — *${kindLabel}* \`[${item.category}]\``);
  lines.push("");

  if (item.signature) {
    lines.push("```opal");
    lines.push(item.signature);
    lines.push("```");
    lines.push("");
  }

  lines.push(item.description);

  if (item.documentation) {
    lines.push("");
    lines.push(item.documentation);
  }

  if (item.returnType) {
    lines.push("");
    lines.push(`**Returns:** \`${item.returnType}\``);
  }

  if (item.accelerable !== undefined) {
    lines.push("");
    lines.push(
      item.accelerable
        ? "Accelerable — supports streaming."
        : "Not accelerable — requires full dataset scan."
    );
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

documents.listen(connection);
connection.listen();
