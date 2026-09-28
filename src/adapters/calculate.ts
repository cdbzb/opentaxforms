import { calculateForm1040 } from '../../vendor/telostax/src/engine/form1040';
import { calculateCapitalLossCarryover } from '../../vendor/telostax/src/engine/capitalLossCarryover';
import { TraceBuilder } from '../../vendor/telostax/src/engine/traceBuilder';
import { FilingStatus, type TaxReturn, type CalculationTrace } from '../../vendor/telostax/src/types';
import { fieldMoney, InputError, priorLabels, validateShape, type Draft } from './model';
import { unsupportedField } from '../forms/form1040';
import { addIncomeTax } from '../tax/2025/incomeTax';

export interface ValueNode { id: string; value: number; inputs: string[]; explanation: string; entered?: boolean }
export interface Calculation { nodes: Map<string, ValueNode>; errors: string[]; errorSource?: string }
export function validateGraph(nodes: Map<string, ValueNode>): void {
  const done = new Set<string>(); const active = new Set<string>();
  function visit(id: string) {
    if (active.has(id)) throw new Error(`Circular calculation dependency: ${id}`);
    if (done.has(id)) return;
    const node = nodes.get(id); if (!node) throw new Error(`Missing calculation source: ${id}`);
    active.add(id); node.inputs.forEach(visit); active.delete(id); done.add(id);
  }
  nodes.forEach(n => visit(n.id));
}
export function calculate(draft: Draft): Calculation {
  const nodes = new Map<string, ValueNode>();
  const set = (id: string, value: number, inputs: string[] = [], explanation = 'Entered on this device', entered = false) => nodes.set(id, { id, value, inputs, explanation, entered });
  try {
    draft = validateShape(draft);
    const unsupported = Object.entries(draft.unsupported1040).filter(([,entry])=>entry.applies || entry.amount.trim() !== '');
    if (unsupported.length) {
      return { nodes: new Map(), errorSource: `form1040.line${unsupported[0][0]}`,
        errors: unsupported.map(([id])=>{
          const f=unsupportedField(id)!;
          return `${/^\d/.test(id)?`Form 1040 line ${id}`:f.label}: ${f.label} is not supported yet. Your entry is saved as a note. Return incomplete; calculated results are withheld. Needed: ${f.needs}`;
        }) };
    }
    const wages = fieldMoney(draft.wages, 'form1040.line1a', 'W-2 wages · line 1a');
    const investments = draft.investments;
    if (investments.special) throw new InputError('Return incomplete: special investment treatment is not supported yet. Review bond/OID adjustments, nominee income, savings-bond exclusions, foreign tax, nondividend distributions, section 199A dividends, collectibles/section 1250 gains and investment-interest elections.', 'scheduleB.special');
    const hasInvestments = investments.interest.length + investments.dividends.length > 0;
    for (const key of ['foreignAccount','foreignTrust'] as const) {
      if (investments[key] === 'yes') throw new InputError('Return incomplete: foreign accounts or trusts require reporting that is not supported yet. See Schedule B Part III and its instructions.', `scheduleB.${key}`);
      if (hasInvestments && investments[key] === 'unanswered') throw new InputError(`Complete Schedule B Part III: answer the ${key === 'foreignAccount' ? 'foreign account' : 'foreign trust'} question.`, `scheduleB.${key}`);
    }
    const payerAmount = (kind: string, payer: {id:string;payer:string}, key: string, raw: string) => {
      const id = `${kind}.${payer.id}.${key}`;
      const value = fieldMoney(raw,id,`${payer.payer || 'Payer'} · ${key}`);
      set(id,value,[],`${payer.payer}: ${key} amount entered from your records`,true);
      return value;
    };
    const requirePayer = (kind: string, payer: {id:string;payer:string}) => {
      if (!payer.payer.trim()) throw new InputError('Enter the payer name for this Schedule B entry.',`${kind}.${payer.id}.payer`);
    };
    const interest = investments.interest.map(p => {
      requirePayer('interest',p);
      return {id:p.id,payerName:p.payer,amount:payerAmount('interest',p,'taxable',p.taxable),taxExemptInterest:payerAmount('interest',p,'exempt',p.exempt)};
    });
    const dividends = investments.dividends.map(p => {
      requirePayer('dividends',p);
      const ordinaryDividends=payerAmount('dividends',p,'ordinary',p.ordinary);
      const qualifiedDividends=payerAmount('dividends',p,'qualified',p.qualified);
      if (qualifiedDividends > ordinaryDividends) throw new InputError('Qualified dividends cannot exceed ordinary dividends for the same payer. Qualified dividends are already included in box 1a.',`dividends.${p.id}.qualified`);
      return {id:p.id,payerName:p.payer,ordinaryDividends,qualifiedDividends,capitalGainDistributions:payerAmount('dividends',p,'capitalGain',p.capitalGain)};
    });
    const status = { single: FilingStatus.Single, mfj: FilingStatus.MarriedFilingJointly, mfs: FilingStatus.MarriedFilingSeparately, hoh: FilingStatus.HeadOfHousehold, qss: FilingStatus.QualifyingSurvivingSpouse }[draft.filingStatus];
    set('filingStatus', status, [], 'Filing status is user-selected; eligibility is not determined by this prototype.', true);
    set('form1040.line1a', wages, [], 'Total wages from W-2 box 1', true);
    const traces: CalculationTrace[] = [];
    const previous = new TraceBuilder();
    let st = 0, lt = 0;
    if (draft.hasPriorLoss) {
      const priorAmount = (key: keyof Draft['prior']) => fieldMoney(draft.prior[key], `prior.input.${key}`, priorLabels[key], key !== 'deduction');
      const prior = { taxableIncomeUnfloored: priorAmount('taxable'), shortTerm: priorAmount('short'), longTerm: priorAmount('long'), lossDeduction: priorAmount('deduction') };
      const net = prior.shortTerm + prior.longTerm;
      // Prior filing status may differ from this year's. Accept either legal cap,
      // but not an arbitrary smaller deduction; Schedule D 21 precedes income limits.
      const plausibleDeduction = [3000,1500].some(cap => Math.abs(prior.lossDeduction-Math.min(cap,-net))<0.005);
      if (net >= 0) throw new InputError('Check the 2024 Schedule D line 7 and line 15 inputs at the top of this worksheet. Enter losses with a minus sign. Their combined amount must be a loss when a prior-year capital loss is selected.', 'prior.input.short');
      if (prior.lossDeduction <= 0 || !plausibleDeduction) throw new InputError('Check “2024 capital loss deduction” in the inputs at the top of this worksheet. Copy the positive amount from your 2024 Schedule D, line 21; it feeds worksheet line 2 below. It must equal the net loss limited to $3,000 ($1,500 if married filing separately in 2024).', 'prior.input.deduction');
      const result = calculateCapitalLossCarryover(prior, previous, 'prior');
      st = result.shortTerm; lt = result.longTerm;
      Object.entries({ taxable: prior.taxableIncomeUnfloored, short: prior.shortTerm, long: prior.longTerm, deduction: prior.lossDeduction }).forEach(([key,v])=>set(`prior.input.${key}`,v,[],'Entered from the 2024 return',true));
      traces.push(...previous.build());
    } else {
      set('prior.8', 0, [], 'No prior-year capital loss selected.'); set('prior.13', 0, [], 'No prior-year capital loss selected.');
    }
    const sales = draft.sales.map((s,i) => {
      const proceeds = fieldMoney(s.proceeds, `sale.${s.id}.proceeds`, `Proceeds for sale ${i+1} (Schedule D)`);
      const basis = fieldMoney(s.basis, `sale.${s.id}.basis`, `Cost basis for sale ${i+1} (Schedule D)`);
      set(`sale.${s.id}.proceeds`, proceeds, [], `${s.description}: proceeds`, true);
      set(`sale.${s.id}.basis`, basis, [], `${s.description}: reported basis`, true);
      return { id: s.id, brokerName: '', description: s.description, dateSold: '', proceeds, costBasis: basis, isLongTerm: s.term === 'long', basisReportedToIRS: true, washSaleLossDisallowed: 0 };
    });
    // Narrow, explicit input surface. Date is not used to infer holding period;
    // the user supplies short/long classification. No personal identifiers needed.
    const taxReturn: TaxReturn = {
      id: 'local', schemaVersion: 1, taxYear: 2025, status: 'in_progress', currentStep: 0, currentSection: 'review',
      filingStatus: status, dependents: [], w2Income: [{ id: 'wages', employerName: '', wages, federalTaxWithheld: 0, socialSecurityWages: wages, socialSecurityTax: 0, medicareWages: wages, medicareTax: 0, stateTaxWithheld: 0 }],
      income1099NEC: [], income1099K: [], income1099INT: interest, income1099DIV: dividends, income1099R: [], income1099G: [], income1099MISC: [], income1099B: sales,
      incomeK1: [], income1099SA: [], incomeW2G: [], income1099DA: [], income1099C: [], income1099Q: [], businesses: [], rentalProperties: [], otherIncome: 0, expenses: [], educationCredits: [],
      deductionMethod: 'standard', incomeDiscovery: {}, createdAt: '', updatedAt: '', capitalLossCarryforwardST: st, capitalLossCarryforwardLT: lt,
    };
    const result = calculateForm1040(taxReturn, { enabled: true });
    // Reuse engine aggregation; attach the payer inputs rather than reconstructing
    // income arithmetic in the UI. Special exclusions/adjustments are gated above.
    set('scheduleB.line2', result.form1040.totalInterest, interest.map(p=>`interest.${p.id}.taxable`), 'Sum of taxable interest from the listed payers.');
    set('scheduleB.line3', 0, [], 'No savings-bond exclusion claimed. Form 8815 is unsupported; mark special investment treatment if it applies.');
    set('scheduleB.line4', result.form1040.totalInterest, ['scheduleB.line2','scheduleB.line3'], 'Line 2 less line 3.');
    set('scheduleB.line6', result.form1040.totalDividends, dividends.map(p=>`dividends.${p.id}.ordinary`), 'Sum of ordinary dividends, including the qualified portion.');
    set('form1040.line2a', result.form1040.taxExemptInterest, interest.map(p=>`interest.${p.id}.exempt`), 'Tax-exempt interest; excluded from total income.');
    set('form1040.line2b', result.form1040.totalInterest, ['scheduleB.line4'], 'Taxable interest from Schedule B line 4.');
    set('form1040.line3a', result.form1040.qualifiedDividends, dividends.map(p=>`dividends.${p.id}.qualified`), 'Eligible qualified portion of the ordinary dividends; do not add to income again.');
    set('form1040.line3b', result.form1040.totalDividends, ['scheduleB.line6'], 'Ordinary dividends from Schedule B line 6.');
    set('scheduleD.line13', result.form1040.totalCapitalGainDistributions, dividends.map(p=>`dividends.${p.id}.capitalGain`), 'Sum of ordinary capital gain distributions from Form 1099-DIV box 2a.');
    traces.push(...result.traces || []);
    // Upstream ID line13 describes the deduction amount; map to actual 2025
    // line12e for this standard-deduction-only slice. The API's line11 is 11a/11b.
    const rename = (id: string) => id === 'form1040.line13' ? 'form1040.line12e' : id === 'form1040.line11' ? 'form1040.line11a' : id;
    const allowed = /^(sale\.|capitalSales\.|scheduleD\.|prior\.|next\.|form1040\.(line7a|line9|line11|line13$|line15$))/;
    for (const t of traces.filter(t => allowed.test(t.lineId))) set(rename(t.lineId), t.value, t.inputs.map(i=>rename(i.lineId)), t.formula || t.label);
    set('scope.noAdjustments', 0, [], 'Prototype assumption: no adjustments recorded. Schedule 1 is not implemented; recording an adjustment makes the return incomplete.');
    nodes.get('form1040.line11a')!.inputs = nodes.get('form1040.line11a')!.inputs.map(id=>id==='form1040.line10'?'scope.noAdjustments':id);
    // Display aliases within the explicitly constrained slice. No additional tax
    // rules: unsupported earned income/deductions block this path above.
    set('form1040.line1z', wages, ['form1040.line1a'], 'W-2 wages only; no other earned income recorded.');
    set('form1040.line11b', nodes.get('form1040.line11a')!.value, ['form1040.line11a'], 'Copy adjusted gross income from line 11a.');
    set('form1040.line14', nodes.get('form1040.line12e')!.value, ['form1040.line12e'], 'Base standard deduction only; no additional deductions recorded.');
    nodes.get('form1040.line9')!.inputs = nodes.get('form1040.line9')!.inputs.map(id=>id==='form1040.line1a'?'form1040.line1z':id);
    nodes.get('form1040.line15')!.inputs = ['form1040.line11b','form1040.line14'];
    // The standard deduction is produced by the engine; attach its true scope
    // dependency, whose age/dependent additions are expressly excluded in the UI.
    nodes.get('form1040.line12e')!.inputs = ['filingStatus'];
    if (result.scheduleD) {
      set('next.input.short', result.scheduleD.netShortTerm, ['scheduleD.line7'], 'From Schedule D line 7');
      set('next.input.long', result.scheduleD.netLongTerm, ['scheduleD.line15'], 'From Schedule D line 15');
      set('next.input.deduction', result.scheduleD.capitalLossDeduction, result.scheduleD.netGainOrLoss < 0 ? ['scheduleD.line21'] : ['scheduleD.line16'], 'Loss deduction as a positive amount; zero for a gain.');
    } else {
      for (const id of ['capitalSales.short','capitalSales.long','scheduleD.line6','scheduleD.line7','scheduleD.line14','scheduleD.line15','scheduleD.line16']) set(id,0,[],'No sales or prior-year losses entered.');
    }
    addIncomeTax(nodes,status);
    validateGraph(nodes);
    return { nodes, errors: [] };
  } catch (error) {
    return { nodes: new Map(), errors: [error instanceof Error ? error.message : 'Calculation could not be completed.'], errorSource: error instanceof InputError ? error.source : undefined };
  }
}
