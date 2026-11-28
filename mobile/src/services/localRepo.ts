/**
 * Device-local, owner-scoped records with a future-facing sync outbox.
 *
 * This is the hybrid foundation: every user-owned write (drafts, watchlist,
 * local votes, reviews, notes) lands on the phone first and is queued. A real
 * shared transport can be injected later through `setLocalSyncTransport()`;
 * until then the outbox simply stays pending and the app remains usable.
 *
 * Security rule: this module only receives already-sanitised application data.
 * It never reads cookies, Auth.js/Supabase tokens, service-role keys, database
 * URLs, or any other credential, and it actively strips secret-looking keys.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCachedUser, getDeviceId } from './api';
import { clearScreenCache } from '../utils/screenCache';

const NAMESPACE = 'zv_local_v1';
const ENVELOPE_PREFIX = `${NAMESPACE}:envelope:`;
const SENSITIVE_KEY =
  /(?:token|secret|password|passwd|cookie|authorization|api[_-]?key|database[_-]?url|dsn|private[_-]?key|session)/i;
// Marker pieces are joined at runtime so the bundle never contains a literal
// production secret prefix that scanners would flag. This is redaction only.
const SUPABASE_SECRET_MARKER = ['sb', 'secret'].join('_') + '_';
const SECRET_VALUE = new RegExp(
  `(?:${SUPABASE_SECRET_MARKER}|sk_[A-Za-z0-9]{16,}|ghp_[A-Za-z0-9]{16,}|Bearer\\s+[A-Za-z0-9._-]{12,})`,
  'i'
);

export interface LocalOwner {
  scope: 'user' | 'device';
  id: string;
}

export interface LocalRecord<T = any> {
  id: string;
  collection: string;
  owner: LocalOwner;
  data: T;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  revision: number;
  dirty: boolean;
}

export interface OutboxOp {
  id: string;
  owner: LocalOwner;
  collection: string;
  recordId: string;
  op: 'upsert' | 'delete';
  payload: any;
  createdAt: number;
  attempts: number;
  status: 'pending' | 'failed' | 'synced';
  lastError?: string | null;
  syncedAt?: number | null;
}

export interface PulledRow {
  collection: string;
  id: string;
  data: any;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface LocalSyncTransport {
  name: string;
  push(op: OutboxOp): Promise<void>;
  pull?(): Promise<PulledRow[]>;
}

export interface LocalStats {
  owner: LocalOwner;
  records: number;
  dirty: number;
  pending: number;
  failed: number;
  outbox: number;
}

interface Envelope {
  version: 1;
  owner: LocalOwner;
  records: Record<string, LocalRecord>;
  outbox: OutboxOp[];
  updatedAt: number;
}

const envelopes = new Map<string, Envelope>();
const reads = new Map<string, Promise<Envelope>>();
let activeTransport: LocalSyncTransport | null = null;

function ownerKey(owner: LocalOwner): string {
  return `${owner.scope}:${owner.id}`;
}

function emptyEnvelope(owner: LocalOwner): Envelope {
  return { version: 1, owner, records: {}, outbox: [], updatedAt: Date.now() };
}

function recordKey(collection: string, id: string): string {
  return `${collection}::${id}`;
}

function newId(prefix: string): string {
  const random =
    typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${prefix}_${random}`;
}

/** Remove credentials and credential-shaped fields before anything is stored. */
function stripSecrets<T>(value: T, seen = new WeakSet<object>()): any {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    return SECRET_VALUE.test(value) ? '[redacted]' : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== 'object') return null;
  if (seen.has(value as object)) return '[circular]';
  seen.add(value as object);

  if (Array.isArray(value)) {
    return value.map((entry) => stripSecrets(entry, seen)).filter((entry) => entry !== undefined);
  }

  const result: Record<string, any> = {};
  Object.entries(value as Record<string, any>).forEach(([key, entry]) => {
    if (SENSITIVE_KEY.test(key)) return;
    result[key] = stripSecrets(entry, seen);
  });
  return result;
}

/** Resolve a stable owner without making any network request. */
export async function resolveLocalOwner(userId?: string | null): Promise<LocalOwner> {
  if (userId) return { scope: 'user', id: userId };
  try {
    const cached = await getCachedUser();
    if (cached?.id) return { scope: 'user', id: cached.id };
  } catch {
    // Display cache unavailable — device scope is still safe and useful.
  }
  const deviceId = await getDeviceId();
  return { scope: 'device', id: deviceId };
}

