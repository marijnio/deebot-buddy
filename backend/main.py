"""FastAPI application entrypoint serving Deebot Buddy REST API and SPA frontend."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend import services
from backend.database import get_connection, get_db_path, init_db
from backend.schemas import (
    BackupPayload,
    CompleteTaskRequest,
    SettingsUpdateRequest,
    TestWebhookRequest,
    UpdateInventoryRequest,
    UpdateTaskRequest,
)

DEFAULT_STATIC_DIR = Path(__file__).resolve().parent.parent / "frontend" / "dist"
DEFAULT_MASCOTS_DIR = Path(__file__).resolve().parent.parent / "mascots"


def get_static_dir() -> Path:
    raw = os.environ.get("STATIC_DIR")
    return Path(raw) if raw else DEFAULT_STATIC_DIR


def get_mascots_dir() -> Path:
    raw = os.environ.get("MASCOTS_DIR")
    return Path(raw) if raw else DEFAULT_MASCOTS_DIR


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Deebot Buddy",
    description="Self-hosted maintenance tracker for ECOVACS DEEBOT T90 PRO OMNI",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> dict[str, Any]:
    conn = get_connection()
    try:
        count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
        return {"status": "ok", "tasks_seeded": count}
    finally:
        conn.close()


@app.get("/api/dashboard")
def get_dashboard() -> dict[str, Any]:
    conn = get_connection()
    try:
        return services.build_dashboard(conn)
    finally:
        conn.close()


@app.get("/api/tasks/{task_id}")
def get_task_detail(task_id: int) -> dict[str, Any]:
    conn = get_connection()
    try:
        return services.get_task_detail(conn, task_id)
    finally:
        conn.close()


@app.post("/api/tasks/{task_id}/complete")
def complete_task(task_id: int, req: CompleteTaskRequest) -> dict[str, Any]:
    conn = get_connection()
    try:
        return services.complete_task(conn, task_id, req)
    finally:
        conn.close()


@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, req: UpdateTaskRequest) -> dict[str, Any]:
    conn = get_connection()
    try:
        return services.update_task(conn, task_id, req)
    finally:
        conn.close()


@app.delete("/api/logs/{log_id}")
def undo_log(log_id: int) -> dict[str, Any]:
    conn = get_connection()
    try:
        return services.undo_log(conn, log_id)
    finally:
        conn.close()


@app.patch("/api/inventory/{inventory_id}")
def update_inventory(inventory_id: int, req: UpdateInventoryRequest) -> dict[str, Any]:
    conn = get_connection()
    try:
        return services.update_inventory(conn, inventory_id, req)
    finally:
        conn.close()


@app.get("/api/settings")
def get_settings() -> dict[str, Any]:
    conn = get_connection()
    try:
        raw = services.get_settings_dict(conn)
        return {
            **raw,
            "notifications_enabled": raw.get("notifications_enabled", "false") == "true",
        }
    finally:
        conn.close()


@app.post("/api/settings")
def save_settings(req: SettingsUpdateRequest) -> dict[str, Any]:
    conn = get_connection()
    try:
        raw = services.update_settings(conn, req)
        return {
            **raw,
            "notifications_enabled": raw.get("notifications_enabled", "false") == "true",
        }
    finally:
        conn.close()


@app.post("/api/settings/test-webhook")
async def test_webhook(req: TestWebhookRequest | None = None) -> dict[str, Any]:
    conn = get_connection()
    try:
        settings = services.get_settings_dict(conn)
        dashboard = services.build_dashboard(conn)
    finally:
        conn.close()
    return await services.send_webhook_notification(
        settings, dashboard, override=req, is_test=True
    )


@app.post("/api/notifications/check")
async def check_and_notify() -> dict[str, Any]:
    conn = get_connection()
    try:
        settings = services.get_settings_dict(conn)
        dashboard = services.build_dashboard(conn)
    finally:
        conn.close()

    if settings.get("notifications_enabled") != "true":
        return {"sent": False, "reason": "Notifications are disabled"}
    if not settings.get("webhook_url"):
        return {"sent": False, "reason": "No webhook URL configured"}
    if dashboard["counts"]["overdue"] == 0:
        return {"sent": False, "reason": "No overdue tasks"}

    result = await services.send_webhook_notification(settings, dashboard, is_test=False)
    return {"sent": True, **result}


@app.get("/api/export")
def export_backup() -> JSONResponse:
    conn = get_connection()
    try:
        data = services.export_backup(conn)
    finally:
        conn.close()
    return JSONResponse(
        content=data,
        headers={
            "Content-Disposition": 'attachment; filename="deebot-buddy-backup.json"'
        },
    )


@app.post("/api/import")
def import_backup(payload: BackupPayload) -> dict[str, Any]:
    conn = get_connection()
    try:
        return services.import_backup(conn, payload)
    finally:
        conn.close()


@app.get("/mascots/{filename}")
def serve_mascot(filename: str):
    if (
        not filename.endswith(".svg")
        or "/" in filename
        or "\\" in filename
        or ".." in filename
    ):
        raise HTTPException(status_code=404, detail="Mascot SVG not found")

    override_path = get_db_path().parent / "mascots" / filename
    default_path = get_mascots_dir() / filename
    target = override_path if override_path.is_file() else default_path

    if not target.is_file():
        raise HTTPException(status_code=404, detail="Mascot SVG not found")

    return FileResponse(
        str(target),
        media_type="image/svg+xml",
        headers={"Cache-Control": "no-cache, must-revalidate"},
    )


static_dir = get_static_dir()
assets_dir = static_dir / "assets"
if assets_dir.is_dir():
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")


@app.get("/{full_path:path}")
def serve_spa(full_path: str):
    if full_path.startswith("api/") or full_path.startswith("mascots/"):
        raise HTTPException(status_code=404, detail="Not found")

    dist = get_static_dir()
    if full_path:
        candidate = (dist / full_path).resolve()
        try:
            candidate.relative_to(dist.resolve())
        except ValueError:
            raise HTTPException(status_code=404, detail="Not found")
        if candidate.is_file():
            return FileResponse(str(candidate))

    index_file = dist / "index.html"
    if index_file.is_file():
        return FileResponse(str(index_file))

    return JSONResponse(
        {
            "message": "Deebot Buddy API is running. Build frontend/dist to serve the UI."
        }
    )
