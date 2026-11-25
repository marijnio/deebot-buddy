"""SQLite connection management, schema initialization, and idempotent seeding."""

from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from backend.seed_data import DEFAULT_SETTINGS, INITIAL_INVENTORY, INITIAL_TASKS

DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "data" / "deebot.db"


def get_db_path() -> Path:
    raw = os.environ.get("DEEBOT_DB_PATH")
    path = Path(raw) if raw else DEFAULT_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(str(get_db_path()), timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn


def init_db() -> None:
    conn = get_connection()
    try:
        conn.execute("PRAGMA journal_mode = WAL;")
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                unit_label TEXT NOT NULL DEFAULT 'units',
                in_stock INTEGER NOT NULL DEFAULT 0 CHECK (in_stock >= 0),
                low_stock_threshold INTEGER NOT NULL DEFAULT 1 CHECK (low_stock_threshold >= 0),
                notes TEXT NOT NULL DEFAULT '',
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS tasks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                slug TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                location TEXT NOT NULL CHECK (location IN ('Robot', 'OMNI Station', 'Both')),
                sort_order INTEGER NOT NULL DEFAULT 0,
                clean_interval_days INTEGER NULL,
                replace_interval_days INTEGER NULL,
                last_cleaned_at TEXT NULL,
                last_replaced_at TEXT NULL,
                clean_due_override TEXT NULL,
                replace_due_override TEXT NULL,
                inventory_id INTEGER NULL REFERENCES inventory(id) ON DELETE SET NULL,
                is_critical_water INTEGER NOT NULL DEFAULT 0,
                instructions TEXT NOT NULL,
                icon TEXT NOT NULL DEFAULT 'wrench'
            );

            CREATE TABLE IF NOT EXISTS maintenance_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
                action_type TEXT NOT NULL CHECK (action_type IN ('CLEAN', 'REPLACE')),
                performed_at TEXT NOT NULL,
                notes TEXT NOT NULL DEFAULT '',
                prev_last_cleaned_at TEXT NULL,
                prev_last_replaced_at TEXT NULL,
                prev_clean_due_override TEXT NULL,
                prev_replace_due_override TEXT NULL,
                stock_decremented INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_logs_task_performed
                ON maintenance_logs (task_id, performed_at DESC, id DESC);
            """
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        seed_if_empty(conn, now_iso)
        conn.commit()
    finally:
        conn.close()


def seed_if_empty(conn: sqlite3.Connection, now_iso: str) -> None:
    """Seed inventory, tasks, and default settings if tasks table is empty."""
    task_count = conn.execute("SELECT COUNT(*) FROM tasks").fetchone()[0]
    if task_count == 0:
        for item in INITIAL_INVENTORY:
            conn.execute(
                """
                INSERT OR IGNORE INTO inventory
                    (slug, name, unit_label, in_stock, low_stock_threshold, notes, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    item["slug"],
                    item["name"],
                    item["unit_label"],
                    item["in_stock"],
                    item["low_stock_threshold"],
                    item["notes"],
                    now_iso,
                ),
            )

        slug_to_inv_id = {
            row["slug"]: row["id"]
            for row in conn.execute("SELECT id, slug FROM inventory").fetchall()
        }

        for task in INITIAL_TASKS:
            inv_id = (
                slug_to_inv_id.get(task["inventory_slug"])
                if task["inventory_slug"]
                else None
            )
            last_cleaned = now_iso if task["clean_interval_days"] is not None else None
            last_replaced = now_iso if task["replace_interval_days"] is not None else None

            conn.execute(
                """
                INSERT OR IGNORE INTO tasks (
                    slug, name, location, sort_order,
                    clean_interval_days, replace_interval_days,
                    last_cleaned_at, last_replaced_at,
                    inventory_id, is_critical_water, instructions, icon
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    task["slug"],
                    task["name"],
                    task["location"],
                    task["sort_order"],
                    task["clean_interval_days"],
                    task["replace_interval_days"],
                    last_cleaned,
                    last_replaced,
                    inv_id,
                    task["is_critical_water"],
                    task["instructions"],
                    task["icon"],
                ),
            )

    for key, value in DEFAULT_SETTINGS.items():
        conn.execute(
            "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
            (key, value),
        )
