import { customAlphabet } from 'nanoid';
import { loadRooms, persistRooms, saveExists, getSaveSize } from './storage.js';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const newCode = customAlphabet(ALPHABET, 6);

const rooms = loadRooms();
const subscribers = new Map();

const OFFLINE_AFTER_MS = 30_000;
const HOST_STALE_AFTER_MS = 60_000;

// Migrate any rooms loaded from disk to the v2 shape.
for (const r of Object.values(rooms)) {
  if (!r.lastHostAt) r.lastHostAt = {};
}

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
    lastHostAt: {},
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
  // Serialize before returning so clients always see members as an array.
  return serializeRoom(rooms[code]);
}

export function getRoom(code) {
  const r = rooms[code];
  if (!r) return null;
  return serializeRoom(r);
}

export function joinRoom(code, member) {
  const r = rooms[code];
  if (!r) return null;
  if (!r.lastHostAt) r.lastHostAt = {};
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
  r.lastHostAt = r.lastHostAt || {};
  r.lastHostAt[memberId] = Date.now();
  r.lockHolder = null;
  r.lockAcquiredAt = null;
  r.saveVersion += 1;
  r.lastSyncAt = Date.now();
  r.saveSize = size;
  persistRooms(rooms);
  broadcast(code);
  promoteNextHost(code, memberId);
  return { ok: true, room: serializeRoom(r) };
}

export function forceUnlock(code, memberId) {
  const r = rooms[code];
  if (!r) return { error: 'room_not_found' };
  if (!r.members[memberId]) return { error: 'not_in_room' };
  const previous = r.lockHolder;
  if (previous) {
    r.lastHostAt = r.lastHostAt || {};
    r.lastHostAt[previous] = Date.now();
  }
  r.lockHolder = null;
  r.lockAcquiredAt = null;
  persistRooms(rooms);
  broadcast(code);
  if (previous) promoteNextHost(code, previous);
  return { ok: true, room: serializeRoom(r) };
}

/**
 * Pick the next eligible online member and emit a `host_promoted` event.
 * Does NOT acquire the lock for them — they still need to /wake to download.
 */
function promoteNextHost(code, previousHolderId) {
  const r = rooms[code];
  if (!r) return null;
  const now = Date.now();
  const candidates = Object.values(r.members)
    .filter((m) => m.id !== previousHolderId && now - m.lastSeen < OFFLINE_AFTER_MS)
    .sort((a, b) => {
      const la = r.lastHostAt?.[a.id] ?? 0;
      const lb = r.lastHostAt?.[b.id] ?? 0;
      if (la !== lb) return la - lb;
      return a.joinedAt - b.joinedAt;
    });

  if (candidates.length === 0) return null;
  const next = candidates[0];
  emitEvent(code, {
    type: 'host_promoted',
    memberId: next.id,
    memberName: next.name,
    previousHolderId: previousHolderId || null,
    ts: Date.now(),
  });
  return next.id;
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

/**
 * Aggregate counts only — no member names, IDs, or room codes leave this
 * function. Used by the owner-only /stats endpoint. We're not collecting
 * anything new here: every value is derived from data the relay already
 * needs to track in order to route saves and lock state.
 */
export function getAggregateStats() {
  const now = Date.now();
  const allRooms = Object.values(rooms);

  // Unique members across all rooms, deduped by id. A user who joins
  // multiple rooms still counts once.
  const allIds = new Set();
  const onlineIds = new Set();
  let activeRooms = 0; // rooms with at least one online member OR a held lock

  for (const r of allRooms) {
    let roomHasOnline = false;
    for (const m of Object.values(r.members)) {
      allIds.add(m.id);
      if (now - m.lastSeen < OFFLINE_AFTER_MS) {
        onlineIds.add(m.id);
        roomHasOnline = true;
      }
    }
    if (roomHasOnline || r.lockHolder) activeRooms += 1;
  }

  return {
    rooms: allRooms.length,
    activeRooms,
    members: allIds.size,
    onlineMembers: onlineIds.size,
    serverTime: now,
  };
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

function emitEvent(code, payload) {
  const set = subscribers.get(code);
  if (!set) return;
  const serialized = JSON.stringify(payload);
  for (const ws of set) {
    if (ws.readyState === 1) {
      try { ws.send(serialized); } catch {}
    }
  }
}

// Unified ticker: broadcast room state every 10s, and detect stale hosts
// (heartbeat dead for >60s) so we can auto-promote without waiting on the
// host's client to do anything.
setInterval(() => {
  const now = Date.now();
  for (const code of Object.keys(rooms)) {
    const r = rooms[code];
    if (r.lockHolder) {
      const holder = r.members[r.lockHolder];
      const lastSeen = holder?.lastSeen ?? 0;
      if (!holder || now - lastSeen > HOST_STALE_AFTER_MS) {
        const previous = r.lockHolder;
        r.lastHostAt = r.lastHostAt || {};
        r.lastHostAt[previous] = lastSeen || now;
        r.lockHolder = null;
        r.lockAcquiredAt = null;
        persistRooms(rooms);
        broadcast(code);
        promoteNextHost(code, previous);
        continue;
      }
    }
    broadcast(code);
  }
}, 10_000);
