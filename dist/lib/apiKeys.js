"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.listManagedKeys = listManagedKeys;
exports.createManagedKey = createManagedKey;
exports.updateManagedKey = updateManagedKey;
exports.deleteManagedKey = deleteManagedKey;
exports.isValidKey = isValidKey;
exports.isPublicKey = isPublicKey;
exports.touchLastUsed = touchLastUsed;
exports.getRateLimitMax = getRateLimitMax;
exports.hasAnyKeys = hasAnyKeys;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
require("dotenv/config");
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
const API_KEYS_STORE = process.env.API_KEYS_STORE ||
    node_path_1.default.resolve(process.cwd(), 'data', 'api-keys.json');
function sha256(input) {
    return node_crypto_1.default.createHash('sha256').update(input).digest('hex');
}
function ensureStore() {
    const dir = node_path_1.default.dirname(API_KEYS_STORE);
    if (!node_fs_1.default.existsSync(dir))
        node_fs_1.default.mkdirSync(dir, { recursive: true });
    if (!node_fs_1.default.existsSync(API_KEYS_STORE)) {
        node_fs_1.default.writeFileSync(API_KEYS_STORE, JSON.stringify({ keys: [] }, null, 2), 'utf-8');
    }
}
function readStore() {
    try {
        ensureStore();
        const raw = node_fs_1.default.readFileSync(API_KEYS_STORE, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed.keys) ? parsed.keys : [];
    }
    catch {
        return [];
    }
}
function writeStore(keys) {
    ensureStore();
    node_fs_1.default.writeFileSync(API_KEYS_STORE, JSON.stringify({ keys }, null, 2), 'utf-8');
}
function listManagedKeys() {
    return readStore().map(({ keyHash: _keyHash, ...rest }) => rest);
}
function createManagedKey(input) {
    const plain = `gt_${node_crypto_1.default.randomBytes(24).toString('hex')}`;
    const now = new Date().toISOString();
    const item = {
        id: node_crypto_1.default.randomUUID(),
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
function updateManagedKey(id, patch) {
    const keys = readStore();
    const idx = keys.findIndex((k) => k.id === id);
    if (idx === -1)
        return null;
    const existing = keys[idx];
    keys[idx] = {
        ...existing,
        name: patch.name !== undefined ? patch.name.trim() : existing.name,
        isActive: patch.isActive ?? existing.isActive,
        rateLimitPerMin: patch.rateLimitPerMin !== undefined
            ? Math.max(1, patch.rateLimitPerMin)
            : existing.rateLimitPerMin,
    };
    writeStore(keys);
    const { keyHash: _keyHash, ...meta } = keys[idx];
    return meta;
}
function deleteManagedKey(id) {
    const keys = readStore();
    const filtered = keys.filter((k) => k.id !== id);
    if (filtered.length === keys.length)
        return false;
    writeStore(filtered);
    return true;
}
function isValidKey(key) {
    if (!key)
        return false;
    if (key === PUBLIC_API_KEY || API_KEYS.includes(key))
        return true;
    const keyHash = sha256(key);
    return readStore().some((k) => k.isActive && k.keyHash === keyHash);
}
function isPublicKey(key) {
    return !!PUBLIC_API_KEY && key === PUBLIC_API_KEY;
}
function touchLastUsed(key) {
    if (!key)
        return;
    const keyHash = sha256(key);
    const keys = readStore();
    const idx = keys.findIndex((k) => k.keyHash === keyHash);
    if (idx === -1)
        return;
    keys[idx] = { ...keys[idx], lastUsedAt: new Date().toISOString() };
    writeStore(keys);
}
function getRateLimitMax(key) {
    if (isPublicKey(key))
        return 30;
    if (key && API_KEYS.includes(key))
        return 60;
    if (!key)
        return 60;
    const keyHash = sha256(key);
    const managed = readStore().find((k) => k.isActive && k.keyHash === keyHash);
    return managed?.rateLimitPerMin ?? 60;
}
function hasAnyKeys() {
    return !!PUBLIC_API_KEY || API_KEYS.length > 0 || readStore().length > 0;
}
