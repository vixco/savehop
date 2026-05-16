import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Member = {
  id: string;
  name: string;
  online: boolean;
  lastSeen: number;
};

export type RoomState = {
  code: string;
  createdAt: number;
  lockHolder: string | null;
  lockHolderName: string | null;
  lockAcquiredAt: number | null;
  saveVersion: number;
  lastSyncAt: number | null;
  saveSize: number;
  hasSave: boolean;
  members: Member[];
};

export type SyncStatus = 'idle' | 'uploading' | 'downloading' | 'error' | 'ready';

export type SelectedGame = {
  name: string;
  exePath: string;
  exeName: string;
  savePath: string;
  /** 'folder' when the save is a directory (zip/unzip); 'file' when a single file. */
  saveKind: 'folder' | 'file';
};

function uuid() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DEFAULT_SERVER = (import.meta as any).env?.VITE_SERVER_URL || 'https://savehop.fly.dev';

type Store = {
  // Identity
  memberId: string;
  memberName: string;

  // Connection
  serverUrl: string;
  gamePath: string;
  selectedGame: SelectedGame | null;
  roomCode: string | null;
  room: RoomState | null;

  // Sync state (not persisted)
  syncStatus: SyncStatus;
  errorMessage: string | null;

  // Auto-mode preferences
  autoRejoin: boolean;
  autoWakeOnLaunch: boolean;
  autoSleepOnGameExit: boolean;
  startMinimized: boolean;
  launchOnStartup: boolean;

  // Setters
  setMemberName: (n: string) => void;
  setServerUrl: (u: string) => void;
  setGamePath: (p: string) => void;
  setSelectedGame: (g: SelectedGame | null) => void;
  setRoomCode: (c: string | null) => void;
  setRoom: (r: RoomState | null) => void;
  setSyncStatus: (s: SyncStatus) => void;
  setError: (msg: string | null) => void;

  setAutoRejoin: (v: boolean) => void;
  setAutoWakeOnLaunch: (v: boolean) => void;
  setAutoSleepOnGameExit: (v: boolean) => void;
  setStartMinimized: (v: boolean) => void;
  setLaunchOnStartup: (v: boolean) => void;

  isLockHolder: () => boolean;
};

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      memberId: uuid(),
      memberName: '',
      serverUrl: DEFAULT_SERVER,
      gamePath: '',
      selectedGame: null,
      roomCode: null,
      room: null,
      syncStatus: 'idle',
      errorMessage: null,

      autoRejoin: true,
      autoWakeOnLaunch: false,
      autoSleepOnGameExit: false,
      startMinimized: false,
      launchOnStartup: false,

      setMemberName: (memberName) => set({ memberName }),
      setServerUrl: (serverUrl) => set({ serverUrl: serverUrl.trim().replace(/\/+$/, '') }),
      setGamePath: (gamePath) => set({ gamePath }),
      setSelectedGame: (selectedGame) => set({ selectedGame }),
      setRoomCode: (roomCode) => set({ roomCode }),
      setRoom: (room) => set({ room }),
      setSyncStatus: (syncStatus) => set({ syncStatus }),
      setError: (errorMessage) => set({ errorMessage }),

      setAutoRejoin: (v) => set({ autoRejoin: v }),
      setAutoWakeOnLaunch: (v) => set({ autoWakeOnLaunch: v }),
      setAutoSleepOnGameExit: (v) => set({ autoSleepOnGameExit: v }),
      setStartMinimized: (v) => set({ startMinimized: v }),
      setLaunchOnStartup: (v) => set({ launchOnStartup: v }),

      isLockHolder: () => {
        const s = get();
        return !!s.room && s.room.lockHolder === s.memberId;
      },
    }),
    {
      name: 'savehop',
      partialize: (s) => ({
        memberId: s.memberId,
        memberName: s.memberName,
        serverUrl: s.serverUrl,
        gamePath: s.gamePath,
        selectedGame: s.selectedGame,
        roomCode: s.roomCode,
        autoRejoin: s.autoRejoin,
        autoWakeOnLaunch: s.autoWakeOnLaunch,
        autoSleepOnGameExit: s.autoSleepOnGameExit,
        startMinimized: s.startMinimized,
        launchOnStartup: s.launchOnStartup,
      }),
    },
  ),
);
