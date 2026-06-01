#!/usr/bin/env python3
"""
app.py — Task Manager REST API.

A small but complete REST API demonstrating a typical SaaS feature:
CRUD endpoints for a "tasks" resource, with in-memory storage,
JSON request/response handling, and proper HTTP status codes.

Built with Python's standard library only — no Flask, no installs —
so it runs anywhere with `python app.py`.

It also serves a single-page web UI (static/) from the same server, so the
whole thing — API and frontend — runs with just `python app.py`.

Endpoints:
    GET    /tasks          list all tasks
    POST   /tasks          create a task        body: {"title": "...", "done": false}
    GET    /tasks/<id>     get one task
    PUT    /tasks/<id>     update a task         body: {"title": "...", "done": true}
    DELETE /tasks/<id>     delete a task
    GET    /health         service health check
    GET    /              the web UI (and its static assets)

Author: StacklaneUAE
"""

import json
import mimetypes
import os
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

# directory holding the frontend (index.html, styles.css, app.js)
STATIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "static")

# ---- simple in-memory "database" -------------------------------------------
TASKS = {}
NEXT_ID = {"value": 1}


def _new_task(title, done=False):
    tid = NEXT_ID["value"]
    NEXT_ID["value"] += 1
    task = {"id": tid, "title": title, "done": bool(done)}
    TASKS[tid] = task
    return task


# seed a couple so the API isn't empty on first run
_new_task("Set up project repo", done=True)
_new_task("Write API documentation")


class Handler(BaseHTTPRequestHandler):
    # --- helpers ---
    def _send(self, status, payload):
        body = json.dumps(payload, indent=2).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body_json(self):
        length = int(self.headers.get("Content-Length", 0))
        if not length:
            return {}
        try:
            return json.loads(self.rfile.read(length))
        except json.JSONDecodeError:
            return None

    def _serve_static(self, path):
        # "/" -> marketing landing page, "/app" -> the task manager UI,
        # anything else -> that file from static/ (e.g. /styles.css, /app.js)
        if path in ("", "/"):
            rel = "landing.html"
        elif path in ("/app", "/app/"):
            rel = "index.html"
        else:
            rel = path.lstrip("/")
        # resolve safely inside STATIC_DIR — block any path traversal
        full = os.path.normpath(os.path.join(STATIC_DIR, rel))
        try:
            inside = os.path.commonpath([STATIC_DIR, full]) == STATIC_DIR
        except ValueError:
            # different drive (e.g. a crafted "C:/..." path on Windows)
            inside = False
        if not inside or not os.path.isfile(full):
            return self._send(404, {"error": "Not found"})

        ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
        with open(full, "rb") as f:
            body = f.read()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _task_id(self, path):
        parts = path.strip("/").split("/")
        if len(parts) == 2 and parts[0] == "tasks":
            try:
                return int(parts[1])
            except ValueError:
                return None
        return None

    def log_message(self, fmt, *args):
        print(f"  {self.command} {self.path} -> {args[1]}")

    # --- routes ---
    def do_GET(self):
        path = urlparse(self.path).path
        if path == "/health":
            return self._send(200, {"status": "ok", "tasks_stored": len(TASKS)})
        if path == "/tasks":
            return self._send(200, {"tasks": list(TASKS.values())})
        tid = self._task_id(path)
        if tid is not None:
            task = TASKS.get(tid)
            if task:
                return self._send(200, task)
            return self._send(404, {"error": f"Task {tid} not found"})
        # not an API route — try serving the web UI / static assets
        return self._serve_static(path)

    def do_POST(self):
        if urlparse(self.path).path != "/tasks":
            return self._send(404, {"error": "Unknown endpoint"})
        data = self._body_json()
        if data is None:
            return self._send(400, {"error": "Invalid JSON body"})
        title = (data.get("title") or "").strip()
        if not title:
            return self._send(400, {"error": "Field 'title' is required"})
        task = _new_task(title, data.get("done", False))
        return self._send(201, task)

    def do_PUT(self):
        tid = self._task_id(urlparse(self.path).path)
        if tid is None:
            return self._send(404, {"error": "Unknown endpoint"})
        task = TASKS.get(tid)
        if not task:
            return self._send(404, {"error": f"Task {tid} not found"})
        data = self._body_json()
        if data is None:
            return self._send(400, {"error": "Invalid JSON body"})
        if "title" in data:
            task["title"] = str(data["title"]).strip()
        if "done" in data:
            task["done"] = bool(data["done"])
        return self._send(200, task)

    def do_DELETE(self):
        tid = self._task_id(urlparse(self.path).path)
        if tid is None:
            return self._send(404, {"error": "Unknown endpoint"})
        if tid in TASKS:
            del TASKS[tid]
            return self._send(200, {"deleted": tid})
        return self._send(404, {"error": f"Task {tid} not found"})


def run(port=8000, open_browser=True):
    server = HTTPServer(("", port), Handler)
    url = f"http://localhost:{port}"
    print(f"Task Manager running on {url}")
    print(f"  Web UI:  {url}/")
    print(f"  API:     {url}/tasks")
    if open_browser:
        # open the UI shortly after the server starts accepting connections
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    run()
