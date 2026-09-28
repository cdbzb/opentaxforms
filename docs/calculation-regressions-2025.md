# 2025 calculation regression evidence

Sources rechecked on 2026-09-27. These tests cover the prototype's existing
wages, eligible base standard deduction, covered stock sales and capital loss
carryover slice. They do not establish correctness of the upstream engine's
other income, tax, credit or refund calculations.

## Published IRS examples

`tests/irs-regression-2025.test.ts` runs these through the application adapter
and the patched Form 1040 entry point:

| Source | Published amounts checked | Added assumptions |
| --- | --- | --- |
| [2025 Schedule D instructions, Example 1, p.10](https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=10) | Covered long-term sale: proceeds $6,000, basis $2,000, gain $4,000 | Single, $50,000 wages, eligible base standard deduction |
| [Same example, second-sale variant, p.11](https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=11) | Additional proceeds $5,000 and basis $3,000; combined gain $6,000 | Same additions as above |
| [2025 Publication 550, Bob and Shelly, p.102](https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102) | $7,000 loss, $26,000 taxable income, $3,000 deduction, $4,000 carryover | Short-term character, proceeds $0/basis $7,000, eligible base deduction and $60,500 wages reproduce the published taxable income |
| [Same example, smaller-loss variant](https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102) | $2,000 loss, $2,000 deduction, no carryover | Short-term character, proceeds $0/basis $2,000 and $59,500 wages hold taxable income at $26,000 |

The carryover examples also run against the isolated worksheet function.
Synthetic wage and sale inputs are not attributed to the IRS. The tests check
sale gains and their downstream transfers; they do not validate a rendered or
exported Schedule D's proceeds/basis columns.

## Independently worked boundary fixtures

`tests/fixtures/capital-loss-2025.ts` records literal expected amounts for
applicable lines of the [2025 incoming worksheet, p.10](https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=10).
These are synthetic applications of IRS instructions, not published taxpayer
examples. Expected amounts are not calculated by the implementation under test.
Each fixture runs both in isolation and through the adapter's 2024-input-to-2025
Schedule D path.

- Both loss characters with full, partial or no absorption; short losses used first.
- Opposite-term gains offset losses before the income-absorption limit is applied.
- Losses below the annual cap, including partial or complete preservation at low income.
- Exactly zero taxable income and one-cent absorption.
- Prior-year $1,500 deductions, including mixed losses and low income.

Separate full-return cases straddle the 2025 income absorption boundaries for
single and MFS returns, including one cent below and above. They check outgoing
carryovers against unfloored taxable income, not the zero shown on Form 1040
line 15. The outgoing result remains a preview under Publication 550's rule,
not an official 2026 worksheet.

Four cases distinguish prior-year deductions from current filing status. For a
synthetic $7,000 prior loss and negative $1,500 prior taxable income: a $3,000
prior deduction consumes $1,500, leaving $5,500; a $1,500 prior deduction consumes
nothing, leaving $7,000. Current wages of $16,750 absorb $1,000 under either
current single or MFS status. Expected outgoing losses are therefore $4,500 and
$6,000 respectively. Attribution of a joint loss between spouses is assumed,
not determined by the application.

Five further cases combine carryovers and current sales: no sales, opposite-term
offsets, exact exhaustion and a positive net gain. They check line 16 versus
line 21 routing, preserve character, verify repeat calculation does not consume
stored losses, and confirm sale order does not alter totals. Provenance checks
follow affected results back to prior inputs and current sale inputs.

## Results and limits

142 tests pass in five suites: 46 in the IRS regression suite, 47 existing
calculation checks, 19 form checks, 10 storage checks and 20 DOM interaction
checks. The new suite replaces two older Bob/Shelly checks, for a net increase
of 44 tests. TypeScript/production build and the vendored-source integrity check
pass. No calculation or application behavior changed in this step.

The first fixture run found a mismatched synthetic prior-loss input and a
JavaScript signed-zero comparison; both test issues were corrected. No new
engine defect was reproduced by this corpus. That is evidence for the tested
slice, not a claim of general tax correctness.

Remaining exclusions include whole-dollar filing/export behavior, ownership
allocation after a joint return, canceled-debt attribute reductions, itemized
deductions, dependent/age/blindness additions, wash sales and other Form 8949
adjustments. Browser layout, printing and actual network behavior require
separate checks; see [prototype validation](prototype-validation.md).

Next calculation expansion: review reusable Schedule B and qualified-dividend/
capital-gain tax worksheet modules against IRS fixtures and their interaction
with this corpus before exposing Form 1040 line 16.
