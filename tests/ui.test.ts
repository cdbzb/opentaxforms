// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mountApp } from '../src/ui/main';
import { exampleDraft } from '../src/adapters/model';
import { encode, STORAGE_KEY } from '../src/storage/local';

let root: HTMLElement;
let app: ReturnType<typeof mountApp>;
function button(selector: string) { const found=root.querySelector<HTMLButtonElement>(selector);expect(found,selector).not.toBeNull();return found!; }
function click(selector: string) { button(selector).click(); }
function edit(key: string,value: string) {
  const el=root.querySelector<HTMLInputElement>(`[data-key="${key}"]`)!;
  el.value=value;el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));
}
async function importJSON(text: string) {
  const input=root.querySelector<HTMLInputElement>('#import-file')!;
  Object.defineProperty(input,'files',{value:[{size:text.length,text:async()=>text}]});
  input.dispatchEvent(new Event('change',{bubbles:true}));
  await new Promise(resolve=>setTimeout(resolve,0));
}
beforeEach(()=>{
  localStorage.clear();document.body.innerHTML='<div id="test-root"></div>';root=document.querySelector('#test-root')!;
  vi.spyOn(window,'confirm').mockReturnValue(true);
  vi.stubGlobal('fetch',vi.fn(()=>{throw new Error('Tax data must stay local');}));
});
afterEach(()=>{app?.destroy();vi.restoreAllMocks();vi.unstubAllGlobals();});
describe('forms interaction',()=>{
  it('preserves all numbered 2025 Form 1040 lines and never displays unimplemented totals as zero',()=>{
    app=mountApp(root);click('[data-action="example"]');
    // Independently transcribed sequence from the official 2025 Form 1040.
    const expected='1a 1b 1c 1d 1e 1f 1g 1h 1i 1z 2a 2b 3a 3b 3c 4a 4b 4c 5a 5b 5c 6a 6b 6c 6d 7a 7b 8 9 10 11a 11b 12a 12b 12c 12d 12e 13a 13b 14 15 16 17 18 19 20 21 22 23 24 25a 25b 25c 25d 26 27a 27b 27c 28 29 30 31 32 33 34 35a 35b 35c 35d 36 37 38'.split(' ');
    const actual=[...root.querySelectorAll('article [data-line]')].map(el=>el.getAttribute('data-line')!.replace('form1040.line','')).filter(line=>/^\d/.test(line));
    expect(actual).toEqual(expected);
    for(const line of ['16','24','33','35a','37']){
      const row=root.querySelector(`[data-line="form1040.line${line}"]`)!;
      expect(row.textContent).toContain('Not calculated');expect(row.textContent).not.toContain('$0.00');
    }
    const interest=root.querySelector('[data-line="form1040.line2b"]')!;
    expect(interest.textContent).toContain('Unsupported');
    click('[data-line="form1040.line2b"] .support-marker');
    expect(root.querySelector('.inspector')!.textContent).toContain('Schedule B');
    expect(root.querySelector('.inspector a')!.getAttribute('href')).toContain('irs.gov');
  });
  it('saves unsupported interest, marks every form incomplete, and restores supported results after clearing',async()=>{
    app=mountApp(root);click('[data-action="example"]');edit('unsupported:2b:amount','125');
    expect(root.querySelector('.incomplete-notice')!.textContent).toContain('Return incomplete');
    expect(root.querySelector('[data-line="form1040.line9"]')!.textContent).toContain('—');
    const exported=encode(app.getDraft());
    app.destroy();app=mountApp(root);
    expect(root.querySelector<HTMLInputElement>('[data-key="unsupported:2b:amount"]')!.value).toBe('125');
    click('[data-page="next"]');
    expect(root.querySelector('.incomplete-notice')!.textContent).toContain('Taxable interest');
    expect(root.querySelector('[data-line="next.8"]')!.textContent).toContain('—');
    click('.return-status [data-source]');expect(document.activeElement?.getAttribute('data-key')).toBe('unsupported:2b:amount');
    click('[data-clear-unsupported="2b"]');expect(root.querySelector('.incomplete-notice')).toBeNull();
    expect(root.querySelector('[data-line="form1040.line9"]')!.textContent).toContain('$52,000.00');
    await importJSON(exported);expect(root.querySelector('.incomplete-notice')!.textContent).toContain('125');
  });
  it('lets a user flag unsupported income without knowing the amount',()=>{
    app=mountApp(root);click('[data-action="example"]');
    click('[data-line="form1040.line8"] .support-marker');
    const flag=root.querySelector<HTMLInputElement>('[data-key="unsupported:8:applies"]')!;
    flag.checked=true;flag.dispatchEvent(new Event('change',{bubbles:true}));
    expect(app.getDraft().unsupported1040['8']).toEqual({applies:true,amount:''});
    expect(root.querySelector('.incomplete-notice')!.textContent).toContain('amount not entered');
    expect(root.querySelector('[data-line="form1040.line15"]')!.textContent).toContain('—');
  });
  it('uses two sheets and paired income fields while keeping support details out of the form rows',()=>{
    app=mountApp(root);click('[data-action="example"]');
    expect(root.querySelectorAll('.paper-sheet')).toHaveLength(2);
    const pairs=[...root.querySelectorAll('.paper-pair')].map(pair=>[...pair.querySelectorAll('[data-line]')].map(line=>line.getAttribute('data-line')));
    expect(pairs).toEqual(['2','3','4','5','6'].map(n=>[`form1040.line${n}a`,`form1040.line${n}b`]));
    expect(root.querySelectorAll('article .support-detail')).toHaveLength(0);
    expect(root.querySelector('article [data-key="unsupported:2b:applies"]')).toBeNull();
    const wage=root.querySelector<HTMLInputElement>('[data-key="wages"]')!;
    wage.focus();expect(document.activeElement).toBe(wage);
    expect(root.querySelector('.inspector h3')!.textContent).toContain('Wages');
    const interest=root.querySelector<HTMLInputElement>('[data-key="unsupported:2b:amount"]')!;
    interest.focus();expect(document.activeElement).toBe(interest);
    expect(root.querySelector('.inspector')!.textContent).toContain('Schedule B');
    expect(root.querySelector('.inspector [data-key="unsupported:2b:applies"]')).not.toBeNull();
    expect(root.querySelector('[data-line="form1040.line2b"]')!.classList.contains('selected')).toBe(true);
  });
  it('attaches a compact amount error to the paper field with the full accessible message',()=>{
    app=mountApp(root);click('[data-action="example"]');edit('wages','');
    const wage=root.querySelector<HTMLInputElement>('[data-key="wages"]')!;
    expect(wage.getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('[data-line="form1040.line1a"]')!.textContent).toContain('Needs attention');
    const description=document.getElementById(wage.getAttribute('aria-describedby')!)!;
    expect(description.textContent).toContain('This amount is blank');
    expect(document.activeElement).toBe(wage);
  });
  it('locates a blank sale input from the carryover worksheet instead of reporting excess decimals',()=>{
    app=mountApp(root);click('[data-page="prior"]');
    expect(root.querySelector('.return-status')!.textContent).toContain('Proceeds for sale 1 (Schedule D): This amount is blank');
    expect(root.querySelector('.return-status')!.textContent).not.toContain('decimal');
    click('.return-status [data-source]');
    expect(root.querySelector('article')!.getAttribute('aria-label')).toBe('Schedule D');
    expect(document.activeElement?.getAttribute('data-key')).toBe('sale:sale-1:proceeds');
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true');
    click('[data-remove="sale-1"]');
    expect(root.querySelector('.return-status')!.textContent).toContain('Supported lines are calculated');
  });
  it.each(['','1.234','1,234'])('locates and highlights the wages input for %j from another form',value=>{
    app=mountApp(root);click('[data-action="example"]');edit('wages',value);click('[data-page="prior"]');
    click('.return-status [data-source]');
    expect(document.activeElement?.getAttribute('data-key')).toBe('wages');
    expect(document.activeElement?.getAttribute('aria-invalid')).toBe('true');
    edit('wages','50000');expect(root.querySelector('[aria-invalid="true"]')).toBeNull();
  });
  it('takes a missing prior-year amount to its worksheet input',()=>{
    const d=exampleDraft();d.hasPriorLoss=true;d.prior={taxable:'20000',short:'-8000',long:'',deduction:'3000'};
    localStorage.setItem(STORAGE_KEY,encode(d));app=mountApp(root);
    expect(root.querySelector('.return-status')!.textContent).toContain('2024 Schedule D line 15 · gain or loss: This amount is blank');
    click('.return-status [data-source]');expect(document.activeElement?.getAttribute('data-key')).toBe('prior:long');
    edit('prior:long','0');expect(root.querySelector('.return-status')!.textContent).toContain('Supported lines are calculated');
  });
  it('takes a carryover validation error to the labeled source input and clears it after correction',()=>{
    const d=exampleDraft();d.hasPriorLoss=true;
    d.prior={taxable:'20000',short:'-8000',long:'0',deduction:'8000'};
    localStorage.setItem(STORAGE_KEY,encode(d));app=mountApp(root);
    expect(root.querySelector('.return-status')!.textContent).toContain('worksheet line 2');
    click('.return-status [data-source="prior.input.deduction"]');
    const input=root.querySelector<HTMLInputElement>('[data-key="prior:deduction"]')!;
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-label')).toBe('2024 capital loss deduction · Schedule D line 21');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(input.getAttribute('aria-describedby')!)!.textContent).toContain('2024 Schedule D, line 21');
    expect(root.querySelector('article')!.textContent).toContain('Inputs from your 2024 return');
    edit('prior:deduction','3000');
    expect(root.querySelector('[aria-invalid="true"]')).toBeNull();
    expect(root.querySelector('.return-status')!.textContent).toContain('Supported lines are calculated');
    expect(root.querySelector('[data-line="prior.2"]')!.textContent).toContain('$3,000.00');
  });
  it('edits a sale, follows 1040 → Schedule D → source inputs, and reloads locally',()=>{
    app=mountApp(root);click('[data-action="example"]');
    expect(root.querySelector('[data-line="form1040.line7a"]')!.textContent).toContain('$2,000.00');
    click('[data-source="scheduleD.line16"]');
    expect(root.querySelector('article')!.getAttribute('aria-label')).toBe('Schedule D');
    click('[data-source="scheduleD.line7"]');click('[data-source="capitalSales.short"]');click('[data-source="sale.example.gain"]');
    expect(root.querySelector('.inspector')!.textContent).toContain('Cost basis');
    edit('sale:example:proceeds','14000');
    click('[data-page="1040"]');
    expect(root.querySelector('[data-line="form1040.line7a"]')!.textContent).toContain('$4,000.00');
    app.destroy();app=mountApp(root);
    expect(app.getDraft().sales[0].proceeds).toBe('14000');
    expect(root.querySelector('[data-line="form1040.line15"]')!.textContent).toContain('$38,250.00');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('follows a carryover-only loss back to the prior-year worksheet',()=>{
    const d=exampleDraft();d.sales=[];d.wages='0';d.hasPriorLoss=true;
    d.prior={taxable:'20000',short:'-8000',long:'0',deduction:'3000'};
    localStorage.setItem(STORAGE_KEY,encode(d));app=mountApp(root);
    click('[data-source="scheduleD.line21"]');click('[data-source="scheduleD.line16"]');click('[data-source="scheduleD.line7"]');click('[data-source="scheduleD.line6"]');click('[data-source="prior.8"]');
    expect(root.querySelector('article')!.getAttribute('aria-label')).toBe('2024 → 2025 carryover');
    expect(root.querySelector('.inspect-value')!.textContent).toBe('$5,000.00');
    click('[data-page="next"]');expect(root.querySelector('[data-line="next.8"]')!.textContent).toContain('$5,000.00');
  });
  it('withdraws stale numbers while retaining unfinished drafts and input focus',()=>{
    app=mountApp(root);click('[data-action="example"]');edit('wages','');
    expect(root.querySelector('[data-line="form1040.line15"]')!.textContent).toContain('—');
    expect(document.activeElement?.getAttribute('data-key')).toBe('wages');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).wages).toBe('');
    edit('wages','60000');expect(root.querySelector('[data-line="form1040.line15"]')!.textContent).toContain('$46,250.00');
  });
  it('imports a valid file and leaves the active draft unchanged after an invalid import',async()=>{
    app=mountApp(root);await importJSON(encode(exampleDraft()));expect(app.getDraft()).toEqual(exampleDraft());
    await importJSON('{"taxYear":2026}');expect(app.getDraft()).toEqual(exampleDraft());
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('Import failed');
  });
  it('does not overwrite a corrupt saved file on normal edits',()=>{
    localStorage.setItem(STORAGE_KEY,'bad json');app=mountApp(root);edit('wages','50000');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('bad json');
    expect(root.querySelector('[role="alert"]')!.textContent).toContain('not been overwritten');
  });
  it('keeps calculations usable when saving fails',()=>{
    const storage={getItem:()=>null,setItem:()=>{throw new Error('quota');}} as unknown as Storage;
    app=mountApp(root,storage);click('[data-action="example"]');
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Not saved');
    expect(root.querySelector('[data-line="form1040.line15"]')!.textContent).toContain('$36,250.00');
  });
  it('escapes imported text and opens only fixed IRS links without a referrer',async()=>{
    const d=exampleDraft();d.sales[0].description='<img src=x onerror=alert(1)>';
    app=mountApp(root);await importJSON(encode(d));click('[data-page="scheduleD"]');
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector<HTMLInputElement>('[data-key="sale:example:description"]')!.value).toBe(d.sales[0].description);
    for(const a of root.querySelectorAll<HTMLAnchorElement>('a[href^="https://"]')){expect(a.hostname).toBe('www.irs.gov');expect(a.rel).toContain('noreferrer');}
  });
  it('requires confirmation before replacing a draft',()=>{
    app=mountApp(root);click('[data-action="example"]');vi.mocked(window.confirm).mockReturnValue(false);click('[data-action="new"]');expect(app.getDraft()).toEqual(exampleDraft());
  });
  it('exports only the local versioned draft and invokes print',()=>{
    vi.useFakeTimers();
    let exported: Blob|undefined;
    vi.stubGlobal('URL',Object.assign(class extends URL {},{createObjectURL:vi.fn((blob:Blob)=>{exported=blob;return 'blob:test';}),revokeObjectURL:vi.fn()}));
    vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
    const print=vi.spyOn(window,'print').mockImplementation(()=>{});
    app=mountApp(root);click('[data-action="example"]');click('[data-action="download"]');
    expect(exported?.type).toBe('application/json');expect(exported!.size).toBeGreaterThan(100);
    click('[data-action="print"]');expect(print).toHaveBeenCalledOnce();expect(fetch).not.toHaveBeenCalled();
    vi.runAllTimers();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test');vi.useRealTimers();
  });
});
