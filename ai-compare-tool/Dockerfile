FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# The logs/ directory is created at runtime by app.py if missing, but Fly's
# filesystem is ephemeral by default anyway — see the README note about
# using a Fly volume if you want the comparison log to survive redeploys.
EXPOSE 8080

# gunicorn, not the Flask dev server: multi-worker, production-hardened.
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "60", "app:app"]
