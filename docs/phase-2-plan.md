# Phase 2: AI navigator

Goal: demonstrate an AI product built around the existing deterministic energy engine.

1. Add a local, same-origin DeepSeek API service. Keep the key on the server; never log requests.
2. Extract a small set of explicitly stated building facts into a reviewable form. Unknowns remain unknown; the user confirms before calculations change.
3. Use the current engine result to provide an explanation and a coordination draft. Model output is restricted to selecting vetted, applicable text; numbers and offer names come from the engine.
4. Test extraction validation, confirmation, grounding, failures, and the existing engine/scenario suite. Document local setup, privacy, limitations and evaluation.

The static GitHub Pages build remains usable without an AI service. Hosting a public AI backend and providing a model credential are separate deployment steps.

## Public preview preparation

- Serve the built static page and two same-origin serverless endpoints on Vercel; preserve the local server.
- Originally planned a server-only project key for the Vercel and local services; superseded by visitor-owned credentials below.
- Before a public endpoint is usable, establish a project-scoped budget and API rate limit; do not expose an unrestricted paid model key.
- Verify the production build, serverless request validation, mocked model responses and a real request when credentials are available.

## Intake usability pass

- Explain the three starting facts (role, Massachusetts town, number of homes), then show optional heating and bill-payer details with a realistic example and a no-guessing reminder.
- Present extracted facts in plain language. Make corrections and the confirmation step explicit; unknown optional details remain unknown.
- Separate describing a building from requesting an explanation of the current report. Preserve the privacy notice, manual form and accessible status feedback.
- Test the review labels, missing-fact prompts and confirmation behavior; build and check keyboard/mobile layout where browser access is available.

## Input and interface polish

- Refine the intake composition and form controls with clear hierarchy, comfortable type, focus/disabled/loading states, responsive spacing, and restrained motion, informed by Apple’s public site.
- Make the description field grow with typing without changing its value or imposing keyboard shortcuts; preserve manual resizing, accessibility, reduced motion and dark mode.
- Keep confirmation, privacy, source data and deterministic calculations intact. Verify textarea behavior, responsive styles, existing tests and a protected preview.

## Independent review fixes

- Preserve demo-data labeling after edits, and require explicit consent before replacing a building with AI-extracted facts.
- Never present an unknown payer as zero shifted cost; distinguish unknown from an observed zero.
- Resolve Massachusetts municipalities against the shared Census list before deriving DEC status; unknown names stay unknown and the UI asks for correction.
- Keep the paid endpoint protected until rate limiting and provider-side spend limits are effective.
- Re-run engine scenarios before and after engine changes, focused regression tests, the full suite, and live evaluation on the corrected preview.

## Visitor-owned API credentials

- Keep the existing labeled example report available without an AI request. Require a visitor-provided provider key for every live AI request; never fall back to the project credential.
- Keep the key only in the current page's password field, send it in a same-origin request header over HTTPS, and do not store or log it. Explain the server transfer and billing before use.
- Apply the same credential requirement locally and on Vercel, preserve the deterministic engine and review step, and update the evaluation runner and setup documentation.
- Test missing and malformed credentials, key selection and redaction, the browser flow, and a protected preview before production.

## Demo-first entry

- Make the existing fictional building and deterministic report the primary path; present the prepared AI extraction honestly as an example.
- Move live AI input and its credential settings into an optional secondary section, keeping manual entry, key privacy, confirmation, and model-free calculations intact.
- Verify the demo and optional live flow at mobile and desktop widths, including keyboard navigation and no-key behavior.

## Resident-first guidance

- Explain the questions the report can help answer, who it is for, and how to start with the fictional example or the building form.
- Explain heat pumps and optional price and efficiency controls in plain language without changing calculations or presenting estimates as guarantees.
- Check the example, own-building form, mobile layout, keyboard access, and existing test suite.

## Portfolio release

- Update the repository landing page and screenshots to match the public demo, visitor-owned credential flow, evidence, and known limits.
- Clearly distinguish the historical independent review and model evaluations from later changes and checks.
- Run the release checks, merge the tested branch to `main`, and verify the public repository and deployments.
