import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { AuditEntry, AuditType } from '../types.js';

export const GENESIS = '0'.repeat(64);

export function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

const hashOf = (e: Omit<AuditEntry, 'hash'>) =>
  createHash('sha256')
    .update(canonical({ seq: e.seq, ts: e.ts, type: e.type, actor: e.actor, payload: e.payload, prevHash: e.prevHash }))
    .digest('hex');

export const CSV_COLUMNS = ['seq', 'ts', 'type', 'actor', 'caseId', 'agentId', 'onBehalfOf', 'service', 'amount', 'outcome',
  'ruleId', 'reason', 'approver', 'aigfRisks', 'cccControl', 'calmControl', 'source', 'traceId', 'hash'] as const;

export class AuditLog {
  entries: AuditEntry[] = [];
  onAppend?: (e: AuditEntry) => void;
  constructor(private file?: string) {}

  append(type: AuditType, actor: string, payload: Record<string, unknown>, ts: string): AuditEntry {
    const prev = this.entries[this.entries.length - 1];
    const base = { seq: (prev?.seq ?? 0) + 1, ts, type, actor, payload, prevHash: prev?.hash ?? GENESIS };
    const entry: AuditEntry = { ...base, hash: hashOf(base) };
    this.entries.push(entry);
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      appendFileSync(this.file, JSON.stringify(entry) + '\n');
    }
    this.onAppend?.(entry);
    return entry;
  }

  verify(): { ok: boolean; count: number; brokenAtSeq?: number } {
    let prevHash = GENESIS;
    for (const e of this.entries) {
      if (e.prevHash !== prevHash || e.hash !== hashOf(e)) return { ok: false, count: this.entries.length, brokenAtSeq: e.seq };
      prevHash = e.hash;
    }
    return { ok: true, count: this.entries.length };
  }

  reset() {
    this.entries = [];
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, '');
    }
  }

  toCsv(): string {
    const cell = (v: unknown) => {
      const s = Array.isArray(v) ? v.join(';') : v == null ? '' : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const top = new Set(['seq', 'ts', 'type', 'actor', 'hash']);
    const rows = this.entries.map((e) =>
      CSV_COLUMNS.map((c) => cell(top.has(c) ? (e as unknown as Record<string, unknown>)[c] : e.payload[c])).join(','));
    return [CSV_COLUMNS.join(','), ...rows].join('\n') + '\n';
  }
}
