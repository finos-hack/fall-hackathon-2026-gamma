import type { SpendPolicy } from './schema.js';

const round4 = (n: number) => Math.round(n * 1e4) / 1e4;

export interface PriceInput {
  kind: 'llm' | 'service';
  service: string;
  inputTokens?: number;
  outputTokens?: number;
  quantity?: number;
}

/** Returns the amount rounded to 4 decimals, or null for an unknown service. */
export function computeAmount(policy: SpendPolicy, req: PriceInput): number | null {
  if (req.kind === 'llm') {
    const p = policy.pricing.llm[req.service];
    if (!p) return null;
    return round4(
      ((req.inputTokens ?? 0) / 1000) * p.inputPer1kTokens +
        ((req.outputTokens ?? 0) / 1000) * p.outputPer1kTokens,
    );
  }
  const s = policy.pricing.services[req.service];
  if (!s) return null;
  return round4(s.unitPrice * (req.quantity ?? 1));
}
