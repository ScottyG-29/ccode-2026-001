import * as https from "https";
import * as http from "http";
import { URL } from "url";

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  truncated: boolean;
  executionTimeMs: number;
}

export interface DatasetInfo {
  id: string;
  name: string;
  description?: string;
  kind?: string;
}

/**
 * Client for the Observe Export API.
 *
 * Uses the `/v1/meta/export/query` endpoint to run OPAL pipelines
 * and the `/v1/meta/dataset` endpoint to list datasets.
 */
export class ObserveApiClient {
  private baseUrl: string;
  private token: string;

  constructor(customerUrl: string, apiToken: string) {
    // Normalize: remove trailing slash
    this.baseUrl = customerUrl.replace(/\/+$/, "");
    this.token = apiToken;
  }

  /**
   * Execute an OPAL query against a dataset.
   */
  async runQuery(
    datasetId: string,
    pipeline: string,
    interval: string = "1h"
  ): Promise<QueryResult> {
    const startTime = Date.now();
    const url = `${this.baseUrl}/v1/meta/export/query?interval=${encodeURIComponent(interval)}`;

    const body = JSON.stringify({
      query: {
        stages: [
          {
            input: [{ datasetId }],
            pipeline,
          },
        ],
      },
    });

    const raw = await this.request("POST", url, body);
    const executionTimeMs = Date.now() - startTime;

    // Observe returns newline-delimited JSON or CSV depending on accept header.
    // We request NDJSON.
    const lines = raw
      .split("\n")
      .filter((l) => l.trim() !== "");

    const rows: Record<string, unknown>[] = [];
    for (const line of lines) {
      try {
        rows.push(JSON.parse(line));
      } catch {
        // Skip non-JSON lines (e.g. status messages)
      }
    }

    const columns =
      rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      columns,
      rows,
      rowCount: rows.length,
      truncated: rows.length >= 10000,
      executionTimeMs,
    };
  }

  /**
   * List available datasets.
   */
  async listDatasets(): Promise<DatasetInfo[]> {
    const url = `${this.baseUrl}/v1/meta/dataset`;
    const raw = await this.request("GET", url);
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map((ds: Record<string, unknown>) => ({
        id: String(ds.id || ""),
        name: String(ds.name || ds.label || ""),
        description: ds.description ? String(ds.description) : undefined,
        kind: ds.kind ? String(ds.kind) : undefined,
      }));
    }

    // Handle wrapped responses
    const data = parsed.data || parsed.datasets || [];
    return (data as Record<string, unknown>[]).map(
      (ds: Record<string, unknown>) => ({
        id: String(ds.id || ""),
        name: String(ds.name || ds.label || ""),
        description: ds.description ? String(ds.description) : undefined,
        kind: ds.kind ? String(ds.kind) : undefined,
      })
    );
  }

  // -------------------------------------------------------------------------
  // Internal HTTP helper
  // -------------------------------------------------------------------------

  private request(
    method: string,
    url: string,
    body?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const parsed = new URL(url);
      const options: https.RequestOptions = {
        method,
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname + parsed.search,
        headers: {
          Authorization: `Bearer ${this.token}`,
          "Content-Type": "application/json",
          Accept: "application/x-ndjson",
        },
      };

      const transport = parsed.protocol === "https:" ? https : http;
      const req = transport.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          if (res.statusCode && res.statusCode >= 400) {
            reject(
              new Error(
                `HTTP ${res.statusCode}: ${res.statusMessage}\n${body}`
              )
            );
          } else {
            resolve(body);
          }
        });
      });

      req.on("error", reject);

      if (body) {
        req.write(body);
      }
      req.end();
    });
  }
}
