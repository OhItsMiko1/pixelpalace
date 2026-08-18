import type { NeedKey } from './NeedsSystem';
import type { QuestProgress } from './QuestSystem';

const STORAGE_KEY = 'pixelpalace-save-v1';
const SAVE_VERSION = 1;

export interface SaveData {
  version: typeof SAVE_VERSION;
  characterId: string;
  needs: Record<NeedKey, number>;
  hours: number;
  day: number;
  /** Added after v1 shipped — saves written before that predate this field despite the type; read with `??`. */
  reputation: number;
  /** Added after v1 shipped, same caveat as `reputation` — read with `??` / an `undefined` check. */
  quests?: QuestProgress;
  savedAt: number;
}

export function saveGame(data: Omit<SaveData, 'version'>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION }));
  } catch {
    // localStorage unavailable (private browsing, disabled storage, quota) — skip silently.
  }
}

export function loadGame(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as SaveData;
    if (data.version !== SAVE_VERSION) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
