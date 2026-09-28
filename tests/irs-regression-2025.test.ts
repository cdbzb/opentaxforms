import { describe, expect, it } from 'vitest';
import { calculate, type Calculation } from '../src/adapters/calculate';
import { emptyDraft, type Draft, type Sale, type Status } from '../src/adapters/model';
import { calculateCapitalLossCarryover } from '../vendor/telostax/src/engine/capitalLossCarryover';
import { worksheetFixtures } from './fixtures/capital-loss-2025';

function sale(id: string, term: Sale['term'], proceeds: string, basis: string): Sale {
  return { id, description: id, term, proceeds, basis };
}
function draft(wages = '50000', filingStatus: Status = 'single'): Draft {
  return { ...emptyDraft(), wages, filingStatus, sales: [] };
}
function run(d: Draft): Calculation {
  const result = calculate(d);
  expect(result.errors).toEqual([]);
  return result;
}
function values(r: Calculation, expected: Record<string, number>) {
  for (const [id, value] of Object.entries(expected)) {
    // Missing nodes must fail, including those whose expected value is zero.
    // Treat +0 and -0 alike; tolerance is far smaller than one cent.
    expect(r.nodes.get(id)?.value, id).toBeCloseTo(value, 8);
  }
}
function ancestors(r: Calculation, id: string, found = new Set<string>()): Set<string> {
  for (const parent of r.nodes.get(id)!.inputs) {
    if (!found.has(parent)) { found.add(parent); ancestors(r, parent, found); }
  }
  return found;
}

describe('published IRS examples through the 2025 adapter', () => {
  // Schedule D instructions (2025), pp.10–11, Example 1—Basis Reported to
  // the IRS, including its second-transaction variant:
  // https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=10
  // Wages, single status and base-deduction eligibility are synthetic additions.
  it.each([
    { name: 'one covered long-term stock sale', sales: [sale('first', 'long', '6000', '2000')], gain: 4000, taxable: 38250 },
    { name: 'two covered long-term stock sales', sales: [sale('first', 'long', '6000', '2000'), sale('second', 'long', '5000', '3000')], gain: 6000, taxable: 40250 },
  ])('$name', ({ sales, gain, taxable }) => {
    const d = draft(); d.sales = sales;
    const r = run(d);
    values(r, { 'capitalSales.long': gain, 'scheduleD.line15': gain, 'scheduleD.line16': gain,
      'form1040.line7a': gain, 'form1040.line15': taxable, 'next.8': 0, 'next.13': 0 });
    expect(r.nodes.get('form1040.line7a')!.inputs).toEqual(['scheduleD.line16']);
    expect(r.nodes.has('scheduleD.line21')).toBe(false);
    for (const s of sales) {
      expect(ancestors(r, 'form1040.line7a')).toContain(`sale.${s.id}.proceeds`);
      expect(ancestors(r, 'form1040.line7a')).toContain(`sale.${s.id}.basis`);
    }
  });

  // Pub.550 (2025), p.102, Bob/Shelly and the explicitly published $2,000
  // loss alternative: https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102
  // IRS does not specify character, proceeds/basis or wages. Those inputs are
  // synthetic; wages below hold taxable income at the published $26,000.
  it.each([
    { loss: '7000', wages: '60500', deduction: 3000, carry: 4000 },
    { loss: '2000', wages: '59500', deduction: 2000, carry: 0 },
  ])('Bob/Shelly $loss loss with explicitly assigned short-term character', f => {
    const worksheet = calculateCapitalLossCarryover({ taxableIncomeUnfloored: 26000,
      shortTerm: -Number(f.loss), longTerm: 0, lossDeduction: f.deduction });
    expect(worksheet.total).toBe(f.carry);
    const d = draft(f.wages, 'mfj'); d.sales = [sale('loss', 'short', '0', f.loss)];
    values(run(d), { 'form1040.line15': 26000, 'form1040.line7a': -f.deduction,
      'next.4': f.deduction, 'next.8': f.carry, 'next.13': 0 });
  });
});

describe('independently worked incoming worksheet fixtures (synthetic)', () => {
  it.each(worksheetFixtures)('$name: individual worksheet lines', f => {
    const r = calculateCapitalLossCarryover(f.input);
    for (const [line, amount] of Object.entries(f.lines)) expect(r.lines[Number(line)], `line ${line}`).toBe(amount);
    expect(r.shortTerm).toBe(f.short);
    expect(r.longTerm).toBe(f.long);
  });

  it.each(worksheetFixtures)('$name: 2024 inputs transfer into 2025 Schedule D', f => {
    const d = draft(); d.hasPriorLoss = true;
    d.prior = { taxable: String(f.input.taxableIncomeUnfloored), short: String(f.input.shortTerm),
      long: String(f.input.longTerm), deduction: String(f.input.lossDeduction) };
    const r = run(d);
    for (const [line, amount] of Object.entries(f.lines)) values(r, { [`prior.${line}`]: amount });
    values(r, { 'scheduleD.line6': -f.short, 'scheduleD.line14': -f.long });
    // A fully consumed prior loss does not trigger Schedule D. Nonzero incoming
    // losses must trigger it even though there are no current-year sales.
    if (f.short || f.long) {
      expect(ancestors(r, 'form1040.line7a')).toContain('prior.input.taxable');
      expect(ancestors(r, 'form1040.line7a')).toContain('prior.input.deduction');
      expect(r.nodes.get('scheduleD.line6')!.inputs).toEqual(['prior.8']);
      expect(r.nodes.get('scheduleD.line14')!.inputs).toEqual(['prior.13']);
    }
  });
});

