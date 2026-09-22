/**
 * In-memory LRU cache for System One responses keyed by request fingerprint.
 * Useful when the same state is re-asked with new questions (prefix / state reuse).
 */
export class LruCache<V> {
  private readonly map = new Map<string, V>();

  constructor(private readonly maxSize: number) {
    if (maxSize < 1) throw new Error("maxSize must be >= 1");
  }

  get(key: string): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    // refresh recency
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  set(key: string, value: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }

  get size(): number {
    return this.map.size;
  }
}

export function stableHash(input: string): string {
  // FNV-1a 32-bit — fast, deterministic, good enough for cache keys
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
