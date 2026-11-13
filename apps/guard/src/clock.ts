export interface Clock { now(): Date }
export const systemClock: Clock = { now: () => new Date() };

/** Test clock: starts at a fixed time and only moves when advanced. */
export class ManualClock implements Clock {
  constructor(private t = Date.parse('2026-11-16T09:00:00Z')) {}
  now() { return new Date(this.t); }
  advance(ms: number) { this.t += ms; }
}
