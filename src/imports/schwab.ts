import { money, validateShape, type Draft } from '../adapters/model';
import type { ImportReceipt } from './receipts';

export const MAX_CSV_BYTES = 1_000_000;
export interface CsvRecord { row: number; cells: string[] }
export interface ImportIssue { row: number; message: string }
export interface SummaryBox { row: number; box: string; description: string; amount: string; total: string; details: string }
export interface ImportSection { form: string; row: number; corrected: boolean; boxes: SummaryBox[]; headers: string[]; records: CsvRecord[] }
export interface Mapping { kind: 'interest'|'dividends'; key: string; value: string; form: string; boxes: string[]; rows: number[] }
export interface SchwabPreview { year: number; sections: ImportSection[]; issues: ImportIssue[]; mappings: Mapping[]; canonical: string }

// A bounded RFC 4180 reader, including escaped quotes and multiline fields.
// Row references are CSV record numbers, not physical text line numbers.
export function readCsv(text: string): CsvRecord[] {
  if (text.length > MAX_CSV_BYTES) throw new Error('CSV exceeds the 1 MB limit.');
  text = text.replace(/^\uFEFF/, '');
  const result: CsvRecord[] = []; let cells: string[] = [], value = '', quoted = false, closed = false;
  const cell = () => { if (value.length > 2000) throw new Error('CSV cell is too long.'); cells.push(value.trim()); value=''; closed=false; };
  const row = () => { cell(); if(cells.length>40 || result.length>=5000)throw new Error('CSV has too many columns or records.'); result.push({row:result.length+1,cells});cells=[]; };
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) { if(c==='"') { if(text[i+1]==='"'){value+='"';i++;}else{quoted=false;closed=true;} }else value+=c; continue; }
    if(c===','){cell();continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&text[i+1]==='\n')i++;row();continue;}
    if(c==='"'){if(value || closed)throw new Error(`Invalid quoting at CSV record ${result.length+1}.`);quoted=true;continue;}
    if(closed)throw new Error(`Unexpected text after a quote at CSV record ${result.length+1}.`);
    value+=c;
  }
  if(quoted)throw new Error('CSV ends inside a quoted field.');
  if(value || cells.length || closed)row();
  if(!result.length)throw new Error('CSV is empty.');
  return result;
}

function decimal(value: string): string {
  if(!value)return '0.00';
  // Accept the currency and grouping used by Schwab, never permissive coercion.
  if(!/^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))throw new Error('Invalid dollar amount; expected a nonnegative amount with at most two decimals.');
  return money(value.replace(/[$,]/g,'')).toFixed(2);
}
function boxAmount(box: SummaryBox): string {
  if(box.amount && box.total)throw new Error('Both Amount and Total are populated; the value is ambiguous.');
  if(box.details)throw new Error('Unexpected Details alongside a monetary box.');
  return decimal(box.amount || box.total);
}
const required: Record<string,string[]> = { '1099DIV':['1a','1b','2a'], '1099INT':['1','3','8'] };
const knownBoxes: Record<string,string[]> = {
  '1099DIV':['1a','1b','2a','2b','2c','2d','2e','2f',...Array.from({length:14},(_,i)=>String(i+3)),''],
  '1099INT':[...Array.from({length:17},(_,i)=>String(i+1)),''],
  '1099OID':[...Array.from({length:14},(_,i)=>String(i+1)),''],
};

