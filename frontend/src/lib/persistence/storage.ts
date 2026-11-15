import type { Role, User } from "../types";

const VERSION = "v1";
const PREFIX = `nattyrex:${VERSION}`;
const CACHED_USER_KEY = `${PREFIX}:user`;
const ROUTE_PREFIX = `${PREFIX}:route`;
const UI_PREFIX = `${PREFIX}:ui`;
const DRAFT_PREFIX = `${PREFIX}:draft`;
const SCROLL_PREFIX = `${PREFIX}:scroll`;

const DRAFT_TTL_MS = 30 * 24 * 60 * 60_000;
const ROUTE_TTL_MS = 30 * 24 * 60 * 60_000;
const SCROLL_TTL_MS = 24 * 60 * 60_000;

type StorageKind = "local" | "session";

const lifecycleFlushers = new Set<() => void>();

export interface DraftRecord<T> {
  value: T;
  updatedAt: number;
}

export function roleHome(role: Role): string {
  return role === "TRAINER" ? "/trainer/dashboard" : "/app";
}

export function isRouteForRole(role: Role, path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0];
  if (!pathname.startsWith("/")) return false;
  return role === "TRAINER"
    ? pathname === "/trainer" || pathname.startsWith("/trainer/")
    : pathname === "/app" || pathname.startsWith("/app/");
}

function storage(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readJson<T>(kind: StorageKind, key: string): T | null {
  const target = storage(kind);
  if (!target) return null;
  try {
    const raw = target.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJson(kind: StorageKind, key: string, value: unknown): void {
  const target = storage(kind);
  if (!target) return;
  try {
    target.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full, disabled or unavailable in private browsing.
  }
}

export function removeStored(kind: StorageKind, key: string): void {
  const target = storage(kind);
  if (!target) return;
  try {
    target.removeItem(key);
  } catch {
    // Ignore unavailable storage.
  }
}

export function removeStoredWhere(kind: StorageKind, predicate: (key: string) => boolean): void {
  const target = storage(kind);
  if (!target) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (key && predicate(key)) keys.push(key);
    }
    keys.forEach((key) => target.removeItem(key));
  } catch {
    // Ignore unavailable storage.
  }
}

export function cacheUser(user: User): void {
  writeJson("local", CACHED_USER_KEY, { userId: user.id, user });
}

export function readCachedUser(): User | null {
  const record = readJson<{ userId?: string; user?: User }>("local", CACHED_USER_KEY);
  if (!record?.user || record.userId !== record.user.id) {
    removeStored("local", CACHED_USER_KEY);
    return null;
  }
  if (record.user.role !== "TRAINER" && record.user.role !== "CLIENT") {
    removeStored("local", CACHED_USER_KEY);
    return null;
  }
  return record.user;
}

export function clearCachedUser(): void {
  removeStored("local", CACHED_USER_KEY);
}

export function saveLastRoute(userId: string, role: Role, path: string): void {
  if (!isRouteForRole(role, path)) return;
  writeJson("local", `${ROUTE_PREFIX}:${userId}`, { role, path, savedAt: Date.now() });
}

export function readLastRoute(userId: string, role: Role): string | null {
  const key = `${ROUTE_PREFIX}:${userId}`;
  const record = readJson<{ role?: Role; path?: string; savedAt?: number }>("local", key);
  if (!record?.path || record.role !== role || !record.savedAt || Date.now() - record.savedAt > ROUTE_TTL_MS) {
    removeStored("local", key);
    return null;
  }
  if (!isRouteForRole(role, record.path)) {
    removeStored("local", key);
    return null;
  }
  return record.path;
}

export function uiStorageKey(userId: string, key: string): string {
  return `${UI_PREFIX}:${userId}:${key}`;
}

export function draftStorageKey(userId: string, key: string): string {
  return `${DRAFT_PREFIX}:${userId}:${key}`;
}

export function scrollStorageKey(userId: string, path: string): string {
  return `${SCROLL_PREFIX}:${userId}:${path}`;
}

export function readDraft<T>(userId: string, key: string): DraftRecord<T> | null {
  const storageKey = draftStorageKey(userId, key);
  const record = readJson<DraftRecord<T>>("local", storageKey);
  if (!record || typeof record.updatedAt !== "number") {
    removeStored("local", storageKey);
    return null;
  }
  if (Date.now() - record.updatedAt > DRAFT_TTL_MS) {
    removeStored("local", storageKey);
    return null;
  }
  return record;
}

export function writeDraft<T>(userId: string, key: string, value: T): void {
  writeJson("local", draftStorageKey(userId, key), { value, updatedAt: Date.now() });
}

export function clearDraft(userId: string, key: string): void {
  removeStored("local", draftStorageKey(userId, key));
}

export function saveScrollPosition(userId: string, path: string, y: number): void {
  if (!Number.isFinite(y) || y < 0) return;
  writeJson("session", scrollStorageKey(userId, path), { y: Math.round(y), savedAt: Date.now() });
}

export function readScrollPosition(userId: string, path: string): number {
  const storageKey = scrollStorageKey(userId, path);
  const record = readJson<{ y?: number; savedAt?: number }>("session", storageKey);
  if (!record || typeof record.y !== "number" || !record.savedAt) return 0;
  if (Date.now() - record.savedAt > SCROLL_TTL_MS) {
    removeStored("session", storageKey);
    return 0;
  }
  return Math.max(0, record.y);
}

export function clearUserScopedState(userId?: string): void {
  clearCachedUser();
  if (!userId) {
    removeStoredWhere("local", (key) => key.startsWith(`${ROUTE_PREFIX}:`) || key.startsWith(`${DRAFT_PREFIX}:`));
    removeStoredWhere("session", (key) => key.startsWith(`${UI_PREFIX}:`) || key.startsWith(`${SCROLL_PREFIX}:`));
    return;
  }
  removeStored("local", `${ROUTE_PREFIX}:${userId}`);
  removeStoredWhere("local", (key) => key.startsWith(`${DRAFT_PREFIX}:${userId}:`));
  removeStoredWhere("session", (key) => key.startsWith(`${UI_PREFIX}:${userId}:`));
  removeStoredWhere("session", (key) => key.startsWith(`${SCROLL_PREFIX}:${userId}:`));
}

export function registerLifecycleFlush(flusher: () => void): () => void {
  lifecycleFlushers.add(flusher);
  return () => lifecycleFlushers.delete(flusher);
}

export function flushLifecycleState(): void {
  lifecycleFlushers.forEach((flusher) => {
    try {
      flusher();
    } catch {
      // One failing flusher must not prevent the rest from saving.
    }
  });
}
