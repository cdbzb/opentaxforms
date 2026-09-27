import { form1040Lines, contextItems, itemized } from './form1040';
export type Page = '1040' | 'scheduleD' | 'prior' | 'next';
export const sources = {
  form1040: 'https://www.irs.gov/pub/irs-prior/f1040--2025.pdf',
  instructions1040: 'https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf',
  scheduleD: 'https://www.irs.gov/pub/irs-prior/f1040sd--2025.pdf',
  instructionsD: 'https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf',
  prior: 'https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=10',
  next: 'https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102',
};
export interface Field { id: string; page: Page; line: string; label: string; explanation: string; url: string }
export const fields: Field[] = [
  { id: 'scope.noAdjustments', page: '1040', line: '10', label: 'No adjustments recorded (prototype assumption)', explanation: 'The supported calculation assumes no adjustments. Schedule 1 is not implemented. Enter an amount or mark line 10 as applicable if you have adjustments; the return will be marked incomplete.', url: sources.instructions1040 },
  { id: 'form1040.line1a', page: '1040', line: '1a', label: 'Wages from Form W-2', explanation: 'Enter the total of your W-2 box 1 amounts.', url: sources.instructions1040 },
  { id: 'form1040.line7a', page: '1040', line: '7a', label: 'Capital gain or (loss)', explanation: 'The net gain comes from Schedule D line 16. A net loss passes through the limit on line 21.', url: sources.instructions1040 },
  { id: 'form1040.line9', page: '1040', line: '9', label: 'Total income', explanation: 'Wages plus capital gain or deductible loss in this limited return.', url: sources.instructions1040 },
  { id: 'form1040.line10', page: '1040', line: '10', label: 'Adjustments to income', explanation: 'This prototype has no adjustments to income. Returns requiring them are outside its scope.', url: sources.instructions1040 },
  { id: 'form1040.line11a', page: '1040', line: '11a', label: 'Adjusted gross income', explanation: 'Total income less adjustments. Carries to line 11b on page 2 of the IRS form.', url: sources.instructions1040 },
  { id: 'form1040.line12e', page: '1040', line: '12e', label: 'Standard deduction', explanation: 'The 2025 base standard deduction for the selected filing status. Assumes eligibility, no age or blindness additions, and that nobody can claim you as a dependent.', url: sources.instructions1040 },
  { id: 'form1040.line15', page: '1040', line: '15', label: 'Taxable income', explanation: 'AGI less deductions, floored at zero. The carryover calculation keeps the negative amount when needed.', url: sources.instructions1040 },
  { id: 'capitalSales.short', page: 'scheduleD', line: '1a(h)', label: 'Short-term sales: net gain or loss', explanation: 'Covered ordinary stock sales with basis reported to the IRS and no adjustments. Held one year or less.', url: sources.instructionsD },
  { id: 'scheduleD.line6', page: 'scheduleD', line: '6', label: 'Short-term capital loss carryover', explanation: 'A loss brought forward from 2024, from line 8 of the 2025 carryover worksheet.', url: sources.prior },
  { id: 'scheduleD.line7', page: 'scheduleD', line: '7', label: 'Net short-term capital gain or loss', explanation: 'The short-term sales result, reduced by the prior-year short-term loss.', url: sources.instructionsD },
  { id: 'capitalSales.long', page: 'scheduleD', line: '8a(h)', label: 'Long-term sales: net gain or loss', explanation: 'Covered ordinary stock sales with basis reported to the IRS and no adjustments. Held more than one year.', url: sources.instructionsD },
  { id: 'scheduleD.line14', page: 'scheduleD', line: '14', label: 'Long-term capital loss carryover', explanation: 'A loss brought forward from 2024, from line 13 of the 2025 carryover worksheet.', url: sources.prior },
  { id: 'scheduleD.line15', page: 'scheduleD', line: '15', label: 'Net long-term capital gain or loss', explanation: 'The long-term sales result, reduced by the prior-year long-term loss.', url: sources.instructionsD },
  { id: 'scheduleD.line16', page: 'scheduleD', line: '16', label: 'Combined net gain or loss', explanation: 'Combine the short-term and long-term results. A gain goes directly to Form 1040 line 7a.', url: sources.instructionsD },
  { id: 'scheduleD.line21', page: 'scheduleD', line: '21', label: 'Capital loss allowed on Form 1040', explanation: 'For a net loss only: limited to $3,000, or $1,500 when married filing separately. A gain skips this line.', url: sources.instructionsD },
];
for (const f of [...form1040Lines,...contextItems,itemized]) {
  const id=`form1040.line${f.line}`;
  const known=fields.find(field=>field.id===id);
  const explanation = f.support==='supported'
    ? known?.explanation || 'Displayed for the supported wages, capital gains and base standard-deduction scenario only. Unsupported entries make the return incomplete.'
    : `Not supported yet. Needed: ${f.needs} Recorded amounts are notes only, not calculated or verified tax amounts.`;
  if(known)Object.assign(known,{label:f.label,explanation});
  else fields.push({id,page:'1040',line:f.line,label:f.label,explanation,url:sources.instructions1040});
}
export const worksheetLabels = [
  'Taxable income, allowing a negative amount', 'Loss deduction, as a positive amount',
  'Income available to absorb the loss', 'Smaller of lines 2 and 3',
  'Short-term loss, as a positive amount', 'Long-term gain (zero if a loss)',
  'Add lines 4 and 6', 'Short-term loss carryover', 'Long-term loss, as a positive amount',
  'Short-term gain (zero if a loss)', 'Line 4 less line 5, floored at zero',
  'Add lines 10 and 11', 'Long-term loss carryover',
];
for (const page of ['prior','next'] as const) worksheetLabels.forEach((label,index) => fields.push({
  id: `${page}.${index+1}`, page, line: String(index+1), label,
  explanation: page === 'prior' ? '2025 Capital Loss Carryover Worksheet, using your 2024 return.' : 'Outgoing loss calculation using the 2025 Publication 550 rule. Step numbers correspond to the carryover method; this is not an official 2026 worksheet.',
  url: sources[page],
}));
export function fieldFor(id: string): Field {
  const known = fields.find(f=>f.id===id); if (known) return known;
  const page: Page = id.startsWith('prior.') ? 'prior' : id.startsWith('next.') ? 'next' : id==='filingStatus' ? '1040' : 'scheduleD';
  const inputLabels: Record<string,string> = { taxable: 'Taxable income before the zero floor', deduction: 'Capital loss deduction, as a positive amount', short: 'Net short-term gain or loss', long: 'Net long-term gain or loss' };
  const label = id.startsWith('sale.') ? (id.endsWith('.proceeds') ? 'Sale proceeds' : id.endsWith('.basis') ? 'Cost basis' : 'Sale gain or loss') : id==='filingStatus' ? 'Filing status' : inputLabels[id.split('.').at(-1)!] || 'Source amount';
  return { id, page, line: 'Input', label, explanation: 'Source input used by this calculation.', url: page==='1040' ? sources.instructions1040 : page==='scheduleD' ? sources.instructionsD : sources[page] };
}