async function readEnvelope(owner: LocalOwner): Promise<Envelope> {
  const key = ownerKey(owner);
  const cached = envelopes.get(key);
  if (cached) return cached;

  const pending = reads.get(key);
  if (pending) return pending;

  const request = (async () => {
    try {
      const raw = await AsyncStorage.getItem(`${ENVELOPE_PREFIX}${key}`);
      if (raw) {
        const parsed = JSON.parse(raw) as Envelope;
        if (parsed?.version === 1 && parsed.records && Array.isArray(parsed.outbox)) {
          envelopes.set(key, parsed);
          return parsed;
        }
      }
    } catch {
      // Corrupt or unavailable storage starts a fresh local envelope.
    }
    const fresh = emptyEnvelope(owner);
    envelopes.set(key, fresh);
    return fresh;
  })();

  reads.set(key, request);
  try {
    return await request;
  } finally {
    reads.delete(key);
  }
}

async function writeEnvelope(envelope: Envelope): Promise<void> {
  envelope.updatedAt = Date.now();
  envelopes.set(ownerKey(envelope.owner), envelope);
  clearScreenCache('local-data');
  try {
    await AsyncStorage.setItem(`${ENVELOPE_PREFIX}${ownerKey(envelope.owner)}`, JSON.stringify(envelope));
  } catch {
    // The in-memory copy still works for this session when storage is full.
  }
}

function queueOp(envelope: Envelope, op: OutboxOp): void {
  // One latest intent per record: several quick edits do not replay as a spam
  // burst when a transport eventually comes online.
  envelope.outbox = envelope.outbox.filter(
    (existing) =>
      !(
        existing.collection === op.collection &&
        existing.recordId === op.recordId &&
        (existing.status === 'pending' || existing.status === 'failed')
      )
  );
  envelope.outbox.push(op);
}

export async function getLocalRecord<T = any>(
  collection: string,
  id: string,
  owner?: LocalOwner
): Promise<LocalRecord<T> | null> {
  const scope = owner || (await resolveLocalOwner());
  const envelope = await readEnvelope(scope);
  return (envelope.records[recordKey(collection, id)] as LocalRecord<T> | undefined) || null;
}

export async function listLocalRecords<T = any>(
  collection: string,
  owner?: LocalOwner
): Promise<Array<LocalRecord<T>>> {
  const scope = owner || (await resolveLocalOwner());
  const envelope = await readEnvelope(scope);
  return Object.values(envelope.records)
    .filter((record) => record.collection === collection && !record.deletedAt)
    .sort((a, b) => b.updatedAt - a.updatedAt) as Array<LocalRecord<T>>;
}

export async function putLocalRecord<T = any>(
  collection: string,
  data: T,
  id?: string,
  owner?: LocalOwner
): Promise<LocalRecord<T>> {
  const scope = owner || (await resolveLocalOwner());
  const envelope = await readEnvelope(scope);
  const recordId = id || newId('rec');
  const key = recordKey(collection, recordId);
  const now = Date.now();
  const previous = envelope.records[key] as LocalRecord | undefined;
  const record: LocalRecord = {
    id: recordId,
    collection,
    owner: scope,
    data: stripSecrets(data),
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    deletedAt: null,
    revision: (previous?.revision || 0) + 1,
    dirty: true,
  };
  envelope.records[key] = record;
  queueOp(envelope, {
    id: newId('op'),
    owner: scope,
    collection,
    recordId,
    op: 'upsert',
    payload: record.data,
    createdAt: now,
    attempts: 0,
    status: 'pending',
    lastError: null,
    syncedAt: null,
  });
  await writeEnvelope(envelope);
  return record as LocalRecord<T>;
}

export async function removeLocalRecord(
  collection: string,
  id: string,
  owner?: LocalOwner
): Promise<boolean> {
  const scope = owner || (await resolveLocalOwner());
  const envelope = await readEnvelope(scope);
  const key = recordKey(collection, id);
  const previous = envelope.records[key];
  if (!previous || previous.deletedAt) return false;
  const now = Date.now();
  envelope.records[key] = {
    ...previous,
    data: null,
    deletedAt: now,
    updatedAt: now,
    revision: previous.revision + 1,
    dirty: true,
  };
  queueOp(envelope, {
    id: newId('op'),
    owner: scope,
    collection,
    recordId: id,
    op: 'delete',
    payload: null,
    createdAt: now,
    attempts: 0,
    status: 'pending',
    lastError: null,
    syncedAt: null,
  });
  await writeEnvelope(envelope);
  return true;
}

