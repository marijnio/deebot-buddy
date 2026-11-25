"""Domain logic for maintenance scheduling, mood scoring, inventory, webhooks, and backup."""

from __future__ import annotations

import sqlite3
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import httpx
from fastapi import HTTPException

from backend.schemas import (
    BackupPayload,
    CompleteTaskRequest,
    SettingsUpdateRequest,
    TestWebhookRequest,
    UpdateInventoryRequest,
    UpdateTaskRequest,
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def to_iso(dt: datetime) -> str:
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc).isoformat()


def parse_iso(value: str) -> datetime:
    text = value.strip()
    if text.endswith("Z"):
        text = text[:-1] + "+00:00"
    dt = datetime.fromisoformat(text)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def compute_cycle(
    interval_days: Optional[int],
    last_at_str: Optional[str],
    due_override_str: Optional[str],
    now: datetime,
) -> Optional[dict[str, Any]]:
    """Compute elapsed percentage, remaining days, and status for a single maintenance cycle."""
    if interval_days is None:
        return None

    last_at = parse_iso(last_at_str) if last_at_str else now
    due_at = (
        parse_iso(due_override_str)
        if due_override_str
        else last_at + timedelta(days=interval_days)
    )

    total_seconds = max(interval_days * 86400.0, 1.0)
    remaining_seconds = (due_at - now).total_seconds()
    days_remaining = remaining_seconds / 86400.0

    if remaining_seconds <= 0:
        overdue_seconds = abs(remaining_seconds)
        percent_elapsed = 100.0 + (overdue_seconds / total_seconds) * 100.0
        status = "overdue"
    else:
        elapsed_seconds = max(0.0, total_seconds - remaining_seconds)
        percent_elapsed = (elapsed_seconds / total_seconds) * 100.0
        status = "due_soon" if percent_elapsed >= 75.0 else "ok"

    return {
        "interval_days": interval_days,
        "last_at": to_iso(last_at),
        "due_at": to_iso(due_at),
        "is_override": bool(due_override_str),
        "days_remaining": round(days_remaining, 2),
        "hours_remaining": round(remaining_seconds / 3600.0, 1),
        "percent_elapsed": round(percent_elapsed, 1),
        "progress_clamped": round(min(max(percent_elapsed, 0.0), 100.0), 1),
        "status": status,
    }


def _row_to_inventory_dict(row: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "unit_label": row["unit_label"],
        "in_stock": row["in_stock"],
        "low_stock_threshold": row["low_stock_threshold"],
        "is_low_stock": row["in_stock"] <= row["low_stock_threshold"],
        "notes": row["notes"],
        "updated_at": row["updated_at"],
    }


def _task_status_from_cycles(
    clean_cycle: Optional[dict[str, Any]],
    replace_cycle: Optional[dict[str, Any]],
) -> tuple[str, float]:
    cycles = [c for c in (clean_cycle, replace_cycle) if c is not None]
    if not cycles:
        return "ok", 0.0
    max_pct = max(c["percent_elapsed"] for c in cycles)
    if any(c["status"] == "overdue" for c in cycles):
        return "overdue", max_pct
    if any(c["status"] == "due_soon" for c in cycles):
        return "due_soon", max_pct
    return "ok", max_pct