describe('2025 outgoing-loss income boundaries (synthetic)', () => {
  // Pub.550 (2025), p.102. $5,000 ST loss, base standard deduction $15,750.
  // These fixed expectations straddle both ends of the absorption interval.
  it.each([
    ['single', '15749.99', -3000, -3000.01, 0, 5000, 0],
    ['single', '15750', -3000, -3000, 0, 5000, 0],
    ['single', '15750.01', -3000, -2999.99, 0.01, 4999.99, 0],
    ['single', '18749.99', -3000, -0.01, 2999.99, 2000.01, 0],
    ['single', '18750', -3000, 0, 3000, 2000, 0],
    ['single', '18750.01', -3000, 0.01, 3000, 2000, 0.01],
    ['mfs', '15750', -1500, -1500, 0, 5000, 0],
    ['mfs', '15750.01', -1500, -1499.99, 0.01, 4999.99, 0],
    ['mfs', '17249.99', -1500, -0.01, 1499.99, 3500.01, 0],
    ['mfs', '17250', -1500, 0, 1500, 3500, 0],
    ['mfs', '17250.01', -1500, 0.01, 1500, 3500, 0.01],
  ] as const)('%s wages %s', (status, wages, deduction, unfloored, used, remaining, taxable) => {
    const d = draft(wages, status); d.sales = [sale('loss', 'short', '0', '5000')];
    const r = run(d);
    values(r, { 'form1040.line7a': deduction, 'form1040.line15': taxable,
      'next.1': unfloored, 'next.4': used, 'next.8': remaining, 'next.13': 0 });
    const sources = ancestors(r, 'next.8');
    expect(sources).toContain('form1040.line1a');
    expect(sources).toContain('form1040.line12e');
    expect(sources).not.toContain('form1040.line15'); // Must not use floored income.
  });

  it.each([
    ['single', '3000', -3000, 1000, 4500],
    ['mfs', '3000', -1500, 1000, 4500],
    ['single', '1500', -3000, 1000, 6000],
    ['mfs', '1500', -1500, 1000, 6000],
  ] as const)('current %s, actual prior deduction %s', (status, priorDeduction, transfer, used, remaining) => {
    const d = draft('16750', status); d.hasPriorLoss = true;
    // Prior filing status is not inferred from current status. The prior loss
    // is assumed attributable to this taxpayer; spouse allocation is out of scope.
    // With a $3,000 prior deduction, $1,500 was absorbed and $5,500 enters
    // 2025. With $1,500, none was absorbed and all $7,000 enters 2025.
    // Current income absorbs $1,000 in either filing status.
    d.prior = { taxable: '-1500', short: '-7000', long: '0', deduction: priorDeduction };
    values(run(d), { 'form1040.line7a': transfer, 'next.4': used, 'next.8': remaining, 'next.13': 0 });
  });
});

describe('carryover with current sales and character changes (synthetic)', () => {
  // 2024 ST loss $4,000 + LT loss $6,000, full $3,000 deduction:
  // 2025 opens with ST $1,000 and LT $6,000 carryovers.
  it.each([
    { name: 'no current sales', st: '0', lt: '0', netST: -1000, netLT: -6000, net: -7000, transfer: -3000, nextST: 0, nextLT: 4000 },
    { name: 'ST gain offsets remaining LT loss', st: '3000', lt: '0', netST: 2000, netLT: -6000, net: -4000, transfer: -3000, nextST: 0, nextLT: 1000 },
    { name: 'LT gain offsets remaining ST loss', st: '0', lt: '6500', netST: -1000, netLT: 500, net: -500, transfer: -500, nextST: 0, nextLT: 0 },
    { name: 'gains exhaust carryovers exactly', st: '3000', lt: '4000', netST: 2000, netLT: -2000, net: 0, transfer: 0, nextST: 0, nextLT: 0 },
    { name: 'positive net after carryovers', st: '3000', lt: '5000', netST: 2000, netLT: -1000, net: 1000, transfer: 1000, nextST: 0, nextLT: 0 },
  ])('$name', f => {
    const d = draft(); d.hasPriorLoss = true;
    d.prior = { taxable: '20000', short: '-4000', long: '-6000', deduction: '3000' };
    d.sales = [sale('st', 'short', f.st, '0'), sale('lt', 'long', f.lt, '0')].filter(s => s.proceeds !== '0');
    const r = run(d);
    values(r, { 'prior.8': 1000, 'prior.13': 6000, 'scheduleD.line7': f.netST,
      'scheduleD.line15': f.netLT, 'scheduleD.line16': f.net, 'form1040.line7a': f.transfer,
      'next.8': f.nextST, 'next.13': f.nextLT });
    expect(r.nodes.get('form1040.line7a')!.inputs).toEqual([f.net < 0 ? 'scheduleD.line21' : 'scheduleD.line16']);
    expect(r.nodes.has('scheduleD.line21')).toBe(f.net < 0);
    const before = structuredClone(d);
    expect(run(d)).toEqual(r); // Repeat calculation must not consume carryover.
    expect(d).toEqual(before);
    d.sales.reverse();
    const reversed = run(d);
    for (const id of ['scheduleD.line16', 'form1040.line15', 'next.8', 'next.13']) {
      expect(reversed.nodes.get(id)?.value).toBe(r.nodes.get(id)?.value);
    }
  });
});
