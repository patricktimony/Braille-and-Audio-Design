// Key-value storage. The prototype keeps everything in this browser only.
// A future server-backed store can implement the same interface.

export interface KeyValueStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
}

export class MemoryStore implements KeyValueStore {
  private data = new Map<string, string>();
  get<T>(key: string): T | undefined {
    const raw = this.data.get(key);
    return raw === undefined ? undefined : (JSON.parse(raw) as T);
  }
  set<T>(key: string, value: T): void {
    this.data.set(key, JSON.stringify(value));
  }
  remove(key: string): void {
    this.data.delete(key);
  }
}

/** Uses localStorage, falling back to memory when storage is blocked (e.g. private browsing). */
export class BrowserStore implements KeyValueStore {
  private fallback = new MemoryStore();

  get<T>(key: string): T | undefined {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? undefined : (JSON.parse(raw) as T);
    } catch {
      return this.fallback.get<T>(key);
    }
  }
  set<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      this.fallback.set(key, value);
    }
  }
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      this.fallback.remove(key);
    }
  }
}