def _serialize_task(
    row: sqlite3.Row,
    inv_map: dict[int, dict[str, Any]],
    log_counts: dict[int, int],
    now: datetime,
) -> dict[str, Any]:
    clean_cycle = compute_cycle(
        row["clean_interval_days"],
        row["last_cleaned_at"],
        row["clean_due_override"],
        now,
    )
    replace_cycle = compute_cycle(
        row["replace_interval_days"],
        row["last_replaced_at"],
        row["replace_due_override"],
        now,
    )
    overall_status, max_pct = _task_status_from_cycles(clean_cycle, replace_cycle)

    cycles_with_type: list[tuple[str, dict[str, Any]]] = []
    if clean_cycle is not None:
        cycles_with_type.append(("CLEAN", clean_cycle))
    if replace_cycle is not None:
        cycles_with_type.append(("REPLACE", replace_cycle))

    soonest_type: Optional[str] = None
    soonest_cycle: Optional[dict[str, Any]] = None
    if cycles_with_type:
        soonest_type, soonest_cycle = min(
            cycles_with_type, key=lambda pair: pair[1]["days_remaining"]
        )

    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "location": row["location"],
        "sort_order": row["sort_order"],
        "is_critical_water": bool(row["is_critical_water"]),
        "instructions": row["instructions"],
        "icon": row["icon"],
        "clean_cycle": clean_cycle,
        "replace_cycle": replace_cycle,
        "overall_status": overall_status,
        "max_percent_elapsed": round(max_pct, 1),
        "soonest_action": soonest_type,
        "soonest_due_at": soonest_cycle["due_at"] if soonest_cycle else None,
        "soonest_days_remaining": soonest_cycle["days_remaining"] if soonest_cycle else None,
        "inventory": inv_map.get(row["inventory_id"]) if row["inventory_id"] else None,
        "log_count": log_counts.get(row["id"], 0),
    }


def _determine_mood(
    overdue_count: int,
    due_soon_count: int,
    dirty_water_overdue: bool,
) -> tuple[str, str, str]:
    if overdue_count >= 3 or dirty_water_overdue:
        if dirty_water_overdue and overdue_count < 3:
            subtitle = "Dirty Water Tank is overdue! Rescue me before biofilm builds up!"
        else:
            subtitle = f"{overdue_count} maintenance tasks are overdue — waving the white flag!"
        return "faint", "Needs Rescue!", subtitle
    if overdue_count >= 1:
        noun = "task" if overdue_count == 1 else "tasks"
        return (
            "dusty",
            "Dusty & Tangled",
            f"{overdue_count} {noun} overdue — a quick brush & tidy will perk me right up.",
        )
    if due_soon_count >= 1:
        noun = "task" if due_soon_count == 1 else "tasks"
        return (
            "normal",
            "Content & Ready",
            f"Getting close to tidy-up time ({due_soon_count} {noun} due soon).",
        )
    return (
        "happy",
        "Sparkling & Happy",
        "All systems gleaming! Your DEEBOT T90 PRO OMNI is living its best life.",
    )


def _compute_health_score(
    tasks: list[dict[str, Any]],
    overdue_count: int,
    dirty_water_overdue: bool,
) -> int:
    active_cycles: list[dict[str, Any]] = []
    for task in tasks:
        if task["clean_cycle"] is not None:
            active_cycles.append(task["clean_cycle"])
        if task["replace_cycle"] is not None:
            active_cycles.append(task["replace_cycle"])

    if not active_cycles:
        return 100

    freshness_sum = 0.0
    for cycle in active_cycles:
        pct = cycle["percent_elapsed"]
        if pct <= 100.0:
            freshness_sum += max(0.0, 100.0 - pct * 0.6)
        else:
            over_ratio = min(2.0, (pct - 100.0) / 100.0)
            freshness_sum += max(0.0, 40.0 - over_ratio * 20.0)

    avg_freshness = freshness_sum / len(active_cycles)
    penalty = overdue_count * 8 + (15 if dirty_water_overdue else 0)
    score = round(avg_freshness - penalty)
    return max(0, min(100, int(score)))


def get_settings_dict(conn: sqlite3.Connection) -> dict[str, str]:
    rows = conn.execute("SELECT key, value FROM settings").fetchall()
    return {row["key"]: row["value"] for row in rows}


