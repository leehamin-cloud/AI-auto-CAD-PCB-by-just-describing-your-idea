from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from .db import connect, init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title="Autonomous R&D Lab", version="0.1.0", lifespan=lifespan)
STATIC = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=STATIC), name="static")

class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    objective: str = Field(default="", max_length=4000)

class TaskIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    department: str = Field(default="research", max_length=40)

@app.get("/")
def dashboard():
    return FileResponse(STATIC / "index.html")

@app.get("/api/health")
def health():
    return {"status": "ok", "service": "autonomous-rd-lab", "version": "0.1.0"}

@app.get("/api/projects")
def list_projects():
    with connect() as db:
        rows = db.execute("SELECT * FROM projects ORDER BY id DESC").fetchall()
        result = []
        for row in rows:
            item = dict(row)
            item["tasks"] = [dict(t) for t in db.execute(
                "SELECT * FROM tasks WHERE project_id=? ORDER BY id DESC", (row["id"],)
            ).fetchall()]
            item["artifacts"] = [dict(a) for a in db.execute(
                "SELECT * FROM artifacts WHERE project_id=? ORDER BY id DESC", (row["id"],)
            ).fetchall()]
            result.append(item)
        return result

@app.post("/api/projects", status_code=201)
def create_project(payload: ProjectIn):
    with connect() as db:
        cur = db.execute("INSERT INTO projects(name, objective) VALUES (?, ?)",
                         (payload.name.strip(), payload.objective.strip()))
        return dict(db.execute("SELECT * FROM projects WHERE id=?", (cur.lastrowid,)).fetchone())

@app.post("/api/projects/{project_id}/tasks", status_code=201)
def create_task(project_id: int, payload: TaskIn):
    with connect() as db:
        exists = db.execute("SELECT id FROM projects WHERE id=?", (project_id,)).fetchone()
        if not exists:
            raise HTTPException(404, "Project not found")
        cur = db.execute("INSERT INTO tasks(project_id, title, department) VALUES (?, ?, ?)",
                         (project_id, payload.title.strip(), payload.department))
        return dict(db.execute("SELECT * FROM tasks WHERE id=?", (cur.lastrowid,)).fetchone())

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, status: str):
    allowed = {"queued", "in_progress", "blocked", "done"}
    if status not in allowed:
        raise HTTPException(400, f"status must be one of {sorted(allowed)}")
    with connect() as db:
        cur = db.execute("UPDATE tasks SET status=? WHERE id=?", (status, task_id))
        if cur.rowcount == 0:
            raise HTTPException(404, "Task not found")
        return dict(db.execute("SELECT * FROM tasks WHERE id=?", (task_id,)).fetchone())
