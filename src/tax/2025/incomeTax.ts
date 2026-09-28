import { taxTable } from './taxTable';
import { calculateProgressiveTax } from '../../../vendor/telostax/src/engine/brackets';
import { CAPITAL_GAINS_RATES } from '../../../vendor/telostax/src/constants/tax2025';
import { FilingStatus } from '../../../vendor/telostax/src/types';
import { round2 } from '../../../vendor/telostax/src/engine/utils';
import type { ValueNode } from '../../adapters/calculate';

// IRS 2025 1040 instructions pp.68–80. QSS uses the joint-return column.
export function ordinaryIncomeTax(income: number, status: FilingStatus) {
  if (!Number.isFinite(income) || income < 0 || ![1,2,3,4,5].includes(status)) throw new Error('Invalid income tax input.');
  const statusName = ['','Single','Married filing jointly','Married filing separately','Head of household','Qualifying surviving spouse'][status];
  if (income >= 100000) {
    const result=calculateProgressiveTax(income,status);
    return {value:result.tax, explanation:`2025 Tax Computation Worksheet rates (${statusName}): `+
      result.brackets.filter(b=>b.taxableAtRate>0).map(b=>`$${b.taxableAtRate.toFixed(2)} × ${Math.round(b.rate*100)}%`).join(' + ')+'.'};
  }
  const row = taxTable.find(r => r[0] <= income && income < r[1]);
  if (!row) throw new Error('Missing 2025 IRS Tax Table interval.');
  return { value: row[status === FilingStatus.QualifyingSurvivingSpouse ? 3 : status + 1],
    explanation: `2025 IRS Tax Table: at least $${row[0]}, less than $${row[1]}; ${statusName} column${status === FilingStatus.QualifyingSurvivingSpouse ? ' (uses married filing jointly)' : ''}.` };
}

// Narrow official 25-line worksheet. Special Schedule D Tax Worksheet gains,
// Form 2555/8615/8814/4972 and investment-interest elections are excluded upstream.
// https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf#page=38
export function addIncomeTax(nodes: Map<string, ValueNode>, status: FilingStatus) {
  const get = (id: string) => {
    const n = nodes.get(id); if (!n) throw new Error(`Missing tax source: ${id}`); return n.value;
  };
  const put = (id: string, value: number, inputs: string[], explanation: string) => nodes.set(id, { id, value: round2(value), inputs, explanation });
  const income = get('form1040.line15');
  const qualified = get('form1040.line3a');
  const lt = get('scheduleD.line15'), net = get('scheduleD.line16');
  if (qualified <= 0 && !(lt > 0 && net > 0)) {
    const tax = ordinaryIncomeTax(income, status);
    put('form1040.line16', tax.value, ['form1040.line15','filingStatus'], tax.explanation);
    return;
  }
  const n = (line: number) => get(`qdcg.${line}`);
  const line = (id: number, value: number, deps: number[], explanation: string) => put(`qdcg.${id}`, value, deps.map(i=>`qdcg.${i}`), explanation);
  put('qdcg.1', income, ['form1040.line15'], 'Taxable income from Form 1040 line 15.');
  put('qdcg.2', qualified, ['form1040.line3a'], 'Qualified dividends are included in ordinary dividends, not added to income twice.');
  put('qdcg.3', Math.max(0, Math.min(lt,net)), ['scheduleD.line15','scheduleD.line16'], 'Smaller of Schedule D lines 15 and 16; zero if either is a loss or zero.');
  line(4, n(2)+n(3), [2,3], 'Add lines 2 and 3.');
  line(5, Math.max(0,n(1)-n(4)), [1,4], 'Line 1 minus line 4, floored at zero.');
  put('qdcg.6', CAPITAL_GAINS_RATES.THRESHOLD_0[status], ['filingStatus'], '2025 zero-rate threshold for this filing status.');
  line(7, Math.min(n(1),n(6)), [1,6], 'Smaller of lines 1 and 6.');
  line(8, Math.min(n(5),n(7)), [5,7], 'Smaller of lines 5 and 7.');
  line(9, n(7)-n(8), [7,8], 'Line 7 minus line 8: amount taxed at 0%.');
  line(10, Math.min(n(1),n(4)), [1,4], 'Smaller of lines 1 and 4.');
  line(11, n(9), [9], 'Copy line 9.');
  line(12, n(10)-n(11), [10,11], 'Subtract line 11 from line 10.');
  // IRS p.38 explicitly gives $300,000 for MFS. Upstream incorrectly halves
  // the MFJ threshold to $300,025; override that value in this verified slice.
  put('qdcg.13', status === FilingStatus.MarriedFilingSeparately ? 300000 : CAPITAL_GAINS_RATES.THRESHOLD_15[status], ['filingStatus'], '2025 upper threshold for the 15% rate for this filing status.');
  line(14, Math.min(n(1),n(13)), [1,13], 'Smaller of lines 1 and 13.');
  line(15, n(5)+n(9), [5,9], 'Add lines 5 and 9.');
  line(16, Math.max(0,n(14)-n(15)), [14,15], 'Line 14 minus line 15, floored at zero.');
  line(17, Math.min(n(12),n(16)), [12,16], 'Smaller of lines 12 and 16: amount taxed at 15%.');
  line(18, n(17)*0.15, [17], 'Line 17 × 15%.');
  line(19, n(9)+n(17), [9,17], 'Add lines 9 and 17.');
  line(20, n(10)-n(19), [10,19], 'Subtract line 19 from line 10: amount taxed at 20%.');
  line(21, n(20)*0.20, [20], 'Line 20 × 20%.');
  for (const [output,input] of [[22,5],[24,1]]) {
    const tax = ordinaryIncomeTax(n(input),status);
    put(`qdcg.${output}`, tax.value, [`qdcg.${input}`,'filingStatus'], tax.explanation);
  }
  line(23, n(18)+n(21)+n(22), [18,21,22], 'Add lines 18, 21 and 22.');
  line(25, Math.min(n(23),n(24)), [23,24], 'Smaller of the preferential calculation and ordinary tax on all taxable income.');
  put('form1040.line16', n(25), ['qdcg.25'], 'Income tax from the Qualified Dividends and Capital Gain Tax Worksheet. Before credits and other taxes; not total tax.');
}
