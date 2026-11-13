import { z } from 'zod';

export const CONTROL_TYPES = [
  'service_allowlist', 'budget', 'doa_threshold', 'four_eyes', 'structuring',
  'delegation', 'runaway', 'duplicate', 'audit',
] as const;

const amount = z.number().min(0);

const Tier = z.object({
  label: z.string(),
  autoApproveUpTo: amount,
  escalateUpTo: amount,
  fourEyesAbove: amount.nullable(),
  approverRoles: z.array(z.string()),
});

const Agent = z.object({
  description: z.string(),
  tier: z.string(),
  budgets: z.object({ perCase: amount, perDay: amount }),
  allowedServices: z.array(z.string()),
  canDelegateTo: z.array(z.string()),
});

const Control = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(CONTROL_TYPES),
  enabled: z.boolean(),
  action: z.enum(['approve', 'deny', 'escalate', 'deny_and_suspend']),
  params: z.record(z.string(), z.unknown()).optional(),
  aigf: z.object({ risks: z.array(z.string()), mitigations: z.array(z.string()) }),
  rationale: z.string(),
});

export const SpendPolicySchema = z
  .object({
    apiVersion: z.literal('spendguard.finos.org/v1alpha1'),
    kind: z.literal('SpendPolicy'),
    metadata: z.object({
      name: z.string(),
      version: z.string().regex(/^\d+\.\d+\.\d+$/, 'must be semver'),
      owner: z.string(),
      approvedBy: z.string(),
      effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      currency: z.literal('USD'),
    }),
    pricing: z.object({
      llm: z.record(z.string(), z.object({ inputPer1kTokens: amount, outputPer1kTokens: amount })),
      services: z.record(z.string(), z.object({ unitPrice: amount, vendor: z.string() })),
    }),
    authorityTiers: z.record(z.string(), Tier),
    agents: z.record(z.string(), Agent),
    approvers: z.array(z.object({ id: z.string(), name: z.string(), role: z.string() })),
    delegation: z.object({ maxDepth: z.number().int().min(0), defaultTtlMinutes: z.number().positive() }),
    controls: z.array(Control),
  })
  .superRefine((p, ctx) => {
    const bad = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });
    for (const [id, t] of Object.entries(p.authorityTiers)) {
      const path = ['authorityTiers', id];
      if (!(t.autoApproveUpTo < t.escalateUpTo)) bad(path, 'autoApproveUpTo must be less than escalateUpTo');
      if (t.fourEyesAbove !== null && !(t.fourEyesAbove >= t.autoApproveUpTo && t.fourEyesAbove <= t.escalateUpTo))
        bad([...path, 'fourEyesAbove'], 'fourEyesAbove must be null or between autoApproveUpTo and escalateUpTo');
    }
    for (const [id, a] of Object.entries(p.agents)) {
      if (!(a.tier in p.authorityTiers)) bad(['agents', id, 'tier'], `unknown tier "${a.tier}"`);
      for (const c of a.canDelegateTo)
        if (!(c in p.agents)) bad(['agents', id, 'canDelegateTo'], `unknown agent "${c}"`);
    }
  });

export type SpendPolicy = z.infer<typeof SpendPolicySchema>;
