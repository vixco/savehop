# Savehop — Co-op Save Sync for Windows

> **Play any co-op game together — even when the host is offline.**
> No port forwarding. No dedicated servers. No accounts. Free and open source.

[![Download latest release](https://img.shields.io/github/v/release/savehop/savehop?label=Download&color=22d3b8&style=flat-square)](https://github.com/savehop/savehop/releases/latest)
[![Windows 10/11](https://img.shields.io/badge/Windows-10%20%2F%2011-0078d4?style=flat-square&logo=windows)](https://github.com/savehop/savehop/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-22d3b8?style=flat-square)](LICENSE)
[![Self-host with Docker](https://img.shields.io/badge/self--host-docker-2496ed?style=flat-square&logo=docker)](SELF_HOSTING.md)
[![Stars](https://img.shields.io/github/stars/savehop/savehop?style=flat-square)](https://github.com/savehop/savehop/stargazers)

---

## What is Savehop?

**Savehop is a tiny Windows app that lets a group of friends share a single co-op save file for any game — without anyone having to keep a server running.** Think Subnautica 2, Stardew Valley, Valheim, Satisfactory, Minecraft, Terraria, Schedule I, or any title with a local save on disk.

The problem Savehop solves is simple and annoying. In most co-op games, **the host must always be online** for anyone else to play. If your friend who started the world is asleep, at work, or just doesn't feel like playing, the entire group is stuck. The alternatives all have real downsides:

- **Renting a dedicated server** costs $5–$15 per month per game and requires someone to actually administer it.
- **Manually emailing a save file around** works for two people for one weekend, then immediately breaks down — somebody overwrites somebody else's progress, files get out of sync, drama ensues.
- **Cloud-saves like Steam Cloud** are designed for one player, not a group passing the save back and forth.

Savehop fixes this by giving your group **a 6-character room code and a tiny relay server** that holds the latest version of the save. When you want to play, you press **Wake** — the app downloads the latest save and locks it so nobody else can overwrite your session. When you're done, you press **Sleep** — your save uploads and the lock is released so the next player can pick up exactly where you left off.

It is purposefully boring and reliable. You own your save files. You can self-host the relay in one Docker command if you don't trust the public one. The whole thing is MIT-licensed and the entire source is in this repo.

## How it works

```
                ┌────────────────────────────────────────────┐
                │             savehop relay server            │
                │      (holds the current save + lock)        │
                └──────────────────┬─────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                    │
        ┌─────▼─────┐        ┌─────▼─────┐        ┌─────▼─────┐
        │  Player A │        │  Player B │        │  Player C │
        │  (online) │        │ (offline) │        │  (online) │
        └───────────┘        └───────────┘        └───────────┘

  1. Player A clicks  WAKE   → downloads save  → starts playing      (lock = A)
  2. Player A clicks  SLEEP  → uploads save    → releases lock       (lock = none)
  3. Later, Player C clicks WAKE → downloads the save A just made → plays         (lock = C)
```

The lock is the magic. Only one person can hold the save at a time, which means **the file is always linear** — there is exactly one canonical version, never a fork. If somebody disconnects with the lock still held, anyone in the room can press **Force Unlock** to recover.

The relay server only stores **a small lock record and the latest save file** (plus a handful of older versions for safety). It doesn't speak the game's protocol, doesn't run the game, doesn't proxy multiplayer traffic, and doesn't have any state that costs money to keep alive. That's why it can be free, and that's why a single $0/month VPS or a Fly.io free-tier app is enough to host a dozen friend groups.

## Supported games

Savehop works with **any game that stores its save as a normal file on disk**. That covers most single-player and small-group co-op titles. Some common ones:

| Game                 | Typical save location                                                   | Notes                                  |
|----------------------|--------------------------------------------------------------------------|----------------------------------------|
| **Subnautica 2**     | `%USERPROFILE%\AppData\LocalLow\Unknown Worlds\Subnautica2\SavedGames`  | Folder — zip it or point at the dir   |
| **Stardew Valley**   | `%APPDATA%\StardewValley\Saves\<world>\<world>`                          | Co-op pass-the-host workflow          |
| **Valheim**          | `%USERPROFILE%\AppData\LocalLow\IronGate\Valheim\worlds_local`           | `.db` + `.fwl` per world              |
| **Satisfactory**     | `%USERPROFILE%\AppData\Local\FactoryGame\Saved\SaveGames`                | `.sav` files                          |
| **Minecraft (Java)** | `%APPDATA%\.minecraft\saves\<world>`                                     | Folder per world                      |
| **Schedule I**       | `%USERPROFILE%\AppData\LocalLow\TVGS\Schedule I\Saves`                   | Folder per save slot                  |
| **Terraria**         | `%USERPROFILE%\Documents\My Games\Terraria\Worlds`                       | `.wld`                                |
| **Don't Starve Together** | `%USERPROFILE%\Documents\Klei\DoNotStarveTogether\<cluster>`        | Server save folder                    |
| **Project Zomboid**  | `%USERPROFILE%\Zomboid\Saves\Multiplayer\<world>`                        | Per-world folder                      |
| **Anything else**    | wherever it puts its file                                                | Single file or a zipped folder        |

If your game saves into a *folder* instead of a single file, zip it before pointing Savehop at it. A built-in folder-mode is on the roadmap.

> **Important:** Savehop is **not** a multiplayer netcode layer. It does not let two people connect to a single game session at the same time — that's still the game's job. What it does is let two people **take turns being the host** without losing progress, and without needing a dedicated server.

## Download

[**→ Download the latest installer from the GitHub Releases page**](https://github.com/savehop/savehop/releases/latest)

Pick `Savehop-Setup-x.y.z.exe`, run it, done.

- Works on **Windows 10 and Windows 11** (x64).
- **Free** forever. No subscription, no in-app purchase.
- **No account** — you are identified by a UUID stored locally on your machine.
- **~7 MB installer**, ~30 MB on disk (Tauri/Rust, not Electron).

> Building from source? See [Contributing](#contributing). The CI in this repo produces the installer automatically on every tagged release.

## Quick start

1. **Install Savehop** from the link above.
2. **Open it** and type a display name your friends will recognize.
3. **Pick your save file.** Click "Pick save file…" and browse to the actual save file on disk (see the [Supported games](#supported-games) table for common paths).
4. **Create a room.** You'll get a 6-character code (e.g. `K7P29A`). Click it to copy.
5. **Send the code to friends.** They install Savehop, type their name, paste the code, and join.
6. **Press Wake** when you want to play. The app downloads the latest save into your save path and locks the room. Launch the game normally — your save is there, ready to go.
7. **Press Sleep** when you're done. The app uploads your save back to the room and releases the lock. The next person can now Wake.

That's the whole workflow. If somebody crashes or forgets to Sleep, click **Force Unlock** to take over. Last 5 save versions are kept on the server in case you ever need to roll back.

## Self-hosting the server

You can absolutely just use the public relay at `https://savehop.fly.dev` and never think about it. But if you want full ownership of your save files, you can run your own in **one command**:

```bash
git clone https://github.com/savehop/savehop.git
cd savehop
docker compose up -d
```

Then in the Savehop app, click the gear icon and point it at `http://your-server:8787`. Done.

Full instructions, environment variables, and free-tier deploy guides (Fly.io, Railway, Render) are in **[SELF_HOSTING.md](SELF_HOSTING.md)**.

## FAQ

### Does this work with Steam Cloud?

Yes. Savehop reads and writes the local save file directly, the same file Steam Cloud syncs. They coexist fine — but turn off Steam Cloud for the specific game if you see them fighting each other (rare). The simple rule: only Steam Cloud or only Savehop should "own" the file at a time. Most groups just disable Steam Cloud on the title they're co-oping.

### Is my save file safe?

Your save is only uploaded **when you click Sleep**, and only downloaded **when you click Wake**. The app never touches the file in the background. The relay keeps the last 5 versions, so if somebody saves over a critical moment, you can roll back. Every Wake creates a `.savehop-backup` next to the file on your machine before overwriting, as an extra belt-and-braces safety net.

If you want zero trust in the public relay, [self-host it](SELF_HOSTING.md). The server is ~200 lines of Node.js — easy to audit, easy to run on a free tier somewhere.

### What if someone disconnects with the lock still held?

Anyone in the room can press **Force Unlock**. The lock is just a flag on the server; it doesn't gate anything cryptographically. The honor system + a visible "X is playing" indicator is enough for friend groups, which is the entire target audience.

### Can more than 2 people share a room?

Yes — **up to 10 people per room**. The lock model means only one person plays at a time, but the rotation works fine for any group size. Great for big Stardew or Terraria save-passing crews.

### Is this against the game's Terms of Service?

You own your save files. You are not modifying the game, not bypassing DRM, not connecting to the game's servers in any unsupported way — you're just copying a file that's already on your computer to a server that's already yours (or one you chose to use). This is no different from emailing the save to a friend, which has been a standard co-op workflow for decades. We are not lawyers and your game's EULA might say something interesting; check it if you're worried.

### Why not just use Dropbox / Google Drive / OneDrive?

You can. People have done it for years. It breaks down for the same reasons manual file-passing breaks down: **there is no lock**. Two people open the save at the same time, both save back, one overwrites the other, the world is corrupted. Savehop's job is to be the dumb pessimistic lock on top of an otherwise-fine cloud file. That's it. That's the entire product.

### Does Savehop work with games that save to a folder, not a single file?

Right now you need to zip the folder yourself before pointing Savehop at the zip. A "folder mode" that zips/unzips automatically is on the roadmap and would solve Stardew Valley co-op cleanly. PRs welcome.

### Does Savehop work on Mac or Linux?

The relay server runs anywhere — it's Node.js. The desktop app is currently **Windows-only** because the vast majority of co-op-save pain is on Windows. Mac and Linux builds are trivial to add (Tauri supports them) but haven't been packaged yet. PRs very welcome.

### Is there a way to schedule a session?

Not yet. Right now Savehop is purely on-demand — you press Wake when you want to play. Calendar integration / Discord bot pings / "next slot reservation" are all on the roadmap but not implemented. The current product is intentionally tiny.

### How is this different from "co-op save sync" mods I see for specific games?

Game-specific mods have to be rewritten for every game and every game update. Savehop works on any game that stores a save on disk, because it doesn't know or care about the game — it's just a file lock with a UI. That makes it boring and reliable.

## Contributing

Contributions, bug reports, and feature requests are welcome. The codebase is small on purpose:

- `server/` — Node.js Express + WebSocket relay, ~300 lines total.
- `app/` — Tauri v2 + React + TypeScript. Zustand for state, three pages total.
- `app/src-tauri/` — Rust commands for reading and writing the save file from disk.

### Local development

```bash
# Server
cd server && npm install && npm run dev
# → listens on http://localhost:8787

# App (separate terminal)
cd app && npm install
npm run icons   # one-time: generate bundle icons
npm run tauri dev
```

Set `VITE_SERVER_URL=http://localhost:8787` in `app/.env.local` to point the dev app at your local server.

### Releases

Tag a commit with `vX.Y.Z` and push. The `release.yml` workflow builds the Windows installer and attaches it to a new GitHub Release automatically. No manual upload needed.

### Code of conduct

Be kind, assume good faith, don't be a jerk in issues. Standard internet etiquette.

## Roadmap

- [ ] Folder-mode for games that save into a directory (Stardew, Minecraft worlds, DST clusters)
- [ ] macOS and Linux app builds (Tauri already supports them; just needs CI)
- [ ] Optional end-to-end encryption of saves before upload
- [ ] Discord webhook on Wake/Sleep so your group sees who's playing
- [ ] Per-game presets (auto-detect save path for popular titles)
- [ ] Schedule-ahead reservations ("I want to play tomorrow 8pm")
- [ ] In-app one-click Force Unlock vote (instead of unilateral)

## License

[MIT](LICENSE) — do whatever you want with this, including selling it, just keep the copyright notice.

---

<sub>Savehop is not affiliated with Unknown Worlds Entertainment, ConcernedApe, Iron Gate AB, Coffee Stain Studios, Mojang, Re-Logic, TVGS, or any other game studio mentioned in this README. Game names are used to describe compatibility only.</sub>
