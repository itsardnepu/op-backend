import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import 'dotenv/config';

/**
 * API key sources:
 * 1) Environment keys (legacy/fallback)
 * 2) Managed keys persisted in JSON (for admin UI operations)
 */
const PUBLIC_API_KEY = process.env.PUBLIC_API_KEY?.trim() || '';
const API_KEYS_STR = process.env.API_KEYS?.trim() || '';
const API_KEYS = API_KEYS_STR
  ? API_KEYS_STR.split(',').map((k) => k.trim()).filter(Boolean)
  : [];
const API_KEYS_STORE =
  process.env.API_KEYS_STORE ||
  path.resolve(process.cwd(), 'data', 'api-keys.json');

export interface ManagedApiKey {
  id: string;
  name: string;
  prefix: string;
  keyHash: string;
  isActive: boolean;
  rateLimitPerMin: number;
  createdAt: string;
  lastUsedAt: string | null;
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

function ensureStore(): void {
  const dir = path.dirname(API_KEYS_STORE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(API_KEYS_STORE)) {
    fs.writeFileSync(API_KEYS_STORE, JSON.stringify({ keys: [] }, null, 2), 'utf-8');
  }
}

function readStore(): ManagedApiKey[] {
  try {
    ensureStore();
    const raw = fs.readFileSync(API_KEYS_STORE, 'utf-8');
    const parsed = JSON.parse(raw) as { keys?: ManagedApiKey[] };
    return Array.isArray(parsed.keys) ? parsed.keys : [];
  } catch {
    return [];
  }
}

function writeStore(keys: ManagedApiKey[]): void {
  ensureStore();
  fs.writeFileSync(API_KEYS_STORE, JSON.stringify({ keys }, null, 2), 'utf-8');
}

export function listManagedKeys(): Omit<ManagedApiKey, 'keyHash'>[] {
  return readStore().map(({ keyHash: _keyHash, ...rest }) => rest);
}

export function createManagedKey(input: { name: string; rateLimitPerMin?: number }): {
  key: string;
  meta: Omit<ManagedApiKey, 'keyHash'>;
} {
  const plain = `gt_${crypto.randomBytes(24).toString('hex')}`;
  const now = new Date().toISOString();
  const item: ManagedApiKey = {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    prefix: plain.slice(0, 10),
    keyHash: sha256(plain),
    isActive: true,
    rateLimitPerMin: Math.max(1, input.rateLimitPerMin ?? 60),
    createdAt: now,
    lastUsedAt: null,
  };
  const keys = readStore();
  keys.push(item);
  writeStore(keys);
  const { keyHash: _keyHash, ...meta } = item;
  return { key: plain, meta };
}

export function updateManagedKey(
  id: string,
  patch: Partial<Pick<ManagedApiKey, 'name' | 'isActive' | 'rateLimitPerMin'>>
): Omit<ManagedApiKey, 'keyHash'> | null {
  const keys = readStore();
  const idx = keys.findIndex((k) => k.id === id);
  if (idx === -1) return null;
  const existing = keys[idx];
  keys[idx] = {
    ...existing,
    name: patch.name !== undefined ? patch.name.trim() : existing.name,
    isActive: patch.isActive ?? existing.isActive,
    rateLimitPerMin:
      patch.rateLimitPerMin !== undefined
        ? Math.max(1, patch.rateLimitPerMin)
        : existing.rateLimitPerMin,
  };
  writeStore(keys);
  const { keyHash: _keyHash, ...meta } = keys[idx];
  return meta;
}

export function deleteManagedKey(id: string): boolean {
  const keys = readStore();
  const filtered = keys.filter((k) => k.id !== id);
  if (filtered.length === keys.length) return false;
  writeStore(filtered);
  return true;
}

export function isValidKey(key: string | undefined): boolean {
  if (!key) return false;
  if (key === PUBLIC_API_KEY || API_KEYS.includes(key)) return true;
  const keyHash = sha256(key);
  return readStore().some((k) => k.isActive && k.keyHash === keyHash);
}

export function isPublicKey(key: string | undefined): boolean {
  return !!PUBLIC_API_KEY && key === PUBLIC_API_KEY;
}

export function touchLastUsed(key: string | undefined): void {
  if (!key) return;
  const keyHash = sha256(key);
  const keys = readStore();
  const idx = keys.findIndex((k) => k.keyHash === keyHash);
  if (idx === -1) return;
  keys[idx] = { ...keys[idx], lastUsedAt: new Date().toISOString() };
  writeStore(keys);
}

export function getRateLimitMax(key: string | undefined): number {
  if (isPublicKey(key)) return 30;
  if (key && API_KEYS.includes(key)) return 60;
  if (!key) return 60;
  const keyHash = sha256(key);
  const managed = readStore().find((k) => k.isActive && k.keyHash === keyHash);
  return managed?.rateLimitPerMin ?? 60;
}

export function hasAnyKeys(): boolean {
  return !!PUBLIC_API_KEY || API_KEYS.length > 0 || readStore().length > 0;
}
