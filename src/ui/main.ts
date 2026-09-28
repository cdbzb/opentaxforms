import './style.css';
import './form1040.css';
import { calculate, type Calculation } from '../adapters/calculate';
import { emptyDraft, exampleDraft, filingStatuses, priorLabels, type Draft, type Sale } from '../adapters/model';
import { fields, fieldFor, sources, type Page } from '../forms/definitions';
import { load, save, encode, decode } from '../storage/local';
import { incomeLines, taxLines, paymentLines, refundLines, owedLines, contextItems, itemized, form1040Lines, legacyInvestmentFields, type Form1040Line } from '../forms/form1040';

const escape = (s: unknown) => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]!));
const currency = (n: number) => new Intl.NumberFormat('en-US', { style:'currency', currency:'USD' }).format(n);
const link = (url: string, label = 'IRS instructions ↗') => `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
const names: Record<Page,string> = { '1040': 'Form 1040', scheduleB: 'Schedule B', scheduleD: 'Schedule D', prior: '2024 → 2025 carryover', next: 'Carryforward preview', qdcg: 'Qualified dividends & gain tax' };
export function mountApp(root: HTMLElement, storage?: Storage) {
  let draft: Draft = emptyDraft(); let page: Page = '1040'; let selected = 'form1040.line7a';
  let message = ''; let saveStatus = 'Stored only in this browser'; let protectSaved = false;
  try { storage ??= window.localStorage; draft = load(storage) || draft; } catch { message = 'Browser storage could not be read. Any existing draft has not been overwritten. Import a valid file or start a new draft.'; protectSaved = true; saveStatus = 'Browser save unavailable'; }
  let result: Calculation = calculate(draft);
  const amount = (id: string) => result.nodes.has(id) ? currency(result.nodes.get(id)!.value) : '—';
  function persist() {
    if (protectSaved) return;
    try { if(!storage)throw new Error('Storage unavailable'); save(storage,draft); saveStatus = 'Saved in this browser'; }
    catch { saveStatus = 'Not saved — check amounts or download a valid draft'; }
  }
  function inputSource(key: string) {
    if (/^(interest|dividends|scheduleB):/.test(key)) return key.replaceAll(':','.');
    return key==='wages' ? 'form1040.line1a' : key==='filingStatus' ? key : key.startsWith('prior:') ? `prior.input.${key.split(':')[1]}` : key.startsWith('sale:') ? key.replaceAll(':','.') : key.startsWith('unsupported:') ? `form1040.line${key.split(':')[1]}` : undefined;
  }
  function input(key: string, label: string, value: string, opts: { signed?: boolean; text?: boolean; compact?: boolean } = {}) {
    const source = inputSource(key);
    const invalid = source !== undefined && result.errorSource === source;
    const errorId=`input-error-${key.replaceAll(':','-')}`;
    return `<label class="entry ${opts.compact?'compact-entry':''}"><span>${escape(label)}</span><span class="input-wrap">${opts.text ? '' : '<span class="dollar" aria-hidden="true">$</span>'}<input data-key="${key}" aria-label="${escape(label)}" value="${escape(value)}" ${invalid ? `aria-invalid="true" aria-describedby="${errorId}"` : ''} ${opts.text ? 'maxlength="100"' : 'inputmode="decimal" maxlength="30"'} autocomplete="off" placeholder="${key.startsWith('unsupported:') ? 'Not assessed' : opts.text ? 'Description' : opts.signed ? 'May be negative' : '0.00'}" /></span>${invalid ? `<span class="input-error" id="${errorId}">${opts.compact?`<span aria-hidden="true">Needs attention</span><span class="sr-only">${escape(result.errors[0])}</span>`:escape(result.errors[0])}</span>` : ''}</label>`;
  }
  function row(id: string) {
    const f = fieldFor(id); const absentLoss = id==='scheduleD.line21' && !result.errors.length && !result.nodes.has(id);
    return `<div class="form-row ${id===selected ? 'selected' : ''}" data-line="${id}"><span class="line-number">${f.line}</span><div class="row-label"><span>${f.label}</span>${id==='form1040.line7a' ? '<button class="text-button" data-page="scheduleD">Open Schedule D →</button>' : ''}</div><button class="result-button" data-explain="${id}" aria-label="Explain ${f.page==='1040' ? 'Form 1040' : names[f.page]} line ${f.line}" ${absentLoss ? 'disabled' : ''}><span>${absentLoss ? 'Not applicable' : amount(id)}</span><span class="result-arrow" aria-hidden="true">↗</span></button></div>`;
  }
  function unsupportedRow(f: Form1040Line) {
    const id=`form1040.line${f.line}`;
    const record=draft.unsupported1040[f.line] || {applies:false,amount:''};
    const active=record.applies || record.amount.trim()!=='';
    return `<div class="paper-line unsupported-row ${active?'unsupported-active':''} ${selected===id?'selected':''}" data-line="${id}" data-support="${f.support}">
      <span class="line-number">${/^\d/.test(f.line)?f.line:'—'}</span>
      <div class="paper-label"><button class="line-label-button" data-explain="${id}">${escape(f.label)}</button> <button class="support-marker" data-explain="${id}" aria-label="${escape(f.label)}: not supported yet; show details" title="Not supported yet — select for details">${active?'Recorded':'Unsupported'}</button></div>
      ${f.support==='amount'?input(`unsupported:${f.line}:amount`,`Recorded amount · ${/^\d/.test(f.line)?'line '+f.line:f.label}`,record.amount,{compact:true}):f.support==='flag'?`<label class="paper-flag"><input type="checkbox" data-key="unsupported:${f.line}:applies" aria-label="${escape(f.label)} applies" ${record.applies?'checked':''} /> Applies</label>`:`<span class="unavailable-value">${f.support==='detail'?'Not implemented':'Not calculated'}</span>`}
    </div>`;
  }
  function formLine(f: Form1040Line) {
    const oldNote=draft.unsupported1040[f.line];
    if(oldNote && (oldNote.applies || oldNote.amount.trim()) && legacyInvestmentFields.some(old=>old.line===f.line)) return unsupportedRow(legacyInvestmentFields.find(old=>old.line===f.line)!);
    if(f.support!=='supported')return unsupportedRow(f);
    const id=`form1040.line${f.line}`;
    return `<div class="paper-line ${['1z','9','11a','11b','14','15'].includes(f.line)?'paper-total':''} ${selected===id?'selected':''}" data-line="${id}" data-support="supported">
      <span class="line-number">${f.line}</span><div class="paper-label"><button class="line-label-button" data-explain="${id}">${escape(f.label)}</button>${f.line==='7a'?'<button class="paper-schedule-link" data-page="scheduleD" aria-label="Open Schedule D">Schedule D ↗</button>':['2a','2b','3a','3b'].includes(f.line)?'<button class="paper-schedule-link" data-page="scheduleB" aria-label="Enter interest and dividends in Schedule B">Schedule B ↗</button>':f.line==='16'?'<button class="paper-schedule-link" data-page="qdcg">Tax worksheet ↗</button>':''}</div>
      ${f.line==='1a'?input('wages','W-2 wages · line 1a',draft.wages,{compact:true}):`<button class="paper-calculated" data-explain="${id}" aria-label="Explain Form 1040 line ${f.line}, calculated ${amount(id)}"><span>${amount(id)}</span><span aria-hidden="true">↗</span></button>`}
    </div>${f.line==='12e'?unsupportedRow(itemized):''}`;
  }
  function scheduleB() {
    const inv=draft.investments;
    const answer=(key:'foreignAccount'|'foreignTrust',label:string)=>`<label class="entry"><span>${label}</span><select data-key="scheduleB:${key}" aria-label="${label}" ${result.errorSource===`scheduleB.${key}`?'aria-invalid="true"':''}><option value="unanswered" ${inv[key]==='unanswered'?'selected':''}>Choose an answer</option><option value="no" ${inv[key]==='no'?'selected':''}>No</option><option value="yes" ${inv[key]==='yes'?'selected':''}>Yes — needs additional reporting</option></select></label>`;
    return `<div class="form-heading"><div><p class="eyebrow">Form 1040 attachment · interest and ordinary dividends</p><h2>Schedule <strong>B</strong></h2></div><span class="form-year">2025</span></div>
      <div class="note-box">Enter payer totals from your tax records. Ordinary dividends include qualified dividends. This working schedule is available even below the filing threshold. Brokerage import is not available yet.</div>
      <div class="form-section"><div class="section-title"><span>I</span><h3>Interest · line 1</h3></div>
      <p class="field-note">Taxable interest includes plain bank interest and U.S. Treasury/savings-bond interest with no exclusions or adjustments. Enter tax-exempt interest separately; it goes to Form 1040 line 2a, not Schedule B line 1.</p>
      ${inv.interest.map((p,i)=>`<fieldset class="sale"><legend>Interest payer ${i+1}</legend>${input(`interest:${p.id}:payer`,'Interest payer name',p.payer,{text:true})}<div class="input-grid">${input(`interest:${p.id}:taxable`,'Taxable interest',p.taxable)}${input(`interest:${p.id}:exempt`,'Tax-exempt interest',p.exempt)}</div><button class="text-button" data-remove-investment="interest:${p.id}">Remove interest payer ${i+1}</button></fieldset>`).join('')}
      <button class="secondary" data-action="add-interest" ${inv.interest.length>=100?'disabled':''}>+ Add interest payer</button></div>
      ${['scheduleB.line2','scheduleB.line3','scheduleB.line4'].map(row).join('')}
      <div class="form-section"><div class="section-title"><span>II</span><h3>Ordinary dividends · line 5</h3></div>
      <p class="field-note">Enter box 1a and the eligible qualified portion of box 1b from Form 1099-DIV. You must verify the qualified-dividend holding-period rules. Ordinary capital gain distributions (box 2a) go to Schedule D line 13. Special-rate gains and other boxes need additional support.</p>
      ${inv.dividends.map((p,i)=>`<fieldset class="sale"><legend>Dividend payer ${i+1}</legend>${input(`dividends:${p.id}:payer`,'Dividend payer name',p.payer,{text:true})}<div class="input-grid">${input(`dividends:${p.id}:ordinary`,'Ordinary dividends · box 1a',p.ordinary)}${input(`dividends:${p.id}:qualified`,'Eligible qualified dividends · box 1b',p.qualified)}${input(`dividends:${p.id}:capitalGain`,'Capital gain distributions · box 2a',p.capitalGain)}</div><button class="text-button" data-remove-investment="dividends:${p.id}">Remove dividend payer ${i+1}</button></fieldset>`).join('')}
      <button class="secondary" data-action="add-dividend" ${inv.dividends.length>=100?'disabled':''}>+ Add dividend payer</button></div>
      ${row('scheduleB.line6')}
      <div class="form-section"><div class="section-title"><span>III</span><h3>Foreign accounts and trusts</h3></div>
      <p class="field-note">Part III is required if taxable interest or ordinary dividends exceed $1,500, or a foreign account/trust situation applies. This prototype asks both questions whenever payer records are entered. A yes answer makes the return incomplete.</p>
      ${answer('foreignAccount','7a · Financial interest in or signature authority over a foreign financial account during 2025?')}
      <p class="field-note">7a follow-up and 7b · FBAR filing requirement and foreign countries: not determined here. A yes answer requires further review.</p>
      ${answer('foreignTrust','8 · Distribution from, grantor of, or transferor to a foreign trust during 2025?')}
      </div><div class="form-section"><h3>Other investment treatment</h3><label class="checkbox"><input type="checkbox" data-key="scheduleB:special" ${inv.special?'checked':''} /> My statements require treatment beyond the fields above</label><p class="field-note">Includes nominee income, seller-financed mortgages, OID/bond adjustments, savings-bond exclusions, foreign taxes, nondividend distributions, section 199A dividends, collectibles/section 1250 gains, or investment-interest elections. Marking this keeps the return incomplete. Record withholding on Form 1040 line 25b as an unsupported note.</p></div>
      <div class="form-actions"><button class="secondary" data-page="qdcg">Open tax worksheet →</button><button class="primary" data-page="1040">Return to Form 1040 →</button></div><div class="form-source">${link(sources.scheduleB,'View official 2025 Schedule B ↗')}${link(sources.instructionsB)}${link(sources.instructions1040+'#page=26','Qualified-dividend eligibility ↗')}</div>`;
  }
  function taxWorksheet() {
    return `<div class="form-heading"><div><p class="eyebrow">2025 worksheet · Form 1040 line 16</p><h2>Qualified dividends and<br><strong>capital gain tax</strong></h2></div></div><div class="note-box">Income tax before credits and other taxes. Forms 8615, 8814, 4972 and 2555, special-rate gains and investment-interest elections are unsupported. Mark special tax methods on Form 1040 or special investment treatment on Schedule B if applicable.</div>
      ${result.errors.length?'<p class="empty-note">Complete or correct the inputs to calculate this worksheet.</p>':result.nodes.has('qdcg.1')?fields.filter(f=>f.page==='qdcg').map(f=>row(f.id)).join(''):`<p class="empty-note">This worksheet is not needed for the entered income. Form 1040 line 16 uses the ordinary Tax Table or Tax Computation Worksheet.</p>${row('form1040.line16')}`}
      <div class="form-actions"><button class="secondary" data-page="scheduleB">Open Schedule B →</button><button class="primary" data-page="1040">Return to Form 1040 →</button></div><div class="form-source">${link(sources.qdcg,'Open official worksheet, page 38 ↗')}${link(sources.instructions1040+'#page=68','2025 IRS Tax Table ↗')}</div>`;
  }
  function unsupportedNotice() {
    const recorded=Object.entries(draft.unsupported1040).filter(([,entry])=>entry.applies||entry.amount.trim()!=='');
    if (!recorded.length && result.errors.length) return `<div class="incomplete-notice print-incomplete"><strong>Return incomplete — calculated results withheld</strong><ul>${result.errors.map(error=>`<li>${escape(error)}</li>`).join('')}</ul></div>`;
    return `${recorded.length?`<div class="incomplete-notice" role="alert"><strong>Return incomplete — unsupported entries recorded</strong><p>Calculated totals and carryforward estimates are withheld. These entries need supported calculations before this return can be completed.</p><ul>${recorded.map(([id,entry])=>`<li>${escape(fieldFor('form1040.line'+id).label)}${entry.amount.trim()!==''?`: ${escape(entry.amount)} (unverified)`:' — applies; amount not entered'}</li>`).join('')}</ul></div>`:''}`;
  }
  function form1040() {
    const paired=new Set(['2a','3a','4a','5a','6a']);
    function section(title:string,items:Form1040Line[]) {
      const rendered:string[]=[];
      for(let i=0;i<items.length;i++) {
        const f=items[i];
        if(paired.has(f.line))rendered.push(`<div class="paper-pair">${formLine(f)}${formLine(items[++i])}</div>`);
        else rendered.push(formLine(f));
      }
      return `<section class="paper-section" aria-label="${title}"><h3>${title}</h3><div class="paper-section-lines">${rendered.join('')}</div></section>`;
    }
    const header=(pageNumber:number)=>`<header class="paper-heading"><div class="paper-form-number"><small>Form</small><strong>1040</strong></div><div class="paper-form-title"><h2>U.S. Individual Income Tax Return</h2><p>Working copy · not for filing</p></div><strong class="paper-year">2025</strong><span class="paper-page-number">Page ${pageNumber}</span></header>`;
    return `<div class="paper-legend" aria-label="Form field legend"><span><i class="legend-entered"></i>Enter an amount</span><span><i class="legend-calculated"></i>Calculated · select to trace</span><span><i class="legend-unsupported"></i>Unsupported · select for details</span></div>
      <p class="paper-guide">Unsupported entries are saved as notes and mark the return incomplete. Blank unsupported lines are unassessed.</p>
      <section class="paper-sheet" aria-label="Form 1040 page 1">
      ${header(1)}
      <div class="paper-identity"><div><strong>Taxpayer & spouse</strong><span>Names and SSNs — not collected in this prototype</span></div><div><strong>Home address</strong><span>Address and residence details — not collected</span></div></div>
      <section class="paper-filing"><h3>Filing status</h3><label><span class="sr-only">Filing status</span><select data-key="filingStatus" aria-label="Filing status">${Object.entries(filingStatuses).map(([key,label])=>`<option value="${key}" ${draft.filingStatus===key?'selected':''}>${label}</option>`).join('')}</select></label><small>Eligibility is not determined here.</small></section>
      <div class="paper-context">${contextItems.map(unsupportedRow).join('')}</div>
      ${section('Income',incomeLines)}
      <div class="paper-page-footer"><span>OpenTaxForms · limited calculation support</span><span>Form 1040 (2025) · 1</span></div>
      </section>
      <section class="paper-sheet" aria-label="Form 1040 page 2">
      ${header(2)}
      ${section('Tax and credits',taxLines)}
      ${section('Payments and refundable credits',paymentLines)}
      ${section('Refund',refundLines)}
      ${section('Amount you owe',owedLines)}
      <div class="paper-signatures"><div><strong>Third party designee</strong><span>Authorization and contact details — not implemented</span></div><div><strong>Sign here</strong><span>Signature and identity-protection PIN — not collected. This working copy cannot be filed.</span></div><div><strong>Paid preparer use only</strong><span>Preparer and firm information — not implemented</span></div></div>
      <div class="paper-page-footer"><span>OpenTaxForms · working copy, not for filing</span><span>Form 1040 (2025) · 2</span></div>
      </section>
      <div class="form-source">${link(sources.form1040,'View official 2025 Form 1040 ↗')}${link(sources.instructions1040)}</div>`;
  }
  function scheduleD() {
    return `<div class="form-heading"><div><p class="eyebrow">Form 1040 attachment · capital gains and losses</p><h2>Schedule <strong>D</strong></h2></div><span class="form-year">2025</span></div>
      <div class="form-section"><div class="section-title"><span>01</span><h3>Your stock sales</h3></div><p class="field-note">Ordinary stock only, basis reported to the IRS, with no adjustments or wash sales. Select the holding period from your records.</p>
      ${draft.sales.map((s,i)=>`<fieldset class="sale"><legend>Sale ${i+1}</legend><div class="sale-head">${input(`sale:${s.id}:description`,'Description',s.description,{text:true})}<label class="entry"><span>Holding period</span><select data-key="sale:${s.id}:term" aria-label="Holding period for sale ${i+1}"><option value="short" ${s.term==='short'?'selected':''}>Short-term · 1 year or less</option><option value="long" ${s.term==='long'?'selected':''}>Long-term · more than 1 year</option></select></label></div><div class="input-grid">${input(`sale:${s.id}:proceeds`,`Proceeds for sale ${i+1}`,s.proceeds)}${input(`sale:${s.id}:basis`,`Cost basis for sale ${i+1}`,s.basis)}</div><div class="sale-footer"><span>Gain / (loss) <strong>${amount(`sale.${s.id}.gain`)}</strong></span><button class="text-button" data-remove="${s.id}">Remove sale ${i+1}</button></div></fieldset>`).join('')}
      ${draft.sales.length===0 ? '<p class="empty-note">No current-year stock sales. You can still enter a prior-year loss.</p>' : ''}<button class="secondary" data-action="add" ${draft.sales.length>=100?'disabled':''}>+ Add a stock sale</button></div>
      <div class="section-title"><span>02</span><h3>Short-term</h3></div>${['capitalSales.short','scheduleD.line6','scheduleD.line7'].map(row).join('')}
      <div class="section-title"><span>03</span><h3>Long-term</h3></div>${['capitalSales.long','scheduleD.line13','scheduleD.line14','scheduleD.line15'].map(row).join('')}
      <div class="section-title"><span>04</span><h3>Summary</h3></div>${['scheduleD.line16','scheduleD.line21'].map(row).join('')}
      <div class="form-actions"><button class="secondary" data-page="prior">Open prior-year loss worksheet →</button><button class="primary" data-page="1040">Return to Form 1040 →</button></div><div class="form-source">${link(sources.scheduleD,'View official 2025 Schedule D ↗')}${link(sources.instructionsD)}</div>`;
  }
  function worksheet(which: 'prior'|'next') {
    return `<div class="form-heading"><div><p class="eyebrow">${which==='prior'?'2025 worksheet · using your 2024 return':'2025 loss · preview for the following year'}</p><h2>${which==='prior'?'Capital loss<br><strong>carryover worksheet</strong>':'Your remaining<br><strong>capital loss</strong>'}</h2></div></div>
      ${which==='prior' ? `<div class="form-section"><label class="checkbox"><input type="checkbox" data-key="hasPriorLoss" ${draft.hasPriorLoss?'checked':''} /> I have a capital loss on my 2024 Schedule D</label><p class="field-note">Use the actual 2024 return. Include a negative taxable-income amount if line 15 would have been negative before its zero floor.</p>${draft.hasPriorLoss||result.errorSource?.startsWith('prior.input.')?`<div class="section-title"><h3>Inputs from your 2024 return</h3></div><p class="field-note">The source line numbers refer to your 2024 forms. The calculated worksheet below has its own lines 1–13. The capital loss deduction from Schedule D line 21 goes into worksheet line 2.</p><div class="input-grid">${input('prior:taxable',priorLabels.taxable,draft.prior.taxable,{signed:true})}${input('prior:deduction',priorLabels.deduction,draft.prior.deduction)}${input('prior:short',priorLabels.short,draft.prior.short,{signed:true})}${input('prior:long',priorLabels.long,draft.prior.long,{signed:true})}</div>`:'<p class="empty-note">No prior-year loss selected. Both incoming carryovers are $0.</p>'}</div>` : `<div class="note-box">This preview uses the 2025 Publication 550 carryover rule. It is not an official 2026 worksheet. Amounts depend on the limited income and deductions entered here.</div>`}
      ${(which==='prior'&&!draft.hasPriorLoss)||(which==='next'&&!result.errors.length&&!result.nodes.has('next.1')) ? '' : fields.filter(f=>f.page===which).map(f=>row(f.id)).join('')}
      ${which==='next'&&!result.errors.length&&!result.nodes.has('next.1')?'<p class="empty-note">No sales or carryover activity. There is no loss to carry forward.</p>':''}
      <div class="form-actions"><button class="secondary" data-page="scheduleD">Back to Schedule D →</button></div><div class="form-source">${link(sources[which],which==='prior'?'Open official 2025 carryover worksheet ↗':'Open 2025 Publication 550, page 102 ↗')}</div>`;
  }
  function inspector() {
    const f = fieldFor(selected); const node = result.nodes.get(selected);
    const sourceUrl=selected==='form1040.line16' && node && !result.nodes.has('qdcg.1') ? sources.instructions1040+((result.nodes.get('form1040.line15')?.value || 0)>=100000?'#page=80':'#page=68') : f.url;
    const support=[...form1040Lines,...contextItems,itemized,...legacyInvestmentFields.filter(f=>draft.unsupported1040[f.line]?.applies || draft.unsupported1040[f.line]?.amount.trim())].find(line=>`form1040.line${line.line}`===selected && line.support!=='supported');
    const record=support?draft.unsupported1040[support.line]:undefined;
    const controls=support?`<div class="support-panel"><strong>Not supported yet</strong><p>Needed: ${escape(support.needs)}</p>${support.support==='amount'?`<label class="unsupported-checkbox"><input type="checkbox" data-key="unsupported:${support.line}:applies" ${record?.applies?'checked':''} /> This applies to me (amount may be unknown)</label>`:''}${record&&(record.applies||record.amount.trim()!=='')?`<p>Saved as an unverified note${record.amount.trim()!==''?`: ${escape(record.amount)}`:'. Amount not entered.'}</p><button class="secondary full" data-clear-unsupported="${support.line}">Clear this entry</button>`:''}${['amount','flag'].includes(support.support)?`<button class="secondary full" data-source="${selected}">Go to this line →</button>`:''}</div>`:'';
    return `<p class="eyebrow">Understand this number</p><div class="inspect-title"><span class="inspect-marker">↗</span><div><span class="muted">${names[f.page]} · ${f.line==='Input'?'Input':`Line ${f.line}`}</span><h3>${escape(f.label)}</h3></div></div><div class="inspect-value">${support?'Unsupported':selected==='filingStatus'?filingStatuses[draft.filingStatus]:amount(selected)}</div>${controls}<p>${escape(f.explanation)}</p>
      ${support?'':node ? `<div class="formula"><span>${node.entered?'Source':'Calculation'}</span><p>${escape(node.explanation)}</p></div><h4>${node.inputs.length?'Comes from':'Source detail'}</h4>${node.inputs.length?`<ul class="source-list">${node.inputs.map(id=>`<li><button data-source="${id}"><span>${escape(fieldFor(id).label)}<small>${escape(names[fieldFor(id).page])} · ${fieldFor(id).line}</small></span><strong>${id==='filingStatus'?filingStatuses[draft.filingStatus]:amount(id)} <span aria-hidden="true">→</span></strong></button></li>`).join('')}</ul>`:`<p class="field-note">${node.entered?'A value entered directly in this working return.':'A constant or a value outside the selected activity. See the scope below.'}</p>`}` : `<p class="field-note">${result.errors.length?'Complete the inputs to see the calculation and its sources.':'This line is not used for the current return.'}</p>`}
      <button class="secondary full" data-page="${f.page}">Open ${names[f.page]} →</button><div class="inspector-source">${link(sourceUrl)}</div><div class="privacy-note"><span aria-hidden="true">◉</span><div><strong>Your return stays here.</strong><p>Calculations and saves happen on this device. IRS links open separately without sending your entries.</p></div></div>`;
  }
  function render() {
    result = calculate(draft);
    root.innerHTML = `<header class="topbar"><a class="brand" href="#" data-action="home"><span class="brand-symbol" aria-hidden="true">▤</span>OpenTaxForms</a><div class="top-meta"><span class="year-badge">Tax year 2025</span><span class="local-badge">● Local only</span></div></header>
      <div class="workspace ${page==='1040'?'paper-workspace':''}"><aside class="sidebar"><p class="eyebrow">Your working return</p><nav aria-label="Tax forms">${(Object.keys(names) as Page[]).map((p,i)=>`<button data-page="${p}" ${page===p?'aria-current="page"':''}><span class="nav-number">${i<2?'0'+(i+1):'↳'}</span><span>${names[p]}${p==='1040'?'<small>Full form · limited calculations</small>':p==='scheduleD'?'<small>Capital gains & losses</small>':''}</span></button>`).join('')}</nav>
      <div class="sidebar-tools"><p class="eyebrow">On this device</p><button data-action="download">↓ Download draft</button><label class="file-button">↑ Import draft<input type="file" accept=".json,application/json" aria-label="Import draft" id="import-file" /></label><button data-action="print">▤ Print working summary</button><button data-action="new">+ New draft</button></div><p class="save-status" role="status">${escape(saveStatus)}</p><p class="storage-note">Browser saves and downloaded JSON files are unencrypted.</p></aside>
      <main id="main"><div class="page-heading"><div><p class="eyebrow">Transparent by design</p><h1>Your forms.<br class="mobile-break" /> Every number explained.</h1><p>Enter an amount. Follow it through the return.</p></div><button class="secondary" data-action="example">Load example</button></div>
      <div class="scope-note"><span class="scope-badge">Limited prototype</span><p>2025 wages, plain interest/dividends, covered stock sales, capital loss carryovers and income tax before credits. Assumes standard-deduction eligibility, no dependent status, no age/blindness additions and no special tax methods. Total tax, credits and refunds remain unsupported. <strong>Not ready to file.</strong></p></div>
      ${message?`<div class="alert" role="alert">${escape(message)}</div>`:''}
      <div class="return-status ${result.errors.length?'incomplete':'complete'}"><span aria-hidden="true">${result.errors.length?'○':'✓'}</span><span>${result.errors.length?`Inputs need attention: ${escape(result.errors[0])}`:'Supported lines are calculated. Select any amount to see its source.'}</span>${result.errorSource ? `<button class="secondary" data-source="${result.errorSource}">Go to input →</button>` : ''}</div>
      ${unsupportedNotice()}
      <article class="form-paper ${page==='1040'?'paper1040':''}" aria-label="${names[page]}">${page==='1040'?form1040():page==='scheduleB'?scheduleB():page==='qdcg'?taxWorksheet():page==='scheduleD'?scheduleD():worksheet(page)}</article>
      <footer>Free & open source. Built on TelosTax’s MIT-licensed calculations. <a href="${import.meta.env.BASE_URL}third-party-notices.txt" target="_blank" rel="noopener">License notice ↗</a></footer></main>
      <aside class="inspector" aria-label="Calculation explanation">${inspector()}</aside></div>`;
  }
  function onEdit(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const key = target.dataset.key; if (!key) return;
    const cursor = target instanceof HTMLInputElement ? target.selectionStart : null;
    if (key==='wages') draft.wages = target.value;
    else if (key==='filingStatus') draft.filingStatus = target.value as Draft['filingStatus'];
    else if (key==='hasPriorLoss') draft.hasPriorLoss = (target as HTMLInputElement).checked;
    else if (key.startsWith('scheduleB:')) { const prop=key.split(':')[1]; if(prop==='special')draft.investments.special=(target as HTMLInputElement).checked;else draft.investments[prop as 'foreignAccount'|'foreignTrust']=target.value as 'unanswered'|'no'|'yes'; }
    else if (/^(interest|dividends):/.test(key)) { const [kind,id,prop]=key.split(':'); const entries=draft.investments[kind as 'interest'|'dividends']; const entry=entries.find(p=>p.id===id)!; (entry as unknown as Record<string,string>)[prop]=target.value; }
    else if (key.startsWith('sale:')) { const [,id,prop] = key.split(':'); const sale = draft.sales.find(s=>s.id===id)!; if(prop==='term') sale.term = target.value as Sale['term']; else sale[prop as 'description'|'proceeds'|'basis'] = target.value; }
    else if (key.startsWith('unsupported:')) { const [,id,prop]=key.split(':'); const entry=draft.unsupported1040[id]??={applies:false,amount:''}; if(prop==='applies')entry.applies=(target as HTMLInputElement).checked;else entry.amount=target.value; }
    else if (key.startsWith('prior:')) draft.prior[key.split(':')[1] as keyof Draft['prior']] = target.value;
    const editedSource=inputSource(key);if(editedSource)selected=editedSource;
    persist(); render();
    const replacement = root.querySelector<HTMLInputElement>(`[data-key="${key}"]`);
    replacement?.focus({ preventScroll: true });
    if (cursor!==null && replacement?.tagName==='INPUT' && replacement.type!=='checkbox') replacement.setSelectionRange(cursor,cursor);
  }
  function focusSource(id?: string) {
    if(id==='scope.noAdjustments')id='form1040.line10';
    let key = id==='filingStatus' ? id : id==='form1040.line1a' ? 'wages' : undefined;
    if(id?.startsWith('form1040.line') && root.querySelector(`[data-key="unsupported:${id.slice('form1040.line'.length)}:amount"],[data-key="unsupported:${id.slice('form1040.line'.length)}:applies"]`)){const line=id.slice('form1040.line'.length);key=root.querySelector(`[data-key="unsupported:${line}:amount"]`)?`unsupported:${line}:amount`:`unsupported:${line}:applies`;}
    if(id?.startsWith('prior.input.'))key=`prior:${id.split('.').at(-1)}`;
    if(id?.startsWith('sale.')){const [,sale,field]=id.split('.');if(field!=='gain')key=`sale:${sale}:${field}`;}
    if(id && /^(interest|dividends|scheduleB)\./.test(id))key=id.replaceAll('.',':');
    const element = (key ? root.querySelector<HTMLElement>(`[data-key="${key}"]`) : id ? root.querySelector<HTMLElement>(`[data-line="${id}"]`) : null) || root.querySelector<HTMLElement>('article')!;
    if(!element.matches('input,select'))element.tabIndex=-1;
    element.focus({preventScroll:true});element.scrollIntoView?.({block:'nearest'});
  }
  const controller = new AbortController(); const { signal } = controller;
  root.addEventListener('focusin', e=>{
    const target=e.target as HTMLElement;
    if(!target.closest('.paper1040') || !target.dataset.key)return;
    const source=inputSource(target.dataset.key);
    if(!source || source===selected)return;
    selected=source;
    // Keep the focused field and caret intact while updating its explanation.
    root.querySelector<HTMLElement>('.inspector')!.innerHTML=inspector();
    root.querySelectorAll<HTMLElement>('.paper-line').forEach(line=>line.classList.toggle('selected',line.dataset.line===selected));
  }, { signal });
  root.addEventListener('input', e=>{ if((e.target as HTMLElement).tagName==='INPUT' && (e.target as HTMLInputElement).type!=='checkbox') onEdit(e); }, { signal });
  root.addEventListener('change', async e=>{
    const t = e.target as HTMLInputElement;
    if(t.id==='import-file') {
      const file = t.files?.[0]; if(!file)return;
      try { if(file.size>200_000)throw new Error('Save file is too large.'); const imported=decode(await file.text()); draft=imported; protectSaved=false; persist(); message='Draft imported. '+saveStatus+'.'; }
      catch(error){ message=`Import failed: ${error instanceof Error?error.message:'Invalid file'}. Your current draft is unchanged.`; }
      render();
    } else if(t.tagName==='SELECT'||t.type==='checkbox')onEdit(e);
  }, { signal });
  root.addEventListener('click', e=>{
    const button=(e.target as HTMLElement).closest<HTMLElement>('[data-page],[data-action],[data-explain],[data-source],[data-remove],[data-clear-unsupported],[data-remove-investment]'); if(!button)return;
    e.preventDefault();
    if(button.dataset.page){page=button.dataset.page as Page; render(); focusSource(); return;}
    if(button.dataset.explain){selected=button.dataset.explain;render();const panel=root.querySelector<HTMLElement>('.inspector')!;panel.tabIndex=-1;panel.focus({preventScroll:true});panel.scrollIntoView?.({block:'nearest'});return;}
    if(button.dataset.source){selected=button.dataset.source;page=fieldFor(selected).page;render();focusSource(selected);return;}
    if(button.dataset.clearUnsupported){delete draft.unsupported1040[button.dataset.clearUnsupported];persist();render();focusSource(`form1040.line${button.dataset.clearUnsupported}`);return;}
    if(button.dataset.remove){draft.sales=draft.sales.filter(s=>s.id!==button.dataset.remove);persist();render();return;}
    if(button.dataset.removeInvestment){const [kind,id]=button.dataset.removeInvestment.split(':');if(kind==='interest')draft.investments.interest=draft.investments.interest.filter(p=>p.id!==id);else draft.investments.dividends=draft.investments.dividends.filter(p=>p.id!==id);persist();render();return;}
    switch(button.dataset.action){
      case 'home': page='1040'; break;
      case 'add': draft.sales.push({id:crypto.randomUUID(),description:'Stock sale',term:'short',proceeds:'',basis:''});persist();break;
      case 'add-interest': if(draft.investments.interest.length<100)draft.investments.interest.push({id:crypto.randomUUID(),payer:'',taxable:'',exempt:'0'});persist();break;
      case 'add-dividend': if(draft.investments.dividends.length<100)draft.investments.dividends.push({id:crypto.randomUUID(),payer:'',ordinary:'',qualified:'0',capitalGain:'0'});persist();break;
      case 'example': if(!window.confirm('Replace the current draft with a synthetic example? Download your draft first if you want to keep it.'))return;draft=exampleDraft();protectSaved=false;message='Synthetic example loaded. Replace these amounts with your own records.';persist();break;
      case 'new': if(!window.confirm('Start a new draft? Download your current draft first if you want to keep it.'))return;draft=emptyDraft();protectSaved=false;message='New draft started.';persist();break;
      case 'download': try { const url=URL.createObjectURL(new Blob([encode(draft)],{type:'application/json'})); const a=document.createElement('a');a.href=url;a.download='opentaxforms-2025.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message='Draft downloaded as an unencrypted JSON file.'; } catch {message='Correct invalid amounts before downloading. Blank fields may be saved.';}break;
      case 'print': window.print();return;
    }
    render();
  }, { signal });
  render();
  return { destroy:()=>controller.abort(), getDraft:()=>structuredClone(draft) };
}
const root = document.querySelector<HTMLElement>('#app');
if(root)mountApp(root);
