import { unsupportedField } from '../forms/form1040';
export const ENGINE = 'telostax-989fa6e6b7e4-opentaxforms-1';
export const filingStatuses = { single: 'Single', mfj: 'Married filing jointly', mfs: 'Married filing separately', hoh: 'Head of household', qss: 'Qualifying surviving spouse' } as const;
export type Status = keyof typeof filingStatuses;
export class InputError extends Error {
  constructor(message: string, readonly source: string) { super(message); }
}
export const priorLabels = {
  taxable: '2024 taxable income before the zero floor',
  deduction: '2024 capital loss deduction · Schedule D line 21',
  short: '2024 Schedule D line 7 · gain or loss',
  long: '2024 Schedule D line 15 · gain or loss',
};
export function fieldMoney(text: string, source: string, label: string, signed = false): number {
  try {
    if (text.length > 30) throw new Error('Amount is too long.');
    return money(text, signed);
  } catch (error) {
    throw new InputError(`${label}: ${error instanceof Error ? error.message : 'Invalid amount.'}`, source);
  }
}
export interface Sale { id: string; description: string; term: 'short' | 'long'; proceeds: string; basis: string }
export interface Draft {
  schemaVersion: 1; taxYear: 2025; engine: typeof ENGINE;
  filingStatus: Status; wages: string; sales: Sale[];
  hasPriorLoss: boolean;
  prior: { taxable: string; short: string; long: string; deduction: string };
  unsupported1040: Record<string, { applies: boolean; amount: string }>;
}
export function emptyDraft(): Draft {
  return { schemaVersion: 1, taxYear: 2025, engine: ENGINE, filingStatus: 'single', wages: '0',
    sales: [{ id: 'sale-1', description: 'Stock sale', term: 'short', proceeds: '', basis: '' }],
    hasPriorLoss: false, prior: { taxable: '', short: '', long: '', deduction: '' }, unsupported1040: {} };
}
export function exampleDraft(): Draft {
  const draft = emptyDraft();
  draft.wages = '50000';
  draft.sales[0] = { id: 'example', description: 'Example stock sale', term: 'short', proceeds: '12000', basis: '10000' };
  return draft;
}
// Parse decimal strings as integer cents first: reject coercion, NaN and overflow.
export function money(text: string, signed = false): number {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('This amount is blank. Enter an amount, or 0 if none.');
  if (/[,$]/.test(trimmed)) throw new Error('Use digits without commas or dollar signs, for example 1234.56.');
  if (!signed && trimmed.startsWith('-')) throw new Error('Enter zero or a positive amount.');
  if (/^-?\d+\.\d{3,}$/.test(trimmed)) throw new Error('Use at most two decimal places.');
  const pattern = signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/;
  if (!pattern.test(trimmed)) throw new Error('Enter a number, for example 1234.56.');
  const cents = Math.round(Number(text) * 100);
  if (!Number.isSafeInteger(cents) || Math.abs(cents) > 100_000_000_00) throw new Error('Amount exceeds the $100 million prototype limit.');
  return cents / 100;
}
export function validateShape(data: unknown): Draft {
  if (!data || typeof data !== 'object') throw new Error('This is not an OpenTaxForms save file.');
  const d = data as Record<string, unknown>;
  const knownKeys = (object: object, keys: string[]) => {
    if (Object.keys(object).some(key => !keys.includes(key))) throw new Error('Save file contains unsupported fields.');
  };
  knownKeys(d, ['schemaVersion','taxYear','engine','filingStatus','wages','sales','hasPriorLoss','prior','unsupported1040']);
  if (d.schemaVersion !== 1 || d.taxYear !== 2025 || d.engine !== ENGINE) throw new Error('Unsupported save version, engine revision, or tax year.');
  if (typeof d.filingStatus !== 'string' || !Object.hasOwn(filingStatuses, d.filingStatus) || typeof d.wages !== 'string' || typeof d.hasPriorLoss !== 'boolean') throw new Error('Invalid return fields.');
  if (!Array.isArray(d.sales) || d.sales.length > 100 || !d.prior || typeof d.prior !== 'object') throw new Error('Invalid sales or prior-year worksheet.');
  const prior = d.prior as Record<string, unknown>;
  knownKeys(prior, ['taxable','short','long','deduction']);
  for (const key of ['taxable', 'short', 'long', 'deduction']) if (typeof prior[key] !== 'string') throw new Error('Invalid prior-year amount.');
  const ids = new Set<string>();
  const sales = d.sales.map((value: unknown) => {
    if (!value || typeof value !== 'object') throw new Error('Invalid stock sale.');
    const s = value as Record<string, unknown>;
    knownKeys(s, ['id','description','term','proceeds','basis']);
    if (typeof s.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(s.id) || ids.has(s.id)) throw new Error('Invalid or duplicate sale ID.');
    ids.add(s.id);
    if (typeof s.description !== 'string' || s.description.length > 100 || !['short','long'].includes(String(s.term)) || typeof s.proceeds !== 'string' || typeof s.basis !== 'string') throw new Error('Invalid sale fields.');
    return { id: s.id, description: s.description, term: s.term as Sale['term'], proceeds: s.proceeds, basis: s.basis };
  });
  // Preserve blanks for an unfinished draft, but reject malformed supplied amounts.
  const amount = (s: string, source: string, label: string, signed = false) => { if (s.trim() !== '' || s.length > 30) fieldMoney(s, source, label, signed); return s; };
  // Additive v1 extension: existing saved drafts have no unsupported-entry map.
  const unsupported = d.unsupported1040 === undefined ? {} : d.unsupported1040;
  if (!unsupported || typeof unsupported !== 'object' || Array.isArray(unsupported)) throw new Error('Invalid unsupported Form 1040 entries.');
  const unsupported1040: Draft['unsupported1040'] = {};
  for (const [id,value] of Object.entries(unsupported)) {
    const field = unsupportedField(id);
    if (!field || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Unknown or invalid unsupported Form 1040 entry.');
    knownKeys(value, ['applies','amount']);
    const entry = value as Record<string,unknown>;
    if (typeof entry.applies !== 'boolean' || typeof entry.amount !== 'string' || entry.amount.length > 30) throw new Error('Invalid unsupported Form 1040 entry.');
    if (field.support === 'flag' && entry.amount !== '') throw new Error('This Form 1040 checkbox cannot contain an amount.');
    // These are explicitly unverified notes. Preserve unfinished text without
    // interpreting it or letting it enter the engine; any nonblank value blocks.
    unsupported1040[id] = { applies: entry.applies, amount: entry.amount };
  }
  return { schemaVersion: 1, taxYear: 2025, engine: ENGINE, filingStatus: d.filingStatus as Status,
    unsupported1040,
    wages: amount(d.wages, 'form1040.line1a', 'W-2 wages · line 1a'), hasPriorLoss: d.hasPriorLoss,
    sales: sales.map((s,i) => ({ ...s, proceeds: amount(s.proceeds, `sale.${s.id}.proceeds`, `Proceeds for sale ${i+1} (Schedule D)`), basis: amount(s.basis, `sale.${s.id}.basis`, `Cost basis for sale ${i+1} (Schedule D)`) })),
    prior: {
      taxable: amount(prior.taxable as string, 'prior.input.taxable', priorLabels.taxable, true),
      short: amount(prior.short as string, 'prior.input.short', priorLabels.short, true),
      long: amount(prior.long as string, 'prior.input.long', priorLabels.long, true),
      deduction: amount(prior.deduction as string, 'prior.input.deduction', priorLabels.deduction),
    } };
}
