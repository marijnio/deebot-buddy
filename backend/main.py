"""FastAPI application entrypoint serving Deebot Buddy REST API and SPA frontend."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend import auth, services
from backend.database import get_connection, get_db_path, init_db
from backend.schemas import (
    BackupPayload,
    BulkFlagTasksRequest,
    CompleteTaskRequest,
    LoginRequest,
    PasswordUpdateRequest,
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

PUBLIC_API_PATHS = {
    "/api/health",
    "/api/auth/status",
    "/api/auth/login",
    "/api/auth/logout",
}


def _is_https_request(request: Request) -> bool:
    return (
        request.url.scheme == "https"
        or request.headers.get("x-forwarded-proto", "").lower() == "https"
    )


def _is_request_authenticated(request: Request, conn) -> tuple[bool, dict[str, Any]]:
    state = auth.get_auth_state(conn)
    if not state["password_enabled"]:
        return True, state

    token = request.cookies.get(auth.COOKIE_NAME, "")
    if auth.verify_session_token(token, state["secret"], state["fingerprint"]):
        return True, state

    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        bearer_pw = auth_header[7:].strip()
        if bearer_pw and auth.verify_credentials(conn, bearer_pw):
            return True, state

    return False, state


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    path = request.url.path
    if (
        request.method != "OPTIONS"
        and path.startswith("/api/")
        and path not in PUBLIC_API_PATHS
    ):
        conn = get_connection()
        try:
            authed, _ = _is_request_authenticated(request, conn)
        finally:
            conn.close()
        if not authed:
            return JSONResponse(
                {"detail": "Authentication required"}, status_code=401
            )
    return await call_next(request)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/auth/status")
def auth_status(request: Request) -> dict[str, Any]:
    conn = get_connection()
    try:
        authed, state = _is_request_authenticated(request, conn)
        settings = services.get_public_settings_dict(conn)
        return {
            "password_enabled": state["password_enabled"],
            "authenticated": authed,
            "managed_by_env": state["managed_by_env"],
            "robot_name": settings.get("robot_name", "Deebot T90 PRO OMNI"),
        }
    finally:
        conn.close()


@app.post("/api/auth/login")
def auth_login(req: LoginRequest, request: Request, response: Response) -> dict[str, Any]:
    client_ip = request.client.host if request.client else "unknown"
    retry_after = auth.login_rate_limiter.is_blocked(client_ip)
    if retry_after > 0:
        raise HTTPException(
            status_code=429,
            detail=f"Too many failed attempts. Try again in {retry_after}s.",
        )

    conn = get_connection()
    try:
        if not auth.verify_credentials(conn, req.password):
            auth.login_rate_limiter.record_failure(client_ip)
            raise HTTPException(status_code=401, detail="Incorrect password")

        auth.login_rate_limiter.reset(client_ip)
        state = auth.get_auth_state(conn)
        ttl = (
            auth.REMEMBER_TTL_SECONDS
            if req.remember_me
            else auth.SESSION_TTL_SECONDS
        )
        token = auth.create_session_token(
            state["secret"], state["fingerprint"], ttl
        )
        response.set_cookie(
            key=auth.COOKIE_NAME,
            value=token,
            max_age=ttl,
            httponly=True,
            samesite="lax",
            secure=_is_https_request(request),
            path="/",
        )
        return {"authenticated": True}
    finally:
        conn.close()


@app.post("/api/auth/logout")
def auth_logout(response: Response) -> dict[str, Any]:
    response.delete_cookie(key=auth.COOKIE_NAME, path="/")
    return {"authenticated": False}


@app.post("/api/auth/password")
def update_password(
    req: PasswordUpdateRequest, request: Request, response: Response
) -> dict[str, Any]:
    conn = get_connection()
    try:
        state = auth.get_auth_state(conn)
        if state["managed_by_env"]:
            raise HTTPException(
                status_code=400,
                detail="Password is managed by DEEBOT_PASSWORD environment variable",
            )

        if state["password_enabled"]:
            if not req.current_password:
                raise HTTPException(
                    status_code=400, detail="Current password is required"
                )
            if not auth.verify_password_hash(
                req.current_password, state["password_hash"]
            ):
                raise HTTPException(
                    status_code=401, detail="Current password is incorrect"
                )

        new_pw = (req.new_password or "").strip()
        if not new_pw:
            conn.execute(
                "DELETE FROM settings WHERE key = 'auth_password_hash'"
            )
            conn.commit()
            response.delete_cookie(key=auth.COOKIE_NAME, path="/")
            return {
                "password_enabled": False,
                "authenticated": True,
                "managed_by_env": False,
            }

        if len(new_pw) < 4:
            raise HTTPException(
                status_code=400,
                detail="New password must be at least 4 characters",
            )

        pw_hash = auth.hash_password(new_pw)
        conn.execute(
            """
            INSERT INTO settings (key, value) VALUES ('auth_password_hash', ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (pw_hash,),
        )
        conn.commit()

        new_state = auth.get_auth_state(conn)
        token = auth.create_session_token(
            new_state["secret"],
            new_state["fingerprint"],
            auth.REMEMBER_TTL_SECONDS,
        )
        response.set_cookie(
            key=auth.COOKIE_NAME,
            value=token,
            max_age=auth.REMEMBER_TTL_SECONDS,
            httponly=True,
            samesite="lax",
            secure=_is_https_request(request),
            path="/",
        )
        return {
            "password_enabled": True,
            "authenticated": True,
            "managed_by_env": False,
        }
    finally:
        conn.close()


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


@app.post("/api/tasks/bulk-flag")
def bulk_flag_tasks(req: BulkFlagTasksRequest) -> dict[str, Any]:
    conn = get_connection()
    try:
        return services.bulk_flag_tasks(conn, req)
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
        raw = services.get_public_settings_dict(conn)
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
