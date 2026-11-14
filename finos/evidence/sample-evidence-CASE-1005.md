# Evidence report: CASE-1005

Generated 2026-11-14T11:27:03.583Z by Agent Spend Guard. Policy `loan-approval-agent-spend` v1.0.0 (approved by AI Model Risk Committee).

- **CALM:** node `agent-spend-guard`, control `agent-spend-authority` (`agent-spend-guard#agent-spend-authority`)
- **AIGF risks:** AIR-OP-006, PROPOSED-AIR-OP-SPEND, AIR-SEC-024, AIR-OP-018
- **AIGF mitigations:** AIR-DET-009, AIR-DET-004, AIR-PREV-018, PROPOSED-AIR-PREV-SPEND
- **CCC controls:** CCC.AgentSpend.CN07, CCC.AgentSpend.CN01, CCC.AgentSpend.CN02, CCC.AgentSpend.CN03, CCC.AgentSpend.CN04
- **Audit chain:** intact (17 entries)
- **Totals:** 7 requests, 5 approved, 2 denied or rejected, 0 pending; approved spend $1.35

## Requests

### req-0001: loan-agent bought llm.premium, $0.27

- **Decision:** approve / approved (APPROVED)
- **Why:** Within loan-agent's signing limit ($5.00) and budget.
- **Source:** scripted · **Time:** 2026-11-14T11:26:48.187Z
- **Trace:** `2446bf9e956b306c6f49903705c43c7a` · **Audit hash:** `837db2d5f769daa5893203751489f6c47426a3ddc232c9df9cd0a5a3acb7584c`

| Rule | Result | CCC | AIGF risks | AIGF mitigations |
|---|---|---|---|---|
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-06 | skip | CCC.AgentSpend.CN06 | AIR-OP-028, AIR-SEC-024 | AIR-PREV-022, AIR-PREV-018 |
| SG-01 | pass | CCC.AgentSpend.CN01 | AIR-SEC-024, AIR-OP-018 | AIR-PREV-018 |
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-08 | skip | CCC.AgentSpend.CN08 | AIR-OP-006 | AIR-DET-004 |
| SG-02 | pass | CCC.AgentSpend.CN02 | AIR-OP-018, PROPOSED-AIR-OP-SPEND | AIR-DET-009, PROPOSED-AIR-PREV-SPEND |
| SG-03 | pass | CCC.AgentSpend.CN03 | AIR-SEC-024 | AIR-PREV-018, PROPOSED-AIR-PREV-SPEND |
| SG-04 | pass | CCC.AgentSpend.CN04 | AIR-SEC-024 | PROPOSED-AIR-PREV-SPEND |
| SG-05 | skip | CCC.AgentSpend.CN05 | AIR-SEC-024, PROPOSED-AIR-OP-SPEND | PROPOSED-AIR-PREV-SPEND |

### req-0002: loan-agent bought llm.premium, $0.27

- **Decision:** approve / approved (APPROVED)
- **Why:** Within loan-agent's signing limit ($5.00) and budget.
- **Source:** scripted · **Time:** 2026-11-14T11:26:49.187Z
- **Trace:** `009d42f906fd59d4c27cec9b2e532bf6` · **Audit hash:** `c22b5e5fe8fe845117f8df778c9df7ceaecd8640a23883f554299ecca369ebdd`

