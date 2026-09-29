import type { Draft } from '../adapters/model';
import type { SchwabPreview } from '../imports/schwab';

const escape=(s:unknown)=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
function recordRanges(records: number[]): string {
  const sorted=[...new Set(records)].sort((a,b)=>a-b), ranges:string[]=[];
  for(let i=0;i<sorted.length;i++) {
    const start=sorted[i];let end=start;
    while(sorted[i+1]===end+1)end=sorted[++i];
    ranges.push(start===end?String(start):`${start}–${end}`);
  }
  return ranges.join(', ');
}
export interface ImportReview { file: string; digest: string; preview: SchwabPreview; reviewed: boolean }
export function brokerageImport(draft: Draft, review: ImportReview|null, loading: boolean): string {
  const p=review?.preview;
  const duplicate=review && draft.brokerImports.some(r=>r.digest===review.digest);
  const issues=new Map<string,number[]>();
  for(const issue of p?.issues || [])issues.set(issue.message,[...(issues.get(issue.message)||[]),issue.row]);
  const table=(headers:string[],rows:string[][])=>`<div class="import-table" tabindex="0" role="region" aria-label="CSV source records"><table><thead><tr>${headers.map(h=>`<th scope="col">${escape(h)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(v=>`<td>${escape(v || '—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="form-heading"><div><p class="eyebrow">Local file import</p><h2>Schwab <strong>tax CSV</strong></h2></div></div>
    <div class="import-content"><p>Select a tax-form CSV downloaded from Schwab. Review it before adding records. Files stay on this device.</p>
    <p>Plain 1099-INT and 1099-DIV amounts are supported. Sales, OID, adjustments, other populated boxes and corrected statements need additional support and prevent applying the file.</p>
    <label class="entry"><span>Choose Schwab tax CSV</span><input type="file" id="broker-file" accept=".csv,text/csv" aria-label="Choose Schwab tax CSV" /></label>
    ${loading?'<p role="status">Reading CSV on this device…</p>':''}
    ${review && p ? `<section aria-label="Brokerage import preview"><h3>${escape(review.file)} · ${p.year || 'Unknown year'}</h3><p><strong>Preview only — no values from this file have been added.</strong> CSV record numbers include headers and blank records; a quoted multiline field counts as one record.</p>
      ${duplicate?'<div class="alert" role="alert">This file has already been imported. Renaming a file or deleting its payer records does not remove the import receipt.</div>':''}
      ${p.issues.length?`<div class="alert import-issues" role="alert"><strong>File cannot be applied · ${issues.size} issue types</strong><p>The following items need support or review. Expand a repeated issue to locate its CSV records.</p><ul>${[...issues].map(([message,rows])=>`<li>${rows.length===1?`${escape(message)} <span class="issue-records">CSV record ${rows[0]}</span>`:`<details><summary>${escape(message)} <span class="issue-records">${new Set(rows).size} records</span></summary><p>CSV records: ${recordRanges(rows)}</p></details>`}</li>`).join('')}</ul></div>`:''}
      <h4>Proposed amounts · subject to the checks above</h4>
      ${table(['Destination','Amount','Source form / boxes','CSV records'],p.mappings.map(m=>[`${m.kind==='interest'?'Interest':'Dividends'} · ${m.key}`,m.value,`${m.form} · ${m.boxes.join(' + ')}`,m.rows.join(', ')]))}
      <p>Taxable interest combines 1099-INT boxes 1 and 3. Qualified dividends are included in ordinary dividends. No source values are added when this file has an unresolved issue.</p>
      ${p.sections.map(s=>`<details class="import-section"><summary>${escape(s.form)} · record ${s.row}${s.corrected?' · Corrected':''} · ${s.boxes.length || s.records.length} entries</summary>
        ${s.boxes.length?table(['CSV record','Box','Description','Amount','Total','Details'],s.boxes.map(b=>[String(b.row),b.box,b.description,b.amount,b.total,b.details])):''}
        ${s.records.length?table(['CSV record',...(s.headers.length?s.headers:Array.from({length:Math.max(...s.records.map(r=>r.cells.length))},(_,i)=>`Column ${i+1}`))],s.records.map(r=>[String(r.row),...r.cells])):''}
      </details>`).join('')}
      <label class="checkbox"><input type="checkbox" id="broker-reviewed" ${review.reviewed?'checked':''} ${p.issues.length||duplicate?'disabled':''} /> I checked the amounts and payer, verified qualified-dividend eligibility, have no exclusions or other adjustments, and have not already entered these amounts manually or from another export.</label>
      <p>This adds Charles Schwab payer records to Schedule B. Existing entries remain; Schedule B foreign-account/trust answers are still required. Keep the original CSV with your records.</p>
      <div class="form-actions"><button class="primary" data-action="apply-broker" ${!review.reviewed||p.issues.length||duplicate||loading?'disabled':''}>Add reviewed records</button><button class="secondary" data-action="discard-broker">Dismiss preview</button></div>
      </section>`:''}
    <h3>Import history</h3>${draft.brokerImports.length?draft.brokerImports.map(r=>`<details class="import-section"><summary>${escape(r.file)} · ${r.year} · ${r.fields.length} source fields</summary><p>Original imported values; later edits or deleted payers do not change this receipt.</p>${table(['Destination field','Original amount','Source','CSV records'],r.fields.map(f=>[f.target,f.value,`${f.form} · ${f.boxes.join(' + ')}`,f.rows.join(', ')]))}</details>`).join(''):'<p>No brokerage files have been applied to this draft.</p>'}
    </div>`;
}

export function sourceReceipt(draft: Draft, target: string): string {
  for(const receipt of draft.brokerImports) {
    const f=receipt.fields.find(f=>f.target===target);if(!f)continue;
    const [kind,id,key]=target.split('.');
    const payer=draft.investments[kind as 'interest'|'dividends'].find(p=>p.id===id);
    const current=payer && (payer as unknown as Record<string,string>)[key];
    return `<div class="formula"><span>Imported source</span><p>${escape(receipt.file)} · ${receipt.year}<br>${escape(f.form)} boxes ${escape(f.boxes.join(' + '))} · CSV records ${f.rows.join(', ')}<br>Original imported amount: ${escape(f.value)}${current!==undefined && (!current.trim() || Number(current)!==Number(f.value))?'<br><strong>Edited after import.</strong>':''}</p><button class="text-button" data-page="imports">Open import history →</button></div>`;
  }
  return '';
}
