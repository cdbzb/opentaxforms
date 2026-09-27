# Product Vision

## Working title

**OpenTaxForms**  
Placeholder name only.

## Problem

Most consumer tax software hides the tax return behind an interview.

That can be convenient, but it also means the taxpayer often cannot easily see:

- which form is being completed,
- why a number appears on a line,
- which worksheet produced it,
- which IRS rule applies,
- how one form flows into another.

The result is a black-box experience around a public legal and administrative process.

Historically, Free File Fillable Forms demonstrated another model: let people work directly with tax forms while providing arithmetic and electronic assistance.

This project takes that idea further.

## Goal

Build a free, open-source, privacy-first application that allows ordinary people to prepare their own U.S. federal income tax returns directly from the tax forms.

The goal is not to replace the forms with a proprietary interview.

The goal is to make the government's own forms:

- computable,
- navigable,
- understandable,
- traceable,
- less intimidating.

## Product idea

The user sees Form 1040.

They can type into fields that require taxpayer input.

Calculated fields update automatically.

When a value comes from another form, the user can click it and open the source.

Example:

**2025 Form 1040, line 7a — Capital gain or (loss)**

The interface might show:

- `Calculated from Schedule D, line 16` (gain scenario)
- `Open Schedule D`
- `IRS instructions`
- `Explain this`

If the user follows the source into Schedule D and encounters a capital-loss carryover field, they can open the relevant worksheet.

The return becomes a visible dependency graph instead of a black box.

These examples use verified 2025 line identities. Losses require a different
transfer path through Schedule D line 21; do not use the gain example as a
universal formula. See [the reuse evaluation](reuse-evaluation.md).

## Design philosophy

### 1. Forms first

The IRS form remains the primary interface.

Questionnaires may eventually assist users, but they should not replace visibility into the forms.

### 2. Trace every number

Any calculated number should expose its provenance.

A user should be able to move backward through:

**1040 → schedule → worksheet → source inputs**

### 3. Deterministic calculations

All tax calculations must be deterministic, testable code.

LLMs must not decide:

- tax liability,
- eligibility,
- thresholds,
- deductions,
- filing status,
- worksheet results.

AI can explain language, summarize instructions, and help users navigate.

### 4. Primary sources

Where possible, each field should link directly to:

- IRS form instructions,
- IRS worksheets,
- IRS publications,
- official IRS guidance.

### 5. Privacy by architecture

The safest database of tax returns is no database.

The default application should run locally in the user's browser and keep return data on the user's device.

Possible storage modes:

- browser local storage,
- downloadable JSON file,
- encrypted local project file.

Cloud sync can be considered later, but should not be necessary.

### 6. Free means free

No:

- paid upgrade for Schedule D,
- premium tier for rental income,
- forced account creation,
- deceptive refund products,
- advertisements based on tax information,
- selling user data.

## Reuse evaluation before implementation

The initial evaluation is now recorded in [reuse-evaluation.md](reuse-evaluation.md).
It identifies existing forms/provenance interfaces, component licensing
constraints, reproduced calculation gaps, and a proposed limited 2025 prototype.
Use those findings to guide implementation; the structure below remains conceptual.

The first deliverable is `docs/reuse-evaluation.md`, evaluating OpenTax,
UsTaxes, TelosTax, HabuTax, and Direct File's Fact Graph. These are candidates
to investigate, not established reuse choices.

For each candidate, confirm the project's identity and record primary-source
links and inspected revisions. Compare:

- Reusable components: calculations, form definitions, worksheets, dependency
  tracking, explanations, tests, and fixtures.
- Component and dependency licenses, attribution/distribution obligations,
  compatibility with this application, and unresolved legal questions.
- Supported tax years and forms, IRS sourcing, test coverage, and maintenance.
- Browser/local execution, runtime dependencies, required services, and the
  work needed to keep taxpayer data on the user's device.
- Access to intermediate values, dependencies, rule branches, and source
  citations needed for accurate provenance.
- Existing forms-first navigation and explanations, and gaps our UI could fill.

Use source inspection and small local integration spikes with synthetic data
where practical. Separate demonstrated behavior from claims and unknowns.
Do not infer reuse permission from public availability or correctness from
the existence of an implementation.

Recommend components to reuse, adapt, or exclude, explain the tradeoffs, and
propose the smallest sound architecture. A recommendation may combine parts
of multiple projects. New calculation code needs a documented gap in the
available options; a new engine is not the default starting point.

Our intended focus is the transparent, forms-first interface and its
explanation/provenance layer. Whether this experience is comparatively absent
in existing projects is a question for the evaluation, not an assumed finding.

## Initial milestone

