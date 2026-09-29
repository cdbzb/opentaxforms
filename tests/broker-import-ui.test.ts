// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { mountApp } from '../src/ui/main';
import { csv, schwabRows, salesSection, sale, summaryHeader, box, footer } from './fixtures/schwab';
import { encode, STORAGE_KEY } from '../src/storage/local';

let root: HTMLElement, app: ReturnType<typeof mountApp>;
const click=(selector:string)=>{const el=root.querySelector<HTMLButtonElement>(selector);expect(el,selector).not.toBeNull();el!.click();};
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
async function openCSV(text=csv(schwabRows()),name='synthetic.csv') {
  click('[data-page="imports"]');
  const input=root.querySelector<HTMLInputElement>('#broker-file')!;
  Object.defineProperty(input,'files',{value:[{name,size:text.length,text:async()=>text}]});input.dispatchEvent(new Event('change',{bubbles:true}));
  await vi.waitFor(()=>expect(root.textContent).not.toContain('Reading CSV on this device'));
}
function review() {const box=root.querySelector<HTMLInputElement>('#broker-reviewed')!;box.checked=true;box.dispatchEvent(new Event('change',{bubbles:true}));}
beforeEach(()=>{
  localStorage.clear();document.body.innerHTML='<div id="test-root"></div>';root=document.querySelector('#test-root')!;
  vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('No tax-data network requests');}));
  vi.spyOn(window,'confirm').mockReturnValue(true);app=mountApp(root);click('[data-page="scheduleD"]');click('[data-remove="sale-1"]');
});
afterEach(()=>{app.destroy();vi.restoreAllMocks();vi.unstubAllGlobals();});

it('previews without writing, requires review, applies and traces saved sources after reload',async()=>{
  const before=encode(app.getDraft());await openCSV();expect(encode(app.getDraft())).toBe(before);
  expect(root.textContent).toContain('Preview only');expect(root.querySelector<HTMLButtonElement>('[data-action="apply-broker"]')!.disabled).toBe(true);
  review();click('[data-action="apply-broker"]');expect(root.querySelector('article')!.getAttribute('aria-label')).toBe('Schedule B');
  const d=app.getDraft();expect(d.brokerImports).toHaveLength(1);expect(d.investments.foreignAccount).toBe('unanswered');
  for(const key of ['foreignAccount','foreignTrust']){const input=root.querySelector<HTMLSelectElement>(`[data-key="scheduleB:${key}"]`)!;input.value='no';input.dispatchEvent(new Event('change',{bubbles:true}));}
  click('[data-page="1040"]');click('[data-explain="form1040.line2b"]');click('[data-source="scheduleB.line4"]');click('[data-explain="scheduleB.line4"]');click('[data-source="scheduleB.line2"]');
  click('[data-explain="scheduleB.line2"]');const id=d.investments.interest[0].id;click(`[data-source="interest.${id}.taxable"]`);
  expect(root.querySelector('.inspector')!.textContent).toContain('synthetic.csv');expect(root.querySelector('.inspector')!.textContent).toContain('Original imported amount: 58.01');
  const input=root.querySelector<HTMLInputElement>(`[data-key="interest:${id}:taxable"]`)!;input.value='99';input.dispatchEvent(new Event('input',{bubbles:true}));
  expect(root.querySelector('.inspector')!.textContent).toContain('Edited after import');
  app.destroy();app=mountApp(root);click('[data-page="imports"]');expect(root.textContent).toContain('synthetic.csv');expect(app.getDraft().brokerImports).toEqual(d.brokerImports);expect(fetch).not.toHaveBeenCalled();
});
it('blocks wrong-year, corrected, OID and sale files while preserving the draft',async()=>{
  const before=encode(app.getDraft());const rows=schwabRows('2024');rows[4][1]='Yes';rows.push(...salesSection());
  await openCSV(csv(rows));expect(root.textContent).toContain('working return is 2025');expect(root.textContent).toContain('Corrected statement');expect(root.textContent).toContain('1099-B sale');
  expect(root.querySelector<HTMLButtonElement>('[data-action="apply-broker"]')!.disabled).toBe(true);expect(encode(app.getDraft())).toBe(before);
  click('[data-action="discard-broker"]');expect(root.querySelector('[aria-label="Brokerage import preview"]')).toBeNull();
});
it('detects a renamed duplicate after a reload and removal of its payer records',async()=>{
  await openCSV();review();click('[data-action="apply-broker"]');const id=app.getDraft().investments.interest[0].id;click(`[data-remove-investment="interest:${id}"]`);
  app.destroy();app=mountApp(root);const before=encode(app.getDraft());await openCSV(csv(schwabRows()),'renamed.csv');
  expect(root.textContent).toContain('already been imported');expect(root.querySelector<HTMLButtonElement>('[data-action="apply-broker"]')!.disabled).toBe(true);expect(encode(app.getDraft())).toBe(before);
});
it('escapes file names and arbitrary CSV descriptions and displays every sale column',async()=>{
  const rows=schwabRows();rows[6][1]='<img src=x onerror=alert(1)>';const trade=sale();trade[0]='<script>evil()</script>';trade[21]='Synthetic state identifier';rows.push(...salesSection([trade]));
  await openCSV(csv(rows),'<img src=x>.csv');expect(root.querySelector('script,img')).toBeNull();
  expect(root.textContent).toContain('<script>evil()</script>');expect(root.textContent).toContain('Synthetic state identifier');expect(root.textContent).not.toContain('SYNTHETIC-ACCOUNT');
});
it('clears a previous valid preview when another file fails validation',async()=>{
  await openCSV();await openCSV('"unterminated');expect(root.textContent).toContain('CSV review failed');expect(root.querySelector('[data-action="apply-broker"]')).toBeNull();
});
it('discards pending reads when starting a new draft',async()=>{
  click('[data-page="imports"]');let resolve!:(value:string)=>void;const text=new Promise<string>(done=>{resolve=done;});
  const input=root.querySelector<HTMLInputElement>('#broker-file')!;Object.defineProperty(input,'files',{value:[{name:'slow.csv',size:10,text:()=>text}]});input.dispatchEvent(new Event('change',{bubbles:true}));
  click('[data-action="new"]');resolve(csv(schwabRows()));await settle();expect(root.textContent).not.toContain('slow.csv');expect(app.getDraft().brokerImports).toEqual([]);
});

