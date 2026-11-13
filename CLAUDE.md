# CLAUDE.md — Agent Spend Guard (FINOS Fall Hackathon 2026)

> Spec for Claude Code. The idea and plan are FINAL. Don't re-design or re-brainstorm; build task by task (§8).
> Solo builder: Pardis. Repo: `finos-hack/fall-hackathon-2026-gamma` (template: hack-project-blueprint).
> Track: **Track 2, AI Governance / Gov-as-Code (Steel Thread)**. Build Fri 13 → Mon 16 Nov 2026. Tue 17 = integration + video. 
> **Deadline: Wed 18 Nov 2026, 17:00 ET (23:00 Berlin).**
> **v2 (Fri 13 Nov, after the judging rubric):** FINOS integration is now functional, not just files (§7.0), CCC added (§7.4), Fluxnova hook promoted to must-have (§7.5), live LLM mode added (§7.6), "How it was built" in the README, plan and cut list revised (§8), rubric targets in §10.

---

## 0. How to work in this repo (read every session)

**Mandatory repo rules**
- Read and follow `AGENTS.md` and `CONTRIBUTING.md` (hackathon template). If they conflict with this file, they win; tell Pardis.
- **Every commit is signed off (DCO):** always `git commit -s -m "..."`. Never commit without `-s`. Never squash or rewrite history.
- Keep `LICENSE` (Apache-2.0), `NOTICE`, `CODE_OF_CONDUCT.md`, `MAINTAINERS.md`, `.github/` untouched (README is filled in on Day 4).
- No secrets in git. The core demo needs no API keys (everything is mocked). Only the optional live LLM mode (§7.6) uses `ANTHROPIC_API_KEY` from `.env` (gitignored).

**Session rules (token budget)**
- One session = one task from §8. When its Definition of Done (DoD) is met: run tests, commit (`-s`), tick the box in §8, then tell Pardis to start a fresh session.
- For SG-05 (structuring), SG-06 (delegation) and T1 (Fluxnova hook): first explain the approach in ≤8 lines and wait for an OK, then build.
- Keep replies short. Don't print whole files back; say what changed and where. Don't paste long logs; quote only the relevant lines.
- Simplest working solution. No libraries, infra or features beyond this spec. Ideas go to the "Later" list (§8.4), not into the code.
- Everything external is mocked (vendors, LLM prices, agents), except the live LLM mode (§7.6) and the Fluxnova hook (§7.5).
- If the spec is unclear, ask ONE short question rather than guessing. If a decision changes, update this file.

