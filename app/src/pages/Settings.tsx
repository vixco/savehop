import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';
import { check as checkUpdate } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useStore, type SelectedGame, DEFAULT_SERVER } from '../lib/store';
import { ChevronLeftIcon, BookmarkIcon } from '../lib/ui';

type DetectedGame = {
  name: string;
  exe_path: string;
  save_path: string;
  save_path_exists: boolean;
};

function basename(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] || p;
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="slider" />
    </label>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const {
    serverUrl, setServerUrl,
    selectedGame, setSelectedGame,
    gamePath, setGamePath,
    autoRejoin, setAutoRejoin,
    autoWakeOnLaunch, setAutoWakeOnLaunch,
    autoSleepOnGameExit, setAutoSleepOnGameExit,
    autoWakeOnPromotion, setAutoWakeOnPromotion,
    startMinimized, setStartMinimized,
    launchOnStartup, setLaunchOnStartup,
  } = useStore();

  const [serverDraft, setServerDraft] = useState(serverUrl);
  const [toast, setToast] = useState<string | null>(null);

  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [detected, setDetected] = useState<DetectedGame[] | null>(null);

  const [version, setVersion] = useState<string>('');
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateMsg, setUpdateMsg] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion('?'));
  }, []);

  async function handleCheckUpdate() {
    setUpdateChecking(true);
    setUpdateMsg(null);
    try {
      const u = await checkUpdate();
      if (!u) {
        setUpdateMsg("You're up to date");
        setTimeout(() => setUpdateMsg(null), 4000);
        return;
      }
      setUpdateMsg(`Downloading v${u.version}…`);
      await u.downloadAndInstall();
      setUpdateMsg('Installed — restarting…');
      setTimeout(() => { relaunch(); }, 1000);
    } catch (e: any) {
      setUpdateMsg(`Check failed: ${String(e?.message || e)}`);
      setTimeout(() => setUpdateMsg(null), 6000);
    } finally {
      setUpdateChecking(false);
    }
  }

  useEffect(() => {
    isAutostartEnabled().then((on) => {
      if (on !== launchOnStartup) setLaunchOnStartup(on);
    }).catch(() => {});
  }, []);

  const scan = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      const list = await invoke<DetectedGame[]>('detect_games');
      setDetected(list);
    } catch (e: any) {
      setScanError(typeof e === 'string' ? e : String(e));
      setDetected([]);
    } finally {
      setScanning(false);
    }
  }, []);

  // Run a scan automatically the first time the page opens
  useEffect(() => {
    if (detected === null) scan();
  }, [detected, scan]);

  // Auto-pick a game when none is selected yet and we found exactly one — zero-click setup
  useEffect(() => {
    if (!selectedGame && !gamePath && detected && detected.length === 1) {
      pickGame(detected[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detected]);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1600);
  }

  function pickGame(g: DetectedGame) {
    const next: SelectedGame = {
      name: g.name,
      exePath: g.exe_path,
      exeName: basename(g.exe_path),
      savePath: g.save_path,
      saveKind: 'folder',
    };
    setSelectedGame(next);
    setGamePath('');
    showToast(`${g.name} selected`);
  }

  async function pickManualFile() {
    const selected = await openDialog({
      title: 'Pick your save file',
      multiple: false,
      directory: false,
    });
    if (typeof selected === 'string') {
      setGamePath(selected);
      setSelectedGame(null);
      showToast('Save file selected');
    }
  }

  async function pickManualFolder() {
    const selected = await openDialog({
      title: 'Pick your save folder',
      multiple: false,
      directory: true,
    });
    if (typeof selected === 'string') {
      const exeChoice = await openDialog({
        title: 'Pick the game executable (for auto-sync)',
        multiple: false,
        directory: false,
        filters: [{ name: 'Executable', extensions: ['exe'] }],
      });
      if (typeof exeChoice === 'string') {
        setSelectedGame({
          name: basename(selected),
          exePath: exeChoice,
          exeName: basename(exeChoice),
          savePath: selected,
          saveKind: 'folder',
        });
        setGamePath('');
        showToast('Game configured');
      }
    }
  }

  async function toggleAutostart(v: boolean) {
    setLaunchOnStartup(v);
    try {
      if (v) await enableAutostart();
      else await disableAutostart();
    } catch {
      showToast('Autostart unsupported in dev mode');
    }
  }

  async function toggleStartMinimized(v: boolean) {
    setStartMinimized(v);
  }

  function saveServer() {
    setServerUrl(serverDraft);
    showToast('Server saved');
  }

  function resetServer() {
    setServerDraft(DEFAULT_SERVER);
    setServerUrl(DEFAULT_SERVER);
    showToast('Relay reset');
  }

  function clearSelection() {
    setSelectedGame(null);
    setGamePath('');
    showToast('Cleared');
  }

  const selectedIsManual = !selectedGame && !!gamePath;

  return (
    <>
      <div className="top-bar">
        <button className="subtle-link" onClick={() => navigate(-1)}>
          <ChevronLeftIcon /> Back
        </button>
        <div className="spacer" />
      </div>

      <div className="container">
        <div className="settings-header">
          <div className="brand-icon" style={{ width: 22, height: 22 }}><BookmarkIcon size={22} /></div>
          <div className="settings-title">Settings</div>
        </div>

        {/* Active selection summary */}
        {(selectedGame || selectedIsManual) && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="label">Active game</div>
              <button className="subtle-link" onClick={clearSelection}>Change</button>
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600 }}>
                {selectedGame ? selectedGame.name : basename(gamePath)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                {selectedGame ? selectedGame.exeName : 'manual file'} ·{' '}
                {selectedGame ? 'folder sync' : 'single file'}
              </div>
            </div>
            <div className="path-display">{selectedGame?.savePath || gamePath}</div>
          </div>
        )}

        {/* Game picker */}
        {!selectedGame && !selectedIsManual && (
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="label">Detected games</div>
              <button className="subtle-link" onClick={scan} disabled={scanning}>
                {scanning ? 'Scanning…' : 'Rescan'}
              </button>
            </div>

            {scanning && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-dim)', padding: '8px 0' }}>
                <span className="spinner" />
                Walking Steam / Xbox / Epic / GOG / drives…
              </div>
            )}

            {!scanning && detected && detected.length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--text-dim)', padding: '4px 0' }}>
                No supported games found yet. Use the manual picker below.
              </div>
            )}

            {!scanning && detected && detected.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {detected.map((g) => (
                  <button
                    key={g.name}
                    onClick={() => pickGame(g)}
                    className="game-card"
                    title={g.exe_path}
                  >
                    <div className="game-card-row">
                      <div className="game-card-name">{g.name}</div>
                      <div className={`game-card-status ${g.save_path_exists ? 'ok' : 'pending'}`}>
                        {g.save_path_exists ? 'save found' : 'no save yet'}
                      </div>
                    </div>
                    <div className="game-card-path">{g.save_path}</div>
                  </button>
                ))}
              </div>
            )}

            {scanError && (
              <div className="banner banner-error">{scanError}</div>
            )}

            <div className="divider-or" style={{ marginTop: 6 }}>OR</div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={pickManualFolder}>
                Pick save folder…
              </button>
              <button className="btn" style={{ flex: 1 }} onClick={pickManualFile}>
                Pick save file…
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              Pick a folder for games that save into a directory (most modern games).
              Pick a single file for older / simpler titles.
            </div>
          </div>
        )}

        {/* Auto mode */}
        <div className="card">
          <div className="label">Auto mode</div>

          <div className="setting-row">
            <div className="content">
              <div className="title">Auto-rejoin last room</div>
              <div className="desc">When you open Savehop, jump straight back into the last room you used.</div>
            </div>
            <Toggle checked={autoRejoin} onChange={setAutoRejoin} />
          </div>

          <div className="setting-row">
            <div className="content">
              <div className="title">Auto-wake on launch</div>
              <div className="desc">Claim the save and download it the moment you open the app — no buttons.</div>
            </div>
            <Toggle checked={autoWakeOnLaunch} onChange={setAutoWakeOnLaunch} />
          </div>

          <div className="setting-row">
            <div className="content">
              <div className="title">Auto-sleep when game closes</div>
              <div className="desc">
                Savehop watches your game's process — the moment it exits, your save uploads automatically.
                {' '}Requires a game selected above.
              </div>
            </div>
            <Toggle
              checked={autoSleepOnGameExit}
              onChange={setAutoSleepOnGameExit}
            />
          </div>

          <div className="setting-row">
            <div className="content">
              <div className="title">Auto-wake when promoted to host</div>
              <div className="desc">
                When the current host stops playing, the next online member is auto-promoted.
                If that's you, immediately claim the save so you can launch the game right away.
              </div>
            </div>
            <Toggle
              checked={autoWakeOnPromotion}
              onChange={setAutoWakeOnPromotion}
            />
          </div>
        </div>

        {/* System */}
        <div className="card">
          <div className="label">System</div>

          <div className="setting-row">
            <div className="content">
              <div className="title">Launch Savehop with Windows</div>
              <div className="desc">Start in the background every time you log in.</div>
            </div>
            <Toggle checked={launchOnStartup} onChange={toggleAutostart} />
          </div>

          <div className="setting-row">
            <div className="content">
              <div className="title">Start minimized to tray</div>
              <div className="desc">When Windows starts Savehop for you, keep the window hidden in the tray.</div>
            </div>
            <Toggle checked={startMinimized} onChange={toggleStartMinimized} />
          </div>
        </div>

        {/* Server */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="label">Relay server</div>
            {serverDraft.trim().replace(/\/+$/, '') !== DEFAULT_SERVER && (
              <button className="subtle-link" onClick={resetServer}>Reset to default</button>
            )}
          </div>
          <input
            className="input"
            style={{ fontSize: 13, fontFamily: "'Space Mono', monospace" }}
            value={serverDraft}
            onChange={(e) => setServerDraft(e.target.value)}
            onBlur={saveServer}
            onKeyDown={(e) => { if (e.key === 'Enter') saveServer(); }}
            placeholder={DEFAULT_SERVER}
          />
          <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
            Point this at your own server for full privacy. See SELF_HOSTING.md.
          </div>
        </div>

        {/* App version + manual update check */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500 }}>Savehop v{version || '…'}</div>
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 2 }}>
                Updates install automatically when you open the app.
              </div>
            </div>
            <button
              className="btn"
              style={{ padding: '10px 14px', fontSize: 13, whiteSpace: 'nowrap' }}
              onClick={handleCheckUpdate}
              disabled={updateChecking}
            >
              {updateChecking ? <span className="spinner" /> : null}
              Check for updates
            </button>
          </div>
          {updateMsg && (
            <div style={{ fontSize: 12, color: 'var(--accent)', marginTop: 4 }}>{updateMsg}</div>
          )}
        </div>

        <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 11, padding: '8px 0 16px' }}>
          Savehop · open source · MIT
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}
