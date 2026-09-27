# Reuse evaluation

Inspected September 26, 2026. This is a source and integration assessment, not certification of a complete tax return. All execution used synthetic inputs. This report records the original candidate evaluation; the subsequently implemented extraction, local patches, and narrow prototype are documented in [prototype architecture](prototype-architecture.md) and [validation results](prototype-validation.md). No production-ready engine or complete return is claimed.

## Recommendation

**Use TelosTax's MIT-licensed calculation modules as the provisional baseline for a narrowly scoped 2025 prototype, behind a small adapter.** Repair the reproduced carryover defects before enabling those cases. Build our own accessible forms interface and improve the engine's emitted provenance. Reuse its form-field metadata selectively after checking it against IRS forms. Do not fork the entire application or add a second calculation engine at this stage.

This is an engineering recommendation: the relevant TelosTax functions bundled for the browser without external runtime imports, passed basic Schedule D → 1040 checks, and have a clean function boundary. It is **conditional on correctness repairs**, not a conclusion that TelosTax is ready to file returns. [Engine entry point][tt-engine], [package manifest][tt-package], [local results](evidence/reuse-spike.json).

The original differentiation hypothesis needs revision. OpenTax already contains an interactive explanation graph; TelosTax already contains editable PDF forms, trace disclosure, and navigation from trace inputs to forms. Our opportunity is a more reliable, complete, accessible implementation of that experience, with correct form identities, explicit missing values, primary-source links, and genuinely local operation. Those features are not absent from existing projects. This conclusion is based on source inspection, not a usability study. [OpenTax explanation UI][ot-explain], [TelosTax Forms Mode][tt-forms], [trace navigation][tt-trace-ui].

## Identities and pinned revisions

“OpenTax” is ambiguous. I treated `xavierliwei/opentax`, the browser application, as the primary candidate and also inspected Filed's and Invaro's separate projects. This avoids silently conflating their licenses or capabilities.

