// Tiny file cache: one JSON file per key under social-mirror/.cache, with a TTL.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '.cache');
const TTL_MS = Number(process.env.CACHE_HOURS || 24) * 3600 * 1000;

const pathFor = (key) => join(DIR, createHash('sha256').update(key).digest('hex').slice(0, 32) + '.json');

export async function cacheGet(key) {
  try {
    const entry = JSON.parse(await readFile(pathFor(key), 'utf8'));
    if (Date.now() - entry.savedAt > TTL_MS) return null;
    return entry;
  } catch {
    return null;
  }
}

export async function cacheSet(key, value) {
  await mkdir(DIR, { recursive: true });
  const entry = { key, savedAt: Date.now(), value };
  await writeFile(pathFor(key), JSON.stringify(entry));
  return entry;
}

// Returns { value, cachedAt } — cachedAt is null when freshly fetched.
export async function cached(key, fetcher, { refresh = false, shouldCache = () => true } = {}) {
  if (!refresh) {
    const hit = await cacheGet(key);
    if (hit) return { value: hit.value, cachedAt: new Date(hit.savedAt).toISOString() };
  }
  const value = await fetcher();
  if (shouldCache(value)) await cacheSet(key, value);
  return { value, cachedAt: null };
}