export function parseSchwab(text: string): SchwabPreview {
  const records=readCsv(text);
  const result: SchwabPreview={year:0,sections:[],issues:[],mappings:[],canonical:JSON.stringify(records.map(r=>r.cells))};
  const issue=(row:number,message:string)=>result.issues.push({row,message});
  let section: ImportSection|undefined; let account=false, year=false, summaryHeader=false, saleHeaders=0, correctionSeen=false;
  for(const record of records) {
    const c=record.cells; if(c.every(v=>!v))continue;
    if(c[0]==='Account' && !section && !account && c.length===2 && c[1]){account=true;continue;}
    if(c[0]==='Tax Year' && !section && !year && c.length===2 && /^20\d{2}$/.test(c[1])){result.year=Number(c[1]);year=true;continue;}
    if(/^Form 1099\s*(DIV|INT|OID|B)$/.test(c[0]) && c.slice(1).every(v=>!v)) {
      section={form:c[0].replace(/^Form /,'').replace(/\s/g,''),row:record.row,corrected:false,boxes:[],headers:[],records:[]};
      result.sections.push(section);summaryHeader=false;saleHeaders=0;correctionSeen=false;continue;
    }
    if(!section){issue(record.row,'Unrecognized metadata or missing form section.');continue;}
    if(c[0]==='Corrected' && !summaryHeader && !saleHeaders && !correctionSeen && ['Yes','No'].includes(c[1]) && c.slice(2).every(v=>!v)) {
      correctionSeen=true;section.corrected=c[1]==='Yes';if(section.corrected)issue(record.row,'Corrected statement: replacement reconciliation is required; appending would risk double counting.');continue;
    }
    if(section.form==='1099B') {
      if(saleHeaders===0 && c[0]==='1a' && c[1]==='1b' && c[2]==='1c' && c.length===24){saleHeaders++;continue;}
      if(saleHeaders===1 && c.length===24 && c[0].startsWith('Description of property') && c[1]==='Date acquired' && c[3]==='Proceeds' && c[4]==='Cost or other basis' && c[6]==='Wash sale loss disallowed') {
        section.headers=c;saleHeaders++;continue;
      }
      section.records.push(record);
      issue(record.row,'1099-B sale: importing sales requires Form 8949 and security-treatment review, which are not implemented yet.');
      if(saleHeaders!==2 || c.length!==24)issue(record.row,'Unrecognized 1099-B columns.');
      if(c[11]==='Uncovered' || c[18]==='No')issue(record.row,'Basis is not reported to the IRS; review coverage and cost basis.');
      try {if(decimal(c[6]||'')!=='0.00')issue(record.row,'Wash-sale loss adjustment requires additional support.');}catch{issue(record.row,'Invalid wash-sale amount.');}
      if(c[4] && /^\$?0(?:\.0{1,2})?$/.test(c[4]))issue(record.row,'Stated basis is zero; verify it against your records.');
      continue;
    }
    if(!summaryHeader && c.length===6 && c.slice(0,5).join('|')==='Box|Description|Amount|Total|Details' && !c[5]){summaryHeader=true;continue;}
    if(!summaryHeader || c.length!==6 || c[5]){section.records.push(record);issue(record.row,'Unrecognized summary columns or extra data.');continue;}
    const box: SummaryBox={row:record.row,box:c[0],description:c[1],amount:c[2],total:c[3],details:c[4]};
    if(section.boxes.some(b=>b.box===box.box))issue(record.row,'Duplicate box in this form.');
    section.boxes.push(box);
    if(!knownBoxes[section.form]?.includes(box.box) || (!box.box && box.description!=='FATCA filing requirement')){issue(record.row,'Unknown tax box; review is required.');continue;}
    if(required[section.form]?.includes(box.box)) {
      try {boxAmount(box);}catch(e){issue(record.row,(e as Error).message);}
    }else {
      const values=[box.amount,box.total,box.details].filter(Boolean);
      const inactive=values.every(v=>/^\$?0(?:\.0{1,2})?$/.test(v)) || (!box.box && values.length===1 && values[0]==='No');
      if(!inactive)issue(record.row,`${section.form} box ${box.box || 'FATCA'} (${box.description}): not supported; this item cannot be omitted from the import.`);
    }
  }
  if(!account)issue(1,'Missing Account metadata; this is not a recognized Schwab tax CSV.');
  if(!year)issue(1,'Missing or invalid tax year.');
  else if(result.year!==2025)issue(2,`This file is for ${result.year}. The working return is 2025; review only.`);
  if(!result.sections.length)issue(1,'No recognized tax forms found.');
  for(const form of ['1099DIV','1099INT']) {
    const sections=result.sections.filter(s=>s.form===form);
    if(sections.length>1)issue(sections[1].row,`Multiple ${form} sections are ambiguous and require review.`);
    for(const s of sections) {
      for(const box of required[form])if(!s.boxes.some(b=>b.box===box))issue(s.row,`Missing ${form} box ${box}; no amount will be assumed.`);
      const add=(key:string,boxes:string[])=>{
        const source=boxes.map(b=>s.boxes.find(v=>v.box===b));if(source.some(v=>!v))return;
        try {
          const value=(source.reduce((sum,b)=>sum+Math.round(Number(boxAmount(b!))*100),0)/100).toFixed(2);
          money(value);
          result.mappings.push({kind:form==='1099INT'?'interest':'dividends',key,value,form,boxes,rows:source.map(b=>b!.row)});
        }catch(e){issue(s.row,`${form} ${key}: ${(e as Error).message}`);}
      };
      if(form==='1099INT'){add('taxable',['1','3']);add('exempt',['8']);}
      else {add('ordinary',['1a']);add('qualified',['1b']);add('capitalGain',['2a']);}
    }
  }
  const ordinary=result.mappings.find(m=>m.key==='ordinary'), qualified=result.mappings.find(m=>m.key==='qualified');
  for(const s of result.sections) {
    if(s.form==='1099B' && !s.headers.length)issue(s.row,'Missing recognized 1099-B headers.');
    if(s.form!=='1099B' && !s.boxes.some(b=>b.box==='' && b.description==='FATCA filing requirement'))issue(s.row,'Incomplete summary section: missing FATCA footer.');
  }
  if(ordinary && qualified && Number(qualified.value)>Number(ordinary.value))issue(qualified.rows[0],'Qualified dividends exceed ordinary dividends.');
  if(!result.mappings.length)issue(1,'No supported interest or dividend records to apply.');
  return result;
}

export async function fingerprint(preview: SchwabPreview): Promise<string> {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(preview.canonical));
  return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
}

export function applySchwab(draft: Draft, preview: SchwabPreview, digest: string, file: string, reviewed: boolean): Draft {
  if(!reviewed)throw new Error('Review the file and confirm eligibility and duplicate checks first.');
  if(preview.issues.length || preview.year!==2025)throw new Error('Resolve the file limitations before applying. No records were added.');
  const next=validateShape(structuredClone(draft));
  if(next.brokerImports.some(r=>r.digest===digest))throw new Error('This file has already been imported, even if its payer records were later edited or removed.');
  const receipt: ImportReceipt={file,digest,year:2025,fields:[]};
  for(const kind of ['interest','dividends'] as const) {
    const mappings=preview.mappings.filter(m=>m.kind===kind);if(!mappings.length)continue;
    const id=crypto.randomUUID();
    const values=Object.fromEntries(mappings.map(m=>[m.key,m.value]));
    if(kind==='interest')next.investments.interest.push({id,payer:'Charles Schwab',taxable:values.taxable,exempt:values.exempt});
    else next.investments.dividends.push({id,payer:'Charles Schwab',ordinary:values.ordinary,qualified:values.qualified,capitalGain:values.capitalGain});
    for(const m of mappings)receipt.fields.push({target:`${kind}.${id}.${m.key}`,value:m.value,form:m.form,boxes:m.boxes,rows:m.rows});
  }
  next.brokerImports.push(receipt);
  return validateShape(next);
}
