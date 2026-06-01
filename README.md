# 🚀 Task Manager REST API

A small but complete REST API for a task manager — the kind of backend feature you'd add to an existing SaaS product. Full CRUD, JSON in/out, correct HTTP status codes, input validation, and a health check endpoint.

Built with **Python's standard library only** — no Flask, no `pip install`. Runs anywhere.

## ▶️ Run it
```bash
python app.py
# Task Manager API running on http://localhost:8000
```

## 📡 Endpoints
| Method | Path          | Description        |
|--------|---------------|--------------------|
| GET    | `/health`     | Service health     |
| GET    | `/tasks`      | List all tasks     |
| POST   | `/tasks`      | Create a task      |
| GET    | `/tasks/<id>` | Get one task       |
| PUT    | `/tasks/<id>` | Update a task      |
| DELETE | `/tasks/<id>` | Delete a task      |

## 🧪 Try it
```bash
# list
curl http://localhost:8000/tasks

# create
curl -X POST http://localhost:8000/tasks -d '{"title":"Deploy to production"}'

# update
curl -X PUT http://localhost:8000/tasks/2 -d '{"done":true}'

# delete
curl -X DELETE http://localhost:8000/tasks/1
```

## ✅ What it demonstrates
- RESTful routing and resource design
- JSON request parsing with validation (rejects empty titles & bad JSON)
- Proper status codes (`200`, `201`, `400`, `404`)
- Clean, readable handler structure

## 💡 Natural next steps (client talking points)
- Swap in-memory store for SQLite/PostgreSQL
- Add authentication (API keys or JWT)
- Add pagination and filtering on `GET /tasks`

> Note: storage is in-memory, so data resets when the server restarts — by design, to keep the demo dependency-free.

---
Built by **StacklaneUAE** · [github.com/StacklaneUAE](https://github.com/StacklaneUAE)
