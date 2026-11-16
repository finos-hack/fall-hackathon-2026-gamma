# Demo script (target under 3:00)

Setup: `npm run dev`, open http://localhost:5173, click **Reset**, press `d` to show the Demo menu. Acting as: Sofia.

| Time | Action | Say |
|---|---|---|
| 0:00 | Header visible | "Banks decide who can spend how much. AI agents have no such rules. This is that control." Point at the FINOS chain badge. |
| 0:20 | Demo > S1 | "A normal loan case. Small spends, all auto-approved within the agent's signing limit." |
| 0:40 | Demo > S2 | "A $28 credit report is above the four-eyes limit." Approve as Sofia; try Sofia again (refused); switch to Marco and approve. |
| 1:10 | Demo > S3 | "The agent splits one $9 purchase into three $3 purchases to dodge approval. Borrowed from AML structuring detection." Open the escalated card, show the linked parts, reject. |
| 1:35 | Demo > S4 | "The loan agent delegates to a fraud helper. The helper cannot exceed its parent and spends from the same budget." Show the denied enhanced check in the feed. |
| 1:55 | Demo > S5 | "A looping agent is cut off after five requests, like a blocked card." Show the red banner, click Resume. |
| 2:15 | Click a feed row, then the Audit tab | Show the rule trace with AIGF and CCC refs, "chain intact", and the evidence report for the S5 case. |
| 2:40 | Close | Mention the CALM binding at startup, the proposed AIGF risk and mitigation, and that the Fluxnova hook is tested against a mock engine only. |

Rehearsal notes: S2 and S3 wait for a human, so click quickly. Record the two timed runs (task 4.3):

- Run 1: not yet done
- Run 2: not yet done
