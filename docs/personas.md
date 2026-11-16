# Personas

## Daniel, Head of AI Platform at a mid-size bank (owner / buyer)
- **Goal:** roll out AI agents without a cost incident or an audit finding.
- **Pain:** agents spend on LLMs and paid data checks, but there are no limits, approvals or attribution. Model Risk will not sign off on what it cannot review.
- **Needs:** the controls as code, in FINOS formats (AIGF, CALM, CCC), reviewable and versioned.
- **Success:** he can show Model Risk one policy file mapped to named risks and controls.

## Sofia, Compliance Officer, second line of defence (daily user)
- **Goal:** approve escalations and prove to auditors who spent what, under which rule, approved by whom.
- **Pain:** token counts and logs mean nothing to her. She works in the bank's language: signing limits, four-eyes, delegated authority.
- **Needs:** an approval queue that explains *why* something was escalated, a tamper-evident audit export and a per-case evidence report.
- **Success:** she resolves an escalation in seconds and hands an auditor the evidence report.

## Agent developer (secondary)
- **Goal:** call one API and get a clear answer.
- **Needs:** `POST /api/spend` returns a decision, a reason and the rule that fired.
- **Success:** a denied request tells them exactly what to change.
