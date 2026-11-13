import type { FastifyReply } from 'fastify';
import type { SseEventType } from '../types.js';

type Listener = (type: SseEventType, data: unknown) => void;

export class Bus {
  private listeners = new Set<Listener>();
  emit(type: SseEventType, data: unknown) { for (const l of this.listeners) l(type, data); }
  subscribe(l: Listener) { this.listeners.add(l); return () => this.listeners.delete(l); }
}

/** Streams every bus event as `data: {"type","data"}` until the client disconnects. */
export function openStream(bus: Bus, reply: FastifyReply) {
  reply.hijack();
  const res = reply.raw;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.write(': connected\n\n');
  const off = bus.subscribe((type, data) => res.write(`data: ${JSON.stringify({ type, data })}\n\n`));
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  res.on('close', () => { off(); clearInterval(ping); });
}
