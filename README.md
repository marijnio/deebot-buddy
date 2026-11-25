# Deebot Buddy — Maintenance Tracker for ECOVACS DEEBOT T90 PRO OMNI

A lightweight, self-hosted, single-container web app designed for **Synology NAS** (Container Manager / Docker) to track cleaning, part replacements, care instructions, and spare parts inventory for the **ECOVACS DEEBOT T90 PRO OMNI** and its OMNI station.

## Features
- **Dynamic Robot Mascot (4 Moods):** Custom inline SVG illustrations that reflect your robot's real-time maintenance state:
  - **Sparkling & Happy:** All tasks `< 75%` elapsed
  - **Content & Ready:** Any task `75%–99%` elapsed
  - **Dusty & Tangled:** `1+` tasks overdue
  - **Needs Rescue (Dramatic Faint):** `3+` tasks overdue or **Dirty Water Tank** overdue
- **Dual-Track Maintenance Engine:** Every component tracks **Clean / Check** and **Replace Part** cycles independently. Cleaning resets only the clean timer; replacing resets both timers and decrements your spare parts inventory.
- **14 Pre-Seeded T90 PRO OMNI Components:** Automatically initialized in SQLite (`/app/data/deebot.db`) on first boot with exact T90 PRO OMNI care instructions (including roller mop housing release and 24h filter air-dry reminders).
- **Spare Parts Inventory:** Track dust bags, filters, roller mops, main brush, side brushes, and ECOVACS cleaning solution with **"Low Stock — Reorder Buddy Kit"** alerts.
- **Backdating, Snooze & Undo:** Log maintenance you did days ago, snooze upcoming tasks, customize intervals, or undo an accidental click.
- **Dark / Light Mode, Webhooks & JSON Backups:** Built-in theme toggle, webhook test & alert formatting (Discord, Pushover, Gotify, Home Assistant), and 1-click JSON export/import.

---

## Quick Deploy on Synology NAS (Container Manager)

1. Open **File Station** on your Synology DSM and create the persistent data folder:
   ```
   /volume1/docker/deebot-buddy/data
   ```
2. Copy this repository onto your NAS (for example `/volume1/docker/deebot-buddy/app`).
3. Open **Container Manager** -> **Project** -> **Create**:
   - **Project name:** `deebot-buddy`
   - **Path:** `/volume1/docker/deebot-buddy/app`
   - **Source:** Use existing `docker-compose.yml`
   - Optionally adjust `TZ` in `docker-compose.yml` to your local timezone (e.g. `America/New_York`, `Europe/London`).
4. Build and start the project.
5. Open your browser to `http://<your-synology-ip>:8080`.

Your SQLite database is persisted at `/volume1/docker/deebot-buddy/data/deebot.db`, so container updates never lose your maintenance history.

---

## Local Development

### Backend (FastAPI + SQLite)
```bash
python3.12 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8080
```

### Frontend (Vite + React + Tailwind CSS)
```bash
cd frontend
npm install
npm run dev
```
The Vite dev server runs on `http://localhost:5173` and proxies `/api` requests to `http://127.0.0.1:8080`.

For a single-server production build:
```bash
cd frontend && npm run build
cd .. && uvicorn backend.main:app --host 0.0.0.0 --port 8080
```

---

## Customizing the Mascot SVGs

The 4 robot mascot illustrations live as standalone, designer-friendly `.svg` files in [`mascots/`](mascots/):
- `mascots/happy.svg`
- `mascots/normal.svg`
- `mascots/dusty.svg`
- `mascots/faint.svg`

Open any of them in Figma, Illustrator, Affinity Designer, or Inkscape, save your changes back to `mascots/`, and click **Preview moods -> Reload SVG** in the app (or refresh your browser) — no frontend rebuild required. See [`mascots/README.md`](mascots/README.md) for layer structure and Synology NAS override instructions (`/volume1/docker/deebot-buddy/data/mascots/`).

---

## Webhook Alerts Setup
In **Settings** (top-right gear icon), paste a webhook URL and click **Test Hook**:
- **Discord:** `https://discord.com/api/webhooks/...` (auto-detected, sends rich embed)
- **Pushover:** `https://api.pushover.net/1/messages.json` + App Token & User Key
- **Gotify:** `https://gotify.example.com/message?token=YOUR_APP_TOKEN`
- **Home Assistant / Generic:** Any webhook endpoint accepting JSON payloads

You can also trigger overdue checks from a Synology Task Scheduler or cron job via:
```bash
curl -X POST http://localhost:8080/api/notifications/check
```
