# Pitch outline (3:00)

Use the rubric's words: "multiple FINOS projects working synergistically", "deterministic controls bounding non-deterministic AI", "functional technical demo".

- **0:00-0:20 Hook.** "Banks already decide who can spend how much. AI agents have no such rules yet."
- **0:20-0:40 Gap.** The Steel Thread governs what the loan agent decides and already measures tokens. Nobody controls the spend. "You measure spending. This controls it."
- **0:40-2:05 Demo in the control room.** All five scenarios are scripted agents against the mocked vendors.
  - S1: normal case (scripted agent), small spends auto-approved.
  - S2: a $28 credit report needs four-eyes; Sofia and Marco approve.
  - S3: the agent splits $9 into three $3 purchases and is caught.
  - S4: the fraud helper cannot exceed its parent's authority and spends from the same budget.
  - S5: the looping agent is frozen; show the projected $/hour.
- **2:05-2:40 FINOS pipeline.** CALM declares the control and the guard will not start without it. Every rule is an AIGF risk and a CCC control. Every decision becomes OpenTelemetry evidence and an evidence report (show CASE-1005). We propose one AIGF risk and one mitigation. Fluxnova is the fallback: worker + patched BPMN + mocked-engine test, ready to plug in, not running in the Steel Thread.
- **2:40-3:00 How it was built and what is next.** Solo, four days, spec-first with Claude Code. Next: run on the real Steel Thread, contribute the risk/mitigation to AIGF and the controls to CCC, wire spans into Grafana/Tempo, settlement and a policy simulator.