| Candidate | Repository | Inspected commit | Commit date |
|---|---|---|---|
| OpenTax browser app | [xavierliwei/opentax](https://github.com/xavierliwei/opentax) | `9c6db5b2db41` | 2026-04-07 |
| UsTaxes | [ustaxes/UsTaxes](https://github.com/ustaxes/UsTaxes) | `cc2b8c06b26b` | 2026-09-23 |
| TelosTax | [telosnews/TelosTax](https://github.com/telosnews/TelosTax) | `989fa6e6b7e4` | 2026-04-13 |
| HabuTax | [habutax/habutax](https://github.com/habutax/habutax) | `0d4f8d13b246` | 2024-02-24 |
| Direct File / Fact Graph | [IRS-Public/direct-file](https://github.com/IRS-Public/direct-file) | `e365f9f43446` | 2026-06-11 |
| Filed OpenTax | [filedcom/opentax](https://github.com/filedcom/opentax) | `6a25dba8a836` | 2026-09-26 |
| Invaro OpenTax | [Invaro/opentax-engine](https://github.com/Invaro/opentax-engine) | `aed43ba789dd` | 2026-09-09 |

[Full revisions, commit subjects, and license hashes](evidence/repository-snapshots.json). Commit dates measure repository activity, not tax correctness or a maintenance commitment. UsTaxes' latest commit is a dependency update; Filed's is a tax fix. Direct File's README explicitly says the repository is archived and no longer maintained. [Direct File status][df-readme].

## Comparison

| Candidate | Tax coverage inspected | Local execution and extraction cost | Provenance and forms | Decision |
|---|---|---|---|---|
| OpenTax browser | 2025 modules include 1040, Schedules 1–3/A/B/D, 8949 and preferential-rate calculations. Its 2026 module is explicitly a stub reusing 2025 logic. | Low–medium for pure calculation modules; full app includes automatic server synchronization. Browser bundle succeeded. | Integer-cent `TracedValue`, source IDs, interactive trace UI. Actual line routing and some dependency edges are incomplete. | Reuse trace structures/components selectively; alternate engine candidate, with more form-identity repairs on the sampled path. |
| UsTaxes | Year directories 2020–2025; 1040, Schedule D, 8949, and capital-gain worksheets. Presence of a form class does not establish complete support. | Medium: browser-first TypeScript, but calculations are coupled through form classes, shared data/PDF utilities, and package aliases. | Explicit line methods and PDF mappings; no general execution provenance API found in the inspected path. | Useful independent comparison and possible AGPL base; not the lowest-cost provenance integration. |
| TelosTax | 2025 engine includes 1040, Schedule D, preferential-rate calculations, and numerous other forms. Only the sampled path was independently checked. | Low for direct engine modules. Dollar-valued numbers with rounding helpers. Full client adds servers/AI options and proprietary viewer dependencies. | Optional structured traces, form metadata/editability classifier, editable Forms Mode. Trace coverage is partial. | Preferred calculation baseline and metadata source; build a separate UI and storage layer. |
| HabuTax | 2021–2023 directories; 1040, A/B, portions of 1/3, qualified-dividend worksheet. 2023 line 7 explicitly refuses cases requiring Schedule D/8949. | High for browser: Python solver, text inputs; PDF filling requires pdftk. Python tests run without added dependencies. | Dynamic field dependency discovery and explicit unsupported/missing-input handling. | Design reference; does not supply the requested Schedule D path. |
| Fact Graph | Domain-neutral engine plus Direct File's 2024 tax dictionary; no ready Schedule D implementation found in inspected dictionary. | Medium–high: Java 21/Scala/SBT for source builds, Scala.js browser output. Checked-in JS ran locally. | Native incomplete values, dependency propagation, branch-sensitive explanations in Scala. JS surface needs adaptation for full explanations. | Strong architecture reference and later alternative; avoid making a new tax corpus the first milestone. |

Sources: [OpenTax Schedule D][ot-d], [year stub][ot-2026], [trace types][ot-traced], [server synchronization][ot-sync]; [UsTaxes architecture][us-architecture], [Schedule D][us-d], [coverage notes][us-readme]; [TelosTax calculation][tt-engine], [Schedule D][tt-d], [trace builder][tt-trace], [field classifier][tt-fields]; [HabuTax solver][habu-solver], [2023 1040][habu-1040]; [Fact Graph build][df-build], [explanation semantics][df-explanation], [JS interface][df-interface].

### Additional OpenTax identities

**Filed:** AGPLv3/commercial licensing; Deno/TypeScript node graph, 2025 1040 implementation, input schemas, form mappings and diagnostics. Its Schedule D node recognizes carryover-only input and routed a $5,000 short-term carryover to a $3,000 loss deduction in our test. Its public executor exposes intermediate node data and diagnostics, but that is not yet a complete field-level explanation graph. The isolated Schedule D module bundled for the browser using Zod. The CLI, full return pipeline, persistence and PDF system were not run. Keep it as a serious AGPL alternative, particularly if deeper testing shows a lower correction burden than TelosTax. [Executor][filed-executor], [Schedule D][filed-d], [license][filed-license].

**Invaro:** AGPL-3.0-only/commercial licensing; a declarative rule evaluator with exact-cent arithmetic, content-addressed corpora, assumptions, citations and verifiable derivations. The engine plus corpus bundled for the browser; a 2025 loss-limit calculation and its proof verification passed. This is closer to the desired engine architecture than the manually traced app engines. However, its capital-loss carryover rule explicitly omits the negative-taxable-income adjustment and short/long character split, and its aggregate facts are not a complete printed-form model. A proof establishes consistency with encoded rules, not that those rules fully implement IRS requirements. Prefer it for further engine research, not automatic replacement of the first forms integration. [Core exports][inv-core], [corpus][inv-corpus], [disclosed carryover limits][inv-loss], [license][inv-license].

## Legal reuse boundaries

These are component-level conclusions from inspected grants and manifests. A full transitive dependency/license audit remains necessary for whatever is actually shipped; no project-wide license has yet been chosen here.

| Component | Inspected grant / constraint | Practical reuse conclusion |
|---|---|---|
| OpenTax browser source | MIT | Can adapt calculation/trace code while preserving copyright and permission notices. Audit any imported runtime dependencies separately. [License][ot-license] |
| TelosTax engine and original client code | MIT; shared package also declares MIT | Engine modules are a straightforward permissive reuse path. Prefer direct calculation imports: the broader barrel also exports an LLM parser importing Zod, despite the package's zero-dependency description. [License][tt-license], [manifest][tt-package], [parser][tt-parser] |
| TelosTax PDF viewer/chart dependencies | Syncfusion proprietary components, acknowledged in its security documentation | Do not redistribute the viewer under an assumption that the repository's MIT license covers it. Community-license eligibility is conditional. Replace this dependency for our unrestricted FOSS UI. [Dependencies][tt-client], [security notes][tt-security], [vendor terms][syncfusion] |
| UsTaxes, Filed, Invaro | AGPLv3 grants; Filed/Invaro also advertise commercial alternatives | Free/open-source reuse is possible under applicable AGPL terms. Plan corresponding-source availability, preservation of notices, and modified network-version source offers where applicable. A combined derivative cannot simply be relabeled MIT; an adapter is not an automatic copyleft exemption. No commercial license is needed merely because our project uses the AGPL option. [UsTaxes license][us-license], [Filed license][filed-license], [Invaro license][inv-license], [GNU guidance][gnu-guide] |
| HabuTax | GPLv2 license text and package classifier; no explicit later-version grant found in inspected Python/metadata | Preserve GPL obligations if reused. Resolve the applicable version grant before combining its implementation with AGPLv3 code; do not assume compatibility. Conceptual lessons can be implemented independently. [License][habu-license], [metadata][habu-package], [GNU compatibility guidance][gnu-guide] |
| Direct File original source | Root license states US public domain and worldwide CC0 dedication | Potentially reusable. However, the JS wrapper manifest says `UNLICENSED`; reconcile that metadata with the root grant before packaging it. Runtime dependencies retain their own licenses, and the checked-in bundle is not proven to correspond to the inspected Scala source by our run. [Root license][df-license], [wrapper manifest][df-package], [manual dependency inventory][df-sbom] |

MIT/CC0 material can generally be incorporated into a compatible copyleft distribution while preserving applicable notices; GPL/AGPL components do not become permissively licensed in the reverse direction. Government origin also does not authorize implying IRS endorsement. [GNU license guidance][gnu-list], [Direct File license][df-license].

## What actually ran

The reproducible harness is [spikes/reuse/check.mjs](../spikes/reuse/check.mjs), with [instructions](../spikes/reuse/README.md) and [raw JSON](evidence/reuse-spike.json). It imports unmodified upstream code from temporary pinned checkouts. Browser-targeted bundles were then executed in Node 24.3.0; this establishes module portability, not a browser UI/offline audit.

- **29 independent expectations: 24 passed, 5 failed.** Passing checks include positive/zero/negative Schedule D transfers, both loss limits, and the schedule portion of an IRS published carryforward example. Failing checks are retained as evidence and make the harness exit with status 1.
- **OpenTax:** 211 upstream tests passed across four selected calculation/provenance files. [Log](evidence/opentax-tests.log).
- **TelosTax:** 5,013 tests passed across all 95 files matching `shared/__tests__/**/*.test.ts` at this revision. The first run could not load one file because the isolated tools lacked Zod; installing it resolved that setup failure. This is a measured count, not the larger count advertised in its README. [Log](evidence/telostax-tests.log).
- **HabuTax:** 53 upstream Python tests passed. They do not establish 2025 support. [Log](evidence/habutax-tests.log).
- **Fact Graph:** a synthetic two-input addition remained incomplete until inputs were supplied, reported the missing input paths, and propagated a later change. Used checked-in Scala.js output, not a fresh Scala build or the tax dictionary.
- **Invaro:** loss-limit evaluation and proof verification passed. **Filed:** isolated carryover node output passed. Neither full upstream suite was run. UsTaxes was source-reviewed, not executed.

The three original-app findings below coexist with passing upstream tests. Test volume is not an independent tax oracle. No e-file, complete-return certification, PDF fidelity, accessibility, or network-isolation test was performed.

### Reproduced gaps that block adoption without changes

| Case | Expected | Observed |
|---|---|---|
| $5,000 prior short-term loss carryover, no current trades/distributions | 2025 1040 line 7a = −$3,000 for single | Both OpenTax and TelosTax return $0 through their full 1040 entry points. Their standalone Schedule D functions correctly apply the limit; the orchestrators skip the schedule. |
| $5,000 current capital loss with no other income | Carryforward remains $5,000 because taxable income before the loss is already negative | Both expose $2,000 as remaining carryforward. Their Schedule D helper subtracts the full $3,000 without the taxable-income adjustment. |
| OpenTax Form 8949 Box B transaction with $2,000 gain | Schedule D line 2; line 1b excludes it | It appears on line 1b, with no line 2 result. The total gain can still be correct while form identity/provenance is wrong. |

Authority: [2025 Schedule D, pages 1–2][irs-d], [2025 Schedule D instructions, carryover worksheet and line 21 discussion][irs-d-instructions], [Publication 550 (2025), capital-loss carryover discussion, printed page 102][irs-550]. The low-income fixture is our synthetic application of the IRS rule, not an IRS published example. Separately, the published Bob/Shelly example ($7,000 loss, positive taxable income, $4,000 remaining) passes both standalone schedule implementations.

Other source/trace observations:

- OpenTax labels its transfer through `scheduleD.line21` even for gains, although the actual form routes gains from line 16 and skips line 21. Carryover lines have empty input lists. Internal API names such as `form1040.line7` must map to actual **2025 line 7a**, not be displayed verbatim. [Code][ot-d], [1040 orchestration][ot-1040], [IRS form][irs-d].
- TelosTax's loss example produces a total-income trace of −$3,000 with **no inputs**, and no separate capital-gain/loss trace node. Its trace utility records annotations around calculations; it does not automatically discover dependencies. [Recorded trace](evidence/reuse-spike.json), [orchestration][tt-sections], [trace builder][tt-trace].
- UsTaxes' 2025 Schedule D source puts short-term carryover in method `l4` and long-term carryover in `l11`, leaving `l6`/`l14` empty. This is a source-level line-mapping discrepancy against the official form, not a tested total-tax defect. [Code][us-d], [IRS form][irs-d].
- OpenTax's default UI auto-connects to a reachable backend and synchronizes return data. Extracting the pure engine is compatible with local-only storage; copying the full app is not sufficient to establish that property. [Synchronization][ot-sync], [app shell][ot-shell].
- TelosTax's helper converts non-finite numeric inputs to zero; both apps have defaults that can conceal incomplete data. Validate and distinguish missing/unsupported values before invoking them. [TelosTax helper][tt-d], [OpenTax zero representation][ot-traced].

## Smallest proposed prototype

Use **tax year 2025**, explicitly labeled. No 2026 behavior is inferred from a folder name. Keep the initial runtime to one selected engine, not a mixture of disagreeing calculators.

```text
Visible 1040 / Schedule D / source inputs
    ↓ declarative field metadata and validated edits
2025 adapter (IDs, dollars ↔ integer cents, completeness, supported scope)
    ↓
Pinned TelosTax calculation modules + explicit, tested local patches
    ↓ values + execution-attached provenance
Local browser state / versioned JSON save files
```

Proposed boundaries: `src/forms/2025/` for verified labels, IDs and IRS links; `src/adapters/telostax/` for integration; a separately attributed upstream component with an explicit patch history; `src/ui/` for forms and trace navigation; `src/storage/` for local save/load. Record upstream revision, tax year and save-schema version. Do not copy the app's chat, server, or Syncfusion runtime.

1. **First vertical path:** one ordinary, short-term stock sale, basis reported, no adjustments, $10,000 basis and $12,000 proceeds. Display Schedule D 1a → 7 → 16 → **1040 7a**, all $2,000. The relevant end-to-end engine transfer already passes the harness. Map `scheduleD.netShortTerm`, `netGainOrLoss`, and `form1040.capitalGainOrLoss` to verified form identities; do not calculate tax again in the adapter.
2. Add trace emission at the actual Schedule D and 1040 assignments: transaction identity, proceeds, basis, adjustment, active branch, filing-status dependency, and IRS citation. The UI must consume those records rather than invent a parallel calculation graph. Give users an explicit way to enter upstream facts from the visible form; keep calculated fields read-only.
3. Repair carryover-only scheduling and implement the missing taxable-income-aware carryover worksheet, preserving ST/LT character and intermediate lines. Reuse existing netting and loss-limit logic. The harness demonstrates why this additional calculation work is necessary. Add independent IRS fixtures before exposing it. Resolve the OpenTax/UsTaxes line discrepancies if reusing their metadata or presentation.
4. Expand acceptance tests to mixed ST/LT gains/losses, all supported filing statuses, rounding, prior-year worksheet inputs, invalid/missing values, and incomplete/unsupported cases. Reject unsupported tax years and scenarios instead of displaying zero. Upstream test fixtures may be reused only under their applicable license, and cannot replace IRS-grounded expectations.
5. Verify recalculation, drill-down, source links, local reload/JSON round-trip, and zero return-data network traffic in a real browser. Add print output only after field-mapping checks against the official PDF. Do not present a complete refund or filing-ready return when only this slice is verified.

We do not need a new general dependency engine for this first path. A small form registry can index emitted dependencies, validate references/cycles, and expose errors while recalculating through the existing pure entry point. If later scope requires incremental incomplete-state reasoning, revisit Fact Graph or Invaro rather than expanding that registry into another tax engine.

## Remaining decision limits

The candidate preference is based on sampled integration cost, source boundaries and reproduced defects, not a comprehensive comparative tax audit. Before committing to a full-return product, compare TelosTax and Filed on the same broader IRS fixture corpus, confirm dependency/license inventories for the selected extraction, and test the actual UI. Resolve Direct File's wrapper metadata if its code is adopted. Upstream contribution is sensible, but no issues, pull requests or messages have been sent as part of this evaluation.


[ot-license]: https://github.com/xavierliwei/opentax/blob/9c6db5b2db4178c4c39a37957bf1de9e2ceb0d20/LICENSE
[ot-explain]: https://github.com/xavierliwei/opentax/blob/9c6db5b2db4178c4c39a37957bf1de9e2ceb0d20/src/ui/pages/ExplainView.tsx
[ot-d]: https://github.com/xavierliwei/opentax/blob/9c6db5b2db4178c4c39a37957bf1de9e2ceb0d20/src/rules/2025/scheduleD.ts
[ot-1040]: https://github.com/xavierliwei/opentax/blob/9c6db5b2db4178c4c39a37957bf1de9e2ceb0d20/src/rules/2025/form1040.ts
[ot-2026]: https://github.com/xavierliwei/opentax/blob/9c6db5b2db4178c4c39a37957bf1de9e2ceb0d20/src/rules/2026/constants.ts
[ot-traced]: https://github.com/xavierliwei/opentax/blob/9c6db5b2db4178c4c39a37957bf1de9e2ceb0d20/src/model/traced.ts
[ot-sync]: https://github.com/xavierliwei/opentax/blob/9c6db5b2db4178c4c39a37957bf1de9e2ceb0d20/src/store/syncAdapter.ts
[ot-shell]: https://github.com/xavierliwei/opentax/blob/9c6db5b2db4178c4c39a37957bf1de9e2ceb0d20/src/ui/components/AppShell.tsx
[us-license]: https://github.com/ustaxes/UsTaxes/blob/cc2b8c06b26be57596dc9d112dadd919f2f4a86d/LICENSE
[us-d]: https://github.com/ustaxes/UsTaxes/blob/cc2b8c06b26be57596dc9d112dadd919f2f4a86d/src/forms/Y2025/irsForms/ScheduleD.ts
[us-readme]: https://github.com/ustaxes/UsTaxes/blob/cc2b8c06b26be57596dc9d112dadd919f2f4a86d/README.md
[us-architecture]: https://github.com/ustaxes/UsTaxes/blob/cc2b8c06b26be57596dc9d112dadd919f2f4a86d/docs/ARCHITECTURE.md
[tt-license]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/LICENSE
[tt-engine]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/shared/src/engine/form1040.ts
[tt-package]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/shared/package.json
[tt-client]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/client/package.json
[tt-d]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/shared/src/engine/scheduleD.ts
[tt-trace]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/shared/src/engine/traceBuilder.ts
[tt-forms]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/client/src/components/formsMode/FormsMode.tsx
[tt-trace-ui]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/client/src/components/explain/TraceTree.tsx
[tt-fields]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/shared/src/engine/formFieldClassifier.ts
[tt-security]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/docs/SECURITY.md
[tt-sections]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/shared/src/engine/form1040Sections.ts
[tt-parser]: https://github.com/telosnews/TelosTax/blob/989fa6e6b7e4f712676dc17072267a8a7ad93978/shared/src/utils/llmResponseParser.ts
[habu-license]: https://github.com/habutax/habutax/blob/0d4f8d13b246b0dd0a51c9f0efd62eb8b8b4f9ef/LICENSE
[habu-solver]: https://github.com/habutax/habutax/blob/0d4f8d13b246b0dd0a51c9f0efd62eb8b8b4f9ef/habutax/solver.py
[habu-1040]: https://github.com/habutax/habutax/blob/0d4f8d13b246b0dd0a51c9f0efd62eb8b8b4f9ef/habutax/forms/ty2023/f1040.py
[habu-package]: https://github.com/habutax/habutax/blob/0d4f8d13b246b0dd0a51c9f0efd62eb8b8b4f9ef/setup.cfg
[df-license]: https://github.com/IRS-Public/direct-file/blob/e365f9f43446010af36cccf7edecc52953c00fe9/LICENSE
[df-readme]: https://github.com/IRS-Public/direct-file/blob/e365f9f43446010af36cccf7edecc52953c00fe9/README.md
[df-build]: https://github.com/IRS-Public/direct-file/blob/e365f9f43446010af36cccf7edecc52953c00fe9/direct-file/fact-graph-scala/build.sbt
[df-explanation]: https://github.com/IRS-Public/direct-file/blob/e365f9f43446010af36cccf7edecc52953c00fe9/direct-file/fact-graph-scala/shared/src/main/scala/gov/irs/factgraph/Explanation.scala
[df-interface]: https://github.com/IRS-Public/direct-file/blob/e365f9f43446010af36cccf7edecc52953c00fe9/direct-file/df-client/js-factgraph-scala/src/typings/FactGraph.d.ts
[df-package]: https://github.com/IRS-Public/direct-file/blob/e365f9f43446010af36cccf7edecc52953c00fe9/direct-file/df-client/js-factgraph-scala/package.json
[df-sbom]: https://github.com/IRS-Public/direct-file/blob/e365f9f43446010af36cccf7edecc52953c00fe9/direct-file/fact-graph-scala/manual-scala-sbom.xml
[filed-license]: https://github.com/filedcom/opentax/blob/6a25dba8a836f6564e5561acb15a85f96fec7798/LICENSE
[filed-executor]: https://github.com/filedcom/opentax/blob/6a25dba8a836f6564e5561acb15a85f96fec7798/core/runtime/executor.ts
[filed-d]: https://github.com/filedcom/opentax/blob/6a25dba8a836f6564e5561acb15a85f96fec7798/forms/f1040/nodes/intermediate/aggregation/schedule_d/index.ts
[inv-license]: https://github.com/Invaro/opentax-engine/blob/aed43ba789dd295b1f315c728cb7f2cadd98f4d8/LICENSE
[inv-core]: https://github.com/Invaro/opentax-engine/blob/aed43ba789dd295b1f315c728cb7f2cadd98f4d8/packages/core/src/index.ts
[inv-corpus]: https://github.com/Invaro/opentax-engine/blob/aed43ba789dd295b1f315c728cb7f2cadd98f4d8/packages/corpus-us-federal/src/index.ts
[inv-loss]: https://github.com/Invaro/opentax-engine/blob/aed43ba789dd295b1f315c728cb7f2cadd98f4d8/packages/corpus-us-federal/src/rules/capital-losses.ts
[irs-d]: https://www.irs.gov/pub/irs-prior/f1040sd--2025.pdf
[irs-d-instructions]: https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf
[irs-550]: https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102
[syncfusion]: https://www.syncfusion.com/products/communitylicense
[gnu-guide]: https://www.gnu.org/licenses/quick-guide-gplv3.html
[gnu-list]: https://www.gnu.org/licenses/license-list.html.en