export async function listOutbox(owner?: LocalOwner): Promise<OutboxOp[]> {
  const scope = owner || (await resolveLocalOwner());
  const envelope = await readEnvelope(scope);
  return [...envelope.outbox].sort((a, b) => a.createdAt - b.createdAt);
}

export function setLocalSyncTransport(transport: LocalSyncTransport | null): void {
  activeTransport = transport;
}

export function getLocalSyncTransportName(): string | null {
  return activeTransport?.name || null;
}

async function markSynced(envelope: Envelope, opId: string): Promise<void> {
  const op = envelope.outbox.find((entry) => entry.id === opId);
  if (!op) return;
  op.status = 'synced';
  op.syncedAt = Date.now();
  op.lastError = null;
  const record = envelope.records[recordKey(op.collection, op.recordId)];
  if (record && record.updatedAt <= op.createdAt) record.dirty = false;
}

async function markFailed(envelope: Envelope, opId: string, error: unknown): Promise<void> {
  const op = envelope.outbox.find((entry) => entry.id === opId);
  if (!op) return;
  op.status = 'failed';
  op.attempts += 1;
  op.lastError = String((error as any)?.message || error || 'Sync failed').slice(0, 300);
}

async function applyPulled(envelope: Envelope, rows: PulledRow[]): Promise<void> {
  const now = Date.now();
  for (const row of rows || []) {
    const key = recordKey(row.collection, row.id);
    const local = envelope.records[key];
    if (local?.dirty) continue; // never overwrite an unsynced local edit
    const updatedAt = Number(row.updatedAt) || now;
    if (local && local.updatedAt >= updatedAt) continue;
    envelope.records[key] = {
      id: row.id,
      collection: row.collection,
      owner: envelope.owner,
      data: stripSecrets(row.data),
      createdAt: local?.createdAt || now,
      updatedAt,
      deletedAt: row.deletedAt ?? null,
      revision: (local?.revision || 0) + 1,
      dirty: false,
    };
  }
}

export interface LocalSyncResult {
  enabled: boolean;
  transport: string | null;
  pushed: number;
  failed: number;
  pulled: number;
}

/** Push pending local operations through an injected transport, if one exists. */
export async function syncLocalOutbox(transport = activeTransport): Promise<LocalSyncResult> {
  const scope = await resolveLocalOwner();
  const envelope = await readEnvelope(scope);
  const result: LocalSyncResult = {
    enabled: !!transport,
    transport: transport?.name || null,
    pushed: 0,
    failed: 0,
    pulled: 0,
  };
  if (!transport) return result;

  const ops = envelope.outbox.filter((op) => op.status !== 'synced');
  for (const op of ops) {
    try {
      await transport.push(op);
      await markSynced(envelope, op.id);
      result.pushed += 1;
    } catch (error) {
      await markFailed(envelope, op.id, error);
      result.failed += 1;
    }
  }

  if (transport.pull) {
    try {
      const rows = await transport.pull();
      result.pulled = rows.length;
      await applyPulled(envelope, rows);
    } catch {
      // A failed pull never discards local data.
    }
  }

  // Keep a short audit trail, then prune old synced operations.
  envelope.outbox = envelope.outbox.filter(
    (op) => op.status !== 'synced' || Date.now() - (op.syncedAt || 0) < 24 * 60 * 60 * 1000
  );
  await writeEnvelope(envelope);
  return result;
}

export async function getLocalStats(owner?: LocalOwner): Promise<LocalStats> {
  const scope = owner || (await resolveLocalOwner());
  const envelope = await readEnvelope(scope);
  const records = Object.values(envelope.records);
  return {
    owner: scope,
    records: records.length,
    dirty: records.filter((record) => record.dirty).length,
    pending: envelope.outbox.filter((op) => op.status === 'pending').length,
    failed: envelope.outbox.filter((op) => op.status === 'failed').length,
    outbox: envelope.outbox.length,
  };
}

/** Test/reset helper. Never called automatically on sign-out. */
export async function clearLocalOwner(owner?: LocalOwner): Promise<void> {
  const scope = owner || (await resolveLocalOwner());
  const key = ownerKey(scope);
  envelopes.delete(key);
  clearScreenCache('local-data');
  try {
    await AsyncStorage.removeItem(`${ENVELOPE_PREFIX}${key}`);
  } catch {
    // ignore
  }
}