| Rule | Result | CCC | AIGF risks | AIGF mitigations |
|---|---|---|---|---|
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-06 | skip | CCC.AgentSpend.CN06 | AIR-OP-028, AIR-SEC-024 | AIR-PREV-022, AIR-PREV-018 |
| SG-01 | pass | CCC.AgentSpend.CN01 | AIR-SEC-024, AIR-OP-018 | AIR-PREV-018 |
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-08 | skip | CCC.AgentSpend.CN08 | AIR-OP-006 | AIR-DET-004 |
| SG-02 | pass | CCC.AgentSpend.CN02 | AIR-OP-018, PROPOSED-AIR-OP-SPEND | AIR-DET-009, PROPOSED-AIR-PREV-SPEND |
| SG-03 | pass | CCC.AgentSpend.CN03 | AIR-SEC-024 | AIR-PREV-018, PROPOSED-AIR-PREV-SPEND |
| SG-04 | pass | CCC.AgentSpend.CN04 | AIR-SEC-024 | PROPOSED-AIR-PREV-SPEND |
| SG-05 | skip | CCC.AgentSpend.CN05 | AIR-SEC-024, PROPOSED-AIR-OP-SPEND | PROPOSED-AIR-PREV-SPEND |

### req-0003: loan-agent bought llm.premium, $0.27

- **Decision:** approve / approved (APPROVED)
- **Why:** Within loan-agent's signing limit ($5.00) and budget.
- **Source:** scripted · **Time:** 2026-11-14T11:26:50.168Z
- **Trace:** `8c4eb6a623cda1b7d2f298178feba34a` · **Audit hash:** `3630ce9bf8916d06e8640fc7ab0936fd564e963d98d9672e89ecc7c370446c6a`

| Rule | Result | CCC | AIGF risks | AIGF mitigations |
|---|---|---|---|---|
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-06 | skip | CCC.AgentSpend.CN06 | AIR-OP-028, AIR-SEC-024 | AIR-PREV-022, AIR-PREV-018 |
| SG-01 | pass | CCC.AgentSpend.CN01 | AIR-SEC-024, AIR-OP-018 | AIR-PREV-018 |
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-08 | skip | CCC.AgentSpend.CN08 | AIR-OP-006 | AIR-DET-004 |
| SG-02 | pass | CCC.AgentSpend.CN02 | AIR-OP-018, PROPOSED-AIR-OP-SPEND | AIR-DET-009, PROPOSED-AIR-PREV-SPEND |
| SG-03 | pass | CCC.AgentSpend.CN03 | AIR-SEC-024 | AIR-PREV-018, PROPOSED-AIR-PREV-SPEND |
| SG-04 | pass | CCC.AgentSpend.CN04 | AIR-SEC-024 | PROPOSED-AIR-PREV-SPEND |
| SG-05 | skip | CCC.AgentSpend.CN05 | AIR-SEC-024, PROPOSED-AIR-OP-SPEND | PROPOSED-AIR-PREV-SPEND |

### req-0004: loan-agent bought llm.premium, $0.27

- **Decision:** approve / approved (APPROVED)
- **Why:** Within loan-agent's signing limit ($5.00) and budget.
- **Source:** scripted · **Time:** 2026-11-14T11:26:51.151Z
- **Trace:** `b23314f6675a1984bfd672f403d9d39c` · **Audit hash:** `c3e7b5341c1ef27e993bdddba7453f36a9bf43e8c833e53de9e2856ee74e7fb3`

| Rule | Result | CCC | AIGF risks | AIGF mitigations |
|---|---|---|---|---|
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-06 | skip | CCC.AgentSpend.CN06 | AIR-OP-028, AIR-SEC-024 | AIR-PREV-022, AIR-PREV-018 |
| SG-01 | pass | CCC.AgentSpend.CN01 | AIR-SEC-024, AIR-OP-018 | AIR-PREV-018 |
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-08 | skip | CCC.AgentSpend.CN08 | AIR-OP-006 | AIR-DET-004 |
| SG-02 | pass | CCC.AgentSpend.CN02 | AIR-OP-018, PROPOSED-AIR-OP-SPEND | AIR-DET-009, PROPOSED-AIR-PREV-SPEND |
| SG-03 | pass | CCC.AgentSpend.CN03 | AIR-SEC-024 | AIR-PREV-018, PROPOSED-AIR-PREV-SPEND |
| SG-04 | pass | CCC.AgentSpend.CN04 | AIR-SEC-024 | PROPOSED-AIR-PREV-SPEND |
| SG-05 | skip | CCC.AgentSpend.CN05 | AIR-SEC-024, PROPOSED-AIR-OP-SPEND | PROPOSED-AIR-PREV-SPEND |

