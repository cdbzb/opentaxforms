import { describe, expect, it } from 'vitest';
import { calculate, validateGraph, type ValueNode } from '../src/adapters/calculate';
import { emptyDraft, exampleDraft, money, type Draft } from '../src/adapters/model';
import { calculateCapitalLossCarryover as carryover } from '../vendor/telostax/src/engine/capitalLossCarryover';

function run(d: Draft) {
  const result = calculate(d);
  expect(result.errors).toEqual([]);
  return { value: (id: string) => result.nodes.get(id)?.value, node: (id: string) => result.nodes.get(id)!, result };
}
function loss(wages = '0', term: 'short'|'long' = 'short') {
  const d = exampleDraft(); d.wages = wages;
  d.sales[0] = { ...d.sales[0], term, proceeds: '0', basis: '5000' };
  return d;
}
describe('2025 IRS carryover worksheet', () => {
  // Published examples and line-by-line fixtures: irs-regression-2025.test.ts.
  it.each([
    [-10000,-5000,0,3000,5000,0],
    [-2000,-5000,0,3000,4000,0],
    [0,-5000,0,3000,2000,0],
    [20000,-1000,-6000,3000,0,4000],
    [20000,-7000,2000,3000,2000,0],
    [20000,2000,-7000,3000,0,2000],
    [-4000,-2000,-3000,3000,2000,3000],
    [20000,-5000,0,1500,3500,0],
    [20000,-3000.01,0,3000,.01,0],
    [20000,0,0,0,0,0],
  ])('handles unfloored income %s, ST %s, LT %s, deduction %s', (income,st,lt,deduction,wantST,wantLT) => {
    const r = carryover({ taxableIncomeUnfloored: income, shortTerm: st, longTerm: lt, lossDeduction: deduction });
    expect(r.shortTerm).toBe(wantST); expect(r.longTerm).toBe(wantLT);
    expect(r.total).toBeCloseTo(wantST+wantLT,2);
  });
  it('rejects invalid numeric inputs', () => {
    expect(()=>carryover({ taxableIncomeUnfloored: NaN, shortTerm: 0, longTerm: 0, lossDeduction: 0 })).toThrow();
    expect(()=>carryover({ taxableIncomeUnfloored: 0, shortTerm: 0, longTerm: 0, lossDeduction: -1 })).toThrow();
  });
});
describe('2025 forms integration and provenance', () => {
  it('nets multiple short- and long-term sales without losing carryover character', () => {
    const d=exampleDraft();d.sales=[
      {id:'a',description:'ST loss',term:'short',proceeds:'0',basis:'4000'},
      {id:'b',description:'ST gain',term:'short',proceeds:'1000',basis:'0'},
      {id:'c',description:'LT loss',term:'long',proceeds:'0',basis:'6000'},
    ];const r=run(d);
    expect(r.value('scheduleD.line16')).toBe(-9000);
    expect(r.value('next.8')).toBe(0);expect(r.value('next.13')).toBe(6000);
  });
  it('routes a gain through Schedule D 16 to actual 2025 Form 1040 line 7a', () => {
    const r = run(exampleDraft());
    expect(r.value('form1040.line7a')).toBe(2000);
    expect(r.value('form1040.line9')).toBe(52000);
    expect(r.value('form1040.line12e')).toBe(15750);
    expect(r.value('form1040.line15')).toBe(36250);
    expect(r.node('form1040.line7a').inputs).toEqual(['scheduleD.line16']);
    expect(r.value('scheduleD.line21')).toBeUndefined();
    expect(r.node('sale.example.gain').inputs).toEqual(['sale.example.proceeds','sale.example.basis']);
    expect(r.node('scheduleD.line7').inputs).toContain('capitalSales.short');
    expect(r.node('capitalSales.short').inputs).toContain('sale.example.gain');
  });
  it.each(['short','long'] as const)('preserves the full %s loss when income cannot absorb it', term => {
    const r = run(loss('0',term));
    expect(r.value('form1040.line7a')).toBe(-3000);
    expect(r.value('form1040.line9')).toBe(-3000);
    expect(r.value('form1040.line15')).toBe(0);
    expect(r.value(term==='short'?'next.8':'next.13')).toBe(5000);
    expect(r.node('form1040.line7a').inputs).toEqual(['scheduleD.line21']);
    expect(r.value('next.1')).toBe(-18750);
  });
  it('uses only the part of the loss absorbed by income', () => {
    const r = run(loss('16750'));
    expect(r.value('next.1')).toBe(-2000);
    expect(r.value('next.4')).toBe(1000);
    expect(r.value('next.8')).toBe(4000);
  });
  it('calculates a return with carryover and no current sales', () => {
    const d = emptyDraft(); d.sales=[]; d.hasPriorLoss=true;
    d.prior={ taxable:'20000', short:'-8000', long:'0', deduction:'3000' };
    const r=run(d);
    expect(r.value('prior.8')).toBe(5000);
    expect(r.value('scheduleD.line6')).toBe(-5000);
    expect(r.value('form1040.line7a')).toBe(-3000);
    expect(r.value('next.8')).toBe(5000);
    expect(r.node('scheduleD.line6').inputs).toEqual(['prior.8']);
  });
  it.each([
    ['single',15750,3000],['mfj',31500,3000],['mfs',15750,1500],['hoh',23625,3000],['qss',31500,3000],
  ] as const)('uses 2025 %s standard deduction and loss cap', (status,deduction,cap) => {
    const d=loss('100000'); d.filingStatus=status; const r=run(d);
    expect(r.value('form1040.line12e')).toBe(deduction);
    expect(r.value('form1040.line7a')).toBe(-cap);
    expect(r.value('next.8')).toBe(5000-cap);
  });
  it('supports zero activity without fabricating a loss deduction', () => {
    const d=emptyDraft(); d.sales=[]; const r=run(d);
    expect(r.value('form1040.line15')).toBe(0);
    expect(r.value('form1040.line7a')).toBe(0);
    expect(r.value('scheduleD.line21')).toBeUndefined();
  });
  it('recalculates downstream values after changing an input', () => {
    const d=exampleDraft(); d.sales[0].proceeds='12500.10'; const r=run(d);
    expect(r.value('form1040.line7a')).toBe(2500.1);
    expect(r.value('form1040.line15')).toBe(36750.1);
  });
  it('withdraws all results for missing and invalid inputs', () => {
    for (const wages of ['', 'not money', '-1', '1.001']) {
      const d=exampleDraft();d.wages=wages;const r=calculate(d);
      expect(r.errors.length).toBeGreaterThan(0);expect(r.nodes.size).toBe(0);
    }
  });
  it.each([
    ['', 'blank'], ['   ', 'blank'], ['1.234', 'two decimal places'],
    ['1,234', 'without commas'], ['$1234', 'dollar signs'], ['-1', 'positive amount'],
    ['abc', 'Enter a number'], ['100000000.01', 'prototype limit'],
  ])('identifies the wages field and the actual problem for %j', (wages,message) => {
    const d=exampleDraft();d.wages=wages;const r=calculate(d);
    expect(r.errorSource).toBe('form1040.line1a');
    expect(r.errors[0]).toContain('W-2 wages');expect(r.errors[0]).toContain(message);
    expect(r.nodes.size).toBe(0);
  });
  it.each(['taxable','short','long','deduction'] as const)('identifies missing prior-year %s', key => {
    const d=exampleDraft();d.hasPriorLoss=true;
    d.prior={taxable:'20000',short:'-8000',long:'0',deduction:'3000'};d.prior[key]='';
    const r=calculate(d);expect(r.errorSource).toBe(`prior.input.${key}`);
    expect(r.errors[0]).toContain('blank');expect(r.errors[0]).not.toContain('decimal');
  });
  it('identifies the specific sale and field, including malformed amounts rejected before calculation', () => {
    const d=exampleDraft();d.sales.push({...d.sales[0],id:'second',basis:''});
    expect(calculate(d).errorSource).toBe('sale.second.basis');
    expect(calculate(d).errors[0]).toContain('Cost basis for sale 2');
    d.sales[1].basis='1,000';expect(calculate(d).errorSource).toBe('sale.second.basis');
    expect(calculate(d).errors[0]).toContain('without commas');
  });
  it('rejects impossible prior-year loss deductions', () => {
    const d=exampleDraft(); d.hasPriorLoss=true;
    d.prior={taxable:'0',short:'100',long:'100',deduction:'3000'};
    expect(calculate(d).errors[0]).toMatch(/2024 Schedule D line 7 and line 15/);
    expect(calculate(d).errorSource).toBe('prior.input.short');
    d.prior={taxable:'0',short:'-8000',long:'0',deduction:'1000'};
    expect(calculate(d).errors[0]).toMatch(/2024 capital loss deduction/);
    expect(calculate(d).errorSource).toBe('prior.input.deduction');
    d.prior.deduction='1500';expect(calculate(d).errors).toEqual([]);
  });
});
describe('graph safety and input boundaries', () => {
  const n=(id: string,inputs: string[]): ValueNode=>({id,inputs,value:1,explanation:''});
  it('rejects circular references',()=>expect(()=>validateGraph(new Map([['a',n('a',['b'])],['b',n('b',['a'])]]))).toThrow(/Circular/));
  it('rejects missing sources',()=>expect(()=>validateGraph(new Map([['a',n('a',['missing'])]]))).toThrow(/Missing/));
  it.each(['NaN','Infinity','1e4','1,000','0x10','100000000.01'])('rejects ambiguous or excessive amount %s',value=>expect(()=>money(value)).toThrow());
});
