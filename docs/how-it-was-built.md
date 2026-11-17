# How it was built

Agent Spend Guard was built solo in four days (Fri 13 to Mon 16 Nov 2026) for the FINOS Fall Hackathon, spec-first with Claude Code.

## 1. Spec before code
[`CLAUDE.md`](../CLAUDE.md) was written first and treated as final: the product, the policy model, the exact evaluation pipeline (checks in a fixed order, the first deny short-circuits), the data model, the API and the five demo scenarios. Design questions were settled in the spec, not during the build.

## 2. One session per task
The spec has a checklist of tasks, each with a definition of done. One Claude Code session handled one task, ended with a DCO-signed commit and a ticked box, and the next task started in a fresh session. This kept context small and the history readable.

## 3. Tests are the spec's scenarios
Scenarios S1-S5 are Vitest tests with the spec's expected outcomes, plus edge-case tests (budgets, duplicates, structuring across helpers, grant limits, audit tampering). A task was done when its tests passed.

## 4. Model switching by difficulty
Sonnet by default; Opus for the hard rules (structuring, delegation, the Fluxnova hook) if Sonnet struggled, and for polish. For the hard rules the approach was explained in a few lines and approved before building.

## 5. Scope control
Everything external is mocked. Ideas went to a "Later" list rather than into the code, and a cut list fixed what to drop first if time ran short.

## What was built, in order
1. Scaffold, policy model and schema (zod, YAML, generated JSON Schema).
2. Guard core: evaluation, approvals, hash-chained audit, traces.
3. Structuring, runaway breaker, delegation.
4. Scenario runner, SSE, control room.
5. FINOS artefacts and wiring: CALM binding at startup, CCC catalog, evidence report, `finos:validate`.
6. Fluxnova worker and patched BPMN, tested against a mock engine only.

## Honest limits
The Fluxnova hook has not run against the real Steel Thread stack, and the live LLM mode was cut (roadmap only). See the [README](../README.md).
