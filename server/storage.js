import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || './data';
const MAX_VERSIONS = 5;

export function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

export function roomDir(code) {
  return path.join(DATA_DIR, code);
}

export function loadRooms() {
  const file = path.join(DATA_DIR, 'rooms.json');
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

let saveTimer = null;
export function persistRooms(rooms) {
  ensureDir(DATA_DIR);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const file = path.join(DATA_DIR, 'rooms.json');
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(rooms, null, 2));
    fs.renameSync(tmp, file);
  }, 200);
}

export function storeSave(code, buffer) {
  const dir = roomDir(code);
  ensureDir(dir);
  const current = path.join(dir, 'save.bin');
  if (fs.existsSync(current)) {
    rotateVersions(dir);
    fs.renameSync(current, path.join(dir, 'save.1.bin'));
  }
  fs.writeFileSync(current, buffer);
}

function rotateVersions(dir) {
  for (let i = MAX_VERSIONS - 1; i >= 1; i--) {
    const src = path.join(dir, `save.${i}.bin`);
    const dst = path.join(dir, `save.${i + 1}.bin`);
    if (fs.existsSync(src)) {
      if (i + 1 > MAX_VERSIONS) {
        fs.unlinkSync(src);
      } else {
        fs.renameSync(src, dst);
      }
    }
  }
}

export function readSave(code) {
  const file = path.join(roomDir(code), 'save.bin');
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file);
}

export function saveExists(code) {
  return fs.existsSync(path.join(roomDir(code), 'save.bin'));
}

export function getSaveSize(code) {
  const file = path.join(roomDir(code), 'save.bin');
  if (!fs.existsSync(file)) return 0;
  return fs.statSync(file).size;
}
