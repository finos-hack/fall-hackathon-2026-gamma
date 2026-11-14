# How to plug Agent Spend Guard into the Steel Thread

The Steel Thread loan process (`LoanApprovalProcess_AI`, Fluxnova 3.0.0) already runs its steps as
external tasks. We add one more: **"Authorise agent spend (Spend Guard)"**, topic `spend-guard`, in front
of the paid fraud-detection step. A Node worker inside the guard polls the engine, asks the guard for a
decision and completes the task, or raises BPMN error `SPEND_DENIED`.

```
Document intelligence -> Valid? -> [Authorise agent spend] -> AI: Fraud Detection -> ...
                                         | error SPEND_DENIED
                                         v
                                 Loan stopped (spend denied)
```

## What is in this folder

| File | What |
|---|---|
| `LoanApprovalProcess_AI.spend-guard.bpmn` | Their process with our task, boundary error and end event added. Nothing else changed (4 lines edited: the "Valid" flow now targets our task, the fraud task's incoming flow, and the diagram waypoints of that flow). |
| `../../apps/guard/src/finos/fluxnova-worker.ts` | The external task worker. |
| `../../apps/guard/test/fluxnova.test.ts` | Worker tested against a mock engine REST API: approve, deny, escalate (lock extended, then approved / rejected / expired), case id from business key. |

## Steps

1. Run the Steel Thread as in its README (Java 21, Docker). Keep their API keys in **their** `.env` only.
   Their API and Cockpit use port 8080, so run the guard on another port.
2. Replace their `src/main/resources/bpmn/LoanApprovalProcess_AI.bpmn` with
   `finos/fluxnova/LoanApprovalProcess_AI.spend-guard.bpmn` (same file name), then rebuild the app
   (`docker compose up --build app frontend`).
3. Start the guard with the worker switched on:

   ```sh
   PORT=8088 FLUXNOVA_URL=http://localhost:8080/engine-rest npm run dev -w apps/guard
   # optional: FLUXNOVA_USER / FLUXNOVA_PASSWORD (default demo / demo)
   ```
4. Start the control room against that guard: `GUARD_URL=http://localhost:8088 npm run dev -w apps/control-room`.
   The header badge shows **Fluxnova ✓** after the first successful poll.
5. Start a loan from the Steel Thread Launch UI. The feed shows a `fluxnova` source chip; the case id is the
   process **business key** (or the process instance id when the key is empty).

## Behaviour

- Input defaults on the BPMN task: `spendAgent=loan-agent`, `spendService=fraud-check.basic`, `spendQuantity=1`
  (a normal run is approved). Override them as process variables or by editing the task's input parameters.
- **Approve** completes the task with variables `spendDecision`, `spendRequestId`, `spendReason`.
- **Deny** (any rule) raises BPMN error `SPEND_DENIED`, which the boundary event routes to "Loan stopped".
- **Escalate** keeps the task locked: the worker extends the lock until a human resolves the request in the
  approval queue, or it expires after 15 minutes (counted as denied, so `SPEND_DENIED`).
- Without `FLUXNOVA_URL` nothing changes: no worker starts and `npm i && npm run dev` runs as before.
