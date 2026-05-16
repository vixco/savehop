import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../lib/store';
import { api, ApiError } from '../lib/api';
import { BookmarkIcon, GearIcon } from '../lib/ui';

export default function Home() {
  const navigate = useNavigate();
  const {
    memberId, memberName, serverUrl, roomCode, autoRejoin,
    setMemberName, setRoomCode, setRoom,
  } = useStore();

  const [name, setName] = useState(memberName);
  const [joinCode, setJoinCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-rejoin: if we have a saved roomCode + name + setting enabled, jump in.
  useEffect(() => {
    if (autoRejoin && roomCode && memberName) {
      navigate(`/room/${roomCode}`, { replace: true });
    }
  }, []);

  const canCreate = name.trim().length >= 1 && !busy;
  const canJoin = name.trim().length >= 1 && joinCode.replace(/[^A-Z0-9]/g, '').length === 6 && !busy;

  async function handleCreate() {
    setError(null);
    setBusy('create');
    try {
      setMemberName(name.trim());
      const room = await api.createRoom(serverUrl, memberId, name.trim());
      setRoomCode(room.code);
      setRoom(room);
      navigate(`/room/${room.code}`);
    } catch (e: any) {
      setError(e instanceof ApiError ? `Couldn't reach server: ${e.message}` : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleJoin() {
    setError(null);
    setBusy('join');
    try {
      setMemberName(name.trim());
      const code = joinCode.replace(/[^A-Z0-9]/g, '');
      const room = await api.joinRoom(serverUrl, code, memberId, name.trim());
      setRoomCode(room.code);
      setRoom(room);
      navigate(`/room/${room.code}`);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 404) {
        setError('Room not found — check the code.');
      } else {
        setError(e instanceof ApiError ? `Couldn't reach server: ${e.message}` : String(e));
      }
    } finally {
      setBusy(null);
    }
  }

  function formatJoinCode(raw: string) {
    const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (clean.length <= 3) return clean;
    return clean.slice(0, 3) + '-' + clean.slice(3);
  }

  return (
    <>
      <div className="top-bar">
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
        <div className="brand-block">
          <div className="brand-icon"><BookmarkIcon /></div>
          <div className="brand-word">Savehop</div>
        </div>

        <div>
          <div className="label" style={{ marginBottom: 10 }}>Player name</div>
          <input
            className="input"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={24}
            onKeyDown={(e) => { if (e.key === 'Enter' && canCreate) handleCreate(); }}
          />
        </div>

        <button
          className="btn btn-primary btn-action"
          onClick={handleCreate}
          disabled={!canCreate}
        >
          {busy === 'create' ? <span className="spinner" /> : null}
          Create Room
        </button>

        <div className="divider-or">OR</div>

        <div>
          <div className="label" style={{ marginBottom: 10 }}>Room code</div>
          <input
            className="input mono"
            placeholder="- - -   - - -"
            value={formatJoinCode(joinCode)}
            onChange={(e) => setJoinCode(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && canJoin) handleJoin(); }}
            maxLength={7}
          />
        </div>

        <button
          className="btn btn-action"
          onClick={handleJoin}
          disabled={!canJoin}
        >
          {busy === 'join' ? <span className="spinner" /> : null}
          Join Room
        </button>

        {error && <div className="banner banner-error">{error}</div>}
      </div>
    </>
  );
}
