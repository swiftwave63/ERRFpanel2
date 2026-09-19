<div align="center">

<img src="static/img/errf-logo.svg" width="110" alt="ERRFpanel logo">

# ERRFpanel v1.5.5

### Single-service VLESS / VMess panel with Liquid Glass UI
**FastAPI + Xray-core in one container, local JSON storage, bilingual FA/EN**

</div>

---

## What it is

ERRFpanel is a single-service management panel for VLESS and VMess over WebSocket / XHTTP with TLS.
The backend (`main.py`, FastAPI) manages users, generates Xray config, restarts Xray, collects traffic stats from the Xray stats API, and serves subscriptions. All persistent state lives in one local file: `data/db.json`.

Repository: `https://github.com/errf21/ERRFpanel2`

---

## Features (as implemented)

- **No external database** — everything in `data/db.json` (admin, settings, inbounds, stats, login attempts).
- **One-time setup** — first visit to `/setup` creates the admin username/password.
- **Session auth** — `httponly` session cookie, PBKDF2 password hashing, login rate-limit with temporary lockout.
- **Dashboard** — CPU, memory, uptime, total up/down traffic, 24-hour traffic chart, active connections (recent-traffic based), server location, inbound count.
- **User / inbound management** — create, list, edit, delete; per-user `name`, `quota_gb`, `expire_days`, `max_connections`, `max_requests`, `fp` (fingerprint), `strict_single_ip`, `note`.
- **Usage controls** — quota (GB), expiry date, max active connections, max requests, enable/disable, usage reset.
- **Link revocation** — regenerate UUID per user to instantly invalidate old links.
- **Generated configs** — VLESS WS TLS (port 443, `/vl-ws`), VMess WS TLS (`/vm-ws`), VLESS XHTTP TLS (`/vl-xhttp`); QR code for the TLS link.
- **Subscription output** — `/sub/<uid>` returns base64 plain text plus `Subscription-Userinfo` header; `/sub/<uid>/json` returns JSON.
- **Public status page** — `/status/<uid>` (HTML) and `/api/status/<uid>` (JSON, read-only usage/quota/expiry/connections).
- **Global settings** — `lang` (fa/en), `theme` (dark/light), `public_domain`, `keep_alive`, `default_fingerprint` (chrome/ios/firefox/edge/random), `default_alpn`, `sni_override`, `fragment_enabled`, `fragment_packets`, `fragment_length`, `fragment_interval`, `sub_header_text`, `remark_prefix`, `remark_template`.
- **In-panel OTA update** — check GitHub releases and self-update from `errf21/ERRFpanel2`; the `data/` directory is never overwritten.
- **DoH proxy** — `/dns-query` (GET/POST/OPTIONS) forwarded to `1.1.1.1` / `8.8.8.8`.
- **Liquid Glass UI** — dark/light themes, bilingual Persian/English, self-hosted Vazirmatn fonts, responsive layout, background music player, Telegram support button.
- **Health / stats** — `/health`, `/stats` (authenticated).

---

## Quick start

### Local run

```bash
git clone https://github.com/errf21/ERRFpanel2
cd ERRFpanel2
pip install -r requirements.txt
python main.py
# → http://localhost:10000/setup (or PANEL_PORT if set)
```

### Docker

```bash
docker build -t errfpanel .
docker run -p 8000:8000 errfpanel
# public port comes from PORT (default 8000 in entrypoint.sh)
# internal panel port comes from PANEL_PORT (default 10000)
```

### Railway

- Push/fork this repository.
- New Project → Deploy from GitHub repo.
- Railway uses `railway.json` (`bash /app/entrypoint.sh`).
- After deploy, open the service URL + `/setup`.

### Render

- Push/fork to GitHub.
- New → Web Service → connect the repo; `render.yaml` is detected.
- After deploy, open the service URL + `/setup`.

---

## Initial setup

1. Open `<your-domain>/setup`.
2. Create admin username (letters/numbers/underscore, 3–32 chars) and password (min 6 chars).
3. Sign in at `/login`, open the dashboard at `/dashboard`.
4. Create users under Inbounds.
5. Tune defaults under Settings → Advanced Config Settings.

