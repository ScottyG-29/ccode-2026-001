import * as path from "path";
import * as vscode from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node.js";
import { ObserveApiClient } from "./observe-client.js";
import { QueryResultsPanel } from "./query-results-panel.js";

let client: LanguageClient;
let apiClient: ObserveApiClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // -----------------------------------------------------------------------
  // Language Server
  // -----------------------------------------------------------------------

  const serverModule = context.asAbsolutePath(
    path.join("dist", "server", "server.js")
  );

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009"] },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [
      { scheme: "file", language: "opal" },
      { scheme: "untitled", language: "opal" },
    ],
    synchronize: {
      configurationSection: "observeOpal",
      fileEvents: vscode.workspace.createFileSystemWatcher("**/*.opal"),
    },
  };

  client = new LanguageClient(
    "observeOpalLanguageServer",
    "Observe OPAL Language Server",
    serverOptions,
    clientOptions
  );

  client.start();

  // -----------------------------------------------------------------------
  // Commands
  // -----------------------------------------------------------------------

  context.subscriptions.push(
    vscode.commands.registerCommand("observeOpal.runQuery", () =>
      runCurrentQuery(context)
    ),
    vscode.commands.registerCommand("observeOpal.runSelection", () =>
      runSelectedQuery(context)
    ),
    vscode.commands.registerCommand("observeOpal.setApiToken", () =>
      setApiToken(context)
    ),
    vscode.commands.registerCommand("observeOpal.browseDatasets", () =>
      browseDatasets(context)
    ),
    vscode.commands.registerCommand("observeOpal.openDocs", () =>
      vscode.env.openExternal(
        vscode.Uri.parse(
          "https://docs.observeinc.com/en/latest/content/query-language-reference/index.html"
        )
      )
    )
  );

  // -----------------------------------------------------------------------
  // Status bar
  // -----------------------------------------------------------------------

  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );
  statusBarItem.text = "$(telescope) OPAL";
  statusBarItem.tooltip = "Observe OPAL — Click to run query";
  statusBarItem.command = "observeOpal.runQuery";
  context.subscriptions.push(statusBarItem);

  vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor && editor.document.languageId === "opal") {
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  });

  // Show on activation if already in an OPAL file
  if (
    vscode.window.activeTextEditor &&
    vscode.window.activeTextEditor.document.languageId === "opal"
  ) {
    statusBarItem.show();
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}

// ---------------------------------------------------------------------------
// API Client helpers
// ---------------------------------------------------------------------------

function getOrCreateApiClient(): ObserveApiClient | undefined {
  if (apiClient) return apiClient;

  const config = vscode.workspace.getConfiguration("observeOpal.observe");
  const customerUrl = config.get<string>("customerUrl", "");
  const apiToken = config.get<string>("apiToken", "");

  if (!customerUrl || !apiToken) {
    return undefined;
  }

  apiClient = new ObserveApiClient(customerUrl, apiToken);
  return apiClient;
}

async function ensureApiClient(
  context: vscode.ExtensionContext
): Promise<ObserveApiClient | undefined> {
  const existing = getOrCreateApiClient();
  if (existing) return existing;

  const action = await vscode.window.showWarningMessage(
    "Observe API connection is not configured. Set your customer URL and API token in settings.",
    "Open Settings",
    "Set Token Now"
  );

  if (action === "Open Settings") {
    vscode.commands.executeCommand(
      "workbench.action.openSettings",
      "observeOpal.observe"
    );
  } else if (action === "Set Token Now") {
    await setApiToken(context);
    return getOrCreateApiClient();
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Command implementations
// ---------------------------------------------------------------------------

async function setApiToken(context: vscode.ExtensionContext): Promise<void> {
  const token = await vscode.window.showInputBox({
    prompt: "Enter your Observe API Bearer token",
    password: true,
    placeHolder: "Bearer token from Observe",
    ignoreFocusOut: true,
  });

  if (token) {
    const config = vscode.workspace.getConfiguration("observeOpal.observe");
    await config.update("apiToken", token, vscode.ConfigurationTarget.Global);

    // Reset client so it picks up the new token
    apiClient = undefined;

    vscode.window.showInformationMessage("Observe API token saved.");
  }
}

async function runCurrentQuery(
  context: vscode.ExtensionContext
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== "opal") {
    vscode.window.showWarningMessage("Open an OPAL file to run a query.");
    return;
  }

  const pipeline = editor.document.getText();
  await executeQuery(context, pipeline);
}

async function runSelectedQuery(
  context: vscode.ExtensionContext
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) return;

  const selection = editor.document.getText(editor.selection);
  if (!selection.trim()) {
    vscode.window.showWarningMessage("Select some OPAL text to run.");
    return;
  }

  await executeQuery(context, selection);
}

async function executeQuery(
  context: vscode.ExtensionContext,
  pipeline: string
): Promise<void> {
  const client = await ensureApiClient(context);
  if (!client) return;

  const config = vscode.workspace.getConfiguration("observeOpal.observe");
  const datasetId = config.get<string>("defaultDatasetId", "");
  const interval = config.get<string>("defaultInterval", "1h");

  if (!datasetId) {
    const input = await vscode.window.showInputBox({
      prompt: "Enter the dataset ID to query against",
      placeHolder: "e.g., 41000123",
      ignoreFocusOut: true,
    });
    if (!input) return;

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "Running OPAL query...",
        cancellable: false,
      },
      async () => {
        try {
          const result = await client.runQuery(input, pipeline, interval);
          QueryResultsPanel.show(context.extensionUri, result, pipeline);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          vscode.window.showErrorMessage(`OPAL query failed: ${msg}`);
        }
      }
    );
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Running OPAL query...",
      cancellable: false,
    },
    async () => {
      try {
        const result = await client.runQuery(datasetId, pipeline, interval);
        QueryResultsPanel.show(context.extensionUri, result, pipeline);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`OPAL query failed: ${msg}`);
      }
    }
  );
}

async function browseDatasets(
  context: vscode.ExtensionContext
): Promise<void> {
  const client = await ensureApiClient(context);
  if (!client) return;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: "Fetching datasets...",
      cancellable: false,
    },
    async () => {
      try {
        const datasets = await client.listDatasets();
        const items = datasets.map((ds) => ({
          label: ds.name,
          description: ds.id,
          detail: ds.description || "",
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: "Select a dataset to set as default",
          matchOnDescription: true,
          matchOnDetail: true,
        });

        if (selected) {
          const config = vscode.workspace.getConfiguration(
            "observeOpal.observe"
          );
          await config.update(
            "defaultDatasetId",
            selected.description,
            vscode.ConfigurationTarget.Workspace
          );
          vscode.window.showInformationMessage(
            `Default dataset set to: ${selected.label} (${selected.description})`
          );
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`Failed to fetch datasets: ${msg}`);
      }
    }
  );
}
