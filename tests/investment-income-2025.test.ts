import { describe, it, expect } from 'vitest';
import { ordinaryIncomeTax, addIncomeTax } from '../src/tax/2025/incomeTax';
import { taxTable } from '../src/tax/2025/taxTable';
import { calculate, validateGraph, type ValueNode } from '../src/adapters/calculate';
import { emptyDraft, exampleDraft, type Draft } from '../src/adapters/model';
import { encode, decode } from '../src/storage/local';
import { FilingStatus as F } from '../vendor/telostax/src/types';
import { calculateProgressiveTax } from '../vendor/telostax/src/engine/brackets';

function worksheet(income: number, qualified: number, lt = 0, net = 0, status = F.Single) {
  const nodes = new Map<string,ValueNode>();
  for (const [id,value] of Object.entries({'form1040.line15':income,'form1040.line3a':qualified,'scheduleD.line15':lt,'scheduleD.line16':net,filingStatus:status})) nodes.set(id,{id,value,inputs:[],explanation:'Synthetic fixture input'});
  addIncomeTax(nodes,status); validateGraph(nodes); return nodes;
}
function invested(): Draft {
  const d=emptyDraft();d.sales=[];d.wages='50000';
  d.investments.foreignAccount='no';d.investments.foreignTrust='no';
  return d;
}
function value(d: Draft,id: string) {
  const r=calculate(d);expect(r.errors).toEqual([]);return r.nodes.get(id)?.value;
}

describe('2025 IRS ordinary tax lookup',()=>{
  // Official table pp.68–79, including the published MFJ example on p.68.
  it.each([
    [0,F.Single,0],[4.99,F.Single,0],[5,F.Single,1],[14.99,F.Single,1],[15,F.Single,2],
    [25,F.Single,4],[49.99,F.Single,4],[50,F.Single,6],
    [25300,F.Single,2801],[25300,F.MarriedFilingJointly,2562],[25300,F.MarriedFilingSeparately,2801],
    [25300,F.HeadOfHousehold,2699],[25300,F.QualifyingSurvivingSpouse,2562],
    [99999.99,F.Single,16909],[100000,F.Single,16914],
    [99999.99,F.MarriedFilingJointly,11823],[100000,F.MarriedFilingJointly,11828],
  ])('income %s, status %s gives %s',(income,status,tax)=>expect(ordinaryIncomeTax(income,status).value).toBe(tax));

  it('reproduces the upstream Tax Table gap instead of accepting its bracket-only result',()=>{
    expect(calculateProgressiveTax(25300,F.MarriedFilingJointly).tax).toBe(2559);
    const d=invested();d.filingStatus='mfj';d.wages='56800';
    expect(value(d,'form1040.line15')).toBe(25300);
    expect(value(d,'form1040.line16')).toBe(2562);
  });

  it('covers every table interval with no gaps and uses the correct column at both ends',()=>{
    expect(taxTable).toHaveLength(2062);expect(taxTable[0][0]).toBe(0);expect(taxTable.at(-1)![1]).toBe(100000);
    taxTable.forEach((row,i)=>{
      if(i)expect(row[0]).toBe(taxTable[i-1][1]);
      for(const status of [F.Single,F.MarriedFilingJointly,F.MarriedFilingSeparately,F.HeadOfHousehold,F.QualifyingSurvivingSpouse]) {
        const expected=row[status===F.QualifyingSurvivingSpouse?3:status+1];
        expect(ordinaryIncomeTax(row[0],status).value).toBe(expected);
        expect(ordinaryIncomeTax(row[1]-.01,status).value).toBe(expected);
      }
    });
  });

  // Independently transcribed IRS p.80 computation worksheet: upper bound,
  // multiplication rate, subtraction amount. Tests reuse only the expected
  // IRS affine formula, not the implementation's progressive bracket walk.
  it.each([
    [F.Single,[[103350,.22,5086],[197300,.24,7153],[250525,.32,22937],[626350,.35,30452.75],[1000000,.37,42979.75]]],
    [F.MarriedFilingJointly,[[206700,.22,10172],[394600,.24,14306],[501050,.32,45874],[751600,.35,60905.5],[1000000,.37,75937.5]]],
    [F.MarriedFilingSeparately,[[103350,.22,5086],[197300,.24,7153],[250525,.32,22937],[375800,.35,30452.75],[1000000,.37,37968.75]]],
    [F.HeadOfHousehold,[[103350,.22,6825],[197300,.24,8892],[250500,.32,24676],[626350,.35,32191],[1000000,.37,44718]]],
    [F.QualifyingSurvivingSpouse,[[206700,.22,10172],[394600,.24,14306],[501050,.32,45874],[751600,.35,60905.5],[1000000,.37,75937.5]]],
  ] as const)('matches every computation-worksheet band for status %s',(status,bands)=>{
    let lower=100000;
    for(const [upper,rate,subtraction] of bands) {
      for(const income of [lower,lower+.01,(lower+upper)/2,upper]) expect(ordinaryIncomeTax(income,status).value).toBeCloseTo(Math.round((income*rate-subtraction)*100)/100,2);
      lower=upper+.01;
    }
  });
  it.each([NaN,Infinity,-1])('rejects invalid taxable income %s',income=>expect(()=>ordinaryIncomeTax(income,F.Single)).toThrow());
});