Build a credible proof of concept rather than an entire tax system.

### Supported forms

Start with:

- Form 1040
- Schedules 1–3
- Schedule A
- Schedule B
- Schedule D

Add a small number of important worksheets, such as:

- Capital Loss Carryover Worksheet
- Qualified Dividends and Capital Gain Tax Worksheet

### Required features

#### Form rendering

Render IRS-like forms in the browser.

The initial prototype does not need pixel-perfect reproduction, but field identities and relationships should be clear.

#### Calculations

Support:

- arithmetic,
- conditional calculations,
- references between forms,
- worksheet-derived values,
- tax-year constants.

#### Dependency graph

For the 2025 gain scenario:

`1040.line7a = scheduleD.line16`

then changing the relevant Schedule D input should automatically update Form 1040.

#### Provenance

Clicking a calculated field should reveal its calculation source.

Example:

```text
$12,450

Source:
Schedule D, line 16

Depends on:
Schedule D lines 7 and 15
```

#### IRS references

Each important line should expose its official IRS instruction reference.

#### Plain-English explanation

A user can ask:

`What does this line mean?`

The explanation should be clearly separated from the authoritative IRS source.

#### Validation

Initial validation should catch obvious problems such as:

- missing required fields,
- invalid numeric values,
- inconsistent totals,
- impossible combinations,
- unresolved dependencies.

#### Save/load

Allow the user to save the return locally and reopen it.

#### Print/export

Generate a printable return.

E-file is explicitly out of scope for the first milestone.

## Later milestones

### More tax forms

Potential expansion:

- Schedule C
- Schedule E
- Form 8949
- Form 4562
- Form 6251
- Form 8606
- Form 8889
- Form 1116
- Form 8863
- Form 8995 / 8995-A

### Import

Possible import support for:

- W-2
- 1099-INT
- 1099-DIV
- 1099-B
- brokerage CSV exports

Imports should always remain reviewable by the user.

### E-file

Electronic filing can be a separate project phase.

That phase may require:

- IRS e-file provider registration,
- Modernized e-File schemas,
- business-rule validation,
- IRS Assurance Testing System participation,
- secure transmission infrastructure.

Do not let e-file complexity delay the initial product.

### State tax returns

Treat state returns as separate modules after the federal architecture proves itself.

## Technical direction

A provisional UI stack, subject to the reuse evaluation:

- TypeScript
- React or another lightweight component framework
- Vite
- Vitest
- browser-based storage
- JSON or TypeScript form definitions

The critical architectural boundary is:

```text
UI
↓
Form model
↓
Adapter to selected dependency/calculation components
↓
Tax-year rules
```

Tax rules should not live inside visual components. The adapter should expose
values, dependencies, source references, and calculation errors without
duplicating the selected engine's tax logic. Any provenance added by the UI
must correspond to the calculation actually performed.

## Suggested repository structure

This layout is provisional. `engine/` and `rules/` may contain adapters or
references to reused components; they are not instructions to rewrite them.
Year directories must reflect verified support, not the example year below.

```text
taxforms/
├── AGENTS.md
├── README.md
├── docs/
│   └── product-vision.md
├── src/
│   ├── forms/
│   ├── engine/
│   ├── rules/
│   ├── ui/
│   └── storage/
├── tests/
│   ├── rules/
│   ├── forms/
│   └── fixtures/
└── public/
```

Potential declarative structure:

```text
src/forms/2026/
  1040.ts
  schedule1.ts
  schedule2.ts
  schedule3.ts
  scheduleA.ts
  scheduleB.ts
  scheduleD.ts
```

and:

```text
src/rules/2026/
  standardDeduction.ts
  taxComputation.ts
  capitalGains.ts
```

## First Codex task

A useful first instruction to Codex is:

> Read AGENTS.md and docs/product-vision.md. Evaluate OpenTax, UsTaxes, TelosTax, HabuTax, and Direct File's Fact Graph before implementing a new calculation engine. Produce docs/reuse-evaluation.md with primary-source evidence, component-level legal and technical reuse findings, local spike results where practical, and a recommended architecture. Prioritize the transparent, forms-first UI and explanation/provenance layer. Recommend one tested Schedule D → Form 1040 integration path for an explicitly supported tax year, keeping taxpayer data local. Justify any new calculation code by documented gaps. Do not invent IRS rules.

## Definition of success for the prototype

The prototype succeeds if a technically curious taxpayer can open it and immediately understand the concept:

1. enter a value,
2. see another form update,
3. click the calculated value,
4. see where it came from,
5. open the underlying schedule,
6. see an IRS-source link,
7. save the return locally.

That is enough to prove the central idea.
