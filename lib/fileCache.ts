import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Small JSON-file cache in data/cache/<name>.json (git-ignored), so slow lookups survive restarts.
 * On read-only hosting the writes fail silently and the in-memory copy still works.
 */
export function fileCache<T>(name: string) {
  const file = path.join(process.cwd(), 'data', 'cache', `${name}.json`);
  let entries: Map<string, { expires: number; value: T }> | null = null;
  const load = () => {
    if (entries) return entries;
    entries = new Map();
    try { if (existsSync(file)) for (const [k, v] of Object.entries(JSON.parse(readFileSync(file, 'utf8')))) entries.set(k, v as { expires: number; value: T }); } catch { /* start empty */ }
    return entries;
  };
  return {
    get(key: string): T | undefined { const e = load().get(key); return e && e.expires > Date.now() ? e.value : undefined; },
    set(key: string, value: T, ttlMs: number) {
      load().set(key, { expires: Date.now() + ttlMs, value });
      try { mkdirSync(path.dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(Object.fromEntries(load()), null, 1)); } catch { /* read-only */ }
    },
  };
}