describe('2025 qualified-dividends/capital-gain worksheet',()=>{
  it('matches all 25 hand-worked lines with a short loss reducing eligible long gains',()=>{
    const r=worksheet(60000,2000,10000,8000);
    const expected=[60000,2000,8000,10000,50000,48350,48350,48350,0,10000,0,10000,533400,60000,50000,10000,10000,1500,10000,0,0,5920,7420,8120,7420];
    expected.forEach((v,i)=>expect(r.get(`qdcg.${i+1}`)?.value,`line ${i+1}`).toBe(v));
    expect(r.get('form1040.line16')).toMatchObject({value:7420,inputs:['qdcg.25']});
  });
  it.each([
    [F.Single,48350,533400],[F.MarriedFilingJointly,96700,600050],
    [F.MarriedFilingSeparately,48350,300000],[F.HeadOfHousehold,64750,566700],
    [F.QualifyingSurvivingSpouse,96700,600050],
  ])('uses the published 0/15/20 percent boundaries for status %s',(status,zero,upper)=>{
    for(const offset of [-1,0,1]) {
      const low=worksheet(zero+offset,zero+offset,0,0,status);
      expect(low.get('qdcg.9')?.value).toBe(zero+Math.min(0,offset));
      expect(low.get('qdcg.18')?.value).toBe(offset>0?.15:0);
      expect(low.get('qdcg.21')?.value).toBe(0);
      const high=worksheet(upper+offset,upper+offset,0,0,status);
      expect(high.get('qdcg.13')?.value).toBe(upper);
      expect(high.get('qdcg.17')?.value).toBe(upper-zero+Math.min(0,offset));
      expect(high.get('qdcg.21')?.value).toBe(offset>0?.2:0);
    }
  });
  it('caps preferential income at taxable income when deductions exceed ordinary income',()=>{
    const r=worksheet(1000,5000);expect(r.get('qdcg.5')?.value).toBe(0);
    expect(r.get('qdcg.10')?.value).toBe(1000);expect(r.get('qdcg.25')?.value).toBe(0);
  });
  it('chooses regular tax when table rounding makes the preferential sum larger',()=>{
    // Same table interval for ordinary/all income; 15% on $1 would add $0.15.
    const r=worksheet(50001,1);expect(r.get('qdcg.23')?.value).toBe(5920.15);
    expect(r.get('qdcg.24')?.value).toBe(5920);expect(r.get('qdcg.25')?.value).toBe(5920);
  });
  it('does not give a long-term preference to a short gain offset by a long loss',()=>{
    const r=worksheet(60000,0,-5000,10000);expect(r.has('qdcg.1')).toBe(false);
    expect(r.get('form1040.line16')?.value).toBe(8120);
  });
  it('keeps qualified dividends eligible even with a net capital loss',()=>{
    const r=worksheet(60000,2000,10000,-1000);expect(r.get('qdcg.3')?.value).toBe(0);
    expect(r.get('qdcg.4')?.value).toBe(2000);
  });
  it('uses zero tax when taxable income is zero',()=>expect(worksheet(0,2000).get('form1040.line16')?.value).toBe(0));
});

