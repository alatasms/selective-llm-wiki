// Dependency-free regressions with mocked IO. Input constructors enforce the
// onSubmit requirement of Claude Code 2.1.287; this is not native rendering.
import assert from 'node:assert/strict';
import { actionPrompt, isSourcePath, register, searchNotes, sourceInfo, freshness, history, fold, termMatch, clipBytes, utf8Length, snapshot, LIMITS } from '../plugins/selective-wiki-ui/hooks/register.mjs';
// A date recorded after local midnight must not be flagged as future.
const localMidnight = new Date(2026, 9, 11, 0, 15).getTime();
assert.equal(freshness('Updated: 2026-10-11', localMidnight).label, '0 day(s) since record — live verification unknown');
assert.ok(freshness('Updated: 2026-10-12', localMidnight).label.includes('Future'));
const root='/work/project';
for (const path of ['', '/raw/a.md', 'wiki/a.md', 'raw/../a.md', 'raw//a.md', 'docs/./a.md', 'raw/a\\b.md']) {
  assert.equal(isSourcePath(path),false); assert.throws(()=>actionPrompt('ingest',root,'',path));
}
assert.ok(actionPrompt('ingest',root,'Redis','docs/vendor.md').includes('supplied-source mode'));
const handlers=[],reads=[],prompts=[],writes=[],scheduled=[];
let missingSource=false;
register((event,filter,fn)=>handlers.push({event,filter:typeof filter==='function'?{}:filter,fn:typeof filter==='function'?filter:fn}));
const $={
 session:{cwd:async()=>root},command:{register:async()=>{}},
 fs:{exists:async()=>true,stat:async path=>{
   if (missingSource && path.endsWith('vendor.md')) throw Error('Source removed');
   return {kind:/\.[a-z]+$/.test(path)?'file':'dir',size:path.endsWith('large.md')?LIMITS.note+1:100,
    isLink:path.endsWith('link.md'),realPath:path.endsWith('escape.md')?'/outside/escape.md':path};
 },list:async path=>[
   {name:'vendor.md',kind:'file',size:100},
   {name:'large.md',kind:'file',size:LIMITS.note+1},
   {name:'report.pdf',kind:'file',size:100},
   {name:'escape.md',kind:'file',size:100},
   {name:'link.md',kind:'file',isLink:true,size:100}
 ],read:async path=>{reads.push(path);return path.endsWith('state.md')?'Updated: 2026-10-11\n## Startup summary\nContinue\n## Active work\nTask':'# Vendor\nRedis evidence';},write:async path=>writes.push(path)},
 clock:{after:(ms,fn)=>scheduled.push(fn)},prompt:{submit:async p=>prompts.push(p.text)},
 ui:{open:async()=>({isPlaced:true}),close:async()=>{},log:()=>{},toast:()=>{},invalidate:()=>{},resolve:()=>Object.fromEntries(['Box','Text','Button','Input'].map(type=>[type,props=>{if(type==='Input')assert.equal(typeof props.onSubmit,'function',`Input ${props.key} needs onSubmit`);return {type,props,children:props.children||[]};}]))}
};
async function event(name,e={}){const h=handlers.find(h=>h.event===name&&Object.entries(h.filter||{}).every(([k,v])=>e[k]===v));assert.ok(h);return h.fn($,e,async()=>null);}
async function render(){return event('ui.render',{component:'Pane',requestId:'selective-wiki-dashboard'});}
function find(tree,key){if(tree?.props?.key===key)return tree;for(const c of tree?.children||[]){const f=find(c,key);if(f)return f;}}
async function press(key){const c=find(await render(),key);assert.ok(c,key);await c.props.onPress();}
async function settle(){while(scheduled.length)await scheduled.shift()();}
await event('session.start',{isInteractive:true,surface:'terminal'});
assert.equal(reads.length,2);assert.equal(prompts.length,0);
await press('tab-search');await press('filter-sources');
assert.ok(!find(await render(),'note-raw/vendor.md'));
assert.equal(reads.length,2);
await event('command.run',{command:'wiki-sources',args:'vendor'});
assert.ok(find(await render(),'note-raw/vendor.md'));assert.ok(find(await render(),'note-docs/vendor.md'));
assert.ok(!find(await render(),'ingest'));assert.ok(!find(await render(),'research'));assert.ok(!find(await render(),'audit'));
assert.ok(!reads.some(p=>p.endsWith('large.md')||p.endsWith('.pdf')||p.endsWith('escape.md')||p.endsWith('link.md')));
await press('note-raw/vendor.md');assert.equal(prompts.length,0);
find(await render(),'source-scope').props.onInput('Temporary scope');
find(await render(),'source-scope').props.onSubmit('Redis only');assert.equal(prompts.length,0);
await press('ingest');await press('ingest');assert.equal(prompts.length,0);await settle();assert.equal(prompts.length,1);
assert.ok(prompts[0].includes('Source: "raw/vendor.md"'));assert.ok(prompts[0].includes('Redis only'));assert.ok(prompts[0].includes('/skills/ingest/'));
missingSource=true;await press('ingest');await settle();assert.equal(prompts.length,1);missingSource=false;
await event('command.run',{command:'wiki-sources',args:'report'});
await press('note-docs/report.pdf');assert.ok(!reads.some(p=>p.endsWith('.pdf')));await press('ingest');await settle();assert.ok(prompts.at(-1).includes('docs/report.pdf'));
await find(await render(),'search').props.onInput('');
assert.ok(!find(await render(),'note-docs/report.pdf'));assert.ok(!find(await render(),'ingest'));
assert.equal((await searchNotes($,root,'','sources')).message,'');
await press('tab-state');await press('save');await settle();assert.ok(!prompts.at(-1).includes('docs/report.pdf'));assert.ok(!prompts.at(-1).includes('Redis only'));
await press('tab-search');await press('filter-wiki');assert.ok(find(await render(),'research'));assert.ok(!find(await render(),'ingest'));assert.ok(!find(await render(),'note-docs/report.pdf'));
const result=await searchNotes($,root,'large','sources');assert.equal(result.results.length,2);assert.ok(result.results.every(r=>r.path.endsWith('large.md')));
await assert.rejects(()=>sourceInfo($,root,'raw/escape.md'));await assert.rejects(()=>sourceInfo($,root,'raw/link.md'));
assert.equal(writes.length,0);
// Log order: newest five regardless of file order; ties follow file direction.
const rows=n=>Array.from({length:n},(_,i)=>`## 2026-10-0${i+1}\nChange ${i}`);
assert.ok(history(rows(8).join('\n')).at(0).includes('Change 7'));
assert.ok(history(rows(8).reverse().join('\n')).at(0).includes('Change 7'));
assert.equal(history('no dates').length,0);
// Bytes, not characters.
assert.equal(utf8Length('çğ猫😀'),2+2+3+4);
assert.equal(clipBytes('aç猫',3),'aç');assert.equal(clipBytes('abc猫',4),'abc');assert.equal(clipBytes('ab猫c',4,true),'猫c');
// Turkish-aware, diacritic-insensitive, inflection-tolerant matching.
assert.equal(fold('İSTANBUL ıspanak ŞÖĞÜÇ'),'istanbul ispanak sogüc'.replace('ü','u'));
const hay=fold('Kararlar ve Karar kayıtları'),words=new Set(hay.match(/[\p{L}\p{N}]+/gu));
assert.equal(termMatch('karar',hay,words),'exact');
assert.equal(termMatch('kararlarimizin',fold('Karar notu'),new Set(['karar','notu'])),'stem');
assert.equal(termMatch('ab',fold('xyz'),new Set(['xyz'])),'');
assert.equal(termMatch('kar',fold('karar'),new Set(['karar'])),'exact');
// Oversized state degrades with a warning; absurd size still fails visibly.
const big={...$,fs:{...$.fs,stat:async p=>({kind:'file',size:p.endsWith('state.md')?LIMITS.state+500:100,realPath:p}),
  read:async p=>p.endsWith('state.md')?'Updated: 2026-10-11\n## Startup summary\nContinue\n## Active work\n'+'é'.repeat(LIMITS.state):'## 2026-10-11\nEntry'}};
const degraded=await snapshot(big,root);
assert.equal(degraded.summary,'Continue');assert.ok(degraded.stateWarning.includes('exceeds'));assert.equal(degraded.hook,true);
const huge={...big,fs:{...big.fs,stat:async p=>({kind:'file',size:LIMITS.bytes+1,realPath:p})}};
await assert.rejects(()=>snapshot(huge,root),/exceeds/);
const noHook={...big,fs:{...big.fs,exists:async p=>!p.endsWith('session_start.py')}};
assert.equal((await snapshot(noHook,root)).hook,false);
console.log('PASS: source search/filter/selection, filename discovery for large/binary files, no binary preview, scoped ingest, queued deduplication, deleted/escaped/symlink rejection, independent conversation save and return to wiki. No writes or model calls.');