---

## Environment variables (as implemented)

| Variable | Default | Notes |
|----------|---------|-------|
| `PORT` | `8000` | Public Nginx port (see `entrypoint.sh`). |
| `PANEL_PORT` | `10000` | Internal FastAPI panel port (`main.py`). |

Persistent data: `data/db.json` (created on first run with a generated `secret_key`).

---

## API routes (as implemented in `main.py`)

### Pages

| Route | Method | Notes |
|-------|--------|-------|
| `/` | GET | Redirects to `/setup`, `/login`, or `/dashboard`. |
| `/setup` | GET | Initial admin creation page. |
| `/login` | GET | Admin login page. |
| `/dashboard` | GET | Main panel (requires login). |
| `/status/{uid}` | GET | Public read-only status page. |

### Auth / account

| Route | Method | Notes |
|-------|--------|-------|
| `/api/setup-status` | GET | `{needs_setup}`. |
| `/api/setup` | POST | Create admin (once). Sets session cookie. |
| `/api/login` | POST | Username/password login. Sets session cookie. |
| `/api/logout` | POST | Clears session cookie. |
| `/api/me` | GET | Login state, username, settings, app version. |
| `/api/change-password` | POST | Auth required. Change username/password. |
| `/api/settings` | POST | Auth required. Update allowed settings keys. |

### Inbounds / users

| Route | Method | Notes |
|-------|--------|-------|
| `/api/inbounds` | GET | Auth required. List inbounds. |
| `/api/inbounds` | POST | Auth required. Create inbound. |
| `/api/inbounds/{uid}` | PATCH | Auth required. Edit inbound. |
| `/api/inbounds/{uid}` | DELETE | Auth required. Delete inbound. |
| `/api/inbounds/{uid}/reset-usage` | POST | Auth required. Reset usage counters. |
| `/api/inbounds/{uid}/regenerate` | POST | Auth required. Rotate UUID (revoke old links). |
| `/api/inbounds/{uid}/links` | GET | Auth required. TLS link, all links, sub/status/DoH URLs. |
| `/api/inbounds/{uid}/qr` | GET | Auth required. QR PNG for TLS link. |
| `/api/inbounds/{uid}/sub` | GET | Auth required. Alias of subscription JSON. |

### Subscriptions / public status

| Route | Method | Notes |
|-------|--------|-------|
| `/sub/{uid}` | GET | Public base64 plain-text subscription. |
| `/sub/{uid}/json` | GET | Public subscription JSON. |
| `/api/status/{uid}` | GET | Public status JSON. |

### System / services

| Route | Method | Notes |
|-------|--------|-------|
| `/health` | GET | Liveness check. |
| `/stats` | GET | Auth required. CPU/RAM/uptime/traffic/hourly/location. |
| `/dns-query` | GET/POST/OPTIONS | DNS-over-HTTPS proxy. |
| `/api/ota/check` | GET | Auth required. Compare current vs latest release. |
| `/api/ota/update` | POST | Auth required. Download release zip, apply, restart. |

> Authenticated routes use the session cookie set by `/api/setup` and `/api/login`.

---

## Security notes

- Choose a strong admin password.
- `data/db.json` contains all sensitive state; do not expose it directly (it is not routed).
- If a subscription link leaks, use Regenerate (UUID rotation) for that user.
- Use HTTPS in production (platform ingress / reverse proxy).

---

## License and attribution

- This project is released under the **MIT** License (see `LICENSE`).
- Font **Vazirmatn** under SIL Open Font License 1.1 (see `static/fonts/LICENSE-vazirmatn.txt`).
- App artwork in `static/img/` is AI-generated for this project (see `static/img/LICENSE-assets.txt`).
- Core proxying uses **Xray-core** (see `Dockerfile` / `xray_manager.py`).

---

<div align="center">**ERRFpanel** — Liquid Glass VLESS / VMess panel</div>