def build_dashboard(
    conn: sqlite3.Connection, now: Optional[datetime] = None
) -> dict[str, Any]:
    current_time = now or now_utc()

    inv_rows = conn.execute("SELECT * FROM inventory ORDER BY id ASC").fetchall()
    inventory = [_row_to_inventory_dict(r) for r in inv_rows]
    inv_map = {item["id"]: item for item in inventory}

    count_rows = conn.execute(
        "SELECT task_id, COUNT(*) AS cnt FROM maintenance_logs GROUP BY task_id"
    ).fetchall()
    log_counts = {row["task_id"]: row["cnt"] for row in count_rows}

    task_rows = conn.execute(
        "SELECT * FROM tasks ORDER BY sort_order ASC, id ASC"
    ).fetchall()
    tasks = [_serialize_task(r, inv_map, log_counts, current_time) for r in task_rows]

    overdue_count = sum(1 for t in tasks if t["overall_status"] == "overdue")
    due_soon_count = sum(1 for t in tasks if t["overall_status"] == "due_soon")
    ok_count = sum(1 for t in tasks if t["overall_status"] == "ok")
    dirty_water_overdue = any(
        t["is_critical_water"] and t["overall_status"] == "overdue" for t in tasks
    )
    low_stock_count = sum(1 for i in inventory if i["is_low_stock"])

    mood, mood_label, mood_subtitle = _determine_mood(
        overdue_count, due_soon_count, dirty_water_overdue
    )
    health_score = _compute_health_score(tasks, overdue_count, dirty_water_overdue)

    upcoming_candidates: list[dict[str, Any]] = []
    for t in tasks:
        for action_type, cycle in (
            ("CLEAN", t["clean_cycle"]),
            ("REPLACE", t["replace_cycle"]),
        ):
            if cycle is not None:
                upcoming_candidates.append(
                    {
                        "task_id": t["id"],
                        "task_slug": t["slug"],
                        "task_name": t["name"],
                        "location": t["location"],
                        "action_type": action_type,
                        "due_at": cycle["due_at"],
                        "days_remaining": cycle["days_remaining"],
                        "hours_remaining": cycle["hours_remaining"],
                        "percent_elapsed": cycle["percent_elapsed"],
                        "status": cycle["status"],
                    }
                )

    next_upcoming = (
        min(upcoming_candidates, key=lambda c: c["days_remaining"])
        if upcoming_candidates
        else None
    )

    recent_log_rows = conn.execute(
        """
        SELECT l.*, t.name AS task_name, t.slug AS task_slug, t.location AS task_location
        FROM maintenance_logs l
        JOIN tasks t ON t.id = l.task_id
        ORDER BY l.performed_at DESC, l.id DESC
        LIMIT 12
        """
    ).fetchall()

    recent_logs = [dict(r) for r in recent_log_rows]
    settings = get_settings_dict(conn)

    return {
        "generated_at": to_iso(current_time),
        "robot_name": settings.get("robot_name", "Deebot T90 PRO OMNI"),
        "health_score": health_score,
        "mood": mood,
        "mood_label": mood_label,
        "mood_subtitle": mood_subtitle,
        "counts": {
            "total": len(tasks),
            "overdue": overdue_count,
            "due_soon": due_soon_count,
            "ok": ok_count,
            "low_stock": low_stock_count,
        },
        "dirty_water_overdue": dirty_water_overdue,
        "next_upcoming": next_upcoming,
        "tasks": tasks,
        "inventory": inventory,
        "recent_logs": recent_logs,
    }


def get_task_detail(
    conn: sqlite3.Connection, task_id: int, now: Optional[datetime] = None
) -> dict[str, Any]:
    current_time = now or now_utc()
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    inv_map: dict[int, dict[str, Any]] = {}
    if row["inventory_id"] is not None:
        inv_row = conn.execute(
            "SELECT * FROM inventory WHERE id = ?", (row["inventory_id"],)
        ).fetchone()
        if inv_row:
            inv_map[inv_row["id"]] = _row_to_inventory_dict(inv_row)

    logs = [
        dict(r)
        for r in conn.execute(
            """
            SELECT * FROM maintenance_logs
            WHERE task_id = ?
            ORDER BY performed_at DESC, id DESC
            LIMIT 50
            """,
            (task_id,),
        ).fetchall()
    ]
    task_dict = _serialize_task(row, inv_map, {task_id: len(logs)}, current_time)
    return {"task": task_dict, "logs": logs}


