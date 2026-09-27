import { describe, it, expect } from 'vitest';
import { calculate } from '../src/adapters/calculate';
import { exampleDraft } from '../src/adapters/model';
import { encode, decode } from '../src/storage/local';
import { recordable1040 } from '../src/forms/form1040';

describe('unsupported Form 1040 entries',()=>{
  it.each(['2b','3a','4a','5b','6a','8','10','13b','25a'])('withholds totals and carryforwards when line %s is recorded',line=>{
    const d=exampleDraft();d.unsupported1040[line]={applies:false,amount:'123.45'};
    const r=calculate(d);expect(r.nodes.size).toBe(0);
    expect(r.errorSource).toBe(`form1040.line${line}`);expect(r.errors[0]).toContain('Return incomplete');
    expect(decode(encode(d))).toEqual(d);
  });
  it('blocks every recordable unsupported circumstance, even without an amount',()=>{
    for(const field of recordable1040){
      const d=exampleDraft();d.unsupported1040[field.line]={applies:true,amount:''};
      expect(calculate(d).nodes.size,field.line).toBe(0);
      expect(calculate(d).errors[0],field.line).toContain('not supported yet');
    }
  });
  it('retains unverified entries and never interprets them as tax inputs',()=>{
    const d=exampleDraft();d.unsupported1040['2b']={applies:false,amount:'1,234.5?'};
    const loaded=decode(encode(d));expect(loaded.unsupported1040['2b'].amount).toBe('1,234.5?');
    expect(calculate(loaded).nodes.size).toBe(0);
    d.unsupported1040['2b'].amount='0';expect(calculate(d).nodes.size).toBe(0);
    d.unsupported1040['2b'].amount='';expect(calculate(d).errors).toEqual([]);
  });
  it('reports all unsupported entries, not just the first one',()=>{
    const d=exampleDraft();d.unsupported1040={'2b':{applies:true,amount:''},'8':{applies:false,amount:'-400'}};
    expect(calculate(d).errors).toHaveLength(2);
  });
  it('loads older v1 drafts without losing existing fields',()=>{
    const {unsupported1040,...legacy}=exampleDraft();
    const loaded=decode(JSON.stringify(legacy));expect(loaded).toEqual(exampleDraft());
    expect(calculate(loaded).nodes.get('form1040.line15')?.value).toBe(36250);
  });
  it.each([
    {'999':{applies:true,amount:'1'}},
    {'2b':{applies:'yes',amount:'1'}},
    {'2b':{applies:true,amount:1}},
    {'12a':{applies:true,amount:'100'}},
    {'2b':{applies:true,amount:'1',extra:true}},
  ])('rejects malformed or unknown saved entries %j',entries=>{
    expect(()=>decode(JSON.stringify({...exampleDraft(),unsupported1040:entries}))).toThrow();
  });
  it('exposes direct-copy lines with provenance within the supported slice',()=>{
    const r=calculate(exampleDraft());expect(r.errors).toEqual([]);
    expect(r.nodes.get('form1040.line1z')).toMatchObject({value:50000,inputs:['form1040.line1a']});
    expect(r.nodes.get('form1040.line11b')).toMatchObject({value:52000,inputs:['form1040.line11a']});
    expect(r.nodes.get('form1040.line14')).toMatchObject({value:15750,inputs:['form1040.line12e']});
    expect(r.nodes.get('form1040.line9')?.inputs).toContain('form1040.line1z');
    expect(r.nodes.get('form1040.line15')?.inputs).toEqual(['form1040.line11b','form1040.line14']);
  });
});
