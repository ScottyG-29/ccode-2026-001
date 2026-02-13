# Observe OPAL — VS Code Extension

> Full-featured language support for [Observe's OPAL](https://docs.observeinc.com/en/latest/content/query-language-reference/ObserveProcessingAndAnalysisLanguage.html) (Observe Processing and Analysis Language) — syntax highlighting, IntelliSense, diagnostics, snippets, and live query execution from inside VS Code.

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [From Source (Development)](#from-source-development)
  - [From VSIX Package](#from-vsix-package)
- [Quick Start](#quick-start)
- [Features](#features)
  - [Syntax Highlighting](#syntax-highlighting)
  - [IntelliSense & Autocomplete](#intellisense--autocomplete)
  - [Hover Documentation](#hover-documentation)
  - [Real-Time Diagnostics](#real-time-diagnostics)
  - [Snippets](#snippets)
  - [Live Query Execution](#live-query-execution)
  - [Dataset Browser](#dataset-browser)
  - [Embedded Language Support](#embedded-language-support)
- [Configuration Reference](#configuration-reference)
- [Observe API Setup](#observe-api-setup)
  - [Generating an API Token](#generating-an-api-token)
  - [Configuring the Extension](#configuring-the-extension)
  - [Token Security Considerations](#token-security-considerations)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Snippet Reference](#snippet-reference)
- [OPAL Language Coverage](#opal-language-coverage)
- [Project Architecture](#project-architecture)
- [Development Guide](#development-guide)
  - [Repository Setup](#repository-setup)
  - [Build System](#build-system)
  - [Debugging](#debugging)
  - [Adding New Verbs or Functions](#adding-new-verbs-or-functions)
- [Testing](#testing)
  - [Running Tests](#running-tests)
  - [Test Categories](#test-categories)
  - [Writing Tests](#writing-tests)
- [Packaging & Publishing](#packaging--publishing)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)
- [License](#license)

---

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| [Node.js](https://nodejs.org/) | >= 20.x | Runtime for build tools and Language Server |
| [npm](https://www.npmjs.com/) | >= 10.x | Dependency management |
| [VS Code](https://code.visualstudio.com/) | >= 1.85.0 | Extension host |
| [Git](https://git-scm.com/) | >= 2.x | Source control |

Verify your environment:

```bash
node --version   # v20.x or higher
npm --version    # 10.x or higher
code --version   # 1.85.0 or higher
```

> **Edge case:** If you manage Node versions with `nvm`, ensure the same version is active in both your terminal and VS Code's integrated terminal. A version mismatch can cause the Language Server to fail silently at startup.

---

## Installation

### From Source (Development)

```bash
# Clone the repository
git clone <repo-url> observe-opal-vscode
cd observe-opal-vscode

# Install dependencies
npm install

# Build both client and server bundles
npm run build

# Open in VS Code
code .
```

Then press **F5** to launch the Extension Development Host with the extension loaded.

### From VSIX Package

```bash
# Build the .vsix package
npm run package

# Install it into VS Code
code --install-extension observe-opal-0.1.0.vsix
```

> **Edge case:** If `vsce package` fails with a missing `LICENSE` file warning, create an empty `LICENSE` file or pass `--allow-missing-repository`. The `.vscodeignore` controls which files are included — verify it excludes `node_modules/`, source `.ts` files, and `tsconfig` files to keep the package small.

---

## Quick Start

1. Create a file with the `.opal` extension (e.g., `my-query.opal`)
2. Start typing — you'll see syntax highlighting immediately
3. Type `filter` and let IntelliSense guide you:

```opal
filter severity = "ERROR"
| make_col source_ip:get_field(FIELDS, "source.ip")
| statsby error_count:count(1), group_by(source_ip)
| order_by error_count desc
| topk 25, error_count
```

4. To run queries live, configure your Observe API connection (see [Observe API Setup](#observe-api-setup))
5. Press `Cmd+Shift+Enter` (macOS) or `Ctrl+Shift+Enter` (Windows/Linux) to execute

---

## Features

### Syntax Highlighting

Full TextMate grammar covering the entire OPAL language:

| Token Type | Examples | Scope |
|-----------|---------|-------|
| **Filter verbs** | `filter`, `topk`, `limit`, `ever`, `never` | `keyword.control.verb.filter.opal` |
| **Projection verbs** | `make_col`, `pick_col`, `drop_col`, `flatten` | `keyword.control.verb.projection.opal` |
| **Aggregate verbs** | `statsby`, `timechart`, `align`, `rollup` | `keyword.control.verb.aggregate.opal` |
| **Join verbs** | `join`, `leftjoin`, `union`, `lookup` | `keyword.control.verb.join.opal` |
| **Metadata verbs** | `set_label`, `set_link`, `make_resource` | `keyword.control.verb.metadata.opal` |
| **Metrics verbs** | `delta`, `rate`, `gauge` | `keyword.control.verb.metrics.opal` |
| **Aggregate functions** | `count()`, `avg()`, `percentile()` | `support.function.aggregate.opal` |
| **String functions** | `upper()`, `regex_match()`, `concat()` | `support.function.string.opal` |
| **Time functions** | `now()`, `ago()`, `date_trunc()` | `support.function.time.opal` |
| **Semistructured** | `get_field()`, `object_keys()`, `array_length()` | `support.function.semistructured.opal` |
| **Math functions** | `abs()`, `ceil()`, `round()`, `clamp()` | `support.function.math.opal` |
| **Network functions** | `ip_is_private()`, `cidr_match()` | `support.function.network.opal` |
| **Type functions** | `typeof()`, `coalesce()`, `cast()` | `support.function.type.opal` |
| **Window functions** | `row_number()`, `lag()`, `lead()` | `support.function.window.opal` |
| **Data types** | `string`, `int64`, `timestamp`, `duration` | `support.type.opal` |
| **Dataset references** | `@MyDataset`, `@IPReputation` | `entity.name.tag.dataset.opal` |
| **Label references** | `^Session`, `^Host` | `entity.name.tag.label.opal` |
| **Column assignments** | `col_name:expression` | `variable.other.column.opal` |
| **Logical operators** | `and`, `or`, `not`, `contains`, `like` | `keyword.operator.logical.opal` |
| **Pipe operator** | `\|` | `keyword.operator.pipe.opal` |
| **Strings** | `"double"`, `'single'`, `` `backtick` `` | `string.quoted.*.opal` |
| **Regex literals** | `/pattern/gi` | `string.regexp.opal` |
| **Duration literals** | `5m`, `1h`, `30s`, `7d` | `constant.language.duration.opal` |
| **Comments** | `// line`, `/* block */` | `comment.*.opal` |

> **Edge case:** The regex literal grammar (`/pattern/`) uses a negative lookahead to avoid matching `//` (line comments) and `/*` (block comments). If you encounter false highlighting on division operators adjacent to comments, add a space: `x / y // comment`.

### IntelliSense & Autocomplete

The Language Server provides context-aware completions:

- **After `|` or at line start** — All OPAL verbs with category badges and signatures
- **Inside expressions** (after `:`, `(`, `,`, or within verb bodies) — All OPAL functions with snippet-style tab stops
- **Inside filter expressions** — Logical keywords (`and`, `or`, `contains`, `like`, etc.)
- **In type contexts** (after `cast`, `typeof`) — Data type names

Trigger characters: `|`, `.`, ` `, `(`, `,`

Each completion item shows:
- Category badge (e.g., `[Aggregate]`, `[String]`)
- Full function signature
- Markdown documentation
- Return type (for functions)
- Streaming acceleration support (for verbs)

> **Edge case:** If completions don't trigger after `|`, ensure the `observeOpal.completion.autoTrigger` setting is `true` and that the file is recognized as OPAL (check the language mode in the VS Code status bar).

### Hover Documentation

Hover over any OPAL verb, function, keyword, or data type to see:

- **Name and kind** (Verb, Function, Type, Keyword)
- **Category** (Filter, Aggregate, String, Time, etc.)
- **Signature** with parameter types
- **Description** and extended documentation
- **Return type** (for functions)
- **Accelerable status** — whether the verb supports streaming/incremental processing

### Real-Time Diagnostics

The Language Server validates your OPAL as you type:

| Diagnostic | Severity | Example |
|-----------|----------|---------|
| Empty pipe | Warning | A line containing only `\|` with no verb following |
| Unmatched `(` | Warning | `filter count( > 5` — missing closing paren |
| Extra `)` | Warning | `filter count()) > 5` — too many closing parens |
| Unknown verb | Information | `\| filterr status = "ok"` — typo flagged with suggestions |

Diagnostics are string-aware — parentheses inside quoted strings are correctly ignored.

> **Edge case:** Multi-line expressions where parentheses span multiple lines will flag a per-line warning. This is by design for the lightweight parser; the full Observe backend performs deeper validation. You can disable diagnostics entirely with `observeOpal.diagnostics.enable: false`.

### Snippets

30+ snippets for rapid OPAL authoring. Type a prefix and press `Tab`:

| Prefix | Description |
|--------|-------------|
| `filter` | Filter with operator choice |
| `filterand` | Filter with AND conditions |
| `filteror` | Filter with OR conditions |
| `make_col` | Create a column |
| `make_cols` | Create multiple columns |
| `pick_col` | Select columns |
| `drop_col` | Remove columns |
| `rename_col` | Rename a column |
| `statsby` | Aggregate with group_by (function choice) |
| `statsbyml` | Multi-line multi-aggregation |
| `timechart` | Time-bucketed aggregation (interval choice) |
| `align` | Time series alignment |
| `join` | Inner join |
| `leftjoin` | Left outer join |
| `lookup` | Reference lookup |
| `union` | Vertical dataset union |
| `topk` | Top K rows |
| `bottomk` | Bottom K rows |
| `limit` | Row limit |
| `orderby` | Sort with direction choice |
| `dedup` | Deduplicate |
| `distinct` | Distinct values |
| `extract_regex` | Named regex capture groups |
| `parse_json` | Parse JSON column |
| `flatten` | Expand array to rows |
| `histogram` | Histogram bins |
| `pivot` | Pivot rows to columns |
| `makeresource` | Convert to resource dataset |
| `set_label` | Set display label |
| `set_link` | Link column to dataset |

#### SIEM-Specific Templates

| Prefix | Description |
|--------|-------------|
| `siem-errors` | Error triage pipeline — filters by severity, groups by source IP and user, ranks top 50 |
| `siem-logins` | Login failure analysis — computes per-user failure rates, flags accounts above threshold |
| `siem-timeseries` | Threshold alerting — time-bucketed event count with configurable alert threshold |
| `siem-network` | Network flow analysis — connection counts and byte totals by source, destination, port |

### Live Query Execution

Run OPAL queries against your Observe instance directly from VS Code:

1. **Run entire file** — `Cmd+Shift+Enter` / `Ctrl+Shift+Enter`
2. **Run selection** — Select text, then `Cmd+Enter` / `Ctrl+Enter`

Results appear in a side panel with:
- Styled, scrollable data table
- Column headers from query output
- Row count and execution time
- Truncation indicator (results capped at 10,000 rows; display capped at 1,000)
- Original pipeline displayed above results
- Full VS Code theme integration (respects dark/light themes)

Null values render as styled `null` labels. Object/array values render as inline JSON.

> **Edge case:** If your Observe tenant uses a custom domain or is behind a proxy, ensure the `customerUrl` is the full base URL including the protocol (`https://`). The client uses Node.js `https` natively — no fetch polyfill. HTTP-only URLs will fall back to `http` but this is not recommended.

### Dataset Browser

Command: **Observe OPAL: Browse Observe Datasets**

Opens a filterable quick-pick list of all datasets from your Observe environment. Select one to set it as the default dataset for query execution. The selection is saved at the workspace level so different projects can target different datasets.

> **Edge case:** If the dataset list API returns a wrapped response (e.g., `{ data: [...] }` or `{ datasets: [...] }`), the client handles both formats. If your Observe environment has hundreds of datasets, use the quick-pick filter to narrow the list — it matches on name, ID, and description.

### Embedded Language Support

OPAL syntax highlighting works inside Markdown fenced code blocks:

````markdown
```opal
filter status != 200
| statsby error_count:count(1), group_by(endpoint)
```
````

This is injected via a separate TextMate grammar (`opal-markdown-injection.tmLanguage.json`) that targets `text.html.markdown`. It creates an `meta.embedded.block.opal` scope that delegates to the main `source.opal` grammar.

---

## Configuration Reference

All settings are under the `observeOpal` namespace.

### API Connection

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `observeOpal.observe.customerUrl` | `string` | `""` | Observe tenant URL (e.g., `https://my-org.observeinc.com`) |
| `observeOpal.observe.apiToken` | `string` | `""` | Bearer token for API authentication |
| `observeOpal.observe.defaultDatasetId` | `string` | `""` | Default dataset ID for query execution |
| `observeOpal.observe.defaultInterval` | `string` | `"1h"` | Default time interval (`1h`, `15m`, `1d`, etc.) |

### Editor Behavior

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `observeOpal.diagnostics.enable` | `boolean` | `true` | Enable real-time OPAL validation |
| `observeOpal.completion.autoTrigger` | `boolean` | `true` | Auto-trigger completions after pipes and verbs |

### Example `settings.json`

```jsonc
{
  "observeOpal.observe.customerUrl": "https://my-org.observeinc.com",
  "observeOpal.observe.defaultDatasetId": "41000123",
  "observeOpal.observe.defaultInterval": "15m",
  "observeOpal.diagnostics.enable": true,
  "observeOpal.completion.autoTrigger": true
}
```

> **Edge case:** Do not commit `settings.json` containing API tokens to source control. Use VS Code's `--user-data-dir` or workspace-level settings with `.gitignore` entries. Consider the `observeOpal.setApiToken` command which stores the token via VS Code's global configuration.

---

## Observe API Setup

### Generating an API Token

1. Log in to your Observe environment
2. Navigate to **Settings > API Tokens** (or use the `/v1/login` endpoint)
3. Create a new token with at least **read** permissions for datasets and query execution
4. Copy the bearer token

### Configuring the Extension

**Option A — Command Palette:**

1. Open Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **Observe OPAL: Set Observe API Token**
3. Paste your bearer token (input is masked)

**Option B — Settings:**

1. Open VS Code Settings (`Cmd+,` / `Ctrl+,`)
2. Search for `observeOpal`
3. Set `Customer URL` and `API Token`

**Option C — `settings.json`:**

```jsonc
{
  "observeOpal.observe.customerUrl": "https://my-org.observeinc.com",
  "observeOpal.observe.apiToken": "your-bearer-token-here"
}
```

### Token Security Considerations

- The API token is stored in VS Code's global settings (plain text in `settings.json`)
- For production environments, consider using environment variables or a secrets manager
- Never commit tokens to version control
- Tokens with the minimum required scope (read-only dataset + export) are recommended
- If a token is compromised, revoke it immediately in the Observe UI and generate a new one

> **Edge case:** If your Observe instance requires specific headers (e.g., `X-Observe-Workspace`), you'll need to extend `observe-client.ts` to include them. The current implementation sends `Authorization: Bearer <token>`, `Content-Type: application/json`, and `Accept: application/x-ndjson`.

---

## Keyboard Shortcuts

| Action | macOS | Windows / Linux | Context |
|--------|-------|-----------------|---------|
| Run entire file | `Cmd+Shift+Enter` | `Ctrl+Shift+Enter` | Active editor is `.opal` |
| Run selection | `Cmd+Enter` | `Ctrl+Enter` | Text is selected in `.opal` editor |

The Run Query button also appears in the editor title bar when an OPAL file is active. Right-click context menu includes **Run Selected OPAL** when text is selected.

---

## Snippet Reference

All snippets support VS Code's tab stop navigation (`$1`, `$2`, etc.) and choice menus (`${1|option1,option2|}`).

### Snippets with Choice Menus

These snippets pop up a selection list for common values:

| Snippet | Choice field | Options |
|---------|-------------|---------|
| `filter` | Operator | `=`, `!=`, `>`, `<`, `>=`, `<=`, `contains`, `starts_with`, `ends_with`, `matches`, `like`, `in` |
| `statsby` | Aggregate function | `count(1)`, `sum()`, `avg()`, `min()`, `max()`, `count_distinct()` |
| `timechart` | Interval | `1m`, `5m`, `15m`, `1h`, `1d` |
| `align` | Interval | `1m`, `5m`, `15m`, `1h`, `1d` |
| `orderby` | Direction | `desc`, `asc` |
| `pivot` | Aggregate function | `count(1)`, `sum()`, `avg()` |

---

## OPAL Language Coverage

### Verbs by Category

| Category | Count | Verbs |
|----------|-------|-------|
| **Filter** | 9 | `filter`, `filter_last`, `topk`, `bottomk`, `limit`, `ever`, `never`, `always`, `sample` |
| **Projection** | 8 | `make_col`, `pick_col`, `rename_col`, `drop_col`, `set_col`, `flatten`, `extract_regex`, `parse_json` |
| **Aggregate** | 16 | `statsby`, `timechart`, `align`, `aggregate`, `rollup`, `histogram`, `pivot`, `unpivot`, `dedup`, `distinct`, `fill`, `merge_events`, `make_session`, `make_reference`, `bucketize`, `timestats` |
| **Join** | 12 | `join`, `leftjoin`, `fulljoin`, `union`, `lookup`, `lookup_ip_info`, `exists`, `not_exists`, `follow`, `follow_not`, `surrounding`, `update_resource` |
| **Metadata** | 8 | `set_label`, `set_link`, `set_valid_from`, `set_primary_key`, `make_resource`, `make_event`, `interface`, `publish` |
| **Metrics** | 4 | `delta`, `rate`, `gauge`, `cumulativeCounter` |
| **Sort** | 2 | `order_by`, `sort` |
| **Display** | 2 | `colshow`, `colhide` |

### Functions by Category

| Category | Count | Examples |
|----------|-------|---------|
| **Aggregate** | 17 | `count`, `sum`, `avg`, `percentile`, `median`, `stddev`, `string_agg`, `array_agg`, `group_by` |
| **String** | 19 | `concat`, `upper`, `lower`, `regex_match`, `regex_extract`, `split_part`, `strpos`, `lpad` |
| **Time** | 13 | `now`, `ago`, `parse_timestamp`, `format_time`, `date_trunc`, `date_diff`, `bin` |
| **Semistructured** | 12 | `get_field`, `has_field`, `object_keys`, `array_length`, `make_object`, `object_merge` |
| **Math** | 11 | `abs`, `ceil`, `floor`, `round`, `pow`, `sqrt`, `log`, `clamp`, `greatest`, `least` |
| **Type / Cast** | 10 | `typeof`, `is_null`, `coalesce`, `cast`, `to_int`, `to_float`, `to_timestamp` |
| **Network** | 4 | `ip_is_private`, `ip_is_loopback`, `cidr_match`, `parse_ip` |
| **Window** | 6 | `row_number`, `rank`, `dense_rank`, `lag`, `lead`, `cumulative_sum` |

### Data Types

`string`, `int64`, `float64`, `bool`, `timestamp`, `duration`, `object`, `array`, `variant`

---

## Project Architecture

```
observe-opal-vscode/
├── client/                     # VS Code extension host process
│   └── src/
│       ├── extension.ts        # Activation, command registration, Language Client setup
│       ├── observe-client.ts   # Observe REST API client (Export API + Dataset API)
│       └── query-results-panel.ts  # Webview panel for rendering query results
│
├── server/                     # Language Server process (separate Node.js process)
│   └── src/
│       ├── server.ts           # LSP lifecycle, completions, hover, diagnostics
│       └── opal-language.ts    # OPAL language definitions — single source of truth
│
├── syntaxes/
│   ├── opal.tmLanguage.json                # TextMate grammar for .opal files
│   └── opal-markdown-injection.tmLanguage.json  # Injection grammar for Markdown
│
├── snippets/
│   └── opal.json               # VS Code snippet definitions
│
├── examples/
│   └── demo.opal               # Demo file showing all features
│
├── .vscode/
│   ├── launch.json             # Debug configurations (extension + LSP)
│   └── tasks.json              # Build tasks
│
├── dist/                       # Build output (gitignored)
│   ├── client/extension.js     # Bundled extension (~355KB)
│   └── server/server.js        # Bundled language server (~202KB)
│
├── package.json                # Extension manifest + npm config
├── language-configuration.json # Bracket/comment/folding rules
├── esbuild.mjs                 # Build script (dual client+server bundles)
├── tsconfig.json               # Base TypeScript config
├── tsconfig.client.json        # Client TypeScript config
└── tsconfig.server.json        # Server TypeScript config
```

### Architecture Notes

- **Two-process model:** The extension client runs in the VS Code Extension Host process. The Language Server runs in a separate Node.js process, communicating over IPC. This prevents slow language analysis from blocking the UI.
- **Single source of truth:** All OPAL language knowledge (verbs, functions, types, keywords) is defined in `server/src/opal-language.ts`. The TextMate grammar handles tokenization; the Language Server handles semantics. If Observe adds a new verb, update both files.
- **esbuild bundling:** Both processes are bundled into self-contained `.js` files with all dependencies inlined (except the `vscode` API which is external). This means no `node_modules` in the deployed extension.

---

## Development Guide

### Repository Setup

```bash
git clone <repo-url>
cd observe-opal-vscode
npm install
```

### Build System

| Command | Purpose |
|---------|---------|
| `npm run build` | Production build — minified, no sourcemaps |
| `npm run watch` | Development watch — rebuilds on every save |
| `npm run lint` | ESLint across client and server source |
| `npm test` | Run test suite |
| `npm run package` | Generate `.vsix` for distribution |

The build uses `esbuild.mjs` which produces two bundles in parallel:

| Bundle | Entry | Output | Externals |
|--------|-------|--------|-----------|
| Client | `client/src/extension.ts` | `dist/client/extension.js` | `vscode` |
| Server | `server/src/server.ts` | `dist/server/server.js` | (none) |

> **Edge case:** If you add a new dependency that uses native Node.js addons (e.g., `better-sqlite3`), esbuild cannot bundle it. You'd need to mark it as `external` in `esbuild.mjs` and include it in the VSIX package via `.vscodeignore` exceptions.

### Debugging

**Launch the Extension Development Host:**

1. Open the project in VS Code
2. Press **F5** (or select **Run > Start Debugging**)
3. Choose the **"Launch Extension"** configuration
4. A new VS Code window opens with the extension loaded
5. Open any `.opal` file in the new window to test

**Debug the Language Server:**

1. Use the **"Extension + Server"** compound configuration
2. This launches the extension AND attaches the debugger to the Language Server on port `6009`
3. Set breakpoints in `server/src/server.ts`
4. The server debugger auto-reconnects when the server restarts

> **Edge case:** The Language Server starts in `--inspect=6009` mode only when using the debug launch configuration. In production, it runs without the inspector. If port 6009 is occupied by another process, change it in both `.vscode/launch.json` (the `port` field) and `client/src/extension.ts` (the `execArgv` option).

### Adding New Verbs or Functions

1. **Add the definition** in `server/src/opal-language.ts`:
   - Add to `OPAL_VERBS` or `OPAL_FUNCTIONS` array
   - Include: `name`, `kind`, `category`, `signature`, `description`, `returnType` (functions), `accelerable` (verbs)

2. **Update the TextMate grammar** in `syntaxes/opal.tmLanguage.json`:
   - Add the verb/function name to the appropriate regex pattern in the `repository`
   - Verbs go in their category group (e.g., `verbs.patterns[0].match` for filter verbs)
   - Functions go in their category group (e.g., `aggregate-functions`)

3. **Add a snippet** (optional) in `snippets/opal.json`

4. **Add/update tests** to verify the new item:
   - Completion test: verify it appears in the completion list
   - Hover test: verify documentation renders correctly
   - Grammar test: verify the correct scope is applied
   - Diagnostics test: verify it's recognized (not flagged as unknown verb)

> **Edge case:** The TextMate grammar uses word-boundary anchors (`\b`). If you add a verb or function containing a hyphen (e.g., hypothetically `my-verb`), you'll need to adjust the regex pattern since `\b` doesn't match at hyphens within `\w` character classes.

---

## Testing

### Running Tests

```bash
# Run the full test suite
npm test

# Run with verbose output
npm test -- --verbose

# Run a specific test file
npm test -- --grep "completions"
```

### Test Categories

The following test areas should be covered for a production-quality extension:

#### 1. TextMate Grammar Tests

Verify that tokenization produces the correct scopes:

```
Input:  filter status = "ok"
Expect: keyword.control.verb.filter.opal
        (no scope — column name)
        keyword.operator.comparison.opal
        string.quoted.double.opal
```

Test edge cases:
- Verbs at line start vs. after pipe
- Functions followed by `(` vs. bare words
- Regex literals vs. division operators
- Duration literals (`5m`) vs. bare integers (`5`)
- `@dataset` references with dots and hyphens
- Nested strings with escape characters
- Block comments spanning multiple lines
- Column names that match verb names (e.g., a column named `filter`)

#### 2. Language Server — Completion Tests

Verify context-aware completions:

| Context | Expected completions |
|---------|---------------------|
| After `\|` | All verbs |
| At line start | All verbs |
| After `make_col name:` | All functions |
| Inside `filter` expression | Keywords (`and`, `or`, `contains`, etc.) |
| After `cast(value,` | Data types (`string`, `int64`, etc.) |
| After `statsby count:` | Aggregate functions |

Edge cases:
- Completions inside comments (should NOT trigger)
- Completions inside strings (should NOT trigger)
- Completions after unterminated strings
- Empty document
- Single-character document (`|`)
- Very long lines (> 10,000 characters)

#### 3. Language Server — Hover Tests

Verify hover documentation for every item:

- Each verb returns its full documentation, signature, and accelerable status
- Each function returns signature, description, and return type
- Keywords return their description
- Hovering over non-OPAL identifiers returns null (no hover)
- Hovering at start/end boundaries of words

#### 4. Language Server — Diagnostic Tests

| Input | Expected diagnostic |
|-------|-------------------|
| `\|` (bare pipe) | Warning: "Empty pipe" |
| `\| filterr x = 1` | Info: "Unknown OPAL verb 'filterr'" |
| `filter count( > 5` | Warning: "Unmatched parenthesis — 1 unclosed '('" |
| `filter x = "hello("` | No warning (paren is inside string) |
| `// | bad_verb` | No warning (line is a comment) |
| `` (empty file) | No diagnostics |
| `filter x = 1` | No diagnostics (valid) |

Edge cases:
- Multi-line block comments containing pipe characters
- Lines with mixed string and non-string parentheses
- Unicode characters in column names
- Very large files (> 10,000 lines) — performance check

#### 5. API Client Tests

| Test | Method | Validation |
|------|--------|------------|
| `runQuery` success | POST `/v1/meta/export/query` | Parses NDJSON, extracts columns, counts rows |
| `runQuery` with interval | POST with `?interval=15m` | URL parameter encoding |
| `runQuery` HTTP error | 401/403/500 | Error message includes status and body |
| `runQuery` empty response | POST | Returns `{ columns: [], rows: [], rowCount: 0 }` |
| `runQuery` malformed NDJSON | POST | Skips non-JSON lines gracefully |
| `listDatasets` success | GET `/v1/meta/dataset` | Parses array or wrapped response |
| `listDatasets` wrapped | GET | Handles `{ data: [...] }` format |
| `listDatasets` empty | GET | Returns empty array |
| Constructor URL normalization | — | Trailing slashes removed |
| HTTPS vs HTTP | — | Correct transport module selected |

Edge cases:
- Network timeouts
- Self-signed certificates (Node TLS rejection)
- Token containing special characters
- Response body exceeding available memory
- Observe API returning CSV instead of NDJSON

#### 6. Query Results Panel Tests

- HTML escaping of cell values (XSS prevention)
- Object values rendered as JSON
- Null values styled distinctly
- Truncation notice at 10,000+ rows
- Display cap at 1,000 rows
- Pipeline text escaped in the metadata block
- Panel reuse (second query reuses the panel instead of creating a new one)
- Panel disposal cleanup

#### 7. Extension Activation Tests

- Extension activates on `.opal` file open
- Extension does NOT activate for non-OPAL files
- Status bar item shows/hides based on active editor language
- Commands registered and executable
- Language Client starts and connects to Language Server
- Configuration changes propagate to Language Server

### Writing Tests

Create test files under `test/`:

```
test/
├── suite/
│   ├── grammar.test.ts       # TextMate grammar scope tests
│   ├── completion.test.ts    # LSP completion tests
│   ├── hover.test.ts         # LSP hover tests
│   ├── diagnostics.test.ts   # LSP diagnostic tests
│   ├── api-client.test.ts    # Observe API client tests
│   ├── results-panel.test.ts # Webview panel tests
│   └── extension.test.ts     # Activation + command tests
├── fixtures/
│   ├── valid.opal            # Valid OPAL file for testing
│   ├── errors.opal           # OPAL file with known issues
│   └── edge-cases.opal       # Edge case OPAL file
├── runTest.ts                # Test runner entry point
└── index.ts                  # Test suite loader
```

VS Code extension tests use `@vscode/test-electron` to launch a test instance. Language Server tests can be run independently against the server module using a mock transport.

---

## Packaging & Publishing

### Create a VSIX

```bash
npm run package
# Output: observe-opal-0.1.0.vsix
```

### Publish to VS Code Marketplace

```bash
# First time: create a publisher
npx vsce create-publisher <publisher-name>

# Login
npx vsce login <publisher-name>

# Publish
npx vsce publish
```

### Pre-publish Checklist

- [ ] All tests pass (`npm test`)
- [ ] Lint passes (`npm run lint`)
- [ ] Build succeeds (`npm run build`)
- [ ] Extension activates correctly (F5 manual test)
- [ ] Syntax highlighting works for all verb/function categories
- [ ] IntelliSense triggers in all documented contexts
- [ ] Hover docs display for a sample of verbs and functions
- [ ] Diagnostics fire for empty pipes, unmatched parens, unknown verbs
- [ ] Snippets expand correctly (test a sample: `filter`, `statsby`, `siem-errors`)
- [ ] API connection works with a real Observe instance (if available)
- [ ] `.vscodeignore` excludes source files, configs, and node_modules
- [ ] `package.json` version is bumped
- [ ] CHANGELOG is updated

---

## Troubleshooting

### Extension doesn't activate

- Verify the file has a `.opal` extension
- Check the language mode in the VS Code status bar (bottom-right) — it should say "OPAL"
- Open the Output panel → select "Observe OPAL Language Server" for server logs
- Run `Developer: Toggle Developer Tools` and check the console for errors

### Language Server crashes

- Open the Output panel → "Observe OPAL Language Server"
- Common causes:
  - Node.js version mismatch (requires >= 20.x)
  - Missing `dist/server/server.js` (run `npm run build`)
  - Port conflict on 6009 (only affects debug mode)

### No completions appearing

- Ensure the file language is set to OPAL (not Plain Text)
- Check that `observeOpal.completion.autoTrigger` is `true`
- Try manually triggering completions with `Ctrl+Space`
- Verify the Language Server is running (check Output panel)

### API queries fail

- Verify your `customerUrl` includes `https://` and has no trailing slash
- Confirm your API token has the required permissions
- Check if your Observe instance is accessible from your network
- Review error messages — HTTP status codes indicate the issue:
  - `401` — Invalid or expired token
  - `403` — Insufficient permissions
  - `404` — Invalid endpoint or dataset ID
  - `422` — Malformed OPAL pipeline (check your query syntax)
  - `429` — Rate limited (wait and retry)
  - `500+` — Server-side error (contact Observe support)

### Syntax highlighting looks wrong

- Ensure you're using a color theme that supports semantic highlighting
- The grammar uses standard TextMate scopes — themes with good keyword/function/string support work best
- Reload the window (`Developer: Reload Window`) after installing

---

## Known Limitations

1. **Per-line parenthesis checking** — The diagnostic engine checks parentheses per line, not across multi-line expressions. A `(` on line 5 closed by `)` on line 7 will produce a warning on line 5. Use the Observe UI for full pipeline validation.

2. **No semantic column awareness** — The Language Server does not know your dataset's actual column names. Completions are based on OPAL verbs/functions/types only. Column-level IntelliSense would require a live API connection to fetch dataset schemas.

3. **API token in plaintext** — The token is stored in VS Code's `settings.json`. A future version could use the VS Code `SecretStorage` API for encrypted storage.

4. **No YAML/JSON embedded language** — While Markdown fenced code block injection is supported, OPAL blocks inside YAML or JSON files (e.g., Observe Terraform configs) do not yet get syntax highlighting. This requires additional injection grammars.

5. **Query result rendering limit** — The Webview panel renders a maximum of 1,000 rows for performance. The API response is capped at 10,000 rows. For larger result sets, use the Observe UI.

---

## License

MIT
