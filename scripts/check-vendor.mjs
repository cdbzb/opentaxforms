import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../vendor/telostax/',import.meta.url));
const original=JSON.parse(await readFile(path.join(root,'upstream.json'),'utf8'));
const patches=JSON.parse(await readFile(path.join(root,'patches.json'),'utf8'));
async function files(dir,prefix='') {
  const list=[];
  for(const entry of await readdir(dir,{withFileTypes:true})) {
    const relative=prefix+entry.name;
    if(entry.isDirectory())list.push(...await files(path.join(dir,entry.name),relative+'/'));
    else list.push(relative);
  }
  return list;
}
const expected=new Set([...Object.keys(original.sha256),...Object.keys(patches)]);
const actual=await files(path.join(root,'src'));
const errors=[];
for(const rel of actual) {
  if(!expected.has(rel)){errors.push(`Unrecorded source: ${rel}`);continue;}
  const hash=createHash('sha256').update(await readFile(path.join(root,'src',rel))).digest('hex');
  if(hash!==(patches[rel]?.sha256??original.sha256[rel]))errors.push(`Hash differs: ${rel}`);
  expected.delete(rel);
}
for(const rel of expected)errors.push(`Missing source: ${rel}`);
for(const [rel,patch] of Object.entries(patches)) {
  if(patch.kind!==(Object.hasOwn(original.sha256,rel)?'modified':'added'))errors.push(`Invalid patch classification: ${rel}`);
}
const license=await readFile(path.join(root,'LICENSE'),'utf8');
const notice=await readFile(new URL('../public/third-party-notices.txt',import.meta.url),'utf8');
if(!notice.includes(license))errors.push('Distributed notice must retain the complete TelosTax license.');
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else console.log(`${actual.length} source files verified against ${original.revision}; ${Object.keys(patches).length} recorded local changes; MIT notice retained.`);
