# Delegation-of-authority mapping

How bank spending controls map to Agent Spend Guard.

| Bank control | Agent Spend Guard | Policy field / rule |
|---|---|---|
| DoA matrix / signing limits | Authority tiers | `authorityTiers.*.autoApproveUpTo` (SG-03) |
| Approval chain / escalation | Escalate to approvers with an allowed role | `approverRoles` (SG-03) |
| Approval ceiling (beyond your authority) | Deny | `escalateUpTo` (SG-03) |
| Four-eyes principle | Two distinct approvers | `fourEyesAbove` (SG-04) |
| Cost-centre budget | Per-case and per-day budgets | `agents.*.budgets` (SG-02) |
| Card merchant-category restriction | Service allow-list | `agents.*.allowedServices` (SG-01) |
| Sub-delegation cannot exceed your own authority | Attenuation and shared budget | SG-06 |
| AML structuring / smurfing detection | Split-purchase detection | SG-05 |
| Card freeze | Kill switch, human-only resume | SG-07 |
| Duplicate payment check | Duplicate purchase denial | SG-08 |
| Audit trail, second line of defence | Hash-chained log, evidence report, control room | SG-09 |

## Demo tiers
| Tier | Like a | Auto-approve up to | Ceiling (above: deny) | Four-eyes above |
|---|---|---|---|---|
| T1 (fraud-agent) | junior analyst | $1.00 | $5.00 | none |
| T2 (loan-agent) | loan officer | $5.00 | $50.00 | $25.00 |

## FINOS references
Each rule carries AIGF risk and mitigation IDs and a CCC control ID (`CCC.AgentSpend.CN01..CN09` for SG-01..SG-09). The full mapping is the `controls` section of `policies/loan-approval.policy.yaml` and `finos/ccc/agent-spend-controls.yaml`.
