import {tokenCount} from './tokens';
import type {Message} from './types';
export function draftSourceIds(draft:any){return new Set<string>([...(draft.findings||[]).flatMap((f:any)=>(f.citations||[]).map((c:any)=>c.id)),...(draft.candidates||[]).flatMap((c:any)=>[...(c.preference_source_ids||[]),...(c.constraints||[]).flatMap((x:any)=>x.source_ids||[])])]);}
export function mergeAnswerEvidence(existing:Message[],groups:Message[][],draft:any,budget=4000){
 const required=draftSourceIds(draft),known=new Map(existing.map(m=>[m.id,m]));
 for(const id of required)if(!known.has(id))throw Error('Draft cited a source not acquired in this run.');
 const chosen=existing.filter(m=>required.has(m.id)),ids=new Set(chosen.map(m=>m.id));
 if(tokenCount(chosen)>budget)throw Error('Cited draft evidence exceeds the revision budget; no citations were silently removed.');
 const add=(m:Message)=>{if(ids.has(m.id))return;if(tokenCount([...chosen,m])<=budget){chosen.push(m);ids.add(m.id)}};
 // Interleave results so the first retrieval tool cannot consume the entire
 // allowance before the second tool contributes context or contrary evidence.
 const length=Math.max(0,...groups.map(g=>g.length));
 for(let i=0;i<length;i++)for(const group of groups)if(group[i])add(group[i]);
 for(const m of existing)add(m);
 return chosen;
}
