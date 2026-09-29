const required: Record<string,string[]> = { '1099DIV':['1a','1b','2a'], '1099INT':['1','3','8'] };
export interface ImportField { target: string; value: string; form: string; boxes: string[]; rows: number[] }
export interface ImportReceipt { file: string; digest: string; year: 2025; fields: ImportField[] }
export function validateReceipts(value: unknown, validateAmount: (value: string) => number): ImportReceipt[] {
  if(value===undefined)return [];
  if(!Array.isArray(value) || value.length>20)throw new Error('At most 20 brokerage imports can be saved.');
  const digests=new Set<string>(),targets=new Set<string>();
  const object=(v:unknown,keys:string[])=>{
    if(!v || typeof v!=='object' || Array.isArray(v) || Object.keys(v).some(k=>!keys.includes(k)))throw new Error('Invalid brokerage source record.');
    return v as Record<string,unknown>;
  };
  return value.map(v=>{
    const r=object(v,['file','digest','year','fields']);
    if(typeof r.file!=='string'||!r.file||r.file.length>255 || typeof r.digest!=='string'||!/^[a-f0-9]{64}$/.test(r.digest)||digests.has(r.digest)||r.year!==2025||!Array.isArray(r.fields)||r.fields.length<1||r.fields.length>5)throw new Error('Invalid or duplicate brokerage import receipt.');
    digests.add(r.digest);
    const fields=r.fields.map(v=>{
      const f=object(v,['target','value','form','boxes','rows']);
      if(typeof f.target!=='string'||!/^(interest\.[a-zA-Z0-9-]{1,80}\.(taxable|exempt)|dividends\.[a-zA-Z0-9-]{1,80}\.(ordinary|qualified|capitalGain))$/.test(f.target)||targets.has(f.target)||typeof f.value!=='string'||f.value.length>30||!['1099INT','1099DIV'].includes(String(f.form))||typeof f.form!=='string'||!Array.isArray(f.boxes)||!Array.isArray(f.rows)||!f.rows.length||f.rows.length>2||f.boxes.length!==f.rows.length||f.boxes.some(b=>typeof b!=='string'||!required[f.form as string].includes(b))||f.rows.some(n=>!Number.isInteger(n)||n<1||n>5000))throw new Error('Invalid brokerage field source.');
      validateAmount(f.value);targets.add(f.target);return f as unknown as ImportField;
    });
    return {file:r.file,digest:r.digest,year:2025,fields};
  });
}
