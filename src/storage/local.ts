import { validateShape, type Draft } from '../adapters/model';
export const STORAGE_KEY = 'opentaxforms.2025.v1';
export function encode(draft: Draft): string { return JSON.stringify(validateShape(draft), null, 2); }
export function decode(text: string): Draft {
  if (text.length > 200_000) throw new Error('Save file is too large.');
  return validateShape(JSON.parse(text));
}
export function load(storage: Pick<Storage,'getItem'>): Draft | null {
  const saved = storage.getItem(STORAGE_KEY); return saved ? decode(saved) : null;
}
export function save(storage: Pick<Storage,'setItem'>, draft: Draft): void { storage.setItem(STORAGE_KEY, encode(draft)); }