def _recompute_task_timestamps_from_logs(
    conn: sqlite3.Connection,
    task_row: sqlite3.Row,
    deleted_log: Optional[sqlite3.Row] = None,
) -> tuple[Optional[str], Optional[str]]:
    """Determine effective last_cleaned_at and last_replaced_at after log mutation."""
    task_id = task_row["id"]
    logs = conn.execute(
        "SELECT action_type, performed_at FROM maintenance_logs WHERE task_id = ?",
        (task_id,),
    ).fetchall()

    clean_dates = [
        parse_iso(r["performed_at"])
        for r in logs
        if r["action_type"] in ("CLEAN", "REPLACE")
    ]
    replace_dates = [
        parse_iso(r["performed_at"]) for r in logs if r["action_type"] == "REPLACE"
    ]

    if task_row["clean_interval_days"] is None:
        new_last_cleaned = None
    elif clean_dates:
        new_last_cleaned = to_iso(max(clean_dates))
    elif deleted_log is not None:
        new_last_cleaned = deleted_log["prev_last_cleaned_at"]
    else:
        new_last_cleaned = task_row["last_cleaned_at"]

    if task_row["replace_interval_days"] is None:
        new_last_replaced = None
    elif replace_dates:
        new_last_replaced = to_iso(max(replace_dates))
    elif deleted_log is not None:
        new_last_replaced = deleted_log["prev_last_replaced_at"]
    else:
        new_last_replaced = task_row["last_replaced_at"]

    return new_last_cleaned, new_last_replaced


