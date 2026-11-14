---
# PROPOSED contribution to finos/ai-governance-framework (docs/_risks/).
# Placeholder ID in our policy and CCC catalog: PROPOSED-AIR-OP-SPEND.
# `sequence` is a suggestion; maintainers assign the real number (the next free one was 31 on 14 Nov 2026).
sequence: 31
title: Agent Exceeds Delegated Spending Authority
layout: risk
doc-status: Draft
type: OP
domain: agency
owasp-llm_references:
  - llm03-2026  # LLM03:2026 Excessive Agency
related_risks:
  - ri-24  # Agent Action Authorization Bypass
  - ri-28  # Multi-Agent Trust Boundary Violations
  - ri-18  # Model Overreach / Expanded Use
  - ri-6   # Non-Deterministic Behaviour
---

## Summary

Autonomous agents spend money on behalf of the firm (LLM tokens, paid data and verification services) without the controls the firm applies to people with spending authority. Agents can run up cost through loops, split purchases to stay under approval thresholds, hand work to helper agents that end up with more authority than the agent that called them, and make spend that nobody can attribute to a case, an agent or an approver.

## Description

**Agent Exceeds Delegated Spending Authority** occurs when an AI agent commits spend outside the authority the firm has delegated to it. Banks already control human spending with a delegation-of-authority (DoA) matrix: signing limits, escalation chains, four-eyes approval, budgets per cost centre and restrictions on what may be bought. Agents now buy things directly, for example a credit-bureau report in a loan decision or a fraud check, and call paid models, yet these human controls rarely apply to them. Monitoring usage after the fact (see mi-9) tells the firm what happened, but does not stop an agent from exceeding its authority while it is acting.

The agent's behaviour is not fully predictable (see ri-6), and an agent can pursue its goal through many small, individually permitted actions, so a control on each single call is not enough.

### Failure Modes

* **Runaway Consumption**
  A looping, retrying or confused agent consumes tokens and paid checks until a budget is exhausted or an invoice arrives, with no automatic stop and no human in the loop.

* **Threshold Evasion (Structuring)**
  An agent, or several helper agents acting for the same case, splits one purchase into several smaller ones that each fall under the signing limit, so that no human approval is triggered. The pattern is well known from AML.

* **Authority Amplification Through Delegation**
  A helper agent receives more authority than the agent that delegated to it: wider services, higher limits, its own budget on top of the delegator's, or the ability to delegate further. Spend by the helper escapes the controls on the delegator.

* **Spend Outside the Agent's Role**
  An agent buys services or models its role does not need, because nothing restricts what it may spend on.

* **Unattributable Spend**
  Spend cannot be traced to a case, an agent, the rule that allowed it and the approver, or the record can be changed afterwards, so the second line of defence and auditors have no evidence.

### Consequences

* **Financial Loss and Budget Overruns**: unplanned cost, which is hard to recover from vendors.
* **Broken Delegation of Authority and Segregation of Duties**: agents commit the firm to spend that no human with authority approved.
* **Audit and Regulatory Findings**: the firm cannot show who spent what, under which rule, approved by whom.
* **Cascading Cost Across Agents**: in multi-agent systems one agent's loop can drain a shared budget used by others.

### Key Risk Factors

- **No Machine-Readable Authority Model**: agent spending limits live in documents or in code, not in a reviewable policy.
- **Per-Call Checks Only**: controls look at each request alone, not at related requests over a time window.
- **Unbounded Delegation**: helper agents are not constrained to a subset of the delegator's authority and budget.
- **No Human-Only Resume**: a stopped agent can be restarted by the same system that stopped it.
- **Evidence Not Tied to Frameworks**: decisions are logged without the risk, control and architecture they relate to.

## Links

- [AIGF ri-24: Agent Action Authorization Bypass](https://air-governance-framework.finos.org/risks/ri-24_agent-action-authorization-bypass.html)
- [AIGF ri-28: Multi-Agent Trust Boundary Violations](https://air-governance-framework.finos.org/risks/ri-28_multi-agent-trust-boundary-violations.html)
- [AIGF mi-9: AI System Alerting and Denial of Wallet (DoW) / Spend Monitoring](https://air-governance-framework.finos.org/mitigations/mi-9_ai-system-alerting-and-denial-of-wallet-dow-spend-monitoring.html)
- Reference implementation: Agent Spend Guard (this repository), CCC catalog `finos/ccc/agent-spend-controls.yaml`
