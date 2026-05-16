import express from 'express';
import cors from 'cors';
import multer from 'multer';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import {
  createRoom,
  getRoom,
  joinRoom,
  wake,
  sleep,
  forceUnlock,
  subscribe,
  unsubscribe,
  heartbeat,
  getAggregateStats,
} from './rooms.js';
import { storeSave, readSave, ensureDir } from './storage.js';

const PORT = Number(process.env.PORT || 8787);
const MAX_SAVE_MB = Number(process.env.MAX_SAVE_MB || 100);
const DATA_DIR = process.env.DATA_DIR || './data';
const STATS_TOKEN = process.env.STATS_TOKEN || '';

ensureDir(DATA_DIR);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SAVE_MB * 1024 * 1024 },
});

app.get('/', (_req, res) => {
  res.json({ service: 'savehop', version: '0.1.0', ok: true });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// Owner-only aggregate stats. Disabled entirely when STATS_TOKEN is unset
// so the endpoint never exists publicly. Returns counts only — no member
// names, IDs, or room codes. The relay already tracks this internally to
// route saves and lock state; we're exposing aggregates of existing data,
// not collecting anything new from clients.
app.get('/stats', (req, res) => {
  if (!STATS_TOKEN) return res.status(404).json({ error: 'not_found' });
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || token !== STATS_TOKEN) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  res.json(getAggregateStats());
});

app.post('/rooms', (req, res) => {
  const { memberId, memberName } = req.body || {};
  if (!memberId || !memberName) return res.status(400).json({ error: 'missing_member' });
  const room = createRoom({ id: memberId, name: memberName });
  res.json({ room });
});

app.get('/rooms/:code', (req, res) => {
  const room = getRoom(req.params.code.toUpperCase());
  if (!room) return res.status(404).json({ error: 'not_found' });
  res.json({ room });
});

app.post('/rooms/:code/join', (req, res) => {
  const code = req.params.code.toUpperCase();
  const { memberId, memberName } = req.body || {};
  if (!memberId || !memberName) return res.status(400).json({ error: 'missing_member' });
  const room = joinRoom(code, { id: memberId, name: memberName });
  if (!room) return res.status(404).json({ error: 'not_found' });
  res.json({ room });
});

app.post('/rooms/:code/heartbeat', (req, res) => {
  const code = req.params.code.toUpperCase();
  const { memberId } = req.body || {};
  const ok = heartbeat(code, memberId);
  res.json({ ok });
});

app.post('/rooms/:code/wake', (req, res) => {
  const code = req.params.code.toUpperCase();
  const { memberId } = req.body || {};
  const result = wake(code, memberId);
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

app.post('/rooms/:code/sleep', upload.single('save'), (req, res) => {
  const code = req.params.code.toUpperCase();
  const memberId = req.body.memberId;
  if (!req.file) return res.status(400).json({ error: 'missing_file' });
  storeSave(code, req.file.buffer);
  const result = sleep(code, memberId, req.file.size);
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

app.get('/rooms/:code/save', (req, res) => {
  const code = req.params.code.toUpperCase();
  const room = getRoom(code);
  if (!room) return res.status(404).json({ error: 'not_found' });
  const buf = readSave(code);
  if (!buf) return res.status(404).json({ error: 'no_save_yet' });
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('X-Save-Version', String(room.saveVersion));
  res.send(buf);
});

app.delete('/rooms/:code/lock', (req, res) => {
  const code = req.params.code.toUpperCase();
  const { memberId } = req.body || {};
  const result = forceUnlock(code, memberId);
  if (result.error) return res.status(409).json(result);
  res.json(result);
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://localhost');
  const code = (url.searchParams.get('room') || '').toUpperCase();
  if (!code) return ws.close();
  subscribe(code, ws);

  ws.on('close', () => unsubscribe(code, ws));
  ws.on('error', () => unsubscribe(code, ws));

  const room = getRoom(code);
  if (room) ws.send(JSON.stringify({ type: 'room_update', room }));
});

server.listen(PORT, () => {
  console.log(`[savehop] listening on :${PORT} (data=${DATA_DIR}, max=${MAX_SAVE_MB}MB)`);
});
