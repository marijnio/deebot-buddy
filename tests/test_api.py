"""Comprehensive API and domain tests for Deebot Buddy."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from backend import services
from backend.database import get_connection, init_db
from backend.main import app


@pytest.fixture()
def client(tmp_path, monkeypatch):
    db_file = tmp_path / "test_deebot.db"
    monkeypatch.setenv("DEEBOT_DB_PATH", str(db_file))
    with TestClient(app) as c:
        yield c


def test_auto_seed_and_idempotency(client):
    res = client.get("/api/dashboard")
    assert res.status_code == 200
    data = res.json()

    assert len(data["tasks"]) == 14
    assert len(data["inventory"]) == 6
    assert data["mood"] == "happy"
    assert data["health_score"] >= 90

    slugs = {t["slug"] for t in data["tasks"]}
    assert "dirty_water_tank" in slugs
    assert "washable_roller_mop" in slugs
    assert "antibacterial_dust_bag" in slugs

    # Main brush starts at 1 in stock with threshold 1 -> low stock badge active
    main_brush_inv = next(
        i for i in data["inventory"] if i["slug"] == "main_brush"
    )
    assert main_brush_inv["in_stock"] == 1
    assert main_brush_inv["is_low_stock"] is True

    # Cleaning solution starts at 1 bottle with threshold 0 (not low stock, non-official)
    solution_inv = next(
        i for i in data["inventory"] if i["slug"] == "cleaning_solution"
    )
    assert solution_inv["name"] == "Cleaning Solution"
    assert solution_inv["in_stock"] == 1
    assert solution_inv["low_stock_threshold"] == 0
    assert solution_inv["is_low_stock"] is False
    assert "official" not in solution_inv["notes"].lower()

    solution_task = next(
        t for t in data["tasks"] if t["slug"] == "cleaning_solution_reservoir"
    )
    assert "official" not in solution_task["instructions"].lower()

    # Calling init_db again should not duplicate rows
    init_db()
    res2 = client.get("/api/dashboard")
    assert len(res2.json()["tasks"]) == 14
    assert len(res2.json()["inventory"]) == 6


def test_dual_track_clean_vs_replace_and_undo(client):
    dash = client.get("/api/dashboard").json()
    roller_task = next(
        t for t in dash["tasks"] if t["slug"] == "washable_roller_mop"
    )
    task_id = roller_task["id"]
    initial_stock = roller_task["inventory"]["in_stock"]
    initial_replace_last = roller_task["replace_cycle"]["last_at"]

    # Backdate a CLEAN action 5 days ago -> clean updates, replace & stock stay untouched
    five_days_ago = (datetime.now(timezone.utc) - timedelta(days=5)).isoformat()
    clean_res = client.post(
        f"/api/tasks/{task_id}/complete",
        json={
            "action_type": "CLEAN",
            "performed_at": five_days_ago,
            "notes": "Deep cleaned housing",
        },
    )
    assert clean_res.status_code == 200
    clean_payload = clean_res.json()
    assert clean_payload["stock_decremented"] is False

    updated_roller = next(
        t
        for t in clean_payload["dashboard"]["tasks"]
        if t["id"] == task_id
    )
    assert updated_roller["inventory"]["in_stock"] == initial_stock
    assert updated_roller["replace_cycle"]["last_at"] == initial_replace_last
    assert updated_roller["clean_cycle"]["percent_elapsed"] > 30.0

    # Now log REPLACE -> updates BOTH clean and replace timers, leaves stock untouched
    replace_res = client.post(
        f"/api/tasks/{task_id}/complete",
        json={"action_type": "REPLACE", "notes": "Installed fresh roller"},
    )
    assert replace_res.status_code == 200
    replace_payload = replace_res.json()
    assert replace_payload["stock_decremented"] is False
    replace_log_id = replace_payload["log_id"]

    after_replace = next(
        t
        for t in replace_payload["dashboard"]["tasks"]
        if t["id"] == task_id
    )
    assert after_replace["inventory"]["in_stock"] == initial_stock
    assert after_replace["clean_cycle"]["percent_elapsed"] < 5.0
    assert after_replace["replace_cycle"]["percent_elapsed"] < 5.0

    # Undo the REPLACE log -> restores prior clean/replace timestamps and leaves stock untouched
    undo_res = client.delete(f"/api/logs/{replace_log_id}")
    assert undo_res.status_code == 200
    after_undo = next(
        t for t in undo_res.json()["dashboard"]["tasks"] if t["id"] == task_id
    )
    assert after_undo["inventory"]["in_stock"] == initial_stock
    assert after_undo["replace_cycle"]["last_at"] == initial_replace_last
    assert after_undo["clean_cycle"]["percent_elapsed"] > 30.0


def test_mood_transitions_across_all_four_states(client):
    conn = get_connection()
    try:
        now = services.now_utc()

        # 1. Happy: fresh seed
        d1 = services.build_dashboard(conn, now)
        assert d1["mood"] == "happy"

        # 2. Normal: push one non-critical task to ~85% elapsed (Clean Water Tank: 30d -> 25.5d ago)
        clean_water_last = services.to_iso(now - timedelta(days=25, hours=12))
        conn.execute(
            "UPDATE tasks SET last_cleaned_at = ? WHERE slug = 'clean_water_tank'",
            (clean_water_last,),
        )
        conn.commit()
        d2 = services.build_dashboard(conn, now)
        assert d2["mood"] == "normal"

        # 3. Dusty: 1 non-critical task overdue (Drip Tray: 7d -> 9d ago)
        conn.execute(
            "UPDATE tasks SET last_cleaned_at = ? WHERE slug = 'drip_tray'",
            (services.to_iso(now - timedelta(days=9)),),
        )
        conn.commit()
        d3 = services.build_dashboard(conn, now)
        assert d3["mood"] == "dusty"
        assert d3["counts"]["overdue"] == 1

        # 4a. Faint via 3+ tasks overdue
        conn.execute(
            "UPDATE tasks SET last_cleaned_at = ? WHERE slug IN ('mop_washing_trays', 'side_brush')",
            (services.to_iso(now - timedelta(days=20)),),
        )
        conn.commit()
        d4 = services.build_dashboard(conn, now)
        assert d4["mood"] == "faint"
        assert d4["counts"]["overdue"] >= 3

        # Reset those 3 and verify 4b. Faint via Dirty Water Tank alone overdue
        conn.execute(
            "UPDATE tasks SET last_cleaned_at = ? WHERE slug IN ('drip_tray', 'mop_washing_trays', 'side_brush')",
            (services.to_iso(now),),
        )
        conn.execute(
            "UPDATE tasks SET last_cleaned_at = ? WHERE slug = 'dirty_water_tank'",
            (services.to_iso(now - timedelta(days=4)),),
        )
        conn.commit()
        d5 = services.build_dashboard(conn, now)
        assert d5["dirty_water_overdue"] is True
        assert d5["mood"] == "faint"
        assert 0 <= d5["health_score"] <= 100
    finally:
        conn.close()


def test_task_snooze_inventory_settings_and_backup_roundtrip(client):
    dash = client.get("/api/dashboard").json()
    dirty_tank = next(
        t for t in dash["tasks"] if t["slug"] == "dirty_water_tank"
    )

    # Snooze clean by 2 days & change interval to 4 days
    patch_res = client.patch(
        f"/api/tasks/{dirty_tank['id']}",
        json={"clean_interval_days": 4, "snooze_clean_days": 2},
    )
    assert patch_res.status_code == 200
    updated = next(
        t for t in patch_res.json()["tasks"] if t["id"] == dirty_tank["id"]
    )
    assert updated["clean_cycle"]["interval_days"] == 4
    assert updated["clean_cycle"]["is_override"] is True
    assert updated["clean_cycle"]["days_remaining"] >= 4.9

    # Adjust inventory +/-
    dust_bags = next(i for i in dash["inventory"] if i["slug"] == "dust_bags")
    inv_res = client.patch(
        f"/api/inventory/{dust_bags['id']}",
        json={"delta": -2},
    )
    assert inv_res.status_code == 200
    updated_bags = next(
        i for i in inv_res.json()["inventory"] if i["id"] == dust_bags["id"]
    )
    assert updated_bags["in_stock"] == 1
    assert updated_bags["is_low_stock"] is True

    # Settings save
    settings_res = client.post(
        "/api/settings",
        json={
            "robot_name": "Rosie T90",
            "webhook_url": "https://example.com/hook",
            "webhook_type": "generic",
            "notifications_enabled": True,
        },
    )
    assert settings_res.status_code == 200
    assert settings_res.json()["robot_name"] == "Rosie T90"
    assert settings_res.json()["notifications_enabled"] is True

    # Export and re-import JSON backup
    backup = client.get("/api/export").json()
    assert backup["settings"]["robot_name"] == "Rosie T90"

    # Mutate robot_name, then restore backup
    client.post("/api/settings", json={"robot_name": "Temp Name"})
    imp_res = client.post("/api/import", json=backup)
    assert imp_res.status_code == 200
    assert imp_res.json()["robot_name"] == "Rosie T90"


def test_mascots_endpoint_and_override(client, tmp_path):
    for mood in ("happy", "normal", "dusty", "faint"):
        res = client.get(f"/mascots/{mood}.svg")
        assert res.status_code == 200
        assert "image/svg+xml" in res.headers["content-type"]
        assert "no-cache" in res.headers.get("cache-control", "")
        assert "<svg" in res.text

    assert client.get("/mascots/nonexistent.svg").status_code == 404
    assert client.get("/mascots/happy.png").status_code == 404

    override_dir = tmp_path / "mascots"
    override_dir.mkdir(parents=True, exist_ok=True)
    custom_svg = '<svg xmlns="http://www.w3.org/2000/svg" id="custom-override"></svg>'
    (override_dir / "happy.svg").write_text(custom_svg, encoding="utf-8")

    override_res = client.get("/mascots/happy.svg")
    assert override_res.status_code == 200
    assert "custom-override" in override_res.text


def test_mark_single_task_due_now(client):
    dash = client.get("/api/dashboard").json()
    assert dash["counts"]["total_logs"] == 0

    clean_tank = next(t for t in dash["tasks"] if t["slug"] == "clean_water_tank")
    assert clean_tank["clean_cycle"]["has_log"] is False

    # Flag single task as due now without creating any log entry
    flag_res = client.patch(
        f"/api/tasks/{clean_tank['id']}",
        json={"mark_clean_due": True},
    )
    assert flag_res.status_code == 200
    flagged_dash = flag_res.json()
    assert flagged_dash["counts"]["total_logs"] == 0
    flagged_task = next(
        t for t in flagged_dash["tasks"] if t["id"] == clean_tank["id"]
    )
    assert flagged_task["overall_status"] == "overdue"
    assert flagged_task["clean_cycle"]["is_override"] is True
    assert flagged_task["clean_cycle"]["has_log"] is False

    # Completing CLEAN clears the override and marks has_log=True
    done_res = client.post(
        f"/api/tasks/{clean_tank['id']}/complete",
        json={"action_type": "CLEAN", "notes": "Rinsed tank"},
    )
    assert done_res.status_code == 200
    done_dash = done_res.json()["dashboard"]
    assert done_dash["counts"]["total_logs"] == 1
    done_task = next(
        t for t in done_dash["tasks"] if t["id"] == clean_tank["id"]
    )
    assert done_task["overall_status"] == "ok"
    assert done_task["clean_cycle"]["is_override"] is False
    assert done_task["clean_cycle"]["has_log"] is True


def test_bulk_flag_tasks_scopes_and_only_unlogged(client):
    # Log one task first so we can verify only_unlogged later
    dash = client.get("/api/dashboard").json()
    drip_tray = next(t for t in dash["tasks"] if t["slug"] == "drip_tray")
    client.post(
        f"/api/tasks/{drip_tray['id']}/complete",
        json={"action_type": "CLEAN"},
    )

    # 1. Flag all unlogged clean_and_bag cycles as due_soon -> should skip drip_tray
    due_soon_res = client.post(
        "/api/tasks/bulk-flag",
        json={
            "scope": "clean_and_bag",
            "urgency": "due_soon",
            "only_unlogged": True,
        },
    )
    assert due_soon_res.status_code == 200
    due_soon_payload = due_soon_res.json()
    assert due_soon_payload["flagged_cycles"] == 13
    d1 = due_soon_payload["dashboard"]
    assert d1["mood"] == "normal"
    drip_after = next(t for t in d1["tasks"] if t["id"] == drip_tray["id"])
    assert drip_after["overall_status"] == "ok"

    # 2. Flag all clean_and_bag cycles (including logged) as overdue -> all 14 tasks overdue -> faint
    overdue_res = client.post(
        "/api/tasks/bulk-flag",
        json={
            "scope": "clean_and_bag",
            "urgency": "overdue",
            "only_unlogged": False,
        },
    )
    assert overdue_res.status_code == 200
    overdue_payload = overdue_res.json()
    assert overdue_payload["flagged_cycles"] == 14
    d2 = overdue_payload["dashboard"]
    assert d2["counts"]["overdue"] == 14
    assert d2["mood"] == "faint"


def test_password_lifecycle_and_route_protection(client, tmp_path, monkeypatch):
    # Initially unprotected
    s0 = client.get("/api/auth/status").json()
    assert s0["password_enabled"] is False
    assert s0["authenticated"] is True
    assert client.get("/api/dashboard").status_code == 200

    # Enable password -> sets signed HttpOnly cookie
    pw_res = client.post("/api/auth/password", json={"new_password": "my-secret-pass"})
    assert pw_res.status_code == 200
    assert pw_res.json()["password_enabled"] is True

    # Authenticated client can still fetch dashboard, but secrets are never leaked
    assert client.get("/api/dashboard").status_code == 200
    settings_json = client.get("/api/settings").json()
    assert "auth_password_hash" not in settings_json
    assert "auth_secret" not in settings_json
    export_json = client.get("/api/export").json()
    assert "auth_password_hash" not in export_json["settings"]
    assert "auth_secret" not in export_json["settings"]

    # Unauthenticated client is blocked on API endpoints, allowed on health/status/mascots
    with TestClient(app) as anon:
        assert anon.get("/api/health").status_code == 200
        st = anon.get("/api/auth/status").json()
        assert st["password_enabled"] is True
        assert st["authenticated"] is False
        assert anon.get("/mascots/happy.svg").status_code == 200

        assert anon.get("/api/dashboard").status_code == 401
        assert anon.get("/api/settings").status_code == 401
        assert anon.get("/api/export").status_code == 401
        assert anon.post("/api/tasks/bulk-flag", json={}).status_code == 401

        # Bearer token works for automation
        assert (
            anon.get(
                "/api/dashboard",
                headers={"Authorization": "Bearer my-secret-pass"},
            ).status_code
            == 200
        )

        # Wrong password rejected
        assert (
            anon.post("/api/auth/login", json={"password": "wrong"}).status_code == 401
        )

        # Correct password sets cookie
        login_res = anon.post(
            "/api/auth/login", json={"password": "my-secret-pass", "remember_me": True}
        )
        assert login_res.status_code == 200
        assert anon.get("/api/dashboard").status_code == 200

        # Changing password via primary client invalidates anon's old session cookie
        upd_res = client.post(
            "/api/auth/password",
            json={"current_password": "my-secret-pass", "new_password": "new-secret-pass"},
        )
        assert upd_res.status_code == 200
        assert anon.get("/api/dashboard").status_code == 401

    # Importing a backup preserves password protection
    assert client.post("/api/import", json=export_json).status_code == 200
    assert client.get("/api/auth/status").json()["password_enabled"] is True

    # Removing password requires current password and unlocks app
    assert (
        client.post(
            "/api/auth/password",
            json={"current_password": "wrong", "new_password": ""},
        ).status_code
        == 401
    )
    rm_res = client.post(
        "/api/auth/password",
        json={"current_password": "new-secret-pass", "new_password": ""},
    )
    assert rm_res.status_code == 200
    assert rm_res.json()["password_enabled"] is False
    with TestClient(app) as anon2:
        assert anon2.get("/api/dashboard").status_code == 200


def test_env_password_override(tmp_path, monkeypatch):
    monkeypatch.setenv("DEEBOT_DB_PATH", str(tmp_path / "env_auth.db"))
    monkeypatch.setenv("DEEBOT_PASSWORD", "env-super-pass")
    with TestClient(app) as c:
        st = c.get("/api/auth/status").json()
        assert st["password_enabled"] is True
        assert st["managed_by_env"] is True
        assert st["authenticated"] is False
        assert c.get("/api/dashboard").status_code == 401

        assert (
            c.post("/api/auth/login", json={"password": "env-super-pass"}).status_code
            == 200
        )
        assert c.get("/api/dashboard").status_code == 200
        # UI password changes blocked when DEEBOT_PASSWORD env var is active
        assert (
            c.post("/api/auth/password", json={"new_password": "other"}).status_code
            == 400
        )


def test_cleaning_solution_low_stock_threshold(client):
    dash = client.get("/api/dashboard").json()
    solution = next(
        i for i in dash["inventory"] if i["slug"] == "cleaning_solution"
    )
    assert solution["in_stock"] == 1
    assert solution["is_low_stock"] is False

    # Decrementing from 1 to 0 triggers low stock
    upd_res = client.patch(
        f"/api/inventory/{solution['id']}",
        json={"delta": -1},
    )
    assert upd_res.status_code == 200
    after = next(
        i for i in upd_res.json()["inventory"] if i["id"] == solution["id"]
    )
    assert after["in_stock"] == 0
    assert after["is_low_stock"] is True


def test_migrate_existing_defaults_idempotent(tmp_path, monkeypatch):
    monkeypatch.setenv("DEEBOT_DB_PATH", str(tmp_path / "legacy_deebot.db"))
    init_db()

    conn = get_connection()
    try:
        conn.execute(
            """
            UPDATE inventory
            SET name = 'Official ECOVACS Cleaning Solution',
                low_stock_threshold = 1,
                notes = 'Use official low-foam ECOVACS floor cleaning solution only'
            WHERE slug = 'cleaning_solution'
            """
        )
        conn.execute(
            """
            UPDATE tasks
            SET instructions = 'Open the station dust collection cover and check the solution tank level; top up with official ECOVACS cleaning solution.'
            WHERE slug = 'cleaning_solution_reservoir'
            """
        )
        conn.commit()
    finally:
        conn.close()

    # Re-running init_db migrates the legacy defaults
    init_db()
    conn = get_connection()
    try:
        inv = conn.execute(
            "SELECT name, low_stock_threshold, notes FROM inventory WHERE slug = 'cleaning_solution'"
        ).fetchone()
        assert inv["name"] == "Cleaning Solution"
        assert inv["low_stock_threshold"] == 0
        assert "official" not in inv["notes"].lower()

        task = conn.execute(
            "SELECT instructions FROM tasks WHERE slug = 'cleaning_solution_reservoir'"
        ).fetchone()
        assert "official" not in task["instructions"].lower()

        # Subsequent user customizations must not be overwritten by init_db()
        conn.execute(
            """
            UPDATE inventory
            SET low_stock_threshold = 2,
                notes = 'My favorite floor cleaner'
            WHERE slug = 'cleaning_solution'
            """
        )
        conn.commit()
    finally:
        conn.close()

    init_db()
    conn = get_connection()
    try:
        inv2 = conn.execute(
            "SELECT low_stock_threshold, notes FROM inventory WHERE slug = 'cleaning_solution'"
        ).fetchone()
        assert inv2["low_stock_threshold"] == 2
        assert inv2["notes"] == "My favorite floor cleaner"
    finally:
        conn.close()


def test_custom_robot_name_in_dashboard_and_mood_subtitle(client):
    save_res = client.post("/api/settings", json={"robot_name": "Sparky"})
    assert save_res.status_code == 200
    assert save_res.json()["robot_name"] == "Sparky"

    dash = client.get("/api/dashboard").json()
    assert dash["robot_name"] == "Sparky"
    assert dash["mood"] == "happy"
    assert "Sparky" in dash["mood_subtitle"]
