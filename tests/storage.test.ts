import { describe, expect, it } from 'vitest';
import { encode, decode, load, save, STORAGE_KEY } from '../src/storage/local';
import { emptyDraft, exampleDraft } from '../src/adapters/model';
describe('local save files',()=>{
  it('round-trips a complete return and unfinished draft',()=>{
    for(const d of [emptyDraft(),exampleDraft()])expect(decode(encode(d))).toEqual(d);
  });
  it('uses a year-specific storage key',()=>{
    const data=new Map<string,string>();const storage={getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);}};
    expect(load(storage)).toBeNull();save(storage,exampleDraft());expect(data.has(STORAGE_KEY)).toBe(true);expect(load(storage)).toEqual(exampleDraft());
  });
  it.each([{taxYear:2026},{schemaVersion:2},{engine:'different'},{filingStatus:'invalid'},{wages:'NaN'},{businessIncome:'1000'}])('rejects unsupported or invalid fields %j',patch=>expect(()=>decode(JSON.stringify({...exampleDraft(),...patch}))).toThrow());
  it('rejects duplicate sale IDs',()=>{
    const d=exampleDraft();d.sales.push({...d.sales[0]});expect(()=>decode(JSON.stringify(d))).toThrow(/duplicate/);
  });
  it('rejects corrupt and oversized files',()=>{
    expect(()=>decode('{')).toThrow();expect(()=>decode(' '.repeat(200001))).toThrow(/large/);
  });
});
