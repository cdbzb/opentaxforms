// Source-inspection spike: imports pinned candidate checkouts, never taxpayer data.
// Usage: node spikes/reuse/check.mjs /path/to/checkouts
// Requires esbuild in CHECKOUTS/tooling/node_modules. See README.md here.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { mkdtemp, writeFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = resolve(process.argv[2] || '/private/tmp/opentaxforms-reuse');
const require = createRequire(join(root, 'tooling/package.json'));
const { build } = require('esbuild');
const out = await mkdtemp(join(tmpdir(), 'tax-reuse-spike-'));
const results = { runtime: process.version, bundles: {}, checks: [], observations: {} };
const snapshots = JSON.parse(readFileSync(new URL('../../docs/evidence/repository-snapshots.json', import.meta.url), 'utf8')).repositories;

async function bundle(name, contents, alias = {}) {
  const candidate = join(root, name);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: candidate, encoding: 'utf8' }).trim();
  assert.equal(revision, snapshots.find(x => x.name === name)?.revision,
    `${name}: checkout differs from the recorded evaluation revision`);
  const outfile = join(out, `${name}.mjs`);
  const result = await build({
    stdin: { contents, resolveDir: candidate, loader: 'ts' },
    outfile, bundle: true, platform: 'browser', format: 'esm', target: 'es2022',
    metafile: true, alias, logLevel: 'silent',
  });
  results.bundles[name] = {
    revision,
    bytes: (await stat(outfile)).size,
    inputFiles: Object.keys(result.metafile.inputs).length,
    externalImports: Object.values(result.metafile.outputs).flatMap(x => x.imports).filter(x => x.external),
  };
  return import(pathToFileURL(outfile).href);
}
function check(name, actual, expected) {
  let passed = true;
  try { assert.deepStrictEqual(actual, expected); } catch { passed = false; }
  results.checks.push({ name, actual, expected, passed });
}

const ot = await bundle('opentax', `
  export { emptyTaxReturn } from './src/model/types.ts';
  export { computeScheduleD } from './src/rules/2025/scheduleD.ts';
  export { computeForm1040 } from './src/rules/2025/form1040.ts';
`);
const tt = await bundle('telostax', `
  export { FilingStatus } from './shared/src/types/index.ts';
  export { calculateScheduleD } from './shared/src/engine/scheduleD.ts';
  export { calculateForm1040 } from './shared/src/engine/form1040.ts';
`);

function otReturn(gain, status = 'single', category = 'A') {
  const model = ot.emptyTaxReturn(2025);
  model.filingStatus = status;
  if (gain !== null) {
    model.capitalTransactions = [{
      id: 'synthetic-sale', description: 'Synthetic ordinary stock',
      dateAcquired: '2025-01-02', dateSold: '2025-06-02',
      proceeds: 1000000 + gain * 100, reportedBasis: 1000000,
      adjustedBasis: 1000000, adjustmentCode: '', adjustmentAmount: 0,
      gainLoss: gain * 100, washSaleLossDisallowed: 0, longTerm: false,
      category, source1099BId: 'synthetic-broker',
    }];
  }
  return model;
}
function ttReturn(gain, status = tt.FilingStatus.Single) {
  const model = {
    id: 'synthetic-return', taxYear: 2025, status: 'in_progress',
    currentStep: 0, currentSection: 'review', filingStatus: status,
    deductionMethod: 'standard', otherIncome: 0, incomeDiscovery: {},
    createdAt: '', updatedAt: '',
  };
  for (const name of ['dependents', 'w2Income', 'income1099NEC', 'income1099K',
    'income1099INT', 'income1099DIV', 'income1099R', 'income1099G', 'income1099MISC',
    'income1099B', 'incomeK1', 'income1099SA', 'rentalProperties', 'expenses',
    'educationCredits']) model[name] = [];
  if (gain !== null) model.income1099B.push({
    id: 'synthetic-sale', brokerName: 'Synthetic broker', description: 'Ordinary stock',
    dateAcquired: '2025-01-02', dateSold: '2025-06-02',
    proceeds: 10000 + gain, costBasis: 10000, isLongTerm: false,
    basisReportedToIRS: true, washSaleLossDisallowed: 0,
  });
  return model;
}

