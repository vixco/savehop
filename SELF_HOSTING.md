# Self-Hosting the Savehop Relay

The Savehop relay is a small Node.js + WebSocket server that holds:

- A list of rooms (in-memory + JSON snapshot)
- The current save file for each room
- The last 5 versions of each save (for rollback)
- A simple "who holds the lock" flag

That's all. It does not run game logic, doesn't proxy multiplayer traffic, and doesn't need any external services. You can host it on **any free tier** and a friend group of 10 will never come close to using the limits.

This guide covers three ways to run it: **Docker (recommended)**, **bare Node.js**, and **free-tier deploy to Fly.io / Railway / Render**.

---

## Prerequisites

- **Node.js 20+** (only if running without Docker), or
- **Docker + Docker Compose** (recommended — single command)

A domain name is optional. You can point the Savehop app at a raw IP and port if that's all you have.

---

## Option 1 — Docker Compose (easiest)

```bash
git clone https://github.com/savehop/savehop.git
cd savehop
docker compose up -d
```

That's it. The relay is now running on `http://<your-host>:8787`.

Data is persisted to `./data` next to the `docker-compose.yml` — back this folder up if you care about save history.

To upgrade later:

```bash
git pull
docker compose pull   # or `docker compose build` if you have local changes
docker compose up -d
```

To stop:

```bash
docker compose down
```

---

## Option 2 — Bare Node.js

```bash
git clone https://github.com/savehop/savehop.git
cd savehop/server
npm install --omit=dev
PORT=8787 DATA_DIR=./data node index.js
```

For production, use a process manager so it restarts on crash and on reboot:

```bash
npm install -g pm2
pm2 start index.js --name savehop
pm2 save
pm2 startup    # follow the printed instructions
```

---

## Option 3 — Free-tier cloud deploy

### Fly.io (free hobby plan, generous limits)

```bash
# install flyctl: https://fly.io/docs/hands-on/install-flyctl/
cd server
fly launch --name your-savehop --no-deploy
fly volumes create savehop_data --size 1
# edit fly.toml: add  [[mounts]]  source="savehop_data"  destination="/data"
fly deploy
```

Point the Savehop app at `https://your-savehop.fly.dev`.

### Railway

1. Click **New Project → Deploy from GitHub** and pick your fork of this repo.
2. Set **Root Directory** to `server`.
3. Railway will detect the `Dockerfile` and deploy. Set `DATA_DIR=/data` and add a **Volume** mounted at `/data`.

### Render

1. **New → Web Service → Build from a Git repo**, pick this repo.
2. Set **Root Directory** to `server`. Render picks up the Dockerfile automatically.
3. Add a **Disk** of 1 GB mounted at `/data` and set `DATA_DIR=/data`.

### Self-hosted VPS (Hetzner, Oracle Cloud Free Tier, your old laptop)

Use Option 1 (Docker Compose). Put it behind nginx/Caddy if you want HTTPS:

```caddy
savehop.yourdomain.com {
    reverse_proxy localhost:8787
}
```

Caddy will get a free Let's Encrypt cert automatically.

---

## Pointing the app at your server

1. Open Savehop.
2. Click the **gear icon** in the top-right of the home screen.
3. Enter your server URL (e.g. `https://savehop.yourdomain.com` or `http://192.168.1.10:8787`).
4. **Save**. All future room creations and joins use your relay.

Each friend in the room needs to set the same server URL — there's no "discovery" mechanism. They all point at the same instance.

---

## Environment variables

| Variable      | Default       | Purpose                                                              |
|---------------|---------------|----------------------------------------------------------------------|
| `PORT`        | `8787`        | HTTP + WebSocket listen port                                         |
| `DATA_DIR`    | `./data`      | Where rooms.json and save files are stored. Mount a volume here.    |
| `MAX_SAVE_MB` | `100`         | Reject uploads larger than this. Increase for big modded worlds.    |

---

## Backup and disaster recovery

The relay stores everything under `DATA_DIR`:

```
data/
├── rooms.json          # room metadata + member list + lock state
└── <ROOM_CODE>/
    ├── save.bin        # latest save
    ├── save.1.bin      # previous version
    ├── save.2.bin      # ...
    └── save.5.bin      # oldest kept version
```

To back it up, just copy that folder somewhere. To restore, copy it back and restart the service.

If `rooms.json` is corrupted or deleted, the server will start with an empty room list — but the save files on disk are still there. Anyone who knows their old room code can `POST /rooms/<code>/join` and the room re-materializes with the latest save preserved (this is graceful by accident, but useful in practice).

---

## Security notes

- The relay has **no authentication** by design. Knowledge of a 6-character room code is the only access control. The keyspace is `32^6 ≈ 1 billion` so random guessing is impractical for friend-group use, but **anyone you give the code to can wake, sleep, and force-unlock**. Don't post your room code in a public Discord and expect strangers to behave.
- For zero-trust scenarios, run your own relay and only share the URL with people you trust.
- All traffic between the app and the relay is plain HTTP/WS unless you put it behind HTTPS (Caddy, Cloudflare, the Fly/Railway/Render proxies, etc.). For a relay on the open internet, you should use HTTPS — save files are not encrypted in transit by default.
- End-to-end encryption (where the relay never sees the unencrypted save) is on the roadmap.

---

## Troubleshooting

**The app says "Couldn't reach server".**
Check that the server URL is reachable from your machine: `curl https://yourserver/health` should return `{"ok":true}`. CORS is wide-open by default, so that's not the problem.

**WebSocket doesn't connect / members don't update live.**
Some reverse proxies need explicit WebSocket upgrade headers. For nginx, add `proxy_set_header Upgrade $http_upgrade; proxy_set_header Connection "upgrade";` to the location block. Caddy and the major PaaS proxies handle this automatically.

**Uploads are rejected with "missing_file" or 413.**
Your save is bigger than `MAX_SAVE_MB`. Bump the env var and restart. If you're behind nginx, raise `client_max_body_size` too.

**My rooms keep disappearing on restart.**
You're running without a persistent volume. Mount one at `DATA_DIR` (see Docker Compose example above) — the bind mount `./data:/data` is the easiest fix.

---

## Cost expectations

| Setup                       | Realistic monthly cost                |
|-----------------------------|----------------------------------------|
| Fly.io hobby + 1 GB volume  | $0 (free tier)                         |
| Railway hobby + 1 GB disk   | $0–$5                                  |
| Render free web service     | $0 (sleeps when idle, wakes on request) |
| Oracle Cloud Free Tier VPS  | $0 forever                             |
| Hetzner CX11 VPS            | ~$4                                    |
| Your old laptop in a closet | $0                                     |

A friend group of 10 with daily play sessions will use **single-digit megabytes of bandwidth per day** and **less than 100 MB of disk** for a year of save history. This is a featherweight service.

---

If something is unclear or broken, open an issue. PRs to improve this guide are very welcome.