### req-0005: loan-agent bought llm.premium, $0.27

- **Decision:** approve / approved (APPROVED)
- **Why:** Within loan-agent's signing limit ($5.00) and budget.
- **Source:** scripted · **Time:** 2026-11-14T11:26:52.134Z
- **Trace:** `e903472c7d72ea95f37caf6b9e54cd49` · **Audit hash:** `0fe8c47bf64778fabe48811f31930c1aa376f64d31ed82bc4f16cee058ee9a2a`

| Rule | Result | CCC | AIGF risks | AIGF mitigations |
|---|---|---|---|---|
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-06 | skip | CCC.AgentSpend.CN06 | AIR-OP-028, AIR-SEC-024 | AIR-PREV-022, AIR-PREV-018 |
| SG-01 | pass | CCC.AgentSpend.CN01 | AIR-SEC-024, AIR-OP-018 | AIR-PREV-018 |
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-08 | skip | CCC.AgentSpend.CN08 | AIR-OP-006 | AIR-DET-004 |
| SG-02 | pass | CCC.AgentSpend.CN02 | AIR-OP-018, PROPOSED-AIR-OP-SPEND | AIR-DET-009, PROPOSED-AIR-PREV-SPEND |
| SG-03 | pass | CCC.AgentSpend.CN03 | AIR-SEC-024 | AIR-PREV-018, PROPOSED-AIR-PREV-SPEND |
| SG-04 | pass | CCC.AgentSpend.CN04 | AIR-SEC-024 | PROPOSED-AIR-PREV-SPEND |
| SG-05 | skip | CCC.AgentSpend.CN05 | AIR-SEC-024, PROPOSED-AIR-OP-SPEND | PROPOSED-AIR-PREV-SPEND |

### req-0006: loan-agent bought llm.premium, $0.27

- **Decision:** deny / denied (RUNAWAY, rule SG-07)
- **Why:** loan-agent looks like a runaway loop (5 identical requests in 60s, projected $81.00/hour) and has been frozen. Only a human can resume it.
- **Source:** scripted · **Time:** 2026-11-14T11:26:53.105Z
- **Trace:** `61d8bd4a82156c217f1824234da92088` · **Audit hash:** `613dddcdb6971910d430b942de87249ace87efb8d3a468b9fc75903d553a481b`

| Rule | Result | CCC | AIGF risks | AIGF mitigations |
|---|---|---|---|---|
| SG-07 | pass | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
| SG-06 | skip | CCC.AgentSpend.CN06 | AIR-OP-028, AIR-SEC-024 | AIR-PREV-022, AIR-PREV-018 |
| SG-01 | pass | CCC.AgentSpend.CN01 | AIR-SEC-024, AIR-OP-018 | AIR-PREV-018 |
| SG-07 | fail | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |

### req-0007: loan-agent bought llm.premium, $0.27

- **Decision:** deny / denied (AGENT_SUSPENDED, rule SG-07)
- **Why:** loan-agent is frozen by the kill switch. Only a human can resume it.
- **Source:** scripted · **Time:** 2026-11-14T11:26:53.816Z
- **Trace:** `a6aa4d18d6df3c271a79c1e37f089b4f` · **Audit hash:** `d0811c870a41164fe942dafa73e28acf8da7bc39ef002ecb83d72c2218d241d6`

| Rule | Result | CCC | AIGF risks | AIGF mitigations |
|---|---|---|---|---|
| SG-07 | fail | CCC.AgentSpend.CN07 | AIR-OP-006, PROPOSED-AIR-OP-SPEND | AIR-DET-009, AIR-DET-004 |