**Models (Pardis switches with `/model`; you can't switch yourself, so tell her):** Sonnet 5.5 by default · Opus 5.5 for SG-05/SG-06/T1 if Sonnet struggles, and for the final pitch/README · Haiku 5.5 for tiny edits.
- **Start of every session, before any work:** ask "Task X.Y. Recommended model: <model>. Please switch with `/model` if you're not on it. Reply 'ok' when ready." Then **stop and wait** for her reply.
- **Mid-task, switch up:** if a test for SG-05, SG-06 or T1 still fails after 2 fix attempts, or you're unsure the logic matches §3, stop and ask "This part needs Opus 5.5. Please switch with `/model` and reply 'ok'." Wait. When that part passes, ask "Done with the hard part. Please switch back to Sonnet 5.5 and reply 'ok'." Wait again.
- **Switch down:** if the rest of a task is only text, renames or copy edits, ask "Haiku 5.5 is enough for this. Want to switch?" and wait.
- Never assume she switched. Always wait for her reply.

---

## 1. Short PRD

**One-liner.** The FINOS Steel Thread governs *what* the loan agent decides. Nothing governs *what it spends* getting there. Agent Spend Guard is that missing control, wired into the pipeline's own projects (AIGF → CALM → CCC → Fluxnova → OpenTelemetry evidence). *"You measure spending. This controls it."* Deterministic controls bounding non-deterministic agents.

**Problem.** Banks already control human spending with a **delegation-of-authority (DoA) matrix**: signing limits, escalation chains, four-eyes, budgets per cost centre, card merchant restrictions. AI agents now spend money on their own (LLM tokens, paid data checks like credit bureau pulls and fraud checks) and hand work to other agents. The Steel Thread demo already *measures* token usage (its `llm-token-usage` plugins), but no budget limit, approval or agent-to-agent delegation control exists. That leaves three gaps: runaway cost, agents dodging approval thresholds, and helper agents silently getting more authority than the agent that called them.

**Solution.** A lightweight policy enforcement point. Every agent spend request goes through the guard, which returns **approve / deny / escalate-to-human**, the reason and the rule that fired. Each rule is tagged to a FINOS AIGF risk and a CCC-format control. The policy is a YAML file (policy-as-code) that reads like a bank DoA matrix, and the guard only starts if that policy satisfies the control declared in the CALM architecture. A compliance-officer control room shows live spend, budgets, the approval queue, an exportable tamper-evident audit log and a per-case AIGF evidence report.

**Personas**
- **Daniel, Head of AI Platform at a mid-size bank** (owner/buyer). Wants to roll out agents without a cost incident or an audit finding. Needs the controls as code, in FINOS formats, reviewable by Model Risk.
- **Sofia, Compliance Officer (2nd line of defence)** (daily user). Approves escalations and has to show auditors who spent what, under which rule, approved by whom. Not a developer, so she needs the bank's language, not token counts.
- *(secondary)* **Agent developer.** Calls one API (`POST /api/spend`) and gets a clear decision and reason back.

**Differentiators.** (1) Split-purchase / structuring detection borrowed from AML, (2) agent-to-agent delegation where authority only narrows and budgets are shared, (3) the policy model *is* a DoA matrix, (4) a polished compliance control room, (5) FINOS projects working as one pipeline: CALM declares the control, the guard enforces it, CCC catalogues it, AIGF classifies the risk, Fluxnova calls it, OTel proves it.

**Out of scope.** Real payments or payment rails (AP2, x402, card networks own that; we are not a payments product), real multi-agent orchestration (agents are scripted functions, plus one optional live LLM agent), real vendors (fixed mock prices), auth/SSO (an "acting as" switcher stands in).

**Demo story (3 min) → scenarios S1–S5 (§3.8)**
1. Open in the bank's language: "Banks already decide who can spend how much. AI agents have no such rules yet."
2. **S1 Normal loan case.** Small spends, all auto-approved (ideally started from the Fluxnova loan process, §7.5).
3. **S2 High-value case.** A $28 credit report needs four-eyes. Sofia and Marco approve in the control room.
4. **S3 Wow moment.** The agent splits a $9 purchase into three $3 purchases to dodge approval and gets caught.
5. **S4 Future moment.** The loan agent delegates to a fraud helper. The helper can't exceed the parent's authority and spends from the same budget.
6. **S5 Runaway agent.** It loops and burns tokens, is cut off automatically, and the evidence report explains why with AIGF and CCC references.

---

## 2. Policy model (policy-as-code)

File: `policies/loan-approval.policy.yaml`. Validated with **zod** (`apps/guard/src/policy/schema.ts`). The JSON Schema is generated from zod (`z.toJSONSchema`) into `policies/spend-policy.schema.json` and doubles as the CALM control requirement (§7.1).

### 2.1 Schema (informal; zod is the source of truth)
```
apiVersion: "spendguard.finos.org/v1alpha1"     (literal)
kind: "SpendPolicy"                               (literal)
metadata: { name, version (semver), owner, approvedBy, effectiveFrom (date), currency ("USD") }
pricing:
  llm:      { [serviceId]: { inputPer1kTokens: number, outputPer1kTokens: number } }
  services: { [serviceId]: { unitPrice: number, vendor: string } }
authorityTiers:                                   # the DoA matrix
  { [tierId]: { label, autoApproveUpTo: number, escalateUpTo: number,
                fourEyesAbove: number | null, approverRoles: string[] } }
agents:
  { [agentId]: { description, tier: tierId, budgets: { perCase, perDay },
                 allowedServices: string[] (exact id or prefix glob "x.*"),
                 canDelegateTo: agentId[] } }
approvers: [ { id, name, role } ]
delegation: { maxDepth: int, defaultTtlMinutes: int }
controls: [ { id, name, type, enabled: bool, action: approve|deny|escalate|deny_and_suspend,
              params?: object, aigf: { risks: string[], mitigations: string[] },
              ccc?: string (CCC-format control id, filled in task 4.1), rationale } ]
```
Validation rules: every `agents.*.tier` exists; every `canDelegateTo` agent exists; `autoApproveUpTo < escalateUpTo`; `fourEyesAbove` is null or between the two; every `controls[].type` is one of the 9 types below; all amounts ≥ 0.

### 2.2 Example policy used in the demo (copy verbatim)
```yaml
apiVersion: spendguard.finos.org/v1alpha1
kind: SpendPolicy
metadata:
  name: loan-approval-agent-spend
  version: 1.0.0
  owner: Head of AI Platform
  approvedBy: AI Model Risk Committee
  effectiveFrom: 2026-11-13
  currency: USD

pricing:                                   # mocked, fixed
  llm:
    llm.standard: { inputPer1kTokens: 0.003, outputPer1kTokens: 0.015 }
    llm.premium:  { inputPer1kTokens: 0.015, outputPer1kTokens: 0.075 }
  services:
    kyc.id-verify:             { unitPrice: 1.20,  vendor: MockKYC }
    credit-bureau.score-pull:  { unitPrice: 2.50,  vendor: MockBureau }
    credit-bureau.full-report: { unitPrice: 28.00, vendor: MockBureau }
    property.valuation:        { unitPrice: 1.50,  vendor: MockValuations }
    fraud-check.basic:         { unitPrice: 0.75,  vendor: MockFraud }
    fraud-check.enhanced:      { unitPrice: 4.00,  vendor: MockFraud }

authorityTiers:                            # Delegation-of-Authority matrix
  T1:
    label: Helper agent (like a junior analyst)
    autoApproveUpTo: 1.00                  # signing limit
    escalateUpTo: 5.00                     # above this: outside delegated authority -> deny
    fourEyesAbove: null
    approverRoles: [compliance-officer]
  T2:
    label: Lead agent (like a loan officer)
    autoApproveUpTo: 5.00
    escalateUpTo: 50.00
    fourEyesAbove: 25.00                   # two distinct approvers
    approverRoles: [compliance-officer, head-of-lending]

agents:
  loan-agent:
    description: Loan underwriting agent (FINOS Steel Thread loan approval)
    tier: T2
    budgets: { perCase: 40.00, perDay: 300.00 }
    allowedServices: ["llm.*", "kyc.id-verify", "credit-bureau.*", "property.valuation", "fraud-check.basic"]
    canDelegateTo: [fraud-agent]
  fraud-agent:
    description: Fraud-check helper agent
    tier: T1
    budgets: { perCase: 10.00, perDay: 100.00 }
    allowedServices: ["llm.*", "fraud-check.basic", "fraud-check.enhanced"]
    canDelegateTo: []

approvers:
  - { id: sofia, name: Sofia R., role: compliance-officer }
  - { id: marco, name: Marco B., role: head-of-lending }

delegation: { maxDepth: 1, defaultTtlMinutes: 30 }

controls:
  - id: SG-01
    name: Service allow-list (merchant restriction)
    type: service_allowlist
    enabled: true
    action: deny
    aigf: { risks: [AIR-SEC-024, AIR-OP-018], mitigations: [AIR-PREV-018] }
    rationale: Agents may only buy services their role needs, like card merchant-category limits.
  - id: SG-02
    name: Case and daily budgets (cost centre)
    type: budget
    enabled: true
    action: deny
    aigf: { risks: [AIR-OP-018, PROPOSED-AIR-OP-SPEND], mitigations: [PROPOSED-AIR-PREV-SPEND] }
    rationale: Hard caps per loan case and per agent per day. Pending approvals reserve budget.
  - id: SG-03
    name: Delegation-of-authority thresholds (signing limits)
    type: doa_threshold
    enabled: true
    action: escalate
    aigf: { risks: [AIR-SEC-024], mitigations: [AIR-PREV-018, PROPOSED-AIR-PREV-SPEND] }
    rationale: Above the signing limit a human approves. Above the tier ceiling the request is outside delegated authority (deny).
  - id: SG-04
    name: Four-eyes principle
    type: four_eyes
    enabled: true
    action: escalate
    aigf: { risks: [AIR-SEC-024], mitigations: [PROPOSED-AIR-PREV-SPEND] }
    rationale: High-value spend needs two distinct approvers.
  - id: SG-05
    name: Split-purchase (structuring) detection
    type: structuring
    enabled: true
    action: escalate
    params: { windowMinutes: 10, minParts: 3, nearThresholdRatio: 0.5 }
    aigf: { risks: [AIR-SEC-024, PROPOSED-AIR-OP-SPEND], mitigations: [PROPOSED-AIR-PREV-SPEND] }
    rationale: Borrowed from AML. Several near-threshold buys of the same service that together exceed the signing limit are escalated.
  - id: SG-06
    name: Delegation attenuation (no authority amplification)
    type: delegation
    enabled: true
    action: deny
    aigf: { risks: [AIR-OP-028, AIR-SEC-024], mitigations: [AIR-PREV-022, AIR-PREV-018] }
    rationale: A helper never gets more authority than its parent, and spends from the parent's budget (shared, not doubled).
  - id: SG-07
    name: Runaway agent circuit breaker (kill switch)
    type: runaway
    enabled: true
    action: deny_and_suspend
    params: { windowSeconds: 60, maxIdenticalRequests: 5, maxRequestsPerMinute: 30 }
    aigf: { risks: [AIR-OP-006, PROPOSED-AIR-OP-SPEND], mitigations: [AIR-DET-004] }
    rationale: Looping agents are frozen like a blocked card. Only a human can resume them.
  - id: SG-08
    name: Duplicate purchase
    type: duplicate
    enabled: true
    action: deny
    params: { windowSeconds: 60 }
    aigf: { risks: [AIR-OP-006], mitigations: [AIR-DET-004] }
    rationale: The same paid check with the same parameters twice within a minute is denied.
  - id: SG-09
    name: Tamper-evident audit trail
    type: audit
    enabled: true
    action: approve
    aigf: { risks: [AIR-SEC-024], mitigations: [AIR-DET-021, AIR-DET-004] }
    rationale: Every request, decision and approval goes to a hash-chained, exportable log.
```
**AIGF IDs.** `AIR-SEC-024` (Agent Action Authorization Bypass), `AIR-OP-028` (Multi-Agent Trust Boundary Violations), `AIR-OP-018` (Model Overreach / Expanded Use), `AIR-OP-006` (Non-Deterministic Behaviour) and `AIR-PREV-022` (Multi-Agent Isolation and Segmentation) are confirmed in AIGF. `AIR-PREV-018` (Agent Authority Least Privilege, MI-18), `AIR-DET-021` (Agent Decision Audit and Explainability, MI-21) and `AIR-DET-004` (AI System Observability, MI-4) **must be checked** on air-governance-framework.finos.org in task 4.1 (only the MI numbers are known; fix the prefixes if they differ). `PROPOSED-*` are our contribution (§7.3). The `ccc` field on each control is filled in task 4.1 (§7.4).

---

## 3. Guard logic (exact)

### 3.1 Amount
- `kind: llm`: `amount = inputTokens/1000*inputPer1kTokens + outputTokens/1000*outputPer1kTokens` (pre-authorisation on declared/estimated tokens).
- `kind: service`: `amount = unitPrice * quantity` (quantity defaults to 1).
- Round to 4 decimals internally and show 2. Use integer micro-dollars internally if floats cause test flakiness.

### 3.2 Authority context (own vs delegated)
```
if req.delegationId is absent:
  owner = req.agentId ; tier = tiers[agent.tier] ; allowed(s) = matches(agent.allowedServices, s)
  remaining = min(agent.perCase - spent(case, owner), agent.perDay - spentToday(owner))
else:  (agent acts on a parent's delegated authority)
  g = grant; owner = g.rootAgentId (budget owner)
  tier = stricter(tiers[child.tier], parentEffectiveTier)        # min of every numeric limit
  allowed(s) = matches(g.services, s) && matches(child.allowedServices, s)
  remaining = min(g.amount - g.spent, root.perCase - spent(case, root), root.perDay - spentToday(root))
spent(...) = sum of APPROVED + PENDING amounts (pending reserves budget; rejected/expired releases it)
```
Spend under a delegation is debited to the **grant and the root agent's case/day budgets only** (one money owner, never double-counted).

### 3.3 Evaluation pipeline for `POST /api/spend`
Checks run in this order. The first DENY short-circuits. Every check is recorded in `ruleTrace` as `pass | fail | skip`.
```
0  unknown agent / unknown service                -> DENY  UNKNOWN_AGENT | UNKNOWN_SERVICE
1  SG-07 agent (or its root) suspended            -> DENY  AGENT_SUSPENDED
2  SG-06 delegationId invalid (missing, expired,
         child/case mismatch)                      -> DENY  DELEGATION_INVALID
3  SG-01/SG-06 service not allowed                 -> DENY  SERVICE_NOT_ALLOWED
         (if allowed for the child alone but not in the grant -> DENY DELEGATION_SCOPE, rule SG-06)
4  SG-07 runaway (see 3.6)                         -> DENY  RUNAWAY + suspend agent
5  SG-08 duplicate (service kind only): same agent+case+service+paramsHash in window
                                                   -> DENY  DUPLICATE
6  SG-02 amount > remaining                        -> DENY  CASE_BUDGET | DAY_BUDGET
         (delegated and grant is the binding limit -> DENY GRANT_EXCEEDED, rule SG-06)
7  SG-03 amount > tier.escalateUpTo                -> DENY  ABOVE_DELEGATED_AUTHORITY
   SG-03 amount > tier.autoApproveUpTo             -> ESCALATE ABOVE_SIGNING_LIMIT, approvalsRequired=1
   SG-04 ...and amount > tier.fourEyesAbove        -> ESCALATE FOUR_EYES, approvalsRequired=2
8  SG-05 structuring (see 3.5), only if still APPROVE -> ESCALATE STRUCTURING, approvalsRequired=1
9  APPROVE
```
Each result produces a Decision (§5), an audit entry (SG-09), a trace span (§7.2) and an SSE event.

### 3.4 Approvals (escalations)
- An escalated request becomes `pending`. Approve/reject via `POST /api/requests/:id/approve|reject {approverId, comment}`.
- The approver's role must be in `tier.approverRoles`. Four-eyes: 2 **distinct** approvers (same person twice → 409 `FOUR_EYES_SAME_APPROVER`). Any reject ends the request (`rejected`).
- Pending for >15 min → `expired` (counts as denied). Scripted agents poll `GET /api/requests/:id` (1 s) until resolved.

### 3.5 SG-05 Split-purchase (structuring) detection
```
T = effective tier; near = nearThresholdRatio * T.autoApproveUpTo
applies if kind == service AND near <= amount <= T.autoApproveUpTo
parts = requests with same caseId AND same rootAgentId (owner) AND same service
        AND status in {approved, pending} AND ts >= now - windowMinutes AND amount >= near
if count(parts)+1 >= minParts AND sum(parts)+amount > T.autoApproveUpTo:
   ESCALATE STRUCTURING; decision.linkedRequestIds = parts ids;
   audit STRUCTURING_LINKED for each earlier part (flag it, don't reverse it)
```
Grouping by **root agent** means splitting a purchase across helper agents is caught too (pitch line).

### 3.6 SG-07 Runaway circuit breaker
```
identical = same agentId AND same promptHash (llm) / paramsHash (service) in last windowSeconds
if count(identical) >= maxIdenticalRequests OR count(agent requests last 60s) >= maxRequestsPerMinute:
   DENY RUNAWAY; suspend agent (state.suspended=true, reason, projectedHourlyBurn)
projectedHourlyBurn = (spend by this agent in last 60s) * 60   # shown in the UI banner
```
A suspended agent is denied everything, and so are any active grants it issued. Resume: `POST /api/agents/:id/resume {approverId}` (audit `AGENT_RESUMED`).

### 3.7 SG-06 Delegation: creating a grant (`POST /api/delegations`)
Body: `{ parentAgentId, childAgentId, caseId, amount, services[], ttlMinutes?, parentDelegationId? }`
```
D1 child not in parent.canDelegateTo                       -> DENY DELEGATION_NOT_PERMITTED
D2 depth = (parent grant depth or 0) + 1 > maxDepth, or a cycle -> DENY DELEGATION_DEPTH
D3 any requested service pattern not covered by the parent's effective allowed set
   (p covered by q if p==q, or q = "x.*" and p starts with "x.")  -> DENY DELEGATION_SCOPE
D4 amount > parent's remaining (case/day/own grant)         -> DENY GRANT_EXCEEDS_PARENT
D5 amount > parent effective tier.autoApproveUpTo           -> ESCALATE (grant is pending until approved)
else -> GRANT active (rootAgentId = parent's root or the parent, depth, expiresAt)
```

### 3.8 Demo scenarios (these are also the test cases)
Scripted in `apps/guard/src/agents/scenarios.ts`; each run starts from a fresh case. Narration delays of ~700 ms in demo mode, 0 in tests (injectable clock).

| ID | Case | Steps → expected |
|---|---|---|
| **S1 Normal** | CASE-1001 (small personal loan) | loan-agent: llm.standard 3k/800 tok → APPROVE · kyc.id-verify $1.20 → APPROVE · credit-bureau.score-pull $2.50 → APPROVE · llm.standard summary → APPROVE. Case spend ≈ $3.8 of $40. |
| **S2 Four-eyes** | CASE-1002 (large mortgage) | llm → APPROVE · kyc $1.20 → APPROVE · credit-bureau.full-report $28.00 → ESCALATE FOUR_EYES (28 > 25). sofia approves (1/2), sofia again → 409, marco approves (2/2) → approved · llm summary → APPROVE. |
| **S3 Structuring** | CASE-1003 | Agent needs 6 valuations ($9.00, which would escalate). It sends property.valuation qty 2 ($3.00) three times, ~20 s apart, with different comparable-property params (so SG-08 doesn't fire): part 1 APPROVE, part 2 APPROVE, part 3 → ESCALATE STRUCTURING, linked to parts 1–2, total $9.00 > $5.00. Sofia rejects; audit shows the linked parts. |
| **S4 Delegation** | CASE-1004 | loan-agent grants fraud-agent $3.00 for [fraud-check.basic, llm.*] → GRANTED · fraud-agent llm.standard (delegated) → APPROVE · fraud-check.basic $0.75 → APPROVE, and loan-agent's case budget drops (shared pool) · fraud-check.enhanced $4.00 → DENY DELEGATION_SCOPE (fraud-agent may buy it on its own authority, not on loan-agent's) · fraud-agent tries to sub-delegate → DENY DELEGATION_NOT_PERMITTED. |
| **S5 Runaway** | CASE-1005 | loan-agent loops llm.premium 8k/2k tokens ($0.27) with the same promptHash every 250 ms: requests 1–5 APPROVE, 6 → DENY RUNAWAY, agent suspended (banner shows projected $/hour). Next request → DENY AGENT_SUSPENDED. Sofia resumes. |

**Extra unit tests:** unknown service; service not allowed; day budget exceeded; amount > escalateUpTo → deny; pending reserves budget, reject releases it; duplicate within 60 s; structuring NOT triggered for parts below `near`; structuring across a helper (same root) IS triggered; grant > parent remaining → deny; grant amount > parent signing limit → escalate; depth > 1 → deny; audit chain verifies, and editing one entry breaks `verify`.

---

## 4. Tech stack and folder structure

**Stack: TypeScript end to end.** One language means less context per session, it's fast to build with AI tools, and it gives a live, polished UI for demo day.
- Node ≥ 22, **npm workspaces** (no extra tooling). `concurrently` runs both apps with `npm run dev`.
- **Guard API:** Fastify 5 + zod 4 + `yaml` + `@fastify/cors`; `tsx` for dev; **Vitest** for tests.
- **Storage:** in-memory store behind a small repository interface, plus append-only JSONL files in `data/` (`audit.jsonl`, `traces.jsonl`). No database. (SQLite only if Pardis asks.)
- **Live updates:** Server-Sent Events (`GET /api/stream`), consumed with `EventSource`.
- **Control room:** React + Vite (the FINOS demo also uses React/Vite) + Tailwind + Recharts + lucide-react icons. No component library.
- **Live LLM mode (§7.6):** `@anthropic-ai/sdk`, only loaded when `LIVE_LLM=1` and `ANTHROPIC_API_KEY` is set.
- **Optional, Tue:** `Dockerfile` + `docker-compose.yml` (one service), to match the FINOS demo's style.

**API (all JSON, base `/api`)**
`POST /spend` · `GET /requests/:id` · `POST /requests/:id/approve` · `POST /requests/:id/reject` · `POST /delegations` · `POST /agents/:id/resume` · `GET /state` (agents, budgets, cases, queue, last 200 requests) · `GET /audit?format=json|csv` · `GET /audit/verify` · `GET /evidence/:caseId?format=json|md` (§7.0) · `GET /finos/status` (§7.0) · `GET /policy` · `POST /policy/reload` · `GET /stream` (SSE) · `POST /scenarios/:id/run` (S1–S5, `?live=1` for §7.6) · `POST /reset` · `GET /traces` · *(stretch)* `GET /metrics` (Prometheus text).

**Folder structure (fits the hackathon template; template files stay at the root)**
```
/                         README.md (filled Day 4), AGENTS.md, CONTRIBUTING.md, LICENSE, NOTICE, ...
CLAUDE.md                 this spec
package.json              npm workspaces + scripts: dev, test, build, gen:schema, check:dco, finos:validate
policies/
  loan-approval.policy.yaml
  spend-policy.schema.json          (generated from zod)
apps/guard/
  src/server.ts
  src/policy/{schema.ts, load.ts, pricing.ts, glob.ts}
  src/finos/{calm-binding.ts, evidence.ts, ccc.ts}     (§7.0, §7.4)
  src/engine/{evaluate.ts, authority.ts, approvals.ts, delegation.ts}
  src/engine/rules/{allowlist.ts, budget.ts, doa.ts, structuring.ts, runaway.ts, duplicate.ts}
  src/store/{memory.ts, audit.ts}    (audit = hash chain + CSV export)
  src/telemetry/trace.ts             (OTLP/JSON spans)
  src/agents/{client.ts, scenarios.ts, live-llm.ts}
  src/api/{routes.ts, sse.ts}
  src/clock.ts
  test/{scenarios.test.ts, rules.test.ts, audit.test.ts, finos.test.ts}
apps/control-room/
  src/{main.tsx, App.tsx, api.ts, useStream.ts}
  src/components/...                 (see §6)
finos/
  calm/loan-approval-with-spend-guard.calm.json
  calm/controls/agent-spend-authority.requirement.json
  ccc/agent-spend-controls.yaml      (§7.4)
  aigf/proposed-risk-agent-spend-authority.md
  aigf/proposed-mitigation-delegated-spend-controls.md
  fluxnova/                          (§7.5: worker notes, patched BPMN, how-to)
  traces/sample-trace.json
  evidence/sample-evidence-CASE-1005.md
scripts/finos-validate.ts            (§7.0)
docs/
  prd.md, personas.md, doa-mapping.md, pitch.md, demo-script.md, how-it-was-built.md
data/                     runtime only, gitignored
```
**Ports:** guard on 8080; Vite on 5173 with a `/api` proxy to 8080. (If running next to the Steel Thread stack, which also uses 8080, set `PORT=8088` for the guard.)
**DCO check script:** `npm run check:dco` lists commits since `hackathon/main` with no `Signed-off-by:` trailer (it should print nothing).

---

## 5. Data model (TypeScript, `apps/guard/src/types.ts`)

```ts
type Outcome = 'approve' | 'deny' | 'escalate';
type Status  = 'approved' | 'denied' | 'pending' | 'rejected' | 'expired';

interface SpendRequest {
  id: string; ts: string;                     // ISO
  caseId: string; agentId: string;
  delegationId?: string; rootAgentId: string; // owner of the budget
  kind: 'llm' | 'service'; service: string;   // e.g. 'llm.standard', 'fraud-check.basic'
  inputTokens?: number; outputTokens?: number; promptHash?: string;
  quantity?: number; params?: Record<string, unknown>; paramsHash?: string;
  amount: number; currency: 'USD'; purpose: string;
  source?: 'scripted' | 'live-llm' | 'fluxnova';  // where the request came from
  status: Status; traceId: string; spanId: string;
}
interface RuleResult { ruleId: string; result: 'pass' | 'fail' | 'skip'; detail?: string; aigf?: { risks: string[]; mitigations: string[] }; ccc?: string }
interface Decision {
  requestId: string; outcome: Outcome; reasonCode: string; reason: string;  // human sentence in bank language
  ruleId?: string; ruleTrace: RuleResult[]; linkedRequestIds?: string[];
  approvalsRequired?: 0 | 1 | 2; policyVersion: string; evaluatedAt: string;
  calmControl: string;               // 'agent-spend-guard#agent-spend-authority'
  limitsSnapshot: { tier: string; autoApproveUpTo: number; remaining: number };
}
interface Approval { requestId: string; approverId: string; role: string; action: 'approve' | 'reject'; comment?: string; ts: string }
interface Delegation {
  id: string; parentAgentId: string; childAgentId: string; rootAgentId: string; caseId: string;
  amount: number; spent: number; services: string[]; depth: number;
  status: 'active' | 'pending' | 'denied' | 'expired'; createdAt: string; expiresAt: string;
}
interface AgentState { agentId: string; suspended: boolean; suspendedReason?: string; projectedHourlyBurn?: number }
interface AuditEntry {
  seq: number; ts: string;
  type: 'POLICY_LOADED' | 'CALM_BINDING_VERIFIED' | 'SPEND_REQUESTED' | 'DECISION' | 'APPROVAL_GIVEN' | 'APPROVAL_REJECTED'
      | 'REQUEST_EXPIRED' | 'STRUCTURING_LINKED' | 'DELEGATION_GRANTED' | 'DELEGATION_DENIED'
      | 'AGENT_SUSPENDED' | 'AGENT_RESUMED';
  actor: string;                     // agent id, approver id, or 'spend-guard'
  payload: Record<string, unknown>;  // ids, amount, outcome, ruleId, aigf refs, ccc id, traceId
  prevHash: string; hash: string;    // sha256(canonicalJSON({seq,ts,type,actor,payload,prevHash}))
}
```
**CSV export columns:** seq, ts, type, actor, caseId, agentId, onBehalfOf, service, amount, outcome, ruleId, reason, approver, aigfRisks, cccControl, calmControl, source, traceId, hash.
**SSE events:** `request`, `decision`, `approval`, `delegation`, `agent`, `audit`, `reset`, each `{type, data}`.

---

## 6. Control room UI (one screen, designed for a 1440×900 demo)

**Layout**
```
┌ Header: ◆ Agent Spend Guard | policy "loan-approval-agent-spend v1.0.0" | FINOS chain ✓ | Acting as: [Sofia ▾] | [Demo ▸] [Reset] ┐
├ KPI strip: Spend today / budget · Auto-approved · Escalated (pending) · Denied · Agents suspended          ┤
├ Budgets (3 cols)        │ Live spend feed (6 cols)                  │ Approval queue (3 cols)            ┤
│ • Burn-down line chart  │ time · agent (+ chain chip "loan-agent →  │ card: amount, agent, case, WHY     │
│   per agent (remaining  │   fraud-agent") · source chip (Fluxnova / │ (rule + plain sentence), linked    │
│   vs time)              │   live LLM) · service · $ · decision      │ split parts (SG-05), four-eyes     │
│ • Case budget bars      │   badge · rule chip (SG-05) · reason      │ progress ●○, [Approve] [Reject]    │
│                         │ click row → Request drawer                │                                    │
├ Bottom tabs: Audit log & evidence | Agents & delegations | Policy                                          ┤
└ Suspension banner (red, top) when SG-07 trips: "loan-agent frozen: looping, projected $X/hour. [Resume]"     ┘
```
**Components:** `Header` (PolicyBadge, **FinosChainBadge** (from `GET /api/finos/status`: "AIGF ✓ CALM ✓ CCC ✓ Fluxnova ✓/–"), ActingAsSwitcher, DemoMenu S1–S5 + live toggle, ResetButton) · `KpiStrip/KpiTile` · `BudgetPanel` (BurnDownChart, CaseBudgetBars) · `SpendFeed` (FeedRow, DecisionBadge, DelegationChip, SourceChip, RuleChip) · `ApprovalQueue` (ApprovalCard, FourEyesProgress, LinkedPartsList) · `RequestDrawer` (ruleTrace list with pass/fail, AIGF refs, CCC id, CALM control, limits snapshot, traceId) · `AuditLog` (type/agent filter, Export CSV/JSON, **Evidence report per case**, ChainVerifiedBadge "✓ chain intact, N entries") · `AgentsPanel` (AgentCard with tier, budgets, status, Resume; DelegationTree) · `PolicyViewer` (read-only YAML plus a table rule → AIGF → CCC) · `SuspensionBanner` · `Toast`.

**Visual rules (Pardis owns the final look):** light, bank-grade neutral (slate), one accent colour; decisions always shown as **icon + word + colour** (✓ Approved green, ⏳ Escalated amber, ✕ Denied red) for accessibility; tabular numbers for money; new feed rows highlight for ~1 s; text in the bank's language ("outside delegated authority", "signing limit", "four-eyes"), with token counts only in the drawer. The demo menu can be hidden for screenshots (`d` key).

---

## 7. FINOS integration (functional pipeline, not just files)

### 7.0 How the FINOS projects work together (the Track 2 story)
```
AIGF  (risk + mitigation IDs)  ─┐
CCC   (control catalog)        ─┼─> policy controls[] reference both
CALM  (architecture as code)   ───> declares node agent-spend-guard + control agent-spend-authority
                                    whose requirement = spend-policy.schema.json, config = the policy YAML
Guard (runtime)                ───> on startup VERIFIES the CALM binding, then enforces the policy
Fluxnova (Steel Thread BPMN)   ───> loan process calls the guard before paid steps (§7.5)
OTel + evidence report         ───> every decision carries AIGF + CCC + CALM refs = audit-ready evidence
```
Concretely:
1. **CALM binding at startup (`src/finos/calm-binding.ts`).** Load `finos/calm/loan-approval-with-spend-guard.calm.json`, find node `agent-spend-guard` and control `agent-spend-authority`. Resolve its `requirement-url` and `config-url` to repo-local paths (strip the GitHub `blob/main/` prefix). Check that (a) the config path is the policy actually loaded, (b) the policy validates against the requirement schema, (c) every policy control has `aigf` refs and a `ccc` id that exists in the CCC catalog. If any check fails: refuse to start with a clear error (in tests/dev, `SPENDGUARD_STRICT=0` downgrades to a warning). On success: audit `CALM_BINDING_VERIFIED` with the CALM file's sha256.
2. **`GET /api/finos/status`** returns `{ aigf: {ok, ids}, calm: {ok, file, sha}, ccc: {ok, controls}, fluxnova: {connected, lastCallAt} }` for the header badge.
3. **Evidence report (`src/finos/evidence.ts`), `GET /api/evidence/:caseId`.** Per case: every request, decision, rules evaluated (pass/fail), AIGF risks/mitigations, CCC control id, CALM node/control, approvers, traceId, audit hash, plus chain verification. JSON and markdown. Save one example to `finos/evidence/sample-evidence-CASE-1005.md`.
4. **`npm run finos:validate` (`scripts/finos-validate.ts`).** Runs: CALM CLI validate (`npx @finos/calm-cli validate -a <file>`, skip with a note if it won't install), policy vs schema, CCC catalog parses and covers SG-01..SG-09, AIGF ids in the policy all appear in the mapping. Prints one ✓/✕ line per check. Also called from `npm test` via `finos.test.ts` (without the CLI).

### 7.1 CALM
In task 4.1, fetch the FINOS demo's `architecture/loan-approval.calm.json` (finos-hack/ai-steel-thread-demo), copy it to `finos/calm/loan-approval-with-spend-guard.calm.json` and keep **its `$schema` version**. Then add our node, two relationships and a control. Find the loan-agent node id in their file.
```json
{
  "unique-id": "agent-spend-guard",
  "node-type": "service",
  "name": "Agent Spend Guard",
  "description": "Policy enforcement point for agent spending. Every LLM or paid-service spend by an agent is approved, denied or escalated under a delegation-of-authority policy.",
  "interfaces": [ { "unique-id": "spend-guard-http", "host": "spend-guard", "port": 8080 } ],
  "controls": {
    "agent-spend-authority": {
      "description": "Agents spend only within delegated authority: budgets, signing limits, four-eyes, structuring detection, delegation attenuation, kill switch (AIGF AIR-SEC-024, AIR-OP-028; CCC catalog finos/ccc/agent-spend-controls.yaml).",
      "requirements": [ {
        "requirement-url": "https://github.com/finos-hack/fall-hackathon-2026-gamma/blob/main/finos/calm/controls/agent-spend-authority.requirement.json",
        "config-url": "https://github.com/finos-hack/fall-hackathon-2026-gamma/blob/main/policies/loan-approval.policy.yaml"
      } ]
    }
  }
}
```
Relationships: `connects` loan agent → `agent-spend-guard` (interface `spend-guard-http`, "authorise spend before LLM/vendor call"); `connects` `agent-spend-guard` → their OTel collector/Tempo node ("decision evidence"). `agent-spend-authority.requirement.json` = the generated `spend-policy.schema.json` wrapped as a CALM control requirement.

### 7.2 Trace format (OpenTelemetry, OTLP/JSON shape)
One span per evaluation, `name: "spendguard.evaluate"`, `resource.service.name: "agent-spend-guard"`, written to `data/traces.jsonl`. If the env var `OTEL_EXPORTER_OTLP_ENDPOINT` is set, it is also POSTed to `<endpoint>/v1/traces` (stretch).
Attributes: `gen_ai.agent.id`, `gen_ai.request.model` (llm only), `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens` (GenAI semantic conventions, the same family as Steel Thread's llm-token-usage), then `spendguard.case_id`, `spendguard.service`, `spendguard.amount`, `spendguard.currency`, `spendguard.decision`, `spendguard.reason_code`, `spendguard.rule_id`, `spendguard.source`, `spendguard.delegation.parent_agent_id`, `spendguard.delegation.root_agent_id`, `spendguard.policy.version`, `aigf.risk_ids`, `aigf.mitigation_ids`, `ccc.control_id`, `calm.node_id`, `calm.control_id`. Span status is ERROR for deny, UNSET otherwise; there's a span event `escalated` / `approved_by` when a human acts. Save one real example to `finos/traces/sample-trace.json`.

### 7.3 Proposed AIGF risk and mitigation (contribution text)
Mirror the format of an existing risk file in `finos/ai-governance-framework` (fetch one in task 4.1). Draft content:
- **Risk (proposed, Operational): "Agent Exceeds Delegated Spending Authority".** Autonomous agents spend money on behalf of the firm (LLM tokens, paid data and verification services) without the controls applied to humans with spending authority. Failure modes: runaway consumption from loops or non-determinism; threshold evasion by splitting purchases (structuring); authority amplification when an agent delegates to helper agents whose authority or budget is not bounded by the delegator; spend that can't be attributed to a case, agent or approver. Impact: financial loss, budget overruns, a broken DoA/segregation of duties, audit findings. Related: AIR-SEC-024, AIR-OP-028, AIR-OP-018, AIR-OP-006.
- **Mitigation (proposed, Preventative + Detective): "Delegated Spend Authority Controls for Agents".** Express agent spending authority as code, mirroring the firm's DoA matrix: per-agent tiers with signing limits, approval ceilings and four-eyes; case and daily budgets; service allow-lists; structuring detection over a time window; delegation attenuation (a delegate's authority is a subset of the delegator's and spends from the same budget); a circuit breaker with human-only resume; a tamper-evident audit trail and OpenTelemetry evidence per decision. Reference implementation: Agent Spend Guard. Related: AIR-PREV-018, AIR-PREV-022, AIR-DET-021, AIR-DET-004.

### 7.4 CCC (Common Cloud Controls) control catalog
In task 4.1, fetch one control catalog file from `finos/common-cloud-controls` and **mirror its format exactly** (it follows the Gemara model, Layer 2: threats and controls). Write `finos/ccc/agent-spend-controls.yaml` with one control per SG-01..SG-09: id (e.g. `CCC.AgentSpend.CN01` style, matching their naming), title, objective, threats it addresses (link to the AIGF risk IDs), assessment requirements (testable statements, e.g. "When an agent's request exceeds its signing limit, the request is escalated to an approver with an allowed role"), and a pointer to the test that proves it (`apps/guard/test/...`). Then fill `ccc:` on each policy control. Keep it to the format; don't invent extra structure.

### 7.5 Fluxnova / Steel Thread hook (must-have, timeboxed)
Goal: the **real** Steel Thread loan process (Fluxnova BPMN) asks the guard before paid steps. Fluxnova is built on the Camunda 7 engine, so the expected route (verify first in the repo/docs) is one of:
- **(A) External task worker (preferred):** add a service task `Authorise agent spend` (`camunda:type="external"`, topic `spend-guard`) before the agent step in `LoanApprovalProcess_AI`. Our Node worker (`apps/guard/src/finos/fluxnova-worker.ts`) polls the engine REST API (`fetchAndLock` / `complete` / `handleBpmnError`), calls `evaluate`, and completes the task with `spendDecision` variables, or raises BPMN error `SPEND_DENIED`. Escalations wait for the approval queue, then complete.
- **(B) HTTP call from a Java delegate or the `llm-token-usage` plugin** to `POST /api/spend`, if (A) isn't possible.
Explain the chosen approach in ≤8 lines and wait for Pardis's OK before building.
**Timebox: 4 hours.** If the Steel Thread stack won't run in time (Java 21, Docker, two API keys, slow build), deliver the **fallback**: the patched BPMN file + worker code in `finos/fluxnova/`, a test that runs the worker against a mocked engine REST API, and a README section "How to plug into the Steel Thread" with the exact steps. Either way, requests from this path get `source: 'fluxnova'`.

### 7.6 Live LLM mode (bonus: real agent, timeboxed 2 h)
`src/agents/live-llm.ts`: when `LIVE_LLM=1` and `ANTHROPIC_API_KEY` is set, the loan-agent in S1 (and optionally S5) makes **real** Claude calls. Before each call it asks the guard (`POST /api/spend` with estimated tokens); after the call it logs actual usage from the API response in the trace. S5 live: the agent is prompted in a way that makes it retry/loop, and SG-07 stops it. Use a small, cheap model and keep max tokens low. The scripted mode stays the default for a reliable demo; the video shows one live run. Requests get `source: 'live-llm'`.

---

## 8. Plan: build days in Claude Code sessions

Day 1 is a half day (Fri 13 Nov evening). Must-haves come first. Each row is one fresh session. Tick boxes as you go. **When merging this v2 spec, keep any boxes already ticked.**

### Day 1 — Fri 13 Nov (half day)
- [x] **1.1 Repo setup + scaffold** (Sonnet). Steps: clone `finos-hack/fall-hackathon-2026-gamma` → rename remote `origin` to `hackathon` → Pardis creates an empty **private** GitHub repo → add it as `origin` → `git push -u origin main`. Set `git config user.name/user.email` to match Pardis's GitHub account. Commit `README.md` title "Agent Spend Guard" + "Hackathon Track: AI Governance / Gov-as-Code (Steel Thread)" with `-s` → push to `origin` **and** `hackathon` (access test). Add CLAUDE.md, npm workspaces, Fastify `/api/health`, Vite + Tailwind hello page, Vitest, `.gitignore` (`data/`, `.env`, `node_modules`), `check:dco` script. **DoD:** `npm run dev` shows the page calling `/api/health`; `npm test` is green; test push visible on the hackathon repo; `check:dco` clean.
- [x] **1.2 Policy model** (Sonnet). zod schema (incl. optional `ccc` field), YAML loader with cross-checks (§2.1), the demo policy (§2.2), pricing calc, glob matcher, `gen:schema`, `GET /api/policy`. **DoD:** policy loads; 4 validation tests (bad tier ref, bad threshold order, unknown control type, pricing maths) pass.

### Day 2 — Sat 14 Nov (engine)
- [x] **2.1 Guard core** (Sonnet). types, store, clock, `evaluate` steps 0–3 and 5–7 + 9, approvals (incl. four-eyes, expiry), hash-chained audit + verify + CSV, trace spans to JSONL, all endpoints except scenarios/evidence/finos. **DoD:** S1 and S2 pass as tests; extra tests for budget/duplicate/four-eyes/audit tamper pass.
- [ ] **2.2 Structuring + runaway** (Sonnet → Opus if stuck; explain first). SG-05, SG-07, suspension and resume. **DoD:** S3 and S5 tests + the structuring edge tests pass.
- [ ] **2.3 Delegation** (Sonnet → Opus if stuck; explain first). Grant creation D1–D5, authority context, shared debits. **DoD:** S4 test + delegation edge tests pass; all tests green.

### Day 3 — Sun 15 Nov (demo + UI)
- [ ] **3.1 Scripted agents + scenario runner + SSE** (Sonnet). `client.ts` calls the HTTP API; S1–S5 runnable via `POST /api/scenarios/:id/run`; `/reset`; SSE events. **DoD:** with `curl` you can run each scenario and watch events stream; scenarios wait for human approvals.
- [ ] **3.2 Control room part 1** (Sonnet). Layout, header (acting-as, demo menu, reset, FINOS badge placeholder), live feed, approval queue with four-eyes and linked parts, suspension banner + resume. **DoD:** S1–S5 can be demoed end to end in the browser.
- [ ] **3.3 Control room part 2** (Sonnet). KPI strip, case budget bars (burn-down only if quick), request drawer (rule trace, AIGF, CCC, CALM refs), audit tab with export + chain badge, agents & delegations tab. Policy tab only if time is left. **DoD:** the full 3-minute demo runs without touching the terminal; Pardis is happy with the look.

### Day 4 — Mon 16 Nov (FINOS pipeline + story)
- [ ] **4.1 FINOS artefacts + pipeline wiring** (Sonnet; Opus if the CCC/CALM formats are confusing). Verify the AIGF IDs (§2.2 note); CALM file + requirement (§7.1); CCC catalog (§7.4) + `ccc:` ids in the policy; CALM binding at startup (§7.0.1); `GET /api/finos/status` + header badge; evidence report endpoint + UI button + sample file (§7.0.3); `finos:validate` (§7.0.4); sample trace with CCC/CALM attributes; AIGF risk + mitigation markdown (§7.3). **DoD:** guard refuses to start with a broken CALM binding and starts with the correct one (test); `npm run finos:validate` prints all ✓ (or documents why the CALM CLI was skipped); evidence report for CASE-1005 lists AIGF + CCC + CALM refs; header shows the FINOS chain.
- [ ] **4.2 Docs + README** (Opus for polish). Fill the README template (name, track, problem, install, usage, dev setup, architecture diagram (mermaid) showing the §7.0 pipeline, FINOS integration section, **"How it was built"** (spec-first CLAUDE.md, one Claude Code session per task, model-switching rules, tests as the spec's scenarios, AI tools used), roadmap, demo video link placeholder); `docs/prd.md`, `personas.md`, `doa-mapping.md` (table below), `pitch.md`, `demo-script.md`, `how-it-was-built.md`. **DoD:** someone new can clone, `npm i && npm run dev`, and run the demo from the README alone.
- [ ] **4.3 Dry run + fixes** (Sonnet). Two timed rehearsals of the demo, fix bugs, small UI polish. **DoD:** 2 clean runs under 3:00; all tests green; `check:dco` clean; pushed to `origin`.

### Tue 17 Nov — integration + video
- [ ] **T1 Fluxnova / Steel Thread hook** (Sonnet → Opus if stuck; explain first; **timebox 4 h**, §7.5). **DoD:** either a real Steel Thread loan run shows `source: fluxnova` requests in the control room, or the full fallback (patched BPMN + worker + mocked-engine test + README how-to) is committed.
- [ ] **T2 Live LLM mode** (Sonnet; **timebox 2 h**, §7.6). **DoD:** with `LIVE_LLM=1`, S1 runs with real Claude calls through the guard; S5 live is stopped by SG-07; scripted mode unchanged.
- [ ] **T3 Demo video** (≤3 min, screen + voice; upload unlisted, link in README). Show the FINOS chain badge, one Fluxnova-sourced request (or the fallback), one live-LLM run, and the evidence report.
- Then stretch only: **X1** what-if simulator (edit a threshold, replay recorded requests, show the decision diff); **X3** `/metrics` for Prometheus/Grafana; Docker.

### Wed 18 Nov — submission
Final push of the full, unsquashed history: `git push hackathon main` **by 12:00 ET (18:00 Berlin)**, then verify in the browser (files, README rendering, commit sign-offs). Submit before **17:00 ET (23:00 Berlin)**. If the hackathon rules require working in the assigned repo directly, push once per day instead.

### 8.1 DoA mapping (for docs and pitch)
| Bank control | Agent Spend Guard |
|---|---|
| DoA matrix / signing limits | `authorityTiers.autoApproveUpTo` |
| Approval chain / escalation | escalate → `approverRoles` |
| Approval ceiling (beyond your authority) | `escalateUpTo` → deny |
| Four-eyes principle | `fourEyesAbove`, 2 distinct approvers |
| Cost-centre budget | `budgets.perCase / perDay` |
| Card merchant-category restriction | `allowedServices` |
| Sub-delegation can't exceed your own authority | SG-06 attenuation + shared budget |
| AML structuring / smurfing detection | SG-05 |
| Card freeze | SG-07 kill switch, human-only resume |
| Audit trail, 2nd line of defence | SG-09 hash-chained log + evidence report + control room |

### 8.2 Cut list (cut from the top if behind; never cut the "Protected" line)
1. X1, X3, Docker · 2. OTLP export (keep JSONL traces) · 3. Policy tab · 4. Burn-down chart → simple bars · 5. Request drawer → tooltip · 6. Live LLM mode (T2) · 7. Duplicate rule SG-08 · 8. Four-eyes → single approval · 9. Hash chain → plain append-only log.
**Protected:** guard API + DoA tiers + budgets, SG-05 structuring, SG-06 delegation, SG-07 kill switch, approval queue, live feed, audit export, **CALM binding at startup, CCC catalog, AIGF evidence report, `finos:validate`, FINOS chain badge, Fluxnova hook (real or fallback)**, AIGF proposal, README incl. "How it was built".
Integration earns more points than polish (§10): when in doubt, cut UI polish before FINOS wiring.

### 8.3 Schedule check
End of Sat: the engine is done (all S1–S5 tests pass). If not, go straight to cut items 7–9 and move 3.3 polish to Tuesday after T1. End of Mon: 4.1 must be done; if not, it goes first on Tuesday before T1.

### 8.4 Later (ideas parked during the build)
- authorise → capture with actual token usage (card-style settlement)

---

## 9. Pitch outline and submission checklist

**Pitch (3:00)**
- 0:00–0:20 **Hook.** "Banks already decide who can spend how much. AI agents have no such rules yet."
- 0:20–0:40 **Gap.** The Steel Thread governs what the loan agent decides and already measures tokens (`llm-token-usage`). Nobody controls the spend. "You measure spending. This controls it." Deterministic controls bounding non-deterministic agents.
- 0:40–2:05 **Live demo** S1 (from the Fluxnova loan process or the live LLM agent) → S2 (four-eyes) → S3 (structuring caught) → S4 (helper can't exceed its parent) → S5 (runaway frozen).
- 2:05–2:40 **FINOS pipeline, working as one.** CALM declares the control and the guard won't start without it; every rule is an AIGF risk and a CCC control; Fluxnova calls the guard; every decision becomes OTel evidence and an AIGF evidence report (show it for CASE-1005). Plus our proposed AIGF risk + mitigation.
- 2:40–3:00 **How it was built + roadmap + ask.** Built solo in 4 days, spec-first with Claude Code. Next: contribute the risk/mitigation to AIGF and the controls to CCC; add the guard to the Steel Thread as a governed node; wire spans into their Grafana/Tempo; later, authorise/capture settlement and a policy simulator.

**Submission checklist**
- [ ] README template fully filled: name, **Hackathon Track: AI Governance / Gov-as-Code (Steel Thread)**, problem, install, usage, dev setup, architecture (FINOS pipeline diagram), FINOS integration, How it was built, roadmap, demo video link
- [ ] LICENSE + NOTICE intact; no secrets; `data/` and `.env` not committed
- [ ] Every commit signed off (`npm run check:dco` prints nothing)
- [ ] Tests green; `npm run finos:validate` all ✓; fresh clone → `npm i && npm run dev` works
- [ ] `finos/` artefacts present (CALM, requirement, CCC catalog, AIGF md, Fluxnova hook or fallback, sample trace, sample evidence)
- [ ] Demo video ≤3 min uploaded, link in README
- [ ] Full unsquashed history pushed to `hackathon` by Wed 12:00 ET; verified in the browser
- [ ] Submitted before Wed 18 Nov 17:00 ET
- [ ] Portfolio: export `docs/prd.md`, `personas.md`, `doa-mapping.md` and screenshots for the case study

---

## 10. Judging rubric and our targets (Track 2)

| Category | Target | What earns it here |
|---|---|---|
| 1. Ecosystem Integration (/5) | 5 | AIGF + CALM + CCC + Fluxnova working as one pipeline (§7.0): CALM binding enforced at startup, controls catalogued in CCC and tagged with AIGF, Fluxnova calls the guard, evidence carries all refs. |
| 2. Technical Execution (/5) | 5 | Functional demo of S1–S5, tests = scenarios, `finos:validate` green, runs from a fresh clone. |
| 3. Business Value (/5) | 5 | DoA matrix, four-eyes, AML structuring, card-freeze kill switch; explicitly "bounding non-determinism with deterministic controls in an AI pipeline". |
| Bonus: Innovation & Build Velocity (/5) | 4–5 | Spec-driven build with Claude Code, documented in "How it was built"; a real LLM agent governed live (§7.6); agent-to-agent delegation attenuation. |
Use the rubric's own words in the README and pitch: "multiple FINOS projects working synergistically", "deterministic controls bounding non-deterministic AI", "functional technical demo".

### Build notes (real state, as of Fri 13 Nov; follow these over the spec text)
- Tasks 1.1 and 1.2 are done. `check:dco` is clean; `hackathon/main` has the test push (README commit). `origin` is the private repo.
- Schema generator lives at `apps/guard/scripts-gen-schema.ts` (run via `npm run gen:schema`), not under `scripts/`.
- `buildApp()` is in `apps/guard/src/app.ts` (used by tests via `inject`); `server.ts` only listens. Port comes from `PORT` (default 8080); the startup log line still says ":8080".
- `npm test` runs only the guard workspace (Vitest). `finos:validate` script is not added yet (task 4.1).
- Policy zod schema has the optional `ccc` field on controls; the YAML has no `ccc` values yet (task 4.1).
- Dev UI: Vite on 5173 proxies `/api` to `localhost:8080`; with `PORT=8088` the proxy target in `apps/control-room/vite.config.ts` must be changed too.
- Not run in this session: `npm run dev` in a browser (the 1.1 DoD "page calls /api/health" rests on code + health test).
- Task 2.1 done. `buildApp({clock, dataDir, policyPath})`: no `dataDir` = in-memory (tests); `server.ts` writes `data/audit.jsonl` + `data/traces.jsonl`. Tests use `test/helpers.ts` (`mk()` with a `ManualClock`).
- Engine is `engine/{evaluate,authority,approvals}.ts` (rules are inline in `evaluate.ts`, not in `engine/rules/`). SG-05/SG-07 runaway are `skip` entries in the trace until 2.2; any `delegationId` is DENY `DELEGATION_INVALID` until 2.3 (`authority.ts` has own authority only).
- Not built in 2.1 (per §8): `/api/scenarios`, `/api/delegations`, `/metrics`. `POST /api/reset` truncates the audit/trace files (demo only). `resume` is implemented (audit `AGENT_RESUMED`); nothing suspends yet.
- Errors: `{error, message}` JSON; 404 NOT_FOUND, 403 UNKNOWN_APPROVER/ROLE_NOT_ALLOWED, 409 NOT_PENDING/FOUR_EYES_SAME_APPROVER, 400 BAD_REQUEST.
