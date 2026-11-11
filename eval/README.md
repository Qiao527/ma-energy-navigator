# AI intake evaluation

This small, hand-authored evaluation checks whether the assistant extracts only explicitly stated building facts.
It includes roles, missing and conflicting answers, different floors, buildings outside the supported size, and one
instruction-injection attempt. All inputs are fictional. Expected values are in `intake-cases.json`.

For each field the runner compares the API response with the expected value. An invented fact is a non-null answer
where the expected answer is null; an omitted fact is a null answer where the input explicitly supplied a value.
It also counts other mismatches and request errors. This does not establish the correctness of the energy engine,
the safety of arbitrary input, or the quality of free-form generated text. The latter is not generated here: the
model chooses from fixed explanation and message templates, whose values come from the engine.

## Observations

On 2026-11-10, using `deepseek-flash` on a protected Vercel preview:

- The initial 10 cases passed once.
- An expanded 16-case run passed 15; a homeowner in a single-family building was incorrectly classified as a
  landlord. The prompt was corrected, and the same 16 cases passed on the next run (zero field mismatches).
- A subsequent run against the protected preview after the independent-review fixes also passed all 16 once.
- A prior live example incorrectly applied a tenant-only electricity payer to an owner-occupied floor. The prompt
  was clarified and a deterministic guard was added; the example and its regression test passed.

These are small, developer-authored examples, some reused while developing the prompt. Results are not an
independent benchmark; model responses can vary between runs, and provider model aliases can change. They should
not be interpreted as a guarantee for new users or adversarial input. Users must review the extracted facts.

## Reproduce

Requires Node 24, the Vercel CLI linked to the project, access to a protected preview with `DEEPSEEK_API_KEY` set,
and an account with available model credit. Each case sends one fictional description to DeepSeek and incurs API
usage. Do not put real personal information into the fixtures.

```bash
node --test ai/*.test.mjs
node eval/run-intake.mjs https://<your-preview>.vercel.app
```

The live command exits nonzero for any mismatch or request error. It prints case IDs and mismatched fields, not API
keys or request headers. CI validates fixture structure and deterministic boundaries without model calls.
