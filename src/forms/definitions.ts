import { form1040Lines, contextItems, itemized } from './form1040';
export type Page = '1040' | 'scheduleB' | 'scheduleD' | 'prior' | 'next' | 'qdcg';
export const sources = {
  form1040: 'https://www.irs.gov/pub/irs-prior/f1040--2025.pdf',
  instructions1040: 'https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf',
  scheduleD: 'https://www.irs.gov/pub/irs-prior/f1040sd--2025.pdf',
  instructionsD: 'https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf',
  prior: 'https://www.irs.gov/pub/irs-prior/i1040sd--2025.pdf#page=10',
  next: 'https://www.irs.gov/pub/irs-prior/p550--2025.pdf#page=102',
  scheduleB: 'https://www.irs.gov/pub/irs-prior/f1040sb--2025.pdf',
  instructionsB: 'https://www.irs.gov/pub/irs-prior/i1040sb--2025.pdf',
  qdcg: 'https://www.irs.gov/pub/irs-prior/i1040gi--2025.pdf#page=38',
};
export interface Field { id: string; page: Page; line: string; label: string; explanation: string; url: string }
export const fields: Field[] = [
  { id: 'scope.noAdjustments', page: '1040', line: '10', label: 'No adjustments recorded (prototype assumption)', explanation: 'The supported calculation assumes no adjustments. Schedule 1 is not implemented. Enter an amount or mark line 10 as applicable if you have adjustments; the return will be marked incomplete.', url: sources.instructions1040 },
  { id: 'form1040.line1a', page: '1040', line: '1a', label: 'Wages from Form W-2', explanation: 'Enter the total of your W-2 box 1 amounts.', url: sources.instructions1040 },
  ...['2a','2b','3a','3b'].map(line=>({id:`form1040.line${line}`,page:'1040' as const,line,label:'Investment income',explanation:'Enter payer records in Schedule B. Qualified dividends are included in ordinary dividends; tax-exempt interest is excluded from total income. Select a source to trace the payer amount.',url:sources.instructionsB})),
  { id: 'form1040.line16', page:'1040',line:'16',label:'Income tax',explanation:'2025 Tax Table/Computation Worksheet or Qualified Dividends and Capital Gain Tax Worksheet, as applicable. Before credits and other taxes; this is not total tax or a refund. Forms 8615, 8814, 4972 and 2555 are not supported; flag special tax methods if needed.',url:sources.qdcg },
  { id: 'form1040.line7a', page: '1040', line: '7a', label: 'Capital gain or (loss)', explanation: 'The net gain comes from Schedule D line 16. A net loss passes through the limit on line 21.', url: sources.instructions1040 },
  { id: 'form1040.line9', page: '1040', line: '9', label: 'Total income', explanation: 'Wages, taxable interest, ordinary dividends and capital gain or deductible loss. Qualified dividends are already included; tax-exempt interest is excluded.', url: sources.instructions1040 },
  { id: 'form1040.line10', page: '1040', line: '10', label: 'Adjustments to income', explanation: 'This prototype has no adjustments to income. Returns requiring them are outside its scope.', url: sources.instructions1040 },
  { id: 'form1040.line11a', page: '1040', line: '11a', label: 'Adjusted gross income', explanation: 'Total income less adjustments. Carries to line 11b on page 2 of the IRS form.', url: sources.instructions1040 },
  { id: 'form1040.line12e', page: '1040', line: '12e', label: 'Standard deduction', explanation: 'The 2025 base standard deduction for the selected filing status. Assumes eligibility, no age or blindness additions, and that nobody can claim you as a dependent.', url: sources.instructions1040 },
  { id: 'form1040.line15', page: '1040', line: '15', label: 'Taxable income', explanation: 'AGI less deductions, floored at zero. The carryover calculation keeps the negative amount when needed.', url: sources.instructions1040 },
  { id: 'capitalSales.short', page: 'scheduleD', line: '1a(h)', label: 'Short-term sales: net gain or loss', explanation: 'Covered ordinary stock sales with basis reported to the IRS and no adjustments. Held one year or less.', url: sources.instructionsD },
  { id: 'scheduleD.line6', page: 'scheduleD', line: '6', label: 'Short-term capital loss carryover', explanation: 'A loss brought forward from 2024, from line 8 of the 2025 carryover worksheet.', url: sources.prior },
  { id: 'scheduleD.line7', page: 'scheduleD', line: '7', label: 'Net short-term capital gain or loss', explanation: 'The short-term sales result, reduced by the prior-year short-term loss.', url: sources.instructionsD },
  { id: 'capitalSales.long', page: 'scheduleD', line: '8a(h)', label: 'Long-term sales: net gain or loss', explanation: 'Covered ordinary stock sales with basis reported to the IRS and no adjustments. Held more than one year.', url: sources.instructionsD },
  { id: 'scheduleD.line13', page: 'scheduleD', line: '13', label: 'Capital gain distributions', explanation: 'Ordinary capital gain distributions from the payer records (Form 1099-DIV box 2a). Special-rate gains are unsupported.', url: sources.instructionsD },
  { id: 'scheduleD.line14', page: 'scheduleD', line: '14', label: 'Long-term capital loss carryover', explanation: 'A loss brought forward from 2024, from line 13 of the 2025 carryover worksheet.', url: sources.prior },
  { id: 'scheduleD.line15', page: 'scheduleD', line: '15', label: 'Net long-term capital gain or loss', explanation: 'The long-term sales result plus capital gain distributions, reduced by the prior-year long-term loss.', url: sources.instructionsD },
  { id: 'scheduleD.line16', page: 'scheduleD', line: '16', label: 'Combined net gain or loss', explanation: 'Combine the short-term and long-term results. A gain goes directly to Form 1040 line 7a.', url: sources.instructionsD },
  { id: 'scheduleD.line21', page: 'scheduleD', line: '21', label: 'Capital loss allowed on Form 1040', explanation: 'For a net loss only: limited to $3,000, or $1,500 when married filing separately. A gain skips this line.', url: sources.instructionsD },
];
for (const [line,label] of [['2','Total taxable interest'],['3','Savings-bond interest exclusion'],['4','Taxable interest to Form 1040 line 2b'],['6','Ordinary dividends to Form 1040 line 3b']]) fields.push({id:`scheduleB.line${line}`,page:'scheduleB',line,label,explanation:line==='3'?'Form 8815 exclusions are unsupported. Mark special investment treatment if needed.':'Amounts from payer records on Schedule B. Select sources to trace each entry.',url:sources.instructionsB});
export const qdcgLabels = [
  'Taxable income', 'Qualified dividends', 'Eligible net capital gain', 'Qualified dividends plus eligible gain',
  'Ordinary taxable income', 'Zero-rate threshold', 'Smaller of lines 1 and 6', 'Smaller of lines 5 and 7',
  'Amount taxed at 0%', 'Smaller of lines 1 and 4', 'Amount from line 9', 'Line 10 less line 11',
  'Upper threshold for 15% rate', 'Smaller of lines 1 and 13', 'Lines 5 plus 9', 'Line 14 less line 15, minimum zero',
  'Amount taxed at 15%', 'Tax at 15%', 'Lines 9 plus 17', 'Amount taxed at 20%', 'Tax at 20%',
  'Tax on ordinary taxable income', 'Combined preferential calculation', 'Ordinary tax on all taxable income',
  'Income tax: smaller of lines 23 and 24',
];
qdcgLabels.forEach((label,i)=>fields.push({id:`qdcg.${i+1}`,page:'qdcg',line:String(i+1),label,explanation:'2025 Qualified Dividends and Capital Gain Tax Worksheet. Select the amount for its calculation and sources.',url:sources.qdcg}));
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
  const page: Page = /^(interest|dividends|scheduleB)\./.test(id) ? 'scheduleB' : id.startsWith('prior.') ? 'prior' : id.startsWith('next.') ? 'next' : id==='filingStatus' ? '1040' : 'scheduleD';
  const inputLabels: Record<string,string> = { taxable: 'Taxable income before the zero floor', deduction: 'Capital loss deduction, as a positive amount', short: 'Net short-term gain or loss', long: 'Net long-term gain or loss' };
  const investmentLabels: Record<string,string> = {payer:'Payer name',taxable:'Taxable interest',exempt:'Tax-exempt interest',ordinary:'Ordinary dividends',qualified:'Qualified dividends',capitalGain:'Capital gain distributions',foreignAccount:'Foreign account question',foreignTrust:'Foreign trust question',special:'Special investment treatment'};
  const label = page==='scheduleB' ? investmentLabels[id.split('.').at(-1)!] || 'Payer amount' : id.startsWith('sale.') ? (id.endsWith('.proceeds') ? 'Sale proceeds' : id.endsWith('.basis') ? 'Cost basis' : 'Sale gain or loss') : id==='filingStatus' ? 'Filing status' : inputLabels[id.split('.').at(-1)!] || 'Source amount';
  return { id, page, line: 'Input', label, explanation: 'Source input used by this calculation.', url: page==='1040' ? sources.instructions1040 : page==='scheduleD' ? sources.instructionsD : page==='scheduleB' ? sources.instructionsB : sources[page] };
}
