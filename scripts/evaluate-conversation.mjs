import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
const cases=JSON.parse(await readFile(new URL('../evaluation/conversation/cases.json',import.meta.url),'utf8'));
const dimensions=['source_fidelity','context_coverage','interpretation','calibration','usefulness_language'];
if(process.argv.includes('--score')){
 const file=process.argv[process.argv.indexOf('--score')+1];if(!file)throw Error('Provide a completed rating JSON path.');
 const ratings=JSON.parse(await readFile(file,'utf8'));if(!Array.isArray(ratings)||!ratings.length)throw Error('No ratings.');
 const seen=new Set();for(const r of ratings){const id=r.case_id+'|'+r.reviewer_id;if(!cases.some(c=>c.id===r.case_id)||typeof r.reviewer_id!=='string'||!r.reviewer_id.trim()||seen.has(id)||!dimensions.every(d=>Number.isInteger(r.scores?.[d])&&r.scores[d]>=0&&r.scores[d]<=2)||typeof r.notes!=='string'||!r.notes.trim())throw Error('Incomplete, duplicate or invalid independent human rating.');seen.add(id)}
 process.stdout.write(JSON.stringify({rated_entries:ratings.length,independent_reviewers:new Set(ratings.map(r=>r.reviewer_id)).size,mean:Object.fromEntries(dimensions.map(d=>[d,ratings.reduce((n,r)=>n+r.scores[d],0)/ratings.length])),warning:'Descriptive development ratings only; this does not establish general semantic accuracy.'},null,2)+'\n');process.exit(0);
}
const out=new URL('../evaluation/runs/conversation-'+new Date().toISOString().replace(/[:.]/g,'-')+'/',import.meta.url);await mkdir(out,{recursive:true});
await writeFile(new URL('human-ratings.json',out),JSON.stringify(cases.flatMap(c=>['reviewer-a','reviewer-b'].map(slot=>({case_id:c.id,reviewer_slot:slot,reviewer_id:null,scores:null,notes:''}))),null,2));
if(!process.argv.includes('--live')){process.stdout.write('Prepared '+cases.length+' synthetic cases and blank human ratings. No model calls made. Output: '+out.pathname+'\n');process.exit(0)}
// The bundle reads a process-local credential without embedding it in code or
// result artifacts. The stub has no access to personal DB data.
const vars=await readFile(new URL('../.dev.vars',import.meta.url),'utf8');const entry=vars.split(/\r?\n/).find(l=>/^POE_API_KEY=/.test(l));const key=entry?.slice(entry.indexOf('=')+1).trim().replace(/^(["'])(.*)\1$/,'$2');if(!key)throw Error('Saved Poe key unavailable.');
process.env.UNDERTONE_EVAL_POE_KEY=key;
const bundle=await build({entryPoints:['lib/conversation-run.ts'],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'evaluation-env',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'evaluation'}));b.onLoad({filter:/.*/,namespace:'evaluation'},()=>({contents:'export const env={POE_API_KEY:process.env.UNDERTONE_EVAL_POE_KEY};'}));b.onResolve({filter:/^\.\/service$/},()=>({path:'service',namespace:'service'}));b.onLoad({filter:/.*/,namespace:'service'},()=>({contents:'export class HttpError extends Error{};export function db(){throw Error("Evaluation has no personal database access")}'}));}}]});
const {runConversation}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
for(const c of cases){const messages=c.turns.map(([speaker,body],i)=>({id:c.id+'-m'+i,profile_id:'synthetic',source_id:c.id,speaker,body,timestamp:'2026-11-01T10:'+String(i).padStart(2,'0')+':00',start:i*100,end:i*100+body.length,source_version:1}));const answer=await runConversation({question:c.question,messages,profiles:[{id:'synthetic',name:'Maya',context:'Synthetic evaluation only.'}],context:[],provider:'poe-sonnet',variant:'C'});await writeFile(new URL(c.id+'.json',out),JSON.stringify({case_id:c.id,question:c.question,originals:messages,answer},null,2));process.stdout.write(c.id+': '+answer.status+'; '+answer.metrics.model_calls+' calls\n')}
process.stdout.write('Outputs saved privately. Human ratings remain pending: '+out.pathname+'\n');
