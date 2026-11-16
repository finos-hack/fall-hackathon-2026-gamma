# Product requirements: Agent Spend Guard

## One-liner
The FINOS Steel Thread governs *what* the loan agent decides. Nothing governs *what it spends* getting there. Agent Spend Guard is that missing control: "You measure spending. This controls it."

## Problem
Banks control human spending with a delegation-of-authority (DoA) matrix: signing limits, escalation chains, four-eyes, budgets per cost centre, card merchant restrictions. AI agents now spend money on their own (LLM tokens, paid data checks such as credit-bureau pulls) and hand work to other agents. The Steel Thread demo measures token usage, but no budget limit, approval or delegation control exists. Three gaps follow:

1. **Runaway cost:** a looping or non-deterministic agent burns budget.
2. **Threshold evasion:** an agent splits a purchase into small parts to avoid approval.
3. **Authority amplification:** a helper agent gets more authority than the agent that called it.

## Solution
A policy enforcement point. Every spend request goes through `POST /api/spend` and returns **approve / deny / escalate**, a plain-language reason and the rule that fired. Each rule is tagged with FINOS AIGF risk IDs and a CCC-format control. The policy is a YAML file; the guard only starts if the policy satisfies the control declared in the CALM architecture. A control room shows live spend, budgets, the approval queue, an exportable hash-chained audit log and a per-case evidence report.

## Users
See [personas.md](personas.md). Primary: Daniel (Head of AI Platform, buyer) and Sofia (Compliance Officer, daily user). Secondary: the agent developer who calls one API.

## Requirements (what is built)
| Rule | Requirement |
|---|---|
| SG-01 | Agents may only buy services on their allow-list. |
| SG-02 | Hard per-case and per-day budgets; pending approvals reserve budget. |
| SG-03 | Above the signing limit a human approves; above the tier ceiling the request is denied as outside delegated authority. |
| SG-04 | High-value spend needs two distinct approvers. |
| SG-05 | Several near-threshold purchases of the same service that together exceed the signing limit are escalated, including across helper agents. |
| SG-06 | A delegate never gets more authority than its parent and spends from the parent's budget. |
| SG-07 | A looping agent is cut off and suspended; only a human can resume it. |
| SG-08 | The same paid check with the same parameters twice within a minute is denied. |
| SG-09 | Every request, decision and approval goes to a hash-chained, exportable log. |

Non-functional: deterministic decisions; every decision traceable (OpenTelemetry span with AIGF, CCC and CALM attributes); runs from a fresh clone with no keys.

## Out of scope
Real payments or payment rails, real multi-agent orchestration (agents are scripted), real vendors (fixed mock prices), auth/SSO (an "acting as" switcher stands in), a live LLM mode (roadmap, not built).

## Success criteria
Scenarios S1-S5 pass as tests and run end to end in the control room; `npm run finos:validate` passes; a newcomer can run the demo from the README.
