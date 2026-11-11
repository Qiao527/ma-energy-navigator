# Phase 2 independent review and response

An independent read-only review of the working tree on 2026-11-10 found five issues that must be addressed before
a public AI release. The reviewer reproduced the unknown-payer result against the engine; the other findings were
based on code paths.

| Finding | Response |
|---|---|
| Confirming AI facts replaces the current form and can discard bills and per-floor edits without warning. | Added an explicit confirmation that names the replacement and potential loss; cancelling keeps the existing state. |
| Unknown bill payers can be shown as zero cost shifted to tenants. | The headline figure now says the amount is unknown when payer allocation is incomplete. A regression exercises a real engine report. |
| Editing a demo field removes its label while fictional records remain. | The example remains labeled after edits. The user must explicitly clear the form to start without example data. |
| A misspelled or unrecognized town is treated as definitely outside a Designated Equity Community. | The engine checks the shared Census municipality list and leaves unrecognized towns unknown. The form and AI review ask users to correct an unrecognized name. |
| An unestimated electric water-heater switch can still be shown as a zero cost shift. | Unestimated hot-water switches now force an unknown shift status; a real-report regression covers an owner-paid heat-pump meter. |
| The fairness section can label known-floor costs as a whole-building total when another payer is unknown. | The fairness section shares the completeness check, withholds partial totals, and retains legal and fairness guidance when a known shift exists. A rendering regression checks those details. |
| A shift caused only by hot-water electricity can be misdescribed as heat pumps on tenants’ meters. | The fairness copy now covers heating and hot water without asserting which meter serves the heat pump; a real-report regression covers owner-paid heat-pump meters. |
| The AI explanation can describe a heating-only estimate as a whole-building change when hot water was omitted. | The explanation now specifies the types of costs covered and explicitly notes omitted hot-water changes. |
| The paid public AI endpoints have no effective rate limit or provider spending cap. | **Open:** the Vercel firewall draft only logs requests and is not published. The AI deployment remains login-protected until rate limiting and a provider-side spending limit are in effect. |

The engine scenario suite passed before and after the municipality change. AI extraction evaluation and its
limitations are documented in [`eval/README.md`](../../eval/README.md). The independent reviewer rechecked the fixes and ran the energy regression suite (38 tests passed), with no
new blocking findings, conditional on keeping the paid endpoint protected. A fresh full accessibility audit
and the public-release protections remain open before declaring this phase complete.
