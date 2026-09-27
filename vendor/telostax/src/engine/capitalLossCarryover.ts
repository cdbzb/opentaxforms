// OpenTaxForms addition: fills the verified gap in upstream carryforward logic.
// IRS 2025 Schedule D instructions, Capital Loss Carryover Worksheet, p.10:
// https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=10
// Outgoing loss rule: Pub.550 (2025), p.102 (not an official 2026 worksheet).
// https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102
import { round2 } from './utils.js';
import type { TraceBuilder } from './traceBuilder.js';

export interface CarryoverInput {
  taxableIncomeUnfloored: number;
  shortTerm: number;
  longTerm: number;
  lossDeduction: number; // Schedule D line 21 as a positive number
}
export function calculateCapitalLossCarryover(input: CarryoverInput, tb?: TraceBuilder, prefix = 'carryover') {
  if (Object.values(input).some(n => !Number.isFinite(n)) || input.lossDeduction < 0) {
    throw new Error('Carryover requires finite amounts and a nonnegative loss deduction.');
  }
  const lines: Record<number, number> = {};
  const put = (line: number, label: string, value: number, formula: string, deps: string[]) => {
    lines[line] = round2(value);
    tb?.trace(`${prefix}.${line}`, label, lines[line], {
      formula, authority: 'Capital Loss Carryover Worksheet; 2025 Schedule D instructions, p.10',
      inputs: deps.map(id => ({ lineId: id, label: id, value: id.startsWith(`${prefix}.`) && /^\d+$/.test(id.split('.').at(-1)!) ? lines[Number(id.split('.').at(-1))] :
        id.endsWith('taxable') ? input.taxableIncomeUnfloored : id.endsWith('deduction') ? input.lossDeduction : id.endsWith('short') ? input.shortTerm : input.longTerm })),
    });
  };
  put(1, 'Taxable income, allowing a negative amount', input.taxableIncomeUnfloored, 'Taxable income before the zero floor', [`${prefix}.input.taxable`]);
  put(2, 'Capital loss deduction', input.lossDeduction, 'Loss on Schedule D line 21, as a positive amount', [`${prefix}.input.deduction`]);
  put(3, 'Income available to absorb the loss', Math.max(0, lines[1] + lines[2]), 'max(0, line 1 + line 2)', [`${prefix}.1`, `${prefix}.2`]);
  put(4, 'Loss used against income', Math.min(lines[2], lines[3]), 'min(line 2, line 3)', [`${prefix}.2`, `${prefix}.3`]);
  put(5, 'Short-term loss', Math.max(0, -input.shortTerm), 'Short-term loss as a positive amount, otherwise 0', [`${prefix}.input.short`]);
  put(6, 'Long-term gain', Math.max(0, input.longTerm), 'Long-term gain, otherwise 0', [`${prefix}.input.long`]);
  put(7, 'Short-term loss absorbed', lines[4] + lines[6], 'line 4 + line 6', [`${prefix}.4`, `${prefix}.6`]);
  put(8, 'Short-term loss carryover', Math.max(0, lines[5] - lines[7]), 'max(0, line 5 − line 7)', [`${prefix}.5`, `${prefix}.7`]);
  put(9, 'Long-term loss', Math.max(0, -input.longTerm), 'Long-term loss as a positive amount, otherwise 0', [`${prefix}.input.long`]);
  put(10, 'Short-term gain', Math.max(0, input.shortTerm), 'Short-term gain, otherwise 0', [`${prefix}.input.short`]);
  put(11, 'Remaining deduction applied to long-term loss', Math.max(0, lines[4] - lines[5]), 'max(0, line 4 − line 5)', [`${prefix}.4`, `${prefix}.5`]);
  put(12, 'Long-term loss absorbed', lines[10] + lines[11], 'line 10 + line 11', [`${prefix}.10`, `${prefix}.11`]);
  put(13, 'Long-term loss carryover', Math.max(0, lines[9] - lines[12]), 'max(0, line 9 − line 12)', [`${prefix}.9`, `${prefix}.12`]);
  return { lines, shortTerm: lines[8], longTerm: lines[13], total: round2(lines[8] + lines[13]) };
}
