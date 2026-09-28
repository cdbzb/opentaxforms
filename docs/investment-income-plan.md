# 2025 investment income extension

## Structure and reuse decision

Retain the pinned TelosTax Form 1040 income, deduction and carryover engine.
Its 1099-INT/DIV aggregation and Schedule D capital gain distribution path are
reusable. Add payer-level interest and dividend records to the local draft and
expose Schedule B plus the Qualified Dividends and Capital Gain Tax Worksheet.
Tax year stays 2025. No brokerage connection, file parser or backend is added.

The pinned `capitalGains.ts` uses continuous bracket tax below $100,000 and
does not expose the official 25 worksheet lines. IRS 1040 instructions p.38
require Tax Table lookups on worksheet lines 22 and 24. The p.68 published
MFJ example is $2,562 tax on $25,300; continuous brackets give $2,559.
Therefore do not expose upstream Form 1040 line 16. Add a small year-specific
module for the official worksheet, with explicit dependencies. Reuse upstream
brackets at $100,000 and above, checked against the p.80 computation worksheet;
below that threshold use extracted IRS table rows, with a reproducible script
and source hash. This fills a documented gap, not a second 1040 engine.

The upstream MFS 15% upper threshold is also $300,025 (half of MFJ). The
official p.38 worksheet specifies $300,000. The new module explicitly overrides
this value; all five filing-status thresholds have independent tests. The
vendored source files and hash manifest remain unchanged by this extension.

## Input and calculation boundary

Support plain taxable interest, tax-exempt interest, ordinary dividends,
qualified dividends already determined eligible by the user, and ordinary
capital gain distributions. Qualified dividends are a subset of ordinary
dividends, never additional income. Capital gain distributions route through
Schedule D line 13. Add source nodes for each payer/amount and transfer amounts
into 1040 lines 2a/2b/3a/3b. Preferential gains use the smaller positive Schedule
D line 15 or 16, preserving short-loss netting.

Schedule B Part III answers and a special-investment-treatment flag are saved.
Foreign accounts/trusts and special investment treatment block calculation;
unanswered Part III questions block when investment records are entered or
Part III is otherwise required. No automatic FBAR/Form 3520 determination.
Line 3 exclusion, nominee adjustments, OID/bond adjustments, collectibles,
section 1250 gains and investment-interest elections remain unsupported.
Special line-16 methods (8615, 8814, 4972, 2555) are visibly excluded and may be
flagged. Line 16 is income tax before credits/other taxes, not total tax/refund.

Draft fields are additive to version 1; missing investment fields load empty.
Previously saved unsupported notes for lines 2a/2b/3a/3b remain reviewable and
block results until explicitly cleared, never silently converted or discarded.
All new records use the existing local save/export and validation boundary.

## Evidence and next step

Authorities: [Schedule B](https://www.irs.gov/pub/irs-prior/f1040sb--2025.pdf),
[Schedule B instructions](https://www.irs.gov/pub/irs-prior/i1040sb--2025.pdf),
[1040 worksheet p.38](https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf#page=38),
[Tax Table pp.68–79 and computation worksheet p.80](https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf#page=68).

Test table row coverage/boundaries and published example, all filing statuses,
0/15/20% thresholds, regular-tax comparison, short-loss offsets, payer totals,
qualified-dividend bounds, carryover interactions, migration, blocking cases,
and actual UI events. Keep the existing regression corpus intact. Brokerage
file import follows this extension using a redacted sample and explicit preview,
source-row provenance and duplicate detection.

## Completed implementation and evidence

- `src/adapters/model.ts`: additive validated investment records; missing fields
  migrate to empty records, malformed supplied records are rejected. Existing
  unsupported notes remain blocked until explicitly cleared.
- `src/adapters/calculate.ts`: payer inputs enter the existing 1040 engine;
  Schedule B/source nodes use its aggregate results. The upstream line 16
  output is not included in the displayed graph.
- `src/tax/2025/incomeTax.ts`: IRS table lookup below $100,000, reused progressive
  brackets above, and all 25 worksheet lines with dependencies and explanations.
- `src/tax/2025/taxTable.ts`: 2,062 contiguous published rows extracted from
  the IRS PDF. `python3 scripts/extract-tax-table.py PATH_TO_IRS_PDF` reproduces
  it using Poppler; the PDF hash is recorded in the generated header.
- Form registry/UI: Schedule B Parts I–III, payer inputs, explicit unsupported
  treatment, direct 1040 source navigation, a visible tax worksheet, and local
  saves/exports. Incomplete-result warnings survive print styling.

198 tests pass across six suites. The new suite has 53 tests, including the
published IRS table example and synthetic, hand-worked worksheet cases. Every
table row is checked for gap-free coverage and lookup at its inclusive lower
and just-below-exclusive upper bound, in all five filing statuses. These lookup
checks verify selection/coverage, not an independent re-transcription of every
IRS table cell. The extraction uses actual source rows, not generated midpoint
estimates. The p.80 formula checks independently transcribe its multiplication
and subtraction amounts and compare every band with the reused bracket engine.

UI tests use DOM interaction, not a real rendering engine. Agent browser
verification remains unavailable. The prior desktop validation predates this
extension; mobile layout, printed output and runtime network behavior still
need manual verification. Amounts retain cents, as in the existing prototype;
whole-dollar filing/export is outside this step. Only line 16 income tax is
exposed: AMT, net investment income tax, other taxes, credits and refund totals
remain unsupported, even though upstream code computes additional outputs.
