# Deploy the bot always-on

Goal: keep the paper-trading backend running **24/7 in the cloud** so it keeps
scanning, trading, and (most importantly) **letting markets resolve** even when
your Mac is off. The longer it runs, the more resolved markets you accumulate —
and resolved markets are the only thing that tells you whether a strategy
actually works.

Still **paper-only**. Deploying changes nothing about safety: no wallet, no
keys, no real money, even in the cloud.

---

## What you need first

1. A **GitHub account**, with this project pushed to a repo. From the project
   root (`polymarket-dashboard/`):

   ```bash
   git init
   git add .
   git commit -m "Polymarket paper-trading bot + dashboard"
   # create an empty repo on github.com, then:
   git remote add origin https://github.com/<you>/polymarket-dashboard.git
   git push -u origin main
   ```

   `.gitignore` already excludes `node_modules`, the SQLite db, and `.env`.

2. A **Render account** (render.com) — free to sign up. The always-on instance
   is a paid plan (**~$7/mo**) plus a 1 GB disk (~$0.25/mo). The free plan sleeps
   when idle, which would pause trading, so it's not suitable for "always on".

---

## Option A — one-click blueprint (easiest)

This repo ships a `render.yaml`. In Render:

1. **New ▸ Blueprint**, pick your GitHub repo, approve.
2. Render reads `render.yaml` and proposes two services:
   - **polymarket-paper-bot** — the backend (Docker, always-on, 1 GB disk).
   - **polymarket-dashboard** — the static dashboard.
3. Click **Apply**. The backend builds and starts trading automatically
   (`AUTO_START=true`).
4. When the backend is live, copy its URL (e.g.
   `https://polymarket-paper-bot.onrender.com`). Open the **dashboard** service ▸
   **Environment**, set:
   ```
   VITE_BOT_API = https://polymarket-paper-bot.onrender.com/api
   ```
   and **Manual Deploy** the dashboard so the value is baked in.
5. Open the dashboard URL. Done — it's live and always on.

---

## Option B — manual, no YAML (most beginner-proof)

Backend:

1. **New ▸ Web Service**, connect the repo.
2. **Root Directory:** `server` · **Runtime:** Docker.
3. **Instance Type:** Starter (or higher) — *not* Free (Free sleeps).
4. **Advanced ▸ Add Disk:** name `data`, **Mount Path** `/app/data`, size 1 GB.
5. **Environment:** `AUTO_START=true`, `CORS_ORIGIN=*`.
6. **Create Web Service.** Wait for "Live", then visit `/<url>/api/health` — you
   should see `{"ok":true,...}`.

Dashboard:

1. **New ▸ Static Site**, same repo, **Root Directory:** *(blank / repo root)*.
2. **Build Command:** `npm install && npm run build` · **Publish Directory:** `dist`.
3. **Environment:** `VITE_BOT_API = https://<your-backend>.onrender.com/api`.
4. Add a rewrite rule: **Redirects/Rewrites** ▸ Source `/*` ▸ Destination
   `/index.html` ▸ Rewrite (so client-side routing works).
5. **Create Static Site**, open the URL.

---

## After it's up

- **Tighten CORS (optional):** set the backend's `CORS_ORIGIN` to your exact
  dashboard URL instead of `*`, then redeploy.
- **Check it's trading:** the dashboard's Activity feed and the equity curve
  update; `/api/snapshot` shows positions/trades growing.
- **Let it run.** A trustworthy read on the strategies needs ~100+ *resolved*
  markets — roughly a month or two of continuous running. Until then the numbers
  are a sanity check, not a verdict.
- **Reset anytime:** `POST https://<backend>/api/reset` wipes paper history back
  to the starting bankroll.

## Other hosts

Any host that runs a Node 22 container with a persistent volume works the same
way — **Railway** (volume at `/app/data`), **Fly.io** (`fly volumes create`), or
a small **VPS** (`npm ci && npm start` behind a process manager). Render is just
the most click-through-friendly. The only requirements are Node 22+ and a
persistent path for `data/`.
