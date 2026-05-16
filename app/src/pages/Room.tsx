import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useStore, type RoomState } from '../lib/store';
import { api, ApiError, type WsMessage } from '../lib/api';
import { notify } from '../lib/notify';
import {
  CopyIcon, SunIcon, MoonIcon, ClockIcon, SaveIcon, LockIcon,
  CrownIcon, GearIcon, avatarColors, avatarInitial,
} from '../lib/ui';

function formatHMS(ms: number): string {
  if (ms < 0) ms = 0;
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatRelative(ts: number | null) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 30_000) return 'just now';
  const m = Math.floor(diff / 60_000);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatCode(code: string) {
  if (code.length !== 6) return code;
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

function Avatar({ id, name, online }: { id: string; name: string; online: boolean }) {
  const [a, b] = avatarColors(id);
  return (
    <div className="avatar" style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}>
      {avatarInitial(name)}
      <span className={`online-dot ${online ? 'on' : 'off'}`} />
    </div>
  );
}

export default function Room() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const {
    memberId, memberName, serverUrl,
    selectedGame, gamePath,
    room, setRoom,
    syncStatus, setSyncStatus,
    setRoomCode,
    autoWakeOnLaunch, autoSleepOnGameExit, autoWakeOnPromotion,
  } = useStore();

  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [now, setNow] = useState(Date.now());
  const autoWakeFired = useRef(false);
  const watchActive = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }, []);

  const savePath = selectedGame?.savePath || gamePath;
  const saveKind: 'folder' | 'file' = selectedGame ? selectedGame.saveKind : 'file';
  const hasSyncTarget = !!savePath;

  const doWake = useCallback(async () => {
    if (!code || !hasSyncTarget) return;
    setError(null);
    setSyncStatus('downloading');
    try {
      const r = await api.wake(serverUrl, code, memberId);
      setRoom(r);
      if (r.hasSave) {
        const data = await api.downloadSave(serverUrl, code);
        const cmd = saveKind === 'folder' ? 'write_save_folder' : 'write_save';
        await invoke(cmd, { path: savePath, data: Array.from(data) });
        showToast('Save downloaded — go play!');
      } else {
        showToast("First wake — no save yet.");
      }
      setSyncStatus('ready');
      return r;
    } catch (e: any) {
      if (e instanceof ApiError && e.code === 'locked') {
        setError(`Locked by ${(e as any).heldBy || 'another player'}.`);
      } else {
        setError(e instanceof ApiError ? e.message : String(e));
      }
      setSyncStatus('error');
      return null;
    }
  }, [code, hasSyncTarget, savePath, saveKind, memberId, serverUrl, setRoom, setSyncStatus, showToast]);

  const doSleep = useCallback(async () => {
    if (!code || !hasSyncTarget) return;
    setError(null);
    setSyncStatus('uploading');
    try {
      const cmd = saveKind === 'folder' ? 'read_save_folder' : 'read_save';
      const raw = await invoke<number[]>(cmd, { path: savePath });
      const bytes = new Uint8Array(raw);
      const r = await api.sleep(serverUrl, code, memberId, bytes);
      setRoom(r);
      showToast('Save uploaded.');
      setSyncStatus('idle');
      return r;
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : String(e));
      setSyncStatus('error');
      return null;
    }
  }, [code, hasSyncTarget, savePath, saveKind, memberId, serverUrl, setRoom, setSyncStatus, showToast]);

  // Initial room join + WebSocket
  useEffect(() => {
    if (!code) return;
    if (!memberName) {
      navigate('/');
      return;
    }
    setRoomCode(code);

    let cancelled = false;
    (async () => {
      try {
        const r = await api.joinRoom(serverUrl, code, memberId, memberName);
        if (!cancelled) setRoom(r);
      } catch (e: any) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : String(e));
      }
    })();

    const ws = api.openWebSocket(serverUrl, code);
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data) as WsMessage;
        if (msg.type === 'room_update' && msg.room) {
          setRoom(msg.room as RoomState);
        } else if (msg.type === 'host_promoted') {
          if (msg.memberId === memberId) {
            showToast("You're now the host — wake when ready");
            void notify(
              'Savehop — you are now the host',
              'The previous host left. Press Wake to download the save and continue.',
            );
            if (autoWakeOnPromotion) {
              void doWake();
            }
          } else {
            showToast(`${msg.memberName} is now the host`);
          }
        }
      } catch {}
    };

    const hb = setInterval(() => {
      api.heartbeat(serverUrl, code, memberId);
    }, 8_000);

    return () => {
      cancelled = true;
      clearInterval(hb);
      ws.close();
    };
  }, [code]);

  // Auto-wake on first entry
  useEffect(() => {
    if (!room || autoWakeFired.current) return;
    if (!autoWakeOnLaunch || !hasSyncTarget) return;
    if (room.lockHolder && room.lockHolder !== memberId) return;
    if (room.lockHolder === memberId) { autoWakeFired.current = true; return; }
    autoWakeFired.current = true;
    showToast('Auto-waking…');
    doWake();
  }, [room, autoWakeOnLaunch, hasSyncTarget, memberId, doWake, showToast]);

  // Auto-sleep on game exit (real process watch via sysinfo)
  useEffect(() => {
    if (!autoSleepOnGameExit) return;
    if (!selectedGame?.exeName) return;
    if (!room || room.lockHolder !== memberId) return;
    if (watchActive.current) return;

    watchActive.current = true;
    invoke('start_game_watch', { executable: selectedGame.exeName }).catch(() => {});

    const un = listen<{ executable: string }>('savehop:game-stopped', async () => {
      showToast('Game closed — uploading save…');
      await doSleep();
    });

    return () => {
      watchActive.current = false;
      invoke('stop_game_watch').catch(() => {});
      un.then((u) => u()).catch(() => {});
    };
  }, [autoSleepOnGameExit, selectedGame?.exeName, room?.lockHolder, memberId, doSleep, showToast]);

  async function copyCode() {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      showToast('Code copied');
    } catch {
      showToast('Copy failed');
    }
  }

  async function handleForceUnlock() {
    if (!code) return;
    if (!confirm('Force unlock? Only do this if the lock holder is offline.')) return;
    try {
      const r = await api.forceUnlock(serverUrl, code, memberId);
      setRoom(r);
      showToast('Unlocked');
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : String(e));
    }
  }

  function leave() {
    setRoomCode(null);
    setRoom(null);
    navigate('/');
  }

  if (!room) {
    return (
      <div className="container">
        <div className="brand-block">
          <div className="brand-word">Connecting…</div>
        </div>
        <div className="card" style={{ alignItems: 'center', gap: 12, justifyContent: 'center' }}>
          <span className="spinner" />
          <div style={{ color: 'var(--text-dim)' }}>Joining {code}</div>
        </div>
        {error && <div className="banner banner-error">{error}</div>}
        <button className="btn btn-ghost" onClick={leave}>← Back</button>
      </div>
    );
  }

  const isLocked = !!room.lockHolder;
  const youHoldLock = room.lockHolder === memberId;
  const someoneElseHoldsLock = isLocked && !youHoldLock;
  const lockElapsed = room.lockAcquiredAt ? formatHMS(now - room.lockAcquiredAt) : '00:00:00';
  const onlineCount = room.members.filter((m) => m.online).length;

  // Heuristic "next in line" — only shown while someone else holds the lock.
  // Server is authoritative on actual promotion; this is a UX hint based on join order.
  const nextInLine = (() => {
    if (!isLocked || onlineCount < 2) return null;
    const candidates = room.members
      .filter((m) => m.online && m.id !== room.lockHolder)
      .sort((a, b) => a.lastSeen - b.lastSeen);
    return candidates[0] || null;
  })();

  return (
    <>
      <div className="top-bar">
        <button className="subtle-link" onClick={leave}>← Leave</button>
        <div className="spacer" />
        <button
          className="icon-btn"
          onClick={() => navigate('/settings')}
          title="Settings"
        >
          <GearIcon />
        </button>
      </div>

      <div className="container">
        <div>
          <div className="code-label">ROOM CODE</div>
          <div className="code-row">
            <div className="code-display mono">{formatCode(room.code)}</div>
            <button className="icon-btn" onClick={copyCode} title="Copy">
              <CopyIcon />
            </button>
          </div>
          <div className="code-sub">Share this code with friends</div>
        </div>

        {youHoldLock && (
          <div className="status-banner active">
            <div className="left">
              <span className="status-dot green" />
              <span>Session active</span>
            </div>
            <div className="right">{lockElapsed}</div>
          </div>
        )}
        {someoneElseHoldsLock && (
          <>
            <div className="status-banner waiting">
              <div className="left">
                <span className="status-dot amber" />
                <span>{room.lockHolderName} has the save</span>
              </div>
              <div className="right">{lockElapsed}</div>
            </div>
            {nextInLine && (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center', marginTop: -10 }}>
                Next host if {room.lockHolderName} leaves: <strong style={{ color: 'var(--text-dim)' }}>{nextInLine.id === memberId ? 'you' : nextInLine.name}</strong>
              </div>
            )}
          </>
        )}

        <div className="members-card">
          <div className="members-head">
            <div className="left">Members</div>
            <div className="right">{onlineCount} / {room.members.length} online</div>
          </div>
          <div className="members-list">
            {room.members.map((m) => {
              const isHost = m.id === room.lockHolder;
              const isYou = m.id === memberId;
              return (
                <div className="member" key={m.id}>
                  <Avatar id={m.id} name={m.name} online={m.online} />
                  <span className="member-name">{m.name}</span>
                  {isYou && <span className="you-badge">YOU</span>}
                  {isHost && <span className="crown" title="holds the save"><CrownIcon /></span>}
                  <span className="member-spacer" />
                  {!m.online ? (
                    <span className="member-role offline">offline</span>
                  ) : isHost ? (
                    <span className="member-role host">host</span>
                  ) : isLocked ? (
                    <span className="member-role">watching</span>
                  ) : (
                    <span className="member-role">online</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="footer-pill">
          {youHoldLock ? (
            <>
              <SaveIcon />
              <span>Save locked by you</span>
              <span className="sep">·</span>
              <span className="ver">v{room.saveVersion} → {room.saveVersion + 1}</span>
            </>
          ) : someoneElseHoldsLock ? (
            <>
              <LockIcon />
              <span>Locked by {room.lockHolderName}</span>
              <span className="sep">·</span>
              <span className="ver">v{room.saveVersion}</span>
            </>
          ) : (
            <>
              <ClockIcon />
              <span>
                {room.lastSyncAt
                  ? <>Last synced {formatRelative(room.lastSyncAt)}</>
                  : <>No save uploaded yet</>}
              </span>
              <span className="sep">·</span>
              <span className="ver">v{room.saveVersion}</span>
            </>
          )}
        </div>

        {!isLocked && (
          <button
            className="btn btn-primary btn-action"
            onClick={doWake}
            disabled={!hasSyncTarget || syncStatus === 'downloading' || syncStatus === 'uploading'}
          >
            {syncStatus === 'downloading' ? <span className="spinner" /> : <SunIcon />}
            Wake Session
          </button>
        )}
        {youHoldLock && (
          <button
            className="btn btn-primary btn-action"
            onClick={doSleep}
            disabled={!hasSyncTarget || syncStatus === 'uploading' || syncStatus === 'downloading'}
          >
            {syncStatus === 'uploading' ? <span className="spinner" /> : <MoonIcon />}
            Sleep Session
          </button>
        )}
        {someoneElseHoldsLock && (
          <button className="btn btn-disabled-state btn-action" disabled>
            <ClockIcon /> {room.lockHolderName} is playing…
          </button>
        )}

        {someoneElseHoldsLock ? (
          <div className="action-row">
            <button className="btn-danger-text btn" onClick={handleForceUnlock}>
              Force unlock
            </button>
            <button className="btn btn-ghost" onClick={leave}>Leave Room</button>
          </div>
        ) : (
          <div className="action-row center">
            <button className="btn btn-ghost" onClick={leave}>Leave Room</button>
          </div>
        )}

        {!hasSyncTarget && (
          <div className="banner banner-warn">
            No save selected.{' '}
            <button
              className="subtle-link"
              style={{ display: 'inline', padding: 0, color: 'inherit', textDecoration: 'underline' }}
              onClick={() => navigate('/settings')}
            >
              Open settings
            </button>{' '}
            and pick your game.
          </div>
        )}
        {hasSyncTarget && (
          <div style={{ fontSize: 11, color: 'var(--text-faint)', textAlign: 'center' }}>
            Syncing {selectedGame?.name || 'manual file'} · {saveKind} mode
          </div>
        )}

        {error && <div className="banner banner-error">{error}</div>}
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