describe('Schedule B integration and persistence',()=>{
  it('aggregates payers without double-counting qualified dividends or taxing exempt interest',()=>{
    const d=invested();
    d.investments.interest=[{id:'bank',payer:'Bank',taxable:'1000',exempt:'500'},{id:'treasury',payer:'Treasury',taxable:'250',exempt:'0'}];
    d.investments.dividends=[{id:'broker',payer:'Broker',ordinary:'2000',qualified:'1500',capitalGain:'3000'}];
    const r=calculate(d);expect(r.errors).toEqual([]);
    for(const [id,want] of Object.entries({'scheduleB.line2':1250,'scheduleB.line4':1250,'scheduleB.line6':2000,
      'form1040.line2a':500,'form1040.line3a':1500,'scheduleD.line13':3000,'scheduleD.line15':3000,
      'form1040.line9':56250,'form1040.line15':40500,'qdcg.4':4500})) expect(r.nodes.get(id)?.value,id).toBe(want);
    expect(r.nodes.get('scheduleB.line2')?.inputs).toEqual(['interest.bank.taxable','interest.treasury.taxable']);
    expect(r.nodes.get('scheduleD.line13')?.inputs).toEqual(['dividends.broker.capitalGain']);
    expect(decode(encode(d))).toEqual(d);
  });
  it('investment income changes how much capital loss can be absorbed',()=>{
    const d=invested();d.wages='15750';d.sales=[{id:'loss',description:'loss',term:'short',proceeds:'0',basis:'5000'}];
    expect(value(d,'next.8')).toBe(5000);
    d.investments.interest=[{id:'bank',payer:'Bank',taxable:'1000',exempt:'9000'}];
    expect(value(d,'next.8')).toBe(4000);
  });
  it('nets capital gain distributions against short-term losses before assigning a preference',()=>{
    const d=invested();d.sales=[{id:'loss',description:'loss',term:'short',proceeds:'0',basis:'2000'}];
    d.investments.dividends=[{id:'broker',payer:'Broker',ordinary:'1000',qualified:'500',capitalGain:'5000'}];
    expect(value(d,'qdcg.3')).toBe(3000);expect(value(d,'form1040.line9')).toBe(54000);
  });
  it.each(['special','foreignAccount','foreignTrust'] as const)('withholds every result for unsupported %s',key=>{
    const d=invested();if(key==='special')d.investments.special=true;else d.investments[key]='yes';
    const r=calculate(d);expect(r.nodes.size).toBe(0);expect(r.errorSource).toBe(`scheduleB.${key}`);
  });
  it('requires Part III answers when payer records exist, without assuming no',()=>{
    const d=invested();d.investments.interest=[{id:'bank',payer:'Bank',taxable:'1501',exempt:'0'}];
    d.investments.foreignAccount='unanswered';expect(calculate(d).errorSource).toBe('scheduleB.foreignAccount');
    d.investments.foreignAccount='no';d.investments.foreignTrust='unanswered';expect(calculate(d).errorSource).toBe('scheduleB.foreignTrust');
  });
  it('rejects qualified dividends exceeding ordinary dividends, blank amounts and missing payers',()=>{
    const d=invested();d.investments.dividends=[{id:'b',payer:'Broker',ordinary:'100',qualified:'101',capitalGain:'0'}];
    expect(calculate(d).errorSource).toBe('dividends.b.qualified');
    d.investments.dividends[0].qualified='';expect(calculate(d).errors[0]).toContain('blank');
    d.investments.dividends[0].qualified='100';d.investments.dividends[0].payer='';expect(calculate(d).errorSource).toBe('dividends.b.payer');
  });
  it('loads old drafts and preserves investment notes as blocking notes until reviewed',()=>{
    const {investments,...old}=exampleDraft();old.unsupported1040['2b']={applies:false,amount:'1,000?'};
    const loaded=decode(JSON.stringify(old));expect(loaded.investments.interest).toEqual([]);
    expect(loaded.unsupported1040['2b'].amount).toBe('1,000?');expect(calculate(loaded).nodes.size).toBe(0);
    delete loaded.unsupported1040['2b'];expect(value(loaded,'form1040.line2b')).toBe(0);
  });
  it.each([
    {interest:[{id:'b',payer:'Bank',taxable:'10',exempt:'0',secret:'unexpected'}]},
    {interest:[{id:'b',payer:'Bank',taxable:'10',exempt:'0'},{id:'b',payer:'Bank',taxable:'10',exempt:'0'}]},
    {foreignAccount:'maybe'},{foreignAccount:['no']},{special:'yes'},{extra:123},
  ])('rejects malformed investment saves %j',bad=>{
    const d=invested();Object.assign(d.investments,bad);expect(()=>encode(d)).toThrow();
  });
});
