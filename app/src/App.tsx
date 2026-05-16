import { useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import Home from './pages/Home';
import Room from './pages/Room';
import Settings from './pages/Settings';

type UpdateState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available'; version: string; notes?: string }
  | { kind: 'downloading'; pct: number }
  | { kind: 'installed' }
  | { kind: 'error'; message: string };

export default function App() {
  const [update, setUpdate] = useState<UpdateState>({ kind: 'idle' });

  useEffect(() => {
    (async () => {
      try {
        setUpdate({ kind: 'checking' });
        const u = await check();
        if (!u) {
          setUpdate({ kind: 'idle' });
          return;
        }
        setUpdate({ kind: 'available', version: u.version, notes: u.body });
        let downloaded = 0;
        let total = 0;
        await u.downloadAndInstall((ev) => {
          if (ev.event === 'Started') total = ev.data.contentLength ?? 0;
          if (ev.event === 'Progress') {
            downloaded += ev.data.chunkLength;
            const pct = total > 0 ? Math.round((downloaded / total) * 100) : 0;
            setUpdate({ kind: 'downloading', pct });
          }
          if (ev.event === 'Finished') setUpdate({ kind: 'installed' });
        });
        setTimeout(() => { relaunch(); }, 1200);
      } catch (e: any) {
        setUpdate({ kind: 'error', message: String(e?.message || e) });
        // Silently swallow — updater errors must not block app usage.
        // eslint-disable-next-line no-console
        console.warn('updater', e);
      }
    })();
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code" element={<Room />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <UpdaterBadge state={update} />
    </>
  );
}

function UpdaterBadge({ state }: { state: UpdateState }) {
  if (state.kind === 'idle' || state.kind === 'checking' || state.kind === 'error') return null;

  let text = '';
  if (state.kind === 'available') text = `Updating to v${state.version}…`;
  if (state.kind === 'downloading') text = `Downloading update… ${state.pct}%`;
  if (state.kind === 'installed') text = 'Update installed — restarting…';

  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        background: 'var(--surface)',
        border: '1px solid var(--accent-border)',
        color: 'var(--accent)',
        padding: '6px 12px',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 500,
        zIndex: 10000,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      {text}
    </div>
  );
}
