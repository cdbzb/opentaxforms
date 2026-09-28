# 2025 capital gains prototype

## Investment income extension

The implemented extension in [investment-income-plan.md](investment-income-plan.md)
adds payer records, Schedule B and a year-specific qualified-dividends/capital-gain
worksheet. It reuses TelosTax's income, deduction and carryover calculations;
the adapter replaces only the displayed line 16 calculation with the verified
IRS table/worksheet path. `src/tax/2025` holds the new tax rules and extracted
IRS table, separate from presentation. Two upstream income-tax gaps are
documented there. The sections below describe the original capital-gains slice;
the extension widens it only to the stated investment inputs and line 16.

## Paper-like Form 1040 presentation

Form 1040 uses two paper-like HTML sheets, compact line rows, a section-label
column, and paired interest/dividend/distribution amounts. Read-only calculation
boxes, editable amounts and unsupported notes have distinct labels and styling.
The explanation panel contains support requirements, unknown-amount applicability
controls and source navigation. The paper retains compact unsupported markers.
At narrow widths paired columns and section labels stack; browser zoom and
native keyboard controls remain available. CSS is scoped to Form 1040.
This is a presentation change: engine behavior and save format stay unchanged.
Exact PDF reproduction and filing-ready printing remain outside this step.

## Full-form presentation extension

Restore the 2025 Form 1040 section and numbered-line order using a declarative
registry checked against the official two-page form. Supported lines retain
their existing calculations. Unsupported lines show the missing implementation
and an IRS instruction link; unimplemented totals never appear as zero.

Users may record unsupported source amounts or mark a situation as applicable
without knowing its amount. These are saved local notes, not inputs to the tax
engine. Any such entry blocks calculated results and marks the return incomplete,
including in printed output. No partial AGI or carryforward may look authoritative.
An additive `unsupported1040` save field holds these records; older version-1
drafts load with an empty map. Unsupported entries survive save/load and export.
Identity, banking, signature and preparer sections are visible placeholders,
not collection forms. This change does not expand verified tax-rule coverage.

The first implementation follows the reuse evaluation: one pinned TelosTax engine,
a small TypeScript adapter, declarative form definitions, and a static Vite UI.
No account, backend, AI calls, telemetry, or remote font/runtime assets are needed.

## Boundaries

- `vendor/telostax/`: the transitive source dependencies of the 1040 calculator,
  with MIT license, original hashes, revision, and a local patch record. No client,
  proprietary PDF viewer, server or chat implementation is imported.
- `src/adapters/`: validates the supported input model, invokes the calculator,
  maps actual 2025 form identities and indexes emitted calculation traces.
- `src/forms/`: labels, line IDs, sources, explanation text and navigation.
- `src/ui/`: form rendering and interactions, with no tax calculations.
- `src/storage/`: versioned local JSON; validates imported and stored data.
- `tests/`: IRS-grounded calculation, dependency, validation and storage tests.

Supported slice: W-2 wages, ordinary stock sales reported with basis and no
adjustments (Schedule D 1a/8a), and short/long carryovers. Standard deduction
assumes eligibility, no dependent status, no age/blindness additions. No complete
tax liability/refund is displayed. Other situations are outside this prototype.
Tax year is fixed at 2025, independently of the calendar year.

Both previously reproduced TelosTax defects are fixed in the full entry point:
carryover-only activity must trigger Schedule D; next-year carryforward must use
unfloored taxable income and preserve short/long character. A pure 13-line
carryover worksheet implements the documented gap, sourced to IRS instructions.
The official 2025 worksheet computes incoming losses from 2024. An outgoing-loss
preview uses the 2025 Publication 550 rule and is not labeled an official 2026 form.

Provenance is emitted alongside the affected calculations. The adapter uses
those recorded values and dependencies; it does not reimplement the tax engine.
The registry checks missing references and cycles and explains active branches.
Recompute the small supported return on edits; do not build a second evaluator.

Storage is browser localStorage plus explicit JSON download/import. Save files
are unencrypted and contain only the prototype fields. Invalid/unsupported
versions and incomplete numbers are surfaced, not silently treated as zero.
Print output is a clearly marked working summary, not an IRS filing artifact.

Validation includes the published IRS Bob/Shelly loss example, loss caps,
low/negative taxable income, ST/LT netting, carryover-only returns, correct gain
versus loss routing, missing input, cycle detection, and local round-trips.
DOM interaction tests cover edits, source navigation, reload and local storage.
Real-browser checks for responsive layout, print, keyboard behavior, and
return-data network behavior remain outstanding; see `prototype-validation.md`.