def complete_task(
    conn: sqlite3.Connection, task_id: int, req: CompleteTaskRequest
) -> dict[str, Any]:
    current_time = now_utc()
    task_row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not task_row:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    if req.action_type == "CLEAN" and task_row["clean_interval_days"] is None:
        raise HTTPException(
            status_code=400, detail="This component does not have a cleaning cycle"
        )
    if req.action_type == "REPLACE" and task_row["replace_interval_days"] is None:
        raise HTTPException(
            status_code=400, detail="This component does not have a replacement cycle"
        )

    if req.performed_at:
        try:
            performed_dt = parse_iso(req.performed_at)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid performed_at timestamp") from exc
        if performed_dt > current_time + timedelta(minutes=5):
            raise HTTPException(
                status_code=400, detail="performed_at cannot be in the future"
            )
    else:
        performed_dt = current_time

    performed_iso = to_iso(performed_dt)
    created_iso = to_iso(current_time)

    should_decrement_stock = False
    if req.action_type == "REPLACE":
        should_decrement_stock = (
            req.decrement_stock if req.decrement_stock is not None else True
        )
    elif req.action_type == "CLEAN" and req.decrement_stock is True:
        should_decrement_stock = True

    stock_decremented = 0
    if should_decrement_stock and task_row["inventory_id"] is not None:
        inv_row = conn.execute(
            "SELECT id, in_stock FROM inventory WHERE id = ?",
            (task_row["inventory_id"],),
        ).fetchone()
        if inv_row and inv_row["in_stock"] > 0:
            conn.execute(
                "UPDATE inventory SET in_stock = in_stock - 1, updated_at = ? WHERE id = ?",
                (created_iso, inv_row["id"]),
            )
            stock_decremented = 1

    prior_clean_logs = conn.execute(
        "SELECT 1 FROM maintenance_logs WHERE task_id = ? LIMIT 1",
        (task_id,),
    ).fetchone()
    prior_replace_logs = conn.execute(
        "SELECT 1 FROM maintenance_logs WHERE task_id = ? AND action_type = 'REPLACE' LIMIT 1",
        (task_id,),
    ).fetchone()

    cursor = conn.execute(
        """
        INSERT INTO maintenance_logs (
            task_id, action_type, performed_at, notes,
            prev_last_cleaned_at, prev_last_replaced_at,
            prev_clean_due_override, prev_replace_due_override,
            stock_decremented, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            task_id,
            req.action_type,
            performed_iso,
            req.notes.strip(),
            task_row["last_cleaned_at"],
            task_row["last_replaced_at"],
            task_row["clean_due_override"],
            task_row["replace_due_override"],
            stock_decremented,
            created_iso,
        ),
    )
    log_id = cursor.lastrowid

    new_last_cleaned = task_row["last_cleaned_at"]
    new_last_replaced = task_row["last_replaced_at"]
    new_clean_override = task_row["clean_due_override"]
    new_replace_override = task_row["replace_due_override"]

    if req.action_type in ("CLEAN", "REPLACE") and task_row["clean_interval_days"] is not None:
        if (
            not prior_clean_logs
            or new_last_cleaned is None
            or performed_dt >= parse_iso(new_last_cleaned)
        ):
            new_last_cleaned = performed_iso
            new_clean_override = None

    if req.action_type == "REPLACE" and task_row["replace_interval_days"] is not None:
        if (
            not prior_replace_logs
            or new_last_replaced is None
            or performed_dt >= parse_iso(new_last_replaced)
        ):
            new_last_replaced = performed_iso
            new_replace_override = None

    conn.execute(
        """
        UPDATE tasks
        SET last_cleaned_at = ?,
            last_replaced_at = ?,
            clean_due_override = ?,
            replace_due_override = ?
        WHERE id = ?
        """,
        (
            new_last_cleaned,
            new_last_replaced,
            new_clean_override,
            new_replace_override,
            task_id,
        ),
    )
    conn.commit()

    return {
        "log_id": log_id,
        "stock_decremented": bool(stock_decremented),
        "dashboard": build_dashboard(conn, current_time),
    }


def undo_log(conn: sqlite3.Connection, log_id: int) -> dict[str, Any]:
    current_time = now_utc()
    log_row = conn.execute(
        "SELECT * FROM maintenance_logs WHERE id = ?", (log_id,)
    ).fetchone()
    if not log_row:
        raise HTTPException(status_code=404, detail="Maintenance log entry not found")

    task_row = conn.execute(
        "SELECT * FROM tasks WHERE id = ?", (log_row["task_id"],)
    ).fetchone()
    if not task_row:
        raise HTTPException(status_code=404, detail="Associated task not found")

    conn.execute("DELETE FROM maintenance_logs WHERE id = ?", (log_id,))

    if log_row["stock_decremented"] and task_row["inventory_id"] is not None:
        conn.execute(
            "UPDATE inventory SET in_stock = in_stock + 1, updated_at = ? WHERE id = ?",
            (to_iso(current_time), task_row["inventory_id"]),
        )

    new_last_cleaned, new_last_replaced = _recompute_task_timestamps_from_logs(
        conn, task_row, deleted_log=log_row
    )

    newer_clean_exists = conn.execute(
        """
        SELECT 1 FROM maintenance_logs
        WHERE task_id = ? AND performed_at > ?
        LIMIT 1
        """,
        (task_row["id"], log_row["performed_at"]),
    ).fetchone()

    newer_replace_exists = conn.execute(
        """
        SELECT 1 FROM maintenance_logs
        WHERE task_id = ? AND action_type = 'REPLACE' AND performed_at > ?
        LIMIT 1
        """,
        (task_row["id"], log_row["performed_at"]),
    ).fetchone()

    clean_override = (
        task_row["clean_due_override"]
        if newer_clean_exists
        else log_row["prev_clean_due_override"]
    )
    replace_override = (
        task_row["replace_due_override"]
        if newer_replace_exists
        else log_row["prev_replace_due_override"]
    )

    conn.execute(
        """
        UPDATE tasks
        SET last_cleaned_at = ?,
            last_replaced_at = ?,
            clean_due_override = ?,
            replace_due_override = ?
        WHERE id = ?
        """,
        (
            new_last_cleaned,
            new_last_replaced,
            clean_override,
            replace_override,
            task_row["id"],
        ),
    )
    conn.commit()
    return {"undone_log_id": log_id, "dashboard": build_dashboard(conn, current_time)}


def update_task(
    conn: sqlite3.Connection, task_id: int, req: UpdateTaskRequest
) -> dict[str, Any]:
    current_time = now_utc()
    row = conn.execute("SELECT * FROM tasks WHERE id = ?", (task_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Maintenance task not found")

    clean_interval = (
        req.clean_interval_days
        if req.clean_interval_days is not None and row["clean_interval_days"] is not None
        else row["clean_interval_days"]
    )
    replace_interval = (
        req.replace_interval_days
        if req.replace_interval_days is not None and row["replace_interval_days"] is not None
        else row["replace_interval_days"]
    )

    clean_override = row["clean_due_override"]
    replace_override = row["replace_due_override"]

    if req.clear_clean_override:
        clean_override = None
    elif req.clean_due_override is not None:
        try:
            clean_override = to_iso(parse_iso(req.clean_due_override))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid clean_due_override") from exc
    elif req.snooze_clean_days is not None and clean_interval is not None:
        current_cycle = compute_cycle(
            clean_interval, row["last_cleaned_at"], row["clean_due_override"], current_time
        )
        base_dt = max(current_time, parse_iso(current_cycle["due_at"])) if current_cycle else current_time
        clean_override = to_iso(base_dt + timedelta(days=req.snooze_clean_days))

    if req.clear_replace_override:
        replace_override = None
    elif req.replace_due_override is not None:
        try:
            replace_override = to_iso(parse_iso(req.replace_due_override))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid replace_due_override") from exc
    elif req.snooze_replace_days is not None and replace_interval is not None:
        current_cycle = compute_cycle(
            replace_interval, row["last_replaced_at"], row["replace_due_override"], current_time
        )
        base_dt = max(current_time, parse_iso(current_cycle["due_at"])) if current_cycle else current_time
        replace_override = to_iso(base_dt + timedelta(days=req.snooze_replace_days))

    conn.execute(
        """
        UPDATE tasks
        SET clean_interval_days = ?,
            replace_interval_days = ?,
            clean_due_override = ?,
            replace_due_override = ?
        WHERE id = ?
        """,
        (clean_interval, replace_interval, clean_override, replace_override, task_id),
    )
    conn.commit()
    return build_dashboard(conn, current_time)


def update_inventory(
    conn: sqlite3.Connection, inventory_id: int, req: UpdateInventoryRequest
) -> dict[str, Any]:
    current_time = now_utc()
    row = conn.execute(
        "SELECT * FROM inventory WHERE id = ?", (inventory_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    new_stock = row["in_stock"]
    if req.in_stock is not None:
        new_stock = max(0, req.in_stock)
    elif req.delta is not None:
        new_stock = max(0, row["in_stock"] + req.delta)

    new_threshold = (
        req.low_stock_threshold
        if req.low_stock_threshold is not None
        else row["low_stock_threshold"]
    )
    new_notes = req.notes if req.notes is not None else row["notes"]

    conn.execute(
        """
        UPDATE inventory
        SET in_stock = ?, low_stock_threshold = ?, notes = ?, updated_at = ?
        WHERE id = ?
        """,
        (new_stock, new_threshold, new_notes, to_iso(current_time), inventory_id),
    )
    conn.commit()
    return build_dashboard(conn, current_time)


def update_settings(
    conn: sqlite3.Connection, req: SettingsUpdateRequest
) -> dict[str, str]:
    updates: dict[str, str] = {}
    if req.robot_name is not None:
        updates["robot_name"] = req.robot_name.strip() or "Deebot T90 PRO OMNI"
    if req.webhook_url is not None:
        updates["webhook_url"] = req.webhook_url.strip()
    if req.webhook_type is not None:
        updates["webhook_type"] = req.webhook_type
    if req.pushover_token is not None:
        updates["pushover_token"] = req.pushover_token.strip()
    if req.pushover_user is not None:
        updates["pushover_user"] = req.pushover_user.strip()
    if req.notifications_enabled is not None:
        updates["notifications_enabled"] = "true" if req.notifications_enabled else "false"

    for key, value in updates.items():
        conn.execute(
            """
            INSERT INTO settings (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, value),
        )
    conn.commit()
    return get_settings_dict(conn)


