import type { Song, Stem } from "../types";

const DB_NAME = "stemdeck";
const DB_VERSION = 1;
const STORE_NAME = "songs";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllSongs(): Promise<Song[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => {
      const songs = req.result as Song[];
      songs.sort((a, b) => b.dateAdded - a.dateAdded);
      resolve(songs);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSong(id: string): Promise<Song | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result as Song | undefined);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSong(song: Song): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(song);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteSong(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function generateId(): string {
  return crypto.randomUUID();
}

const STEM_COLORS = [
  "#e63946", "#f4a261", "#2a9d8f", "#264653",
  "#e76f51", "#606c38", "#bc6c25", "#4a4e69",
] as const;

const DRUM_KEYWORDS = ["drum", "drums", "kit", "perc", "percussion"];
const BASS_KEYWORDS = ["bass"];
const VOCAL_KEYWORDS = ["vocal", "vocals", "vox", "voice", "lead", "acapella", "choir"];

export function detectStemType(filename: string): Stem["type"] {
  const lower = filename.toLowerCase();
  if (DRUM_KEYWORDS.some((k) => lower.includes(k))) return "drums";
  if (BASS_KEYWORDS.some((k) => lower.includes(k))) return "bass";
  if (VOCAL_KEYWORDS.some((k) => lower.includes(k))) return "vocals";
  return "other";
}

export function getStemColor(index: number): string {
  return STEM_COLORS[index % STEM_COLORS.length];
}

export function createStem(file: File, colorIndex: number): Stem {
  return {
    id: generateId(),
    name: file.name.replace(/\.[^.]+$/, ""),
    type: detectStemType(file.name),
    blob: file,
    colorIndex,
  };
}
