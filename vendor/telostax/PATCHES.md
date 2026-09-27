# TelosTax extraction and local changes

Source: [telosnews/TelosTax](https://github.com/telosnews/TelosTax), revision
`989fa6e6b7e4f712676dc17072267a8a7ad93978`, `shared/src`.

`upstream.json` records SHA-256 hashes of the 90 original source files reachable
from the Form 1040 entry point, including type dependencies. These files are
MIT licensed; the upstream license is retained verbatim in `LICENSE` and the
distributed `public/third-party-notices.txt`. No proprietary PDF viewer, client,
chat, server, or third-party runtime package is imported by this extraction.
Its internal imports are relative. Extra tax modules remain implementation
dependencies; their presence does not mean this app supports their scenarios.

`patches.json` records hashes of the two modified files and one added file.
`patches/0001-carryover-and-provenance.patch` is the reviewable diff against the
pinned source. Run `npm run check:vendor` from the project root to detect
unrecorded files, missing files, changed source, or a missing MIT notice.

## Changes

- `engine/form1040Sections.ts`: run Schedule D for carryover-only returns;
  finalize outgoing carryover after deductions are known using taxable income
  before its zero floor; emit the capital gain/loss transfer and include it in
  the total-income trace. The return's finalized Schedule D result is updated.
- `engine/scheduleD.ts`: optional trace builder records sale gains, term totals,
  incoming carryovers, netting, and the loss cap at their calculation sites.
  Gain transfers reference line 16; losses reference line 21. Existing
  standalone arithmetic is retained. Its outgoing carryforward fields are
  **provisional** because this helper has no taxable-income input; consume the
  full Form 1040 result through our adapter, never those provisional fields.
- `engine/capitalLossCarryover.ts`: new pure 13-line worksheet closes the
  independently reproduced taxable-income gap. Preserves short/long character,
  exposes intermediate values and dependencies, rejects non-finite inputs.
  Authority: [2025 Schedule D instructions, p.10](https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=10)
  and [Publication 550 (2025), p.102](https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102).

## Adapter contract and limits

Only `src/adapters/calculate.ts` is the application entry point. It rejects
missing/malformed inputs, fixes the tax year at 2025, and restricts the model to
wages, ordinary covered stock sales without adjustments, eligible base standard
deductions, and capital loss carryovers. It maps upstream trace IDs to actual
2025 form identities (deduction → 12e, AGI → 11a, capital result → 7a).
Sale holding period is explicitly entered; no transaction date is fabricated.

The UI displays none of the engine's unverified liability, credit, refund,
state, or other-schedule outputs. Trace closure is checked for this supported
slice, not every upstream tax scenario. Do not widen inputs without independent
fixtures and a review of both calculations and trace dependencies. In particular,
Form 982 attribute reduction and interactions with additional deduction types
have not been validated against these carryover changes.

The original upstream test results in `docs/evidence/telostax-tests.log` were
obtained **before** these changes. The app's regression tests exercise the
patched engine through its full entry point and are separately documented in
`docs/prototype-validation.md`. No upstream issue or pull request has been sent.
