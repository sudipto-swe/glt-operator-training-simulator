/**
 * Tiny storage abstraction so the records layer can run in Node tests
 * (memory backend) and the browser (localStorage) without DOM access.
 */

export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function memoryStorage(): StorageBackend {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k)
  };
}

/** localStorage when available (browsers), otherwise null. */
export function getBackend(): StorageBackend | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // SecurityError in some privacy modes - fall through to null.
  }
  return null;
}

export function loadJson(backend: StorageBackend | null, key: string): unknown {
  if (!backend) return null;
  try {
    const raw = backend.getItem(key);
    return raw == null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveJson(backend: StorageBackend | null, key: string, value: unknown): void {
  if (!backend) return;
  try {
    backend.setItem(key, JSON.stringify(value));
  } catch {
    // QuotaExceededError: records are best-effort; the app keeps running.
  }
}
