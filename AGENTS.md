# AGENTS.md

## Project purpose

This project exists to empower ordinary taxpayers to prepare and understand their own U.S. federal income tax returns.

It should feel like a transparent, computable version of the IRS forms — not a proprietary interview funnel.

## Core principles

- Free and open source.
- No upsells, paid tiers, artificial feature gates, or dark patterns.
- User tax data remains local by default.
- No account should be required for the core application.
- The actual tax forms remain visible and central to the experience.
- Every calculated value should be traceable to its source.
- Every important tax line should link to the relevant IRS instructions.
- Worksheets should be directly accessible rather than hidden.
- Tax calculations must be deterministic code, never LLM output.
- AI may explain tax concepts or IRS instructions in plain English, but AI must not be the authoritative calculation engine.
- Prefer primary IRS sources over secondary summaries.
- Make it easy for a user to see why a number appears where it does.
- Preserve user agency: explain, expose, and calculate; do not obscure.

## First step: evaluate reuse

The initial evaluation is complete in `docs/reuse-evaluation.md`, with pinned
source revisions and reproducible checks in `spikes/reuse/`. Read those findings
before implementation; refresh affected evidence if selecting a different
upstream revision. The recommendation is provisional, with explicit defects
to repair, not approval of a complete tax-return engine.

Before scaffolding the application or writing a new tax calculation engine,
evaluate OpenTax, UsTaxes, TelosTax, HabuTax, and Direct File's Fact Graph.
Confirm project identities and inspect primary repositories, source code,
and licenses. Record revisions, component-level license obligations and
compatibility, supported tax years/forms, correctness evidence, maintenance,
local execution, integration cost, and provenance support.

Deliver `docs/reuse-evaluation.md` with evidence, unresolved questions,
reuse recommendations, and a proposed prototype architecture. Validate
promising integrations with small local spikes using synthetic inputs where
practical. Do not assume public source code is licensed for our use or that
an existing engine is correct without verification.

Concentrate new work on the transparent, forms-first interface and
explanation/provenance layer. Reuse suitable components where legally and
technically compatible; justify new calculation code with documented gaps.

## Initial product scope

The first milestone is a working browser-based prototype of Form 1040 with a small set of supporting schedules and worksheets.

Start with:

- Form 1040
- Schedule 1
- Schedule 2
- Schedule 3
- Schedule A
- Schedule B
- Schedule D
- Capital Loss Carryover Worksheet
- Qualified Dividends and Capital Gain Tax Worksheet

Do not attempt full e-file support in the first milestone.

The first version should support:

- Direct data entry
- Automatic calculations
- Cross-form references
- Traceability/provenance for calculated values
- Opening the source schedule or worksheet from a calculated field
- Links to official IRS instructions
- Plain-English explanations
- Local save/load
- Printable output
- Basic validation

## Architecture constraints

Prefer a declarative form model.

A form field definition should be able to describe:

- Form identifier
- Tax year
- Line identifier
- Label
- Data type
- Whether the field is user-entered or calculated
- Calculation expression or dependency
- Source field(s)
- Validation rules
- IRS instruction URL / citation
- Worksheet dependency
- Display formatting

Example concept:

```ts
{
  form: "1040",
  taxYear: 2025,
  line: "7a",
  label: "Capital gain or (loss)",
  type: "currency",
  source: "capitalGains.amountFor1040"
}
```

Here `capitalGains.amountFor1040` is a conceptual adapter output, not an IRS
line: the verified 2025 mapping must distinguish Schedule D line 16 gains
from line 21 limited losses. See `docs/reuse-evaluation.md`.

Avoid hard-coding all logic directly into UI components.

Reuse or adapt a dependency engine where suitable; implement missing
capabilities only after the reuse evaluation. The engine integration must:

1. resolve calculated fields,
2. propagate updates,
3. detect circular dependencies,
4. expose provenance,
5. report calculation errors clearly.

## Privacy constraints

The default architecture should not require taxpayer data to leave the user's device.

Prefer:

- static frontend hosting,
- local browser storage or user-controlled files,
- optional encrypted local save files.

Avoid:

- mandatory cloud accounts,
- server-side tax-return databases,
- telemetry containing tax data,
- sending tax form contents to an LLM.

If AI explanations are added, design them so tax return contents do not need to be transmitted.

## Tax correctness

Treat tax logic as production-critical.

For every calculation:

- identify the IRS source,
- add automated tests,
- include edge cases,
- use tax-year-specific rules,
- never silently guess.

Keep tax-year logic versioned.

A calculation should be reproducible from inputs and code alone.

## Testing

Create tests at three levels:

1. Unit tests for individual tax rules.
2. Form-level tests for dependencies and calculations.
3. End-to-end tests using published IRS examples where available.

For each supported tax year, maintain regression fixtures.

## UX principles

The application should help users understand the return.

For any calculated line, provide a way to answer:

- Where did this number come from?
- What form or worksheet produced it?
- What inputs affected it?
- What does this line mean?
- What do the IRS instructions say?

A good interaction pattern is:

**1040 line → source schedule → source worksheet → inputs**

Do not hide tax forms behind a questionnaire-only interface.

## Development behavior for Codex

When implementing:

- work incrementally,
- prefer simple architecture over premature abstraction,
- keep tax rules separate from presentation,
- write tests alongside calculation logic,
- document IRS sources near the relevant rules,
- call out uncertainties instead of inventing rules,
- do not fabricate IRS line numbers, thresholds, forms, worksheets, or URLs,
- if current tax-year material is not available, use a prior year only when explicitly labeled as such.

Before large architectural changes, summarize the proposed structure in the repo documentation.