def _detect_webhook_type(url: str, configured_type: str) -> str:
    if configured_type != "auto":
        return configured_type
    lower = url.lower()
    if "discord.com/api/webhooks" in lower or "discordapp.com/api/webhooks" in lower:
        return "discord"
    if "api.pushover.net" in lower:
        return "pushover"
    if "/message" in lower and "token=" in lower:
        return "gotify"
    if "/api/webhook/" in lower:
        return "home_assistant"
    return "generic"


async def send_webhook_notification(
    settings: dict[str, str],
    dashboard: dict[str, Any],
    override: Optional[TestWebhookRequest] = None,
    is_test: bool = False,
) -> dict[str, Any]:
    url = (
        override.webhook_url.strip()
        if override and override.webhook_url is not None
        else settings.get("webhook_url", "")
    )
    if not url:
        raise HTTPException(status_code=400, detail="Webhook URL is not configured")

    configured_type = (
        override.webhook_type
        if override and override.webhook_type is not None
        else settings.get("webhook_type", "auto")
    )
    provider = _detect_webhook_type(url, configured_type)
    pushover_token = (
        override.pushover_token
        if override and override.pushover_token is not None
        else settings.get("pushover_token", "")
    )
    pushover_user = (
        override.pushover_user
        if override and override.pushover_user is not None
        else settings.get("pushover_user", "")
    )

    overdue_tasks = [
        t["name"] for t in dashboard["tasks"] if t["overall_status"] == "overdue"
    ]
    robot_name = dashboard["robot_name"]
    health_score = dashboard["health_score"]
    mood_label = dashboard["mood_label"]

    if is_test:
        title = f"🤖 {robot_name} — Test Alert"
        body = (
            f"Deebot Buddy webhook is connected! Current mood: {mood_label} "
            f"(Health: {health_score}%). Overdue tasks: {len(overdue_tasks)}."
        )
    else:
        title = f"🤖 {robot_name} Needs Attention ({mood_label})"
        joined = ", ".join(overdue_tasks[:5])
        suffix = f" (+{len(overdue_tasks) - 5} more)" if len(overdue_tasks) > 5 else ""
        body = f"Health: {health_score}% | Overdue: {joined}{suffix}"

    async with httpx.AsyncClient(timeout=10.0) as client:
        if provider == "discord":
            color = 0xEF4444 if overdue_tasks and not is_test else 0x10B981
            payload = {
                "username": "Deebot Buddy",
                "content": f"**{title}**\n{body}",
                "embeds": [
                    {
                        "title": title,
                        "description": body,
                        "color": color,
                        "fields": [
                            {
                                "name": "Health Score",
                                "value": f"{health_score}%",
                                "inline": True,
                            },
                            {
                                "name": "Mood",
                                "value": mood_label,
                                "inline": True,
                            },
                            {
                                "name": "Overdue Count",
                                "value": str(len(overdue_tasks)),
                                "inline": True,
                            },
                        ],
                    }
                ],
            }
            resp = await client.post(url, json=payload)
        elif provider == "pushover":
            resp = await client.post(
                url,
                data={
                    "token": pushover_token,
                    "user": pushover_user,
                    "title": title,
                    "message": body,
                },
            )
        elif provider == "gotify":
            resp = await client.post(
                url,
                json={"title": title, "message": body, "priority": 5},
            )
        else:
            resp = await client.post(
                url,
                json={
                    "source": "deebot-buddy",
                    "is_test": is_test,
                    "robot_name": robot_name,
                    "title": title,
                    "message": body,
                    "mood": dashboard["mood"],
                    "mood_label": mood_label,
                    "health_score": health_score,
                    "overdue_tasks": overdue_tasks,
                    "counts": dashboard["counts"],
                },
            )

    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"Webhook returned HTTP {resp.status_code}: {resp.text[:200]}",
        )

    return {"ok": True, "provider": provider, "status_code": resp.status_code}


