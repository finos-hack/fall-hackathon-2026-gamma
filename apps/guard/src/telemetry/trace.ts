import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

type Attr = string | number | boolean | undefined;
type OtlpAttr = { key: string; value: { stringValue?: string; boolValue?: boolean; intValue?: number; doubleValue?: number } };

export interface Span {
  traceId: string; spanId: string; name: string; kind: number;
  startTimeUnixNano: string; endTimeUnixNano: string;
  attributes: OtlpAttr[];
  events: { name: string; timeUnixNano: string; attributes: OtlpAttr[] }[];
  status: { code: 0 | 2 };
}

const val = (v: string | number | boolean) =>
  typeof v === 'string' ? { stringValue: v } : typeof v === 'boolean' ? { boolValue: v }
  : Number.isInteger(v) ? { intValue: v } : { doubleValue: v };
const toAttrs = (o: Record<string, Attr>): OtlpAttr[] =>
  Object.entries(o).filter(([, v]) => v !== undefined).map(([key, v]) => ({ key, value: val(v as string | number | boolean) }));
const nano = (iso: string) => (BigInt(Date.parse(iso)) * 1000000n).toString();

export class TraceWriter {
  spans = new Map<string, Span>(); // by spanId
  constructor(private file?: string) {}

  newIds() { return { traceId: randomBytes(16).toString('hex'), spanId: randomBytes(8).toString('hex') }; }

  private write(span: Span) {
    if (!this.file) return;
    const line = {
      resourceSpans: [{
        resource: { attributes: toAttrs({ 'service.name': 'agent-spend-guard' }) },
        scopeSpans: [{ scope: { name: 'spendguard' }, spans: [span] }],
      }],
    };
    mkdirSync(dirname(this.file), { recursive: true });
    appendFileSync(this.file, JSON.stringify(line) + '\n');
  }

  record(ids: { traceId: string; spanId: string }, ts: string, attrs: Record<string, Attr>, denied: boolean,
    events: { name: string; attrs?: Record<string, Attr> }[] = []) {
    const span: Span = {
      ...ids, name: 'spendguard.evaluate', kind: 1, startTimeUnixNano: nano(ts), endTimeUnixNano: nano(ts),
      attributes: toAttrs(attrs),
      events: events.map((e) => ({ name: e.name, timeUnixNano: nano(ts), attributes: toAttrs(e.attrs ?? {}) })),
      status: { code: denied ? 2 : 0 },
    };
    this.spans.set(span.spanId, span);
    this.write(span);
  }

  /** Adds a span event when a human acts; appends the updated span to the JSONL. */
  addEvent(spanId: string, ts: string, name: string, attrs: Record<string, Attr>) {
    const s = this.spans.get(spanId);
    if (!s) return;
    s.events.push({ name, timeUnixNano: nano(ts), attributes: toAttrs(attrs) });
    this.write(s);
  }

  all() { return [...this.spans.values()]; }

  reset() {
    this.spans.clear();
    if (this.file) {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, '');
    }
  }
}
