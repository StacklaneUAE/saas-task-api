#!/usr/bin/env python3
"""
app.py — Task Manager REST API.

A small but complete REST API demonstrating a typical SaaS feature:
CRUD endpoints for a "tasks" resource, with in-memory storage,
JSON request/response handling, and proper HTTP status codes.

Built with Python's standard library only — no Flask, no installs —
so it runs anywhere with `python app.py`.

Endpoints:
    GET    /tasks          list all tasks
    POST   /tasks          create a task        body: {"title": "...", "done": false}
    GET    /tasks/<id>     get one task
    PUT    /tasks/<id>     update a task         body: {"title": "...", "done": true}
    DELETE /tasks/<id>     delete a task
    GET    /health         service health check

Author: StacklaneUAE
"""

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse

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
        return self._send(404, {"error": "Unknown endpoint"})

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


def run(port=8000):
    server = HTTPServer(("", port), Handler)
    print(f"Task Manager API running on http://localhost:{port}")
    print("Try:  curl http://localhost:8000/tasks")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    run()