// Independent expectations: TY2025 Schedule D lines 16, 21 and Form 1040 line 7a.
// https://www.irs.gov/pub/irs-prior/f1040sd--2025.pdf (page 2)
for (const [label, gain, expected] of [
  ['gain', 2000, 2000], ['zero', 0, 0], ['small loss', -1000, -1000],
  ['loss at limit', -3000, -3000], ['loss above limit', -5000, -3000],
]) {
  check(`OpenTax ${label} to 1040`, ot.computeForm1040(otReturn(gain)).line7.amount / 100, expected);
  check(`TelosTax ${label} to 1040`, tt.calculateForm1040(ttReturn(gain)).form1040.capitalGainOrLoss, expected);
}
check('OpenTax MFS loss limit', ot.computeForm1040(otReturn(-5000, 'mfs')).line7.amount / 100, -1500);
check('TelosTax MFS loss limit', tt.calculateForm1040(ttReturn(-5000, tt.FilingStatus.MarriedFilingSeparately)).form1040.capitalGainOrLoss, -1500);

// Published IRS example: Bob and Shelly, $7,000 loss, $26,000 taxable income,
// MFJ, $3,000 deduction and $4,000 carryforward. Pub. 550 (2025), p.102.
// Exercise the schedule only; its positive-taxable-income precondition is assumed.
const oExample = ot.computeScheduleD(otReturn(-7000, 'mfj'));
const tExample = tt.calculateScheduleD(ttReturn(-7000).income1099B, 0, tt.FilingStatus.MarriedFilingJointly);
check('OpenTax IRS published example deduction', oExample.line21.amount / 100, -3000);
check('OpenTax IRS published example carryforward', oExample.capitalLossCarryforward / 100, 4000);
check('TelosTax IRS published example deduction', tExample.capitalLossDeduction, 3000);
check('TelosTax IRS published example carryforward', tExample.capitalLossCarryforward, 4000);

const oc = otReturn(null);
oc.priorYear = { agi: 5000000, capitalLossCarryforwardST: 500000, capitalLossCarryforwardLT: 0 };
const tc = ttReturn(null);
tc.capitalLossCarryforwardST = 5000;
tc.capitalLossCarryforwardLT = 0;
check('OpenTax standalone carryover deduction', ot.computeScheduleD(oc).line21.amount / 100, -3000);
check('OpenTax carryover-only full return', ot.computeForm1040(oc).line7.amount / 100, -3000);
check('TelosTax standalone carryover deduction', tt.calculateScheduleD([], 0, tt.FilingStatus.Single, 5000, 0).capitalLossDeduction, 3000);
check('TelosTax carryover-only full return', tt.calculateForm1040(tc).form1040.capitalGainOrLoss, -3000);

// TY2025 Schedule D page 1: Form 8949 box B belongs on line 2, not 1b.
const ob = ot.computeScheduleD(otReturn(2000, 'single', 'B'));
check('OpenTax box B excluded from Schedule D line 1b', ob.line1b.amount / 100, 0);
results.observations.opentaxBoxB = {
  line1b: ob.line1b.amount / 100, line2: ob.line2?.amount ?? null,
  carryoverInputs: ot.computeScheduleD(oc).line6.source,
  gainTransferSource: ot.computeForm1040(otReturn(2000)).line7.source,
};
const trace = tt.calculateForm1040(ttReturn(-5000), { enabled: true });
results.observations.telostaxTrace = {
  lines: (trace.traces || []).map(t => t.lineId),
  totalIncome: (trace.traces || []).find(t => t.lineId === 'form1040.line9'),
};
// Preserve entire loss when taxable income before the loss is already negative.
// Publication 550 (2025), p.102: taxable-income adjustment, not just loss minus $3k.
// https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102
// These fixtures have no income besides a $5,000 capital loss.
check('OpenTax low-income carryforward', ot.computeForm1040(otReturn(-5000)).scheduleD.capitalLossCarryforward / 100, 5000);
check('TelosTax low-income carryforward', tt.calculateForm1040(ttReturn(-5000)).scheduleD.capitalLossCarryforward, 5000);