it('protects an unreadable existing browser draft when a CSV is reviewed',async()=>{
  app.destroy();localStorage.setItem(STORAGE_KEY,'corrupt original');app=mountApp(root);
  await openCSV();review();click('[data-action="apply-broker"]');
  expect(localStorage.getItem(STORAGE_KEY)).toBe('corrupt original');expect(app.getDraft().brokerImports).toEqual([]);
  expect(root.textContent).toContain('existing browser draft could not be read');
});

it('summarizes hundreds of sales with collapsible record ranges and isolates MISC in the preview',async()=>{
  const rows=schwabRows();rows.push(['Form 1099MISC',''],summaryHeader,box('2','Royalties','25'),footer());
  const start=rows.length+4;rows.push(...salesSection(Array.from({length:492},()=>sale())));
  const before=encode(app.getDraft());await openCSV(csv(rows));
  const repeated=root.querySelector<HTMLDetailsElement>('.import-issues details')!;
  expect(repeated.open).toBe(false);expect(repeated.querySelector('summary')!.textContent).toContain('492 records');
  expect(repeated.querySelector('p')!.textContent).toBe(`CSV records: ${start}–${start+491}`);
  expect(root.querySelector('.import-issues')!.textContent).not.toContain('Duplicate box');
  const misc=[...root.querySelectorAll('.import-section')].find(s=>s.querySelector('summary')!.textContent!.startsWith('1099MISC'))!;
  expect(misc.textContent).toContain('Royalties');expect(misc.textContent).toContain('25');
  expect(root.querySelector<HTMLButtonElement>('[data-action="apply-broker"]')!.disabled).toBe(true);expect(encode(app.getDraft())).toBe(before);
});
