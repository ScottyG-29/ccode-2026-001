"""
AI Response Comparison Tool
============================
Sends a single research query to two AI API endpoints at the same time,
shows both answers side by side (each clearly labeled by source), and
appends every query/response pair to a local log file for later review.

Nothing is hidden, merged, or substituted — both raw responses are shown
to the user exactly as each API returned them.

Run:
    pip install -r requirements.txt
    cp .env.example .env      # then fill in your real API keys
    python app.py
"""

import os
import json
import time
import traceback
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor

import requests
from dotenv import load_dotenv
from flask import Flask, render_template, request

import anthropic

# ---------------------------------------------------------------------------
# Configuration (loaded from .env — see .env.example for the full list)
# ---------------------------------------------------------------------------

load_dotenv()

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5")

SECOND_API_BASE_URL = os.environ.get("SECOND_API_BASE_URL", "").rstrip("/")
SECOND_API_KEY = os.environ.get("SECOND_API_KEY", "")
SECOND_API_MODEL = os.environ.get("SECOND_API_MODEL", "")
SECOND_API_LABEL = os.environ.get("SECOND_API_LABEL", "Second API")

LOG_PATH = os.path.join(os.path.dirname(__file__), "logs", "comparisons.jsonl")

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "dev-key-change-me")

anthropic_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY) if ANTHROPIC_API_KEY else None


# ---------------------------------------------------------------------------
# Individual API callers
# Each one returns a plain dict: {"label": ..., "text": ..., "error": ...}
# so a failure in one call never breaks the other or crashes the request.
# ---------------------------------------------------------------------------

def call_claude(query: str) -> dict:
    """Send the query to Claude via the Anthropic SDK."""
    label = f"Claude ({ANTHROPIC_MODEL})"
    if not anthropic_client:
        return {"label": label, "text": None, "error": "ANTHROPIC_API_KEY is not configured."}

    try:
        response = anthropic_client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=1024,
            messages=[{"role": "user", "content": query}],
        )
        text = "".join(block.text for block in response.content if block.type == "text")
        return {"label": label, "text": text, "error": None}

    except anthropic.APIStatusError as exc:
        return {"label": label, "text": None, "error": f"Claude API error ({exc.status_code}): {exc.message}"}
    except anthropic.APIConnectionError:
        return {"label": label, "text": None, "error": "Could not connect to the Claude API."}
    except Exception as exc:  # noqa: BLE001 - surface any unexpected failure to the UI instead of crashing
        return {"label": label, "text": None, "error": f"Unexpected Claude error: {exc}"}


def call_second_api(query: str) -> dict:
    """Send the query to the second, OpenAI-compatible chat completions endpoint."""
    label = SECOND_API_LABEL
    if not SECOND_API_BASE_URL or not SECOND_API_KEY or not SECOND_API_MODEL:
        return {"label": label, "text": None, "error": "Second API is not fully configured (base URL / key / model)."}

    try:
        resp = requests.post(
            f"{SECOND_API_BASE_URL}/chat/completions",
            headers={
                "Authorization": f"Bearer {SECOND_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": SECOND_API_MODEL,
                "messages": [{"role": "user", "content": query}],
                "max_tokens": 1024,
            },
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        text = data["choices"][0]["message"]["content"]
        return {"label": label, "text": text, "error": None}

    except requests.exceptions.Timeout:
        return {"label": label, "text": None, "error": "Request to the second API timed out."}
    except requests.exceptions.HTTPError as exc:
        return {"label": label, "text": None, "error": f"Second API HTTP error: {exc}"}
    except requests.exceptions.RequestException as exc:
        return {"label": label, "text": None, "error": f"Second API connection error: {exc}"}
    except (KeyError, IndexError, ValueError):
        return {"label": label, "text": None, "error": "Second API returned an unexpected response shape."}
    except Exception as exc:  # noqa: BLE001
        return {"label": label, "text": None, "error": f"Unexpected second-API error: {exc}"}


# ---------------------------------------------------------------------------
# Logging — every query and both raw responses are appended as one JSON
# line, so the log file is easy to grep or load with pandas/jq later.
# ---------------------------------------------------------------------------

def log_comparison(query: str, result_a: dict, result_b: dict) -> None:
    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "query": query,
        "responses": [result_a, result_b],
    }
    try:
        with open(LOG_PATH, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except OSError as exc:
        # Logging failures should never take down the request itself.
        print(f"[warn] failed to write comparison log: {exc}")


# ---------------------------------------------------------------------------
# Flask routes
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET", "POST"])
def index():
    result_a = result_b = None
    query = ""
    elapsed_seconds = None

    if request.method == "POST":
        query = request.form.get("query", "").strip()

        if not query:
            return render_template("index.html", error="Please enter a query.", query=query)

        start = time.monotonic()
        try:
            # Fire both calls at the same time so total latency is
            # roughly max(a, b) instead of a + b.
            with ThreadPoolExecutor(max_workers=2) as pool:
                future_a = pool.submit(call_claude, query)
                future_b = pool.submit(call_second_api, query)
                result_a = future_a.result()
                result_b = future_b.result()
        except Exception:
            # Belt-and-suspenders: should be unreachable since each call
            # function already catches its own errors, but a request-level
            # failure here should still render a clean error, not a 500.
            traceback.print_exc()
            return render_template(
                "index.html",
                error="An unexpected error occurred while comparing responses.",
                query=query,
            )

        elapsed_seconds = round(time.monotonic() - start, 2)
        log_comparison(query, result_a, result_b)

    return render_template(
        "index.html",
        query=query,
        result_a=result_a,
        result_b=result_b,
        elapsed_seconds=elapsed_seconds,
    )


if __name__ == "__main__":
    port = int(os.environ.get("FLASK_PORT", 5000))
    app.run(host="127.0.0.1", port=port, debug=True)
