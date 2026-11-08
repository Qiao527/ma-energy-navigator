# Contributing

Every Floor is a portfolio project by Qiao Long. These are the rules the work follows; read
[`docs/product.md`](docs/product.md) first.

## Principles

1. **Numbers come only from deterministic code.** Eligibility, costs, savings, payback and CO₂ are computed by
   tested code. A language model may later help understand, ask, route and explain. It never computes or invents
   a number, and never names a program the rules engine did not return.
2. **Ranges, never false precision.** Every estimate carries a low / mid / high and a confidence label that says
   why.
3. **Every rule has a source.** Each rule carries `source_url`, `last_verified` and `effective_from` /
   `effective_until` where known. A rule without a source does not ship.
4. **Ask, don't pretend.** Missing or ambiguous facts (unit count, utility, heating fuel, who pays) become
   questions, never assumptions.
5. **Accessibility is a requirement.** WCAG 2.2 AA, keyboard navigation, a text alternative for every chart,
   color never the only carrier of meaning, works on a phone.
6. **Equity is about access to savings.** Environmental Justice data is used to prioritize help, never to label
   or judge a neighborhood.
7. **Privacy.** Utility bills contain account numbers and addresses. Extract only the fields needed, never log
   raw bills, never commit real personal data.

## How decisions are marked

`docs/product.md` tags every statement **[Decided]** (agreed; don't reverse it silently), **[Proposed]**
(a reasoned suggestion still to check against reality) or **[Open]** (not yet answered). Every change of status
goes into [`docs/decisions.md`](docs/decisions.md) with the date, the decision, why, and who decided.

## How to work

- Brainstorm, write a plan, implement test-first, then review. Don't skip the plan for anything larger than a
  small fix.
- Separate evidence from inference: cite the source of a fact about policy, data or a library.
- Prefer the smallest thing that works. No speculative features, options or abstractions; change only the lines
  the task needs.
- Turn each task into a check that can pass or fail, usually a test.
- Run the standard scenarios (`npm run scenarios` in `engine/`) before any change to rules data or the engine.
  A changed expected result needs Qiao's approval.
- New or changed rules go through the drafting workflow (`docs/product.md` §6a): a draft with verbatim quotes,
  the automatic quote check (`npm run rules:check-drafts`), then Qiao's approval (`tools/approve_rules.py`).
  Never add an active rule directly.
- Technical details (code structure, data formats, libraries, test design, naming) are decided in the work and
  recorded in `docs/decisions.md`. Product direction, policy interpretation, and fairness questions go to Qiao.

## Publishing

- Commits are authored as Qiao Long (GitHub **Qiao527**).
- The public page is built only from approved rules; CI and the Pages workflow fail otherwise.
- CI must pass. No secrets or personal data; generated files stay out of git.
- Code, comments, commit messages and docs are written in English.
