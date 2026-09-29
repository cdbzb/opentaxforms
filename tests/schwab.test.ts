import { describe, expect, it } from 'vitest';
import { parseSchwab, readCsv, fingerprint, applySchwab } from '../src/imports/schwab';
import { emptyDraft, validateShape } from '../src/adapters/model';
import { calculate } from '../src/adapters/calculate';
import { encode, decode } from '../src/storage/local';
import { csv, schwabRows, box, footer, summaryHeader, salesSection, sale } from './fixtures/schwab';

const preview=()=>parseSchwab(csv(schwabRows()));
const digest='a'.repeat(64);
describe('Schwab local import',()=>{
  it('reads BOM, CRLF, escaped quotes, commas and multiline fields with record numbers',()=>{
    expect(readCsv('\uFEFF'+csv([['first','a,b'],['next','two\nlines and "quotes"']]))).toEqual([{row:1,cells:['first','a,b']},{row:2,cells:['next','two\nlines and "quotes"']}]);
  });
  it.each(['"unfinished','a"b,c','"a"oops,b','"a""',''])('rejects malformed CSV %j',text=>expect(()=>readCsv(text)).toThrow());
  it('bounds files, records, columns and cells',()=>{
    for(const text of ['a'.repeat(1000001),'x\n'.repeat(5001),','.repeat(41),'x'.repeat(2001)])expect(()=>readCsv(text)).toThrow();
  });
  it('recognizes Amount versus Total without double counting qualified dividends',()=>{
    const p=preview();expect(p.issues).toEqual([]);
    expect(Object.fromEntries(p.mappings.map(m=>[m.key,m.value]))).toEqual({ordinary:'1200.50',qualified:'800.25',capitalGain:'200.00',taxable:'58.01',exempt:'8.90'});
    expect(p.mappings.find(m=>m.key==='taxable')!.boxes).toEqual(['1','3']);
    expect(p.sections).toHaveLength(2);
  });
  it('maps through the actual calculation and preserves source receipts through save/load and edits',()=>{
    const original=emptyDraft();original.sales=[];original.investments.foreignAccount='no';original.investments.foreignTrust='no';
    const imported=applySchwab(original,preview(),digest,'synthetic.csv',true);
    expect(original.investments.interest).toEqual([]);
    const result=calculate(imported);expect(result.errors).toEqual([]);
    for(const [id,value] of Object.entries({'form1040.line2a':8.9,'form1040.line2b':58.01,'form1040.line3a':800.25,'form1040.line3b':1200.5,'scheduleD.line13':200,'form1040.line9':1458.51}))expect(result.nodes.get(id)!.value).toBeCloseTo(value,2);
    expect(decode(encode(imported))).toEqual(imported);
    imported.investments.interest[0].taxable='99';
    expect(imported.brokerImports[0].fields.find(f=>f.target.endsWith('.taxable'))!.value).toBe('58.01');
    expect(encode(imported)).not.toContain('SYNTHETIC-ACCOUNT');
  });
  it('appends and leaves foreign-account/trust questions unanswered',()=>{
    const d=emptyDraft();d.sales=[];d.investments.interest.push({id:'manual',payer:'Other bank',taxable:'1',exempt:'0'});
    const out=applySchwab(d,preview(),digest,'synthetic.csv',true);
    expect(out.investments.interest).toHaveLength(2);expect(out.investments.interest[0]).toEqual(d.investments.interest[0]);
    expect(calculate(out).errorSource).toBe('scheduleB.foreignAccount');
  });
  it('recognizes canonical duplicates across BOM, newline style and filenames',async()=>{
    const text=csv(schwabRows());const a=await fingerprint(parseSchwab(text));const b=await fingerprint(parseSchwab('\uFEFF'+text.replaceAll('\r\n','\n')+'\n'));
    expect(a).toBe(b);expect(a).toMatch(/^[a-f0-9]{64}$/);
    const d=applySchwab(emptyDraft(),preview(),a,'first.csv',true);d.investments.interest=[];d.investments.dividends=[];
    expect(()=>applySchwab(decode(encode(d)),preview(),b,'renamed.csv',true)).toThrow(/already/);
  });
  it('requires explicit review and preserves the draft on failure',()=>{
    const d=emptyDraft(),before=encode(d);
    expect(()=>applySchwab(d,preview(),digest,'synthetic.csv',false)).toThrow(/Review/);expect(encode(d)).toBe(before);
  });
  it('reviews 2024 data without applying it to 2025 or deriving a carryover',()=>{
    const p=parseSchwab(csv(schwabRows('2024')));expect(p.year).toBe(2024);expect(p.sections).toHaveLength(2);
    expect(p.issues.some(i=>i.message.includes('working return is 2025'))).toBe(true);
    expect(()=>applySchwab(emptyDraft(),p,digest,'prior.csv',true)).toThrow();
  });
  it('blocks corrections and duplicated summary forms',()=>{
    const rows=schwabRows();rows[4][1]='Yes';rows.push(...schwabRows().slice(3));const p=parseSchwab(csv(rows));
    expect(p.issues.some(i=>i.message.includes('Corrected'))).toBe(true);expect(p.issues.some(i=>i.message.includes('Multiple'))).toBe(true);
  });
  it.each(['1.234','NaN','1e3','-1','(20)','$1,2','1,00.00'])('rejects malformed monetary values %s',v=>{
    const rows=schwabRows();rows[6][3]=v;expect(parseSchwab(csv(rows)).issues.length).toBeGreaterThan(0);
  });
  it('blocks ambiguous amounts, unexpected details, duplicate boxes and missing required boxes',()=>{
    for(const mutate of [(r:string[][])=>{r[6][2]='1200.50';},(r:string[][])=>{r[6][4]='extra';},(r:string[][])=>{r.push(box('1','Duplicated','1'));},(r:string[][])=>{r.splice(7,1);}]){
      const rows=schwabRows();mutate(rows);expect(parseSchwab(csv(rows)).issues.length).toBeGreaterThan(0);
    }
  });
  it('blocks unknown data even when its amount is zero and prevents truncated summaries',()=>{
    for(const extra of [box('99','New box','0.00'),['Unknown section','','','','',''],['Box','Description','Amount','Total','Details','Extra']]){
      const rows=schwabRows();rows.push(extra);expect(parseSchwab(csv(rows)).issues.length).toBeGreaterThan(0);
    }
    const rows=schwabRows();rows.pop();expect(parseSchwab(csv(rows)).issues.some(i=>i.message.includes('Incomplete'))).toBe(true);
  });
  it('blocks every unsupported nonzero summary box, including withholding and foreign tax',()=>{
    for(const form of ['1099DIV','1099INT']) {
      const rows=schwabRows();const start=rows.findIndex(r=>r[0]==='Form '+form);
      const end=rows.findIndex((r,i)=>i>start && r[1]==='FATCA filing requirement');
      const allowed=form==='1099DIV'?['1a','1b','2a']:['1','3','8'];
      for(let i=start+1;i<end;i++)if(/^\d/.test(rows[i][0])&&!allowed.includes(rows[i][0])) {
        const altered=structuredClone(rows);altered[i][3]='1.00';expect(parseSchwab(csv(altered)).issues.some(issue=>issue.row===i+1)).toBe(true);
      }
    }
  });
  it('retains repeated OID sections and every sales column while blocking the full import',()=>{
    const rows=schwabRows();for(let i=0;i<2;i++)rows.push([],['Form 1099OID',''],summaryHeader,box('8','Treasury OID','12.00'),footer());
    const trade=sale();trade[4]='0.00';trade[6]='$2.00';trade[11]='Uncovered';trade[18]='No';
    rows.push(...salesSection([trade]));const p=parseSchwab(csv(rows));
    expect(p.sections.filter(s=>s.form==='1099OID')).toHaveLength(2);
    expect(p.sections.at(-1)!.records[0].cells).toEqual(trade);
    for(const term of ['OID','1099-B','Wash-sale','Basis is not','basis is zero'])expect(p.issues.some(i=>i.message.includes(term))).toBe(true);
    expect(()=>applySchwab(emptyDraft(),p,digest,'complex.csv',true)).toThrow();
  });
  it('blocks qualified dividends larger than ordinary dividends and combined interest overflow',()=>{
    const rows=schwabRows();rows[7][2]='9999';expect(parseSchwab(csv(rows)).issues.some(i=>i.message.includes('exceed'))).toBe(true);
    const overflow=schwabRows();const idx=overflow.findIndex(r=>r[0]==='Form 1099INT');overflow[idx+2][3]='100000000';overflow[idx+4][3]='1';
    expect(parseSchwab(csv(overflow)).issues.some(i=>i.message.includes('limit'))).toBe(true);
  });
  it('rejects application atomically when a payer limit is reached',()=>{
    const d=emptyDraft();d.investments.interest=Array.from({length:100},(_,i)=>({id:'payer-'+i,payer:'Bank',taxable:'0',exempt:'0'}));const before=encode(d);
    expect(()=>applySchwab(d,preview(),digest,'synthetic.csv',true)).toThrow();expect(encode(d)).toBe(before);
  });
  it('migrates old saves and rejects malformed or duplicate provenance',()=>{
    const old={...emptyDraft()} as Record<string,unknown>;delete old.brokerImports;expect(validateShape(old).brokerImports).toEqual([]);
    const d=applySchwab(emptyDraft(),preview(),digest,'synthetic.csv',true);
    for(const mutate of [(v:any)=>{v.brokerImports[0].year=2024;},(v:any)=>{v.brokerImports[0].fields[0].rows=[-1];},(v:any)=>{v.brokerImports[0].fields[0].target='<script>';},(v:any)=>{v.brokerImports.push(v.brokerImports[0]);},(v:any)=>{v.brokerImports[0].extra='unknown';}]){
      const altered=structuredClone(d);mutate(altered);expect(()=>decode(JSON.stringify(altered))).toThrow();
    }
  });
});
