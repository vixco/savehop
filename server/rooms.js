import { customAlphabet } from 'nanoid';
import { loadRooms, persistRooms, saveExists, getSaveSize } from './storage.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = customAlphabet(ALPHABET, 6);

const rooms = loadRooms();
const subscribers = new Map();

const OFFLINE_AFTER_MS = 30_000;

export function createRoom(creator) {
  let code;
  do {
    code = newCode();
  } while (rooms[code]);

  rooms[code] = {
    code,
    createdAt: Date.now(),
    lockHolder: null,
    lockAcquiredAt: null,
    saveVersion: 0,
    lastSyncAt: null,
    saveSize: 0,
    members: {
      [creator.id]: {
        id: creator.id,
        name: creator.name,
        joinedAt: Date.now(),
        lastSeen: Date.now(),
      },
    },
  };
  persistRooms(rooms);
  return rooms[code];
}

export function getRoom(code) {
  const r = rooms[code];
  if (!r) return null;
  return serializeRoom(r);
}

export function joinRoom(code, member) {
  const r = rooms[code];
  if (!r) return null;
  r.members[member.id] = {
    id: member.id,
    name: member.name,
    joinedAt: r.members[member.id]?.joinedAt || Date.now(),
    lastSeen: Date.now(),
  };
  persistRooms(rooms);
  broadcast(code);
  return serializeRoom(r);
}

export function heartbeat(code, memberId) {
  const r = rooms[code];
  if (!r || !r.members[memberId]) return false;
  r.members[memberId].lastSeen = Date.now();
  return true;
}

export function wake(code, memberId) {
  const r = rooms[code];
  if (!r) return { error: 'room_not_found' };
  if (!r.members[memberId]) return { error: 'not_in_room' };
  if (r.lockHolder && r.lockHolder !== memberId) {
    return { error: 'locked', heldBy: r.members[r.lockHolder]?.name || 'someone' };
  }
  r.lockHolder = memberId;
  r.lockAcquiredAt = Date.now();
  persistRooms(rooms);
  broadcast(code);
  return { ok: true, room: serializeRoom(r) };
}

export function sleep(code, memberId, size) {
  const r = rooms[code];
  if (!r) return { error: 'room_not_found' };
  if (r.lockHolder !== memberId) return { error: 'not_lock_holder' };
  r.lockHolder = null;
  r.lockAcquiredAt = null;
  r.saveVersion += 1;
  r.lastSyncAt = Date.now();
  r.saveSize = size;
  persistRooms(rooms);
  broadcast(code);
  return { ok: true, room: serializeRoom(r) };
}

export function forceUnlock(code, memberId) {
  const r = rooms[code];
  if (!r) return { error: 'room_not_found' };
  if (!r.members[memberId]) return { error: 'not_in_room' };
  r.lockHolder = null;
  r.lockAcquiredAt = null;
  persistRooms(rooms);
  broadcast(code);
  return { ok: true, room: serializeRoom(r) };
}

function serializeRoom(r) {
  const now = Date.now();
  const members = Object.values(r.members).map((m) => ({
    id: m.id,
    name: m.name,
    online: now - m.lastSeen < OFFLINE_AFTER_MS,
    lastSeen: m.lastSeen,
  }));
  return {
    code: r.code,
    createdAt: r.createdAt,
    lockHolder: r.lockHolder,
    lockHolderName: r.lockHolder ? r.members[r.lockHolder]?.name || null : null,
    lockAcquiredAt: r.lockAcquiredAt,
    saveVersion: r.saveVersion,
    lastSyncAt: r.lastSyncAt,
    saveSize: r.saveSize || (saveExists(r.code) ? getSaveSize(r.code) : 0),
    hasSave: saveExists(r.code),
    members,
  };
}

export function subscribe(code, ws) {
  if (!subscribers.has(code)) subscribers.set(code, new Set());
  subscribers.get(code).add(ws);
}

export function unsubscribe(code, ws) {
  const set = subscribers.get(code);
  if (!set) return;
  set.delete(ws);
  if (set.size === 0) subscribers.delete(code);
}

export function broadcast(code) {
  const set = subscribers.get(code);
  if (!set) return;
  const payload = JSON.stringify({ type: 'room_update', room: getRoom(code) });
  for (const ws of set) {
    if (ws.readyState === 1) {
      try { ws.send(payload); } catch {}
    }
  }
}

setInterval(() => {
  for (const code of Object.keys(rooms)) {
    broadcast(code);
  }
}, 10_000);
