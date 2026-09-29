# OpenTaxForms

A free, open-source, privacy-first experiment in making U.S. federal tax forms computable, navigable, and understandable.

See:

- `AGENTS.md` for project and implementation principles.
- `docs/product-vision.md` for the product concept and initial scope.
- `docs/reuse-evaluation.md` for the completed source/license evaluation,
  reproduced defects, and recommended prototype architecture.

## Run the prototype

Use Node.js 22.12+ (or a compatible newer LTS release) and npm:

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173 and choose **Load example**. Open Schedule D,
change sale proceeds, then follow Form 1040 line 7a through its source amounts.
The inspector also follows losses back to the carryover worksheet and inputs.

```bash
npm test
npm run check:vendor
npm run build
```

The static build is in `dist/`. It needs no account, application server, API
keys, runtime CDN, or tax-data network requests. A development server uses Vite's
local reload connection; the production build does not.

## Current scope

Working **2025** prototype: W-2 wages, plain interest and dividends by payer,
ordinary capital gain distributions, covered stock sales without adjustments,
Schedule B, Schedule D, Form 1040 calculations through line 16 income tax,
the Qualified Dividends and Capital Gain Tax Worksheet, the 2024 → 2025 Capital
Loss Carryover Worksheet, and an outgoing-loss preview.
Calculations reuse pinned MIT-licensed TelosTax modules with documented repairs
for carryover-only returns and low-income carryforwards. The visible income-tax
calculation uses the official IRS Tax Table below $100,000 and a traceable
25-line preferential-rate worksheet; it corrects two documented upstream gaps.

Open **Schedule B** to enter payer records and answer the foreign-account/trust
questions. Qualified dividends are included in ordinary dividends, not added
again. Capital gain distributions flow through Schedule D line 13. Select Form
1040 line 16 to trace its tax-table lookup or worksheet calculation. Foreign
accounts/trusts, special investment treatment and special tax methods remain
unsupported; flagging them withholds all calculated results.

The Form 1040 view preserves the full 2025 numbered-line sequence and sections.
It uses two paper-like sheets with compact rows, aligned amount boxes and paired
interest, dividend and distribution fields. Paired columns stack at narrow
widths. Select a line or focus an amount to see its explanation beside the form.
Unsupported lines have compact markers; the explanation panel shows the forms
or rules needed and lets you mark an unknown amount as applicable.
You can record an unsupported amount or mark a line as applicable even if the
amount is unknown. These entries remain local notes and make the return
incomplete: calculated totals and carryforward estimates are withheld rather
than silently omitting them. Unimplemented tax, payment and refund totals never
appear as zero. Older saved drafts remain compatible.

Select any amount for its calculation, source fields, and IRS instructions.
Edits recalculate locally. Drafts save in browser storage; JSON download/import
provides a portable copy. Both are unencrypted. Print produces the currently
open form as a clearly labeled working summary. Clearing browser storage
removes its saved draft; keep an exported copy when needed.

This is **not a filing-ready return**. It assumes eligibility for the base
standard deduction, no dependent status, and no age/blindness additions. It
does not determine filing-status or qualified-dividend eligibility, calculate
total tax/refund, support e-file, or handle other income and deduction scenarios.
Schedules 1/2/3/A and special tax methods remain unimplemented. Schedule B's
foreign-account/trust reporting and special investment treatments are unsupported.
The outgoing-loss preview is not an official 2026 worksheet.

- [Architecture and scope](docs/prototype-architecture.md)
- [Validation results and remaining checks](docs/prototype-validation.md)
- [2025 IRS regression examples and boundary fixtures](docs/calculation-regressions-2025.md)
- [Investment income implementation and verification](docs/investment-income-plan.md)
- [Schwab CSV import scope and source mapping](docs/schwab-import.md)
- [Pinned engine and exact patches](vendor/telostax/PATCHES.md)
- [Original candidate comparison](docs/reuse-evaluation.md)
- [Original integration spike](spikes/reuse/README.md)
- [Sharing the prototype and GitHub Pages deployment](docs/sharing.md)

The regression corpus now has 233 passing tests, including published IRS
examples and independently worked carryover boundary fixtures. Desktop
validation was reported by the project owner; detailed mobile, keyboard, print
and network checks remain to be recorded. Open **Brokerage import** to review a Schwab tax CSV locally. Supported 2025
interest/dividend files can be appended after review; source receipts and duplicate
detection persist with the draft. Wrong years, corrected statements, sales, OID
and unsupported boxes block the whole file. The next calculation expansion
needed for broader brokerage imports is Form 8949 and bond/OID treatment.
Original application code is MIT licensed; retained TelosTax attribution is in
`vendor/telostax/LICENSE` and the distributed third-party notice.

## Original evaluation brief

From this directory:

```bash
codex
```

Then prompt:

```text
Read AGENTS.md and docs/product-vision.md.

First evaluate OpenTax, UsTaxes, TelosTax, HabuTax, and Direct File's
Fact Graph for legal and technical reuse. Do not begin by implementing
a new Form 1040 calculation engine.

Use primary project sources, source code, and license files. Confirm the
identity of each project; record repository URLs and inspected revisions.
Compare reusable components, license obligations and compatibility,
supported tax years and forms, correctness evidence, maintenance,
local/browser execution, integration cost, and provenance capabilities.
Distinguish verified findings from unknowns and identify any legal questions
that remain unresolved. Publicly visible code is not itself permission to reuse.

Write docs/reuse-evaluation.md with a comparison matrix, component-level
reuse recommendations, and the smallest sound prototype architecture.
Where practical, validate promising components with a small local spike
using synthetic inputs. Document what was actually run and its limits.

Prioritize our implementation effort on the transparent, forms-first UI:
Form 1040 → source schedule → worksheet → inputs, with explanations,
IRS citations, and calculation provenance. Check how candidates already
support this experience rather than assuming it is absent.

Recommend the first tested Schedule D → Form 1040 integration path,
with local-only persistence and an explicitly supported tax year.
Justify any new calculation code by a documented gap in reusable options.
Do not invent IRS rules or treat unverified third-party results as authoritative.
```
