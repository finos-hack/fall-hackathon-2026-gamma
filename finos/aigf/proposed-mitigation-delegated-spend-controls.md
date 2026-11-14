---
# PROPOSED contribution to finos/ai-governance-framework (docs/_mitigations/).
# Placeholder ID in our policy and CCC catalog: PROPOSED-AIR-PREV-SPEND.
# `sequence` is a suggestion; maintainers assign the real number (the next free one was 26 on 14 Nov 2026).
sequence: 26
title: Delegated Spend Authority Controls for Agents
layout: mitigation
doc-status: Draft
type: PREV
domain: access
iso-42001_references:
  - A-9-2    # ISO 42001: Processes for responsible use of AI systems
  - A-6-2-6  # ISO 42001: AI system operation and monitoring
mitigates:
  - ri-31  # Agent Exceeds Delegated Spending Authority (proposed, see proposed-risk-agent-spend-authority.md)
  - ri-24  # Agent Action Authorization Bypass
  - ri-28  # Multi-Agent Trust Boundary Violations
related_mitigations:
  - mi-18  # Agent Authority Least Privilege Framework
  - mi-22  # Multi-Agent Isolation and Segmentation
  - mi-21  # Agent Decision Audit and Explainability
  - mi-4   # AI System Observability
  - mi-9   # AI System Alerting and Denial of Wallet (DoW) / Spend Monitoring
  - mi-24  # Human-in-the-Loop Action Approval Gate
---

## Purpose

Agents that spend money need the same bounded authority as people who spend money. This mitigation expresses agent spending authority as code, mirroring the firm's delegation-of-authority (DoA) matrix, and enforces it before each spend, so that deterministic controls bound the behaviour of non-deterministic agents. It adds prevention to the monitoring described in mi-9: a request is approved, denied or escalated to a human before the money is spent.

---

## Key Principles

| **Control** | **Bank equivalent** | **Behaviour** |
| ----------- | ------------------- | ------------- |
| Authority tiers | DoA matrix, signing limits | Each agent has a tier with a signing limit (auto-approve up to), an approval ceiling and approver roles. Above the limit a human approves; above the ceiling the request is outside delegated authority and is denied. |
| Four-eyes | Four-eyes principle | High-value spend needs two distinct approvers. |
| Budgets | Cost-centre budget | Per-case and per-day caps per agent. Pending approvals reserve budget; rejection or expiry releases it. |
| Service allow-list | Card merchant-category restriction | An agent may buy only the services and models its role needs. |
| Structuring detection | AML structuring / smurfing | Several near-threshold purchases of the same service, within a time window, for the same case and root agent, that together exceed the signing limit are escalated. |
| Delegation attenuation | Sub-delegation cannot exceed your own authority | A delegate's authority is a subset of the delegator's, it spends from the delegator's budget (shared, not doubled), grants are time-boxed and chain depth is limited. |
| Circuit breaker | Card freeze | An agent that loops or bursts requests is suspended, together with its delegations, and only a human can resume it. |
| Evidence | Audit trail for the second line of defence | A tamper-evident (hash-chained) log and one trace span per decision, with the rule, approver and framework references. |

---

## Implementation Guidance

### 1. Express Authority as Reviewable Policy
* Keep tiers, budgets, allow-lists, approvers and control parameters in a versioned policy file, owned and approved like any other DoA document.
* Validate the policy against a schema and refuse to start the enforcement point if the policy does not satisfy the control declared in the architecture.

### 2. Authorise Before Spend
* Route every LLM and paid-service call through a policy enforcement point that returns approve, deny or escalate, the reason in business language and the rule that fired.
* Evaluate checks in a fixed order and record every check (pass, fail, skip) with the decision.

### 3. Bound Delegation
* Allow delegation only between agents the policy names, with a maximum depth.
* Require the granted services to be covered by the delegator's own, and the amount to fit the delegator's remaining budget; escalate grants above the delegator's signing limit.
* Debit delegated spend to the grant and the root agent's budget only. Group structuring checks by root agent so that splitting across helpers is detected.

### 4. Stop and Resume
* Suspend an agent automatically on repeated identical requests or request bursts, and report the projected cost per hour.
* Require a named human to resume it, and audit the resume.

### 5. Produce Evidence
* Write every request, decision, approval, delegation and suspension to a hash-chained log that can be exported and verified.
* Emit an OpenTelemetry span per decision carrying the AIGF risk and mitigation ids, the control catalogue id and the architecture control it belongs to.

---

## Reference Implementation

Agent Spend Guard (this repository). Its policy controls SG-01 to SG-09 map to the CCC catalog `finos/ccc/agent-spend-controls.yaml`, and the architecture control `agent-spend-authority` is declared in `finos/calm/loan-approval-with-spend-guard.calm.json`.

## Links

- [AIGF mi-18: Agent Authority Least Privilege Framework](https://air-governance-framework.finos.org/mitigations/mi-18_agent-authority-least-privilege-framework.html)
- [AIGF mi-22: Multi-Agent Isolation and Segmentation](https://air-governance-framework.finos.org/mitigations/mi-22_multi-agent-isolation-and-segmentation.html)
- [AIGF mi-9: AI System Alerting and Denial of Wallet (DoW) / Spend Monitoring](https://air-governance-framework.finos.org/mitigations/mi-9_ai-system-alerting-and-denial-of-wallet-dow-spend-monitoring.html)