def export_backup(conn: sqlite3.Connection) -> dict[str, Any]:
    inventory = [
        dict(r)
        for r in conn.execute("SELECT * FROM inventory ORDER BY id ASC").fetchall()
    ]
    tasks = [
        dict(r)
        for r in conn.execute("SELECT * FROM tasks ORDER BY sort_order ASC, id ASC").fetchall()
    ]
    logs = [
        dict(r)
        for r in conn.execute("SELECT * FROM maintenance_logs ORDER BY id ASC").fetchall()
    ]
    settings = get_settings_dict(conn)
    return {
        "version": 1,
        "exported_at": to_iso(now_utc()),
        "inventory": inventory,
        "tasks": tasks,
        "maintenance_logs": logs,
        "settings": settings,
    }


def import_backup(conn: sqlite3.Connection, payload: BackupPayload) -> dict[str, Any]:
    if not payload.tasks:
        raise HTTPException(status_code=400, detail="Backup payload contains no tasks")

    try:
        conn.execute("BEGIN")
        conn.execute("DELETE FROM maintenance_logs")
        conn.execute("DELETE FROM tasks")
        conn.execute("DELETE FROM inventory")
        conn.execute("DELETE FROM settings")

        for item in payload.inventory:
            conn.execute(
                """
                INSERT INTO inventory (
                    id, slug, name, unit_label, in_stock, low_stock_threshold, notes, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["id"],
                    item["slug"],
                    item["name"],
                    item.get("unit_label", "units"),
                    max(0, int(item.get("in_stock", 0))),
                    max(0, int(item.get("low_stock_threshold", 1))),
                    item.get("notes", ""),
                    item.get("updated_at", to_iso(now_utc())),
                ),
            )

        for task in payload.tasks:
            conn.execute(
                """
                INSERT INTO tasks (
                    id, slug, name, location, sort_order,
                    clean_interval_days, replace_interval_days,
                    last_cleaned_at, last_replaced_at,
                    clean_due_override, replace_due_override,
                    inventory_id, is_critical_water, instructions, icon
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task["id"],
                    task["slug"],
                    task["name"],
                    task["location"],
                    int(task.get("sort_order", 0)),
                    task.get("clean_interval_days"),
                    task.get("replace_interval_days"),
                    task.get("last_cleaned_at"),
                    task.get("last_replaced_at"),
                    task.get("clean_due_override"),
                    task.get("replace_due_override"),
                    task.get("inventory_id"),
                    int(task.get("is_critical_water", 0)),
                    task.get("instructions", ""),
                    task.get("icon", "wrench"),
                ),
            )

        for log in payload.maintenance_logs:
            conn.execute(
                """
                INSERT INTO maintenance_logs (
                    id, task_id, action_type, performed_at, notes,
                    prev_last_cleaned_at, prev_last_replaced_at,
                    prev_clean_due_override, prev_replace_due_override,
                    stock_decremented, created_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    log["id"],
                    log["task_id"],
                    log["action_type"],
                    log["performed_at"],
                    log.get("notes", ""),
                    log.get("prev_last_cleaned_at"),
                    log.get("prev_last_replaced_at"),
                    log.get("prev_clean_due_override"),
                    log.get("prev_replace_due_override"),
                    int(log.get("stock_decremented", 0)),
                    log.get("created_at", log["performed_at"]),
                ),
            )

        for key, value in payload.settings.items():
            conn.execute(
                "INSERT INTO settings (key, value) VALUES (?, ?)",
                (str(key), str(value)),
            )

        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Invalid backup payload: {exc}") from exc

    return build_dashboard(conn)
