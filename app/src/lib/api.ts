import type { RoomState } from './store';

export class ApiError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch {}
    throw new ApiError(body?.error || `HTTP ${res.status}`, res.status, body?.error);
  }
  return res.json();
}

/** Run a fetch and translate the opaque "Failed to fetch" into a useful diagnostic. */
async function safeFetch(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e: any) {
    const detail = e?.message || String(e);
    // WebView2 / TLS / DNS surfaces as "Failed to fetch" with no detail.
    throw new ApiError(
      `Cannot reach server at ${url} — ${detail}. Check your internet connection or change Server URL in Settings.`,
    );
  }
}

export const api = {
  async createRoom(server: string, memberId: string, memberName: string): Promise<RoomState> {
    const res = await safeFetch(`${server}/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, memberName }),
    });
    return (await handle<{ room: RoomState }>(res)).room;
  },

  async getRoom(server: string, code: string): Promise<RoomState> {
    const res = await safeFetch(`${server}/rooms/${code}`);
    return (await handle<{ room: RoomState }>(res)).room;
  },

  async joinRoom(server: string, code: string, memberId: string, memberName: string): Promise<RoomState> {
    const res = await safeFetch(`${server}/rooms/${code}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, memberName }),
    });
    return (await handle<{ room: RoomState }>(res)).room;
  },

  async heartbeat(server: string, code: string, memberId: string): Promise<void> {
    await safeFetch(`${server}/rooms/${code}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    }).catch(() => {});
  },

  async wake(server: string, code: string, memberId: string): Promise<RoomState> {
    const res = await safeFetch(`${server}/rooms/${code}/wake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    return (await handle<{ room: RoomState }>(res)).room;
  },

  async sleep(server: string, code: string, memberId: string, data: Uint8Array): Promise<RoomState> {
    const form = new FormData();
    form.append('memberId', memberId);
    // Copy into a fresh ArrayBuffer so the Blob constructor sees ArrayBuffer (not SharedArrayBuffer)
    // — required by TypeScript 5.7+'s stricter Uint8Array generics.
    const ab = new ArrayBuffer(data.byteLength);
    new Uint8Array(ab).set(data);
    form.append('save', new Blob([ab], { type: 'application/octet-stream' }), 'save.bin');
    const res = await safeFetch(`${server}/rooms/${code}/sleep`, { method: 'POST', body: form });
    return (await handle<{ room: RoomState }>(res)).room;
  },

  async downloadSave(server: string, code: string): Promise<Uint8Array> {
    const res = await safeFetch(`${server}/rooms/${code}/save`);
    if (!res.ok) {
      let body: any = null;
      try { body = await res.json(); } catch {}
      throw new ApiError(body?.error || `HTTP ${res.status}`, res.status, body?.error);
    }
    const ab = await res.arrayBuffer();
    return new Uint8Array(ab);
  },

  async forceUnlock(server: string, code: string, memberId: string): Promise<RoomState> {
    const res = await safeFetch(`${server}/rooms/${code}/lock`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId }),
    });
    return (await handle<{ room: RoomState }>(res)).room;
  },

  openWebSocket(server: string, code: string): WebSocket {
    const wsUrl = server.replace(/^http/, 'ws') + `/ws?room=${code}`;
    return new WebSocket(wsUrl);
  },
};
