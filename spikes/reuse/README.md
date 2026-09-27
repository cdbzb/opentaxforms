# Reuse evaluation spike

This is an evaluation harness, not application or tax-engine code. It bundles and calls unmodified upstream functions using synthetic inputs. Read [the evaluation](../../docs/reuse-evaluation.md) and [recorded results](../../docs/evidence/reuse-spike.json).

## Reproduce

Prerequisites: Git, Node 24 (tested with 24.3.0), npm, and Python 3 for HabuTax's optional tests.

1. Create a temporary checkout directory, e.g. `/private/tmp/opentaxforms-reuse`.
2. Clone the repositories in [repository-snapshots.json](../../docs/evidence/repository-snapshots.json), using its `name` fields as subdirectory names. Check out each exact full `revision`. Do not substitute current HEAD for the pinned revision when reproducing these findings.
3. Create a `tooling` subdirectory there. Copy this directory's `package.json` and `package-lock.json` into it, then run:

   ```sh
   npm ci --prefix /private/tmp/opentaxforms-reuse/tooling --ignore-scripts --no-audit --no-fund
   ```

4. From the OpenTaxForms project root:

   ```sh
   node spikes/reuse/check.mjs /private/tmp/opentaxforms-reuse
   ```

The expected result on the recorded revisions is **24 passed, 5 failed; exit status 1**. The five failures intentionally expose candidate defects. Do not change the expected results to match incorrect output. JSON includes revisions, observed values, traces, browser bundle sizes, and external imports. Temporary bundles remain in the OS temporary directory; no upstream source is copied into this project by the harness.

The bundle sizes are unminified evaluation artifacts with different export surfaces, not comparable production download sizes. `platform: 'browser'` checks import compatibility; execution occurs in Node. It does not establish a browser UI, runtime network isolation, or source-to-binary reproducibility for the checked-in Fact Graph build.

## Upstream tests that were run

For OpenTax and TelosTax, an isolated tools installation was linked as `node_modules` in each temporary checkout (neither checkout already had that directory). No application startup scripts were run. A temporary Vitest config used:

```js
export default {
  test: {
    environment: 'node',
    globals: true,
    maxWorkers: 2,
    include: [/* patterns below */],
  },
};
```

OpenTax patterns: `tests/rules/scheduleD.test.ts`, `tests/rules/form1040-income.test.ts`, `tests/rules/form1040-full.test.ts`, `tests/rules/engine.test.ts`.

TelosTax pattern: `shared/__tests__/**/*.test.ts`.

From the relevant checkout, invoke `tooling/node_modules/.bin/vitest run --config /absolute/path/to/the/config.mjs` using the actual absolute path to the shared tools executable. This deliberately bypasses the apps' UI/server test configurations; the recorded results cover only these selected pure-code suites. Zod is required by a TelosTax test importing its shared barrel. The selected calculator modules themselves bundled without that dependency.

From the HabuTax checkout:

```sh
python3 -m unittest discover --top-level-directory ./ --start-directory ./tests/ -v
```

Logs are preserved under [docs/evidence](../../docs/evidence). No UsTaxes suite, Filed suite, Invaro full suite, fresh Scala build, or browser test was run.

## Independent expectations

- [2025 Schedule D](https://www.irs.gov/pub/irs-prior/f1040sd--2025.pdf): transaction routing, net gain/loss, deduction limits and transfer to 1040 line 7a.
- [2025 Schedule D instructions](https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf): carryover treatment.
- [2025 Publication 550, printed page 102](https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102): taxable-income adjustment and Bob/Shelly's published example. Only the schedule portion of that example is tested; positive taxable income is assumed, not reconstructed as a full return.

Fact Graph's addition checks are generic dependency tests, not fabricated tax rules. Invaro proof verification checks encoded-rule consistency, not legal correctness. Filed is tested at its Schedule D node output boundary, not through its full 1040 orchestrator.
