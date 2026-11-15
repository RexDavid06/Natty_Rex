import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useAuth } from "../auth";
import {
  draftStorageKey,
  clearDraft,
  readDraft,
  readJson,
  registerLifecycleFlush,
  uiStorageKey,
  writeDraft,
  writeJson,
} from "./storage";

function resolveValue<T>(value: T | (() => T)): T {
  return typeof value === "function" ? (value as () => T)() : value;
}

export function usePersistentState<T>(key: string, initialValue: T | (() => T)) {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const storageKey = uiStorageKey(userId, key);
  const initialRef = useRef(initialValue);
  initialRef.current = initialValue;
  const keyRef = useRef(storageKey);
  const skipWriteRef = useRef(false);
  const [value, setValue] = useState<T>(() => readJson<T>("session", storageKey) ?? resolveValue(initialRef.current));

  useEffect(() => {
    if (keyRef.current === storageKey) return;
    keyRef.current = storageKey;
    skipWriteRef.current = true;
    setValue(readJson<T>("session", storageKey) ?? resolveValue(initialRef.current));
  }, [storageKey]);

  useEffect(() => {
    if (skipWriteRef.current) {
      skipWriteRef.current = false;
      return;
    }
    writeJson("session", storageKey, value);
  }, [storageKey, value]);

  return [value, setValue] as const;
}

export function useDraftState<T>(key: string, initialValue: T | (() => T)) {
  const { user } = useAuth();
  const userId = user?.id ?? "anonymous";
  const storageKey = draftStorageKey(userId, key);
  const initialRef = useRef(initialValue);
  initialRef.current = initialValue;
  const keyRef = useRef(storageKey);
  const dirtyRef = useRef(false);
  const valueRef = useRef<T>(readDraft<T>(userId, key)?.value ?? resolveValue(initialRef.current));
  const [value, setValue] = useState<T>(valueRef.current);
  const [restored, setRestored] = useState(() => Boolean(readDraft<T>(userId, key)));
  const [savedAt, setSavedAt] = useState<number | null>(() => readDraft<T>(userId, key)?.updatedAt ?? null);

  useEffect(() => {
    if (keyRef.current === storageKey) return;
    keyRef.current = storageKey;
    const record = readDraft<T>(userId, key);
    const next = record?.value ?? resolveValue(initialRef.current);
    dirtyRef.current = false;
    valueRef.current = next;
    setValue(next);
    setRestored(Boolean(record));
    setSavedAt(record?.updatedAt ?? null);
  }, [key, storageKey, userId]);

  useEffect(() => {
    if (!dirtyRef.current) return;
    writeDraft(userId, key, value);
    setSavedAt(Date.now());
  }, [key, userId, value]);

  const update = useCallback<Dispatch<SetStateAction<T>>>((next) => {
    dirtyRef.current = true;
    setValue((current) => {
      const resolved = typeof next === "function" ? (next as (previous: T) => T)(current) : next;
      valueRef.current = resolved;
      return resolved;
    });
  }, []);

  const clear = useCallback(() => {
    dirtyRef.current = false;
    clearDraft(userId, key);
    const next = resolveValue(initialRef.current);
    valueRef.current = next;
    setValue(next);
    setRestored(false);
    setSavedAt(null);
  }, [key, userId]);

  const flush = useCallback(() => {
    if (dirtyRef.current) writeDraft(userId, key, valueRef.current);
  }, [key, userId]);

  useEffect(() => registerLifecycleFlush(flush), [flush]);

  return { value, setValue: update, restored, savedAt, clear, flush } as const;
}