const inv = await bundle('invaro', `
  export { evaluate, coerceFacts, verifyProof } from './packages/core/src/index.ts';
  export { getCorpus } from './packages/corpus-us-federal/src/index.ts';
`, { '@invaro/opentax-core': join(root, 'invaro/packages/core/src/index.ts') });
const corpus = inv.getCorpus();
const calculation = inv.evaluate(corpus, inv.coerceFacts(corpus, {
  filingStatus: 'single', netCapitalLoss: 5000,
}), { asOf: '2025-12-31', target: 'us.federal.capital_loss_ordinary_offset' });
check('Invaro capital loss deduction', String(calculation.value.cents), '300000');
results.observations.invaro = { verification: inv.verifyProof(calculation.proof, corpus), assumptions: calculation.proof.assumptions };
check('Invaro proof verifies', results.observations.invaro.verification.ok, true);

// Generic dependency test only: these synthetic facts are not tax rules.
// Uses the upstream checked-in Scala.js output; does not rebuild Scala sources.
const { default: df } = await bundle('direct-file', `
  import graph from './direct-file/df-client/js-factgraph-scala/src/main.js';
  export default graph;
`);
const node = (typeName, options = {}, children = []) => ({ typeName, options, children });
const facts = [
  ...['/a', '/b'].map(path => ({ path, writable: {
    typeName: 'Dollar', options: {}, collectionItemAlias: null, limits: [],
  }, derived: null, placeholder: null })),
  { path: '/sum', writable: null, placeholder: null, derived: node('Add', {}, [
    node('Dependency', { path: '/a' }), node('Dependency', { path: '/b' }),
  ]) },
].map(f => df.DigestNodeWrapperFactory.toNative(new df.DigestNodeWrapper(f.path, f.writable, f.derived, f.placeholder)));
const dictionary = df.FactDictionaryFactory.fromConfig(
  df.FactDictionaryConfig.create(new df.DigestMetaWrapper('2024').toNative(), facts),
);
const graph = df.GraphFactory.apply(dictionary, df.JSPersister.create('{}'));
check('Fact Graph missing inputs remain incomplete', graph.get('/sum').complete, false);
results.observations.factGraphMissing = graph.explainAndSolve('/sum');
graph.set('/a', df.DollarFactory('125.00').right);
graph.set('/b', df.DollarFactory('25.00').right);
graph.save();
check('Fact Graph sum', graph.get('/sum').get.toString(), '150.00');
graph.set('/a', df.DollarFactory('200.00').right);
graph.save();
check('Fact Graph propagates update', graph.get('/sum').get.toString(), '225.00');

const filed = await bundle('filed', `
  export { schedule_d, inputSchema } from './forms/f1040/nodes/intermediate/aggregation/schedule_d/index.ts';
`, { zod: join(root, 'tooling/node_modules/zod/lib/index.mjs') });
const filedResult = filed.schedule_d.compute({ taxYear: 2025, formType: 'f1040' },
  filed.inputSchema.parse({ line_6_carryover: 5000, filing_status: 'single' }));
results.observations.filedCarryover = filedResult;
check('Filed carryover-only deduction routes to 1040',
  filedResult.outputs.find(o => o.nodeType === 'f1040')?.fields.line7_capital_gain, -3000);

results.summary = { passed: results.checks.filter(c => c.passed).length, failed: results.checks.filter(c => !c.passed).length };
await writeFile(join(out, 'results.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
// A nonzero exit records failed candidate expectations; do not silently bless them.
process.exitCode = results.summary.failed ? 1 : 0;
