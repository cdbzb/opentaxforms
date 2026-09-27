# 2025 prototype validation

## Completed

- `npm test`: **98 tests pass** across calculation, storage, and DOM interaction
  suites. Tests invoke the patched engine, not the unmodified candidate checkout.
- `npm run build`: TypeScript checks and Vite's static production build pass.
- `npm run check:vendor`: 91 source files match the recorded upstream or local
  hashes (90 original files, two modified, one added); the distributed notice
  retains the complete upstream MIT license.
- The Vite development server starts at `http://127.0.0.1:5173/`.

## Calculation evidence

`tests/calculation.test.ts` is the tax-year-specific 2025 regression corpus.
The pure worksheet tests cover negative and zero taxable income, partially
absorbed losses, mixed short/long netting, deduction ordering, the MFS cap,
cent rounding, and invalid numeric inputs. Form-level tests invoke the full
1040 entry point through the constrained adapter, including all five filing
statuses, gain/loss routing, no activity, carryover-only activity, mixed sales,
recalculation, and missing-input failure. Every emitted reference must resolve;
missing sources and circular dependencies are rejected.

The published [Bob/Shelly example in 2025 Publication 550, p.102](https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102)
supplies a $7,000 loss, $26,000 taxable income, $3,000 deduction and $4,000
carryforward. Tests check those amounts both directly and through the full
engine. For the full-engine fixture, **$60,500 wages and short-term loss
character are synthetic assumptions**, chosen to reproduce the published
taxable income using the 2025 joint standard deduction. They are not additional
facts supplied by the IRS example.

Other fixtures are independent synthetic applications of the
[2025 Schedule D instructions, p.10](https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=10)
and Publication 550 rule. The incoming worksheet uses actual 2024 return
amounts; the outgoing preview applies the carryover method to the supported
2025 inputs without claiming to implement an official 2026 worksheet.

Verified form identities and deductions come from the
[2025 Schedule D](https://www.irs.gov/pub/irs-prior/f1040sd--2025.pdf),
[2025 Form 1040](https://www.irs.gov/pub/irs-prior/f1040--2025.pdf), and
[2025 Form 1040 instructions](https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf).
The engine retains decimal cents; this is a working calculation summary,
not validation of whole-dollar IRS filing/export behavior.

## Interaction and persistence evidence

`tests/ui.test.ts` uses jsdom to exercise the actual UI event handlers. It
checks edits flowing through the forms, source navigation into prior-year
worksheets, input focus preservation, reload from browser storage, valid/invalid
imports, protection of corrupt saves, saving failure, escaped imported text,
confirmation before replacing a draft, download creation, and print invocation.
Carryover validation also links directly to the labeled 2024 source input,
marks it invalid accessibly, and clears the error after correction.
Amount errors distinguish blanks, formatting, sign, precision, and size limits.
Regression cases verify navigation to wages, sale amounts, and prior-year inputs
even when the error is displayed on another form.
The full-form tests independently assert the 2025 Form 1040 numbered-line order,
explicit unsupported statuses and IRS links, and the absence of fabricated zero
tax/refund totals. Unsupported amounts and applicability flags block calculation,
persist across reload and JSON export/import, and can be cleared to restore the
supported calculation. Incomplete-return notices remain in the DOM on every
form and are included by the print stylesheet. Actual print layout is unverified.

`tests/form1040.test.ts` checks the calculation boundary for unsupported inputs,
all recordable flags, invalid saved records, migration from older v1 drafts, and
provenance for the direct-copy lines 1z, 11b and 14 in the supported scenario.

The paper-like Form 1040 presentation retains those tests and adds DOM checks
for two sheets, the paired 2a/2b through 6a/6b fields, support details and
unknown-amount controls in the explanation panel, focus preservation when the
panel updates, and compact field errors with full accessible descriptions.
Wage edits, unsupported interest save/reload, and capital-loss source navigation
pass through the real UI event handlers. The stylesheet import resolves in the
production build. No save-schema or tax-engine changes were made for this layout.
Fixed external links point to IRS documents with `noreferrer`; the tested
local interactions make no calls to the stubbed `fetch` function.

`tests/storage.test.ts` checks complete and unfinished draft round-trips,
version/year/engine rejection, invalid amounts, unknown fields, duplicate sale
identifiers, malformed JSON, and oversized imports. Unsupported fields are
rejected rather than discarded and treated as an ordinary supported return.

## Not yet verified

The in-app browser runtime reported `Browser is not available: iab` during
this session; a subsequent full-form check also found no available browsers.
The paper-like layout check likewise found no available browser connection.
Consequently **no real-browser visual or network verification
was completed**. DOM tests do not establish layout, accessibility, actual file
download/reimport behavior, browser print output, or network isolation.

Before widening scope or publishing:

1. At desktop and narrow mobile widths, check every form, focus order, source
   navigation, monetary input, long descriptions, and blank/error states.
2. Download an actual draft, reload, import it, and confirm the values match.
3. Inspect printed summaries for clipping, missing values, year and scope labels.
4. Record browser requests for edit, reload, save/load and worksheet navigation;
   confirm no taxpayer values leave the device. Test the static production build
   separately from Vite's development reload connection.
5. Broaden independent IRS examples and review patched engine interactions
   before exposing additional schedules or complete tax/refund results.

The original unpatched upstream suite results remain historical evaluation
evidence. They are not claimed as a full rerun of the patched extraction.
