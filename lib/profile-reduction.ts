import {tokenCount} from './tokens';
export const REDUCTION_VERSION=2;
export const FINAL_OBSERVATIONS=8;
export function mergeLimit(count:number){return Math.max(1,Math.min(FINAL_OBSERVATIONS,count-1));}
// Cite observation handles while merging. Source lineage stays server-side and
// is expanded before validation; citation length cannot prevent convergence.
export function observationPacket(observations:any[]){return observations.map((o,i)=>({category:o.category,text:o.text,support:o.support,lifecycle:o.lifecycle,time_scope:o.time_scope,source_ids:['observation_'+(i+1)],counter_source_ids:[],has_counterexamples:!!o.counter_source_ids.length}));}
export function reductionGroups(observations:any[]){const groups:any[][]=[];let group:any[]=[];for(const o of observations){if(group.length>=64||(group.length>=2&&tokenCount(observationPacket([...group,o]))>6000)){groups.push(group);group=[]}group.push(o)}if(group.length)groups.push(group);return groups;}
export function expandMerge(value:any,input:any[]){
 const limit=mergeLimit(input.length);
 if(!Array.isArray(value?.attributes)||!value.attributes.length||value.attributes.length>limit)throw Error(`Consolidation must combine ${input.length} observations into at most ${limit}. Saved reading results are retained; continue the saved analysis to retry.`);
 const seen=new Set<string>();
 const resolve=(id:unknown)=>{if(typeof id!=='string'||!/^observation_[1-9]\d*$/.test(id))throw Error('Consolidation cited an unknown observation.');const index=Number(id.slice(12))-1;if(index>=input.length)throw Error('Consolidation cited an unknown observation.');seen.add(id);return input[index]};
 const attributes=value.attributes.map((a:any)=>{if(!Array.isArray(a.source_ids)||!a.source_ids.length||!Array.isArray(a.counter_source_ids))throw Error('Invalid consolidation references.');const positive=a.source_ids.map(resolve),negative=a.counter_source_ids.map(resolve);return {...a,source_ids:[...new Set(positive.flatMap((o:any)=>o.source_ids))],counter_source_ids:[...new Set([...positive.flatMap((o:any)=>o.counter_source_ids),...negative.flatMap((o:any)=>[...o.source_ids,...o.counter_source_ids])])]};});
 if(seen.size!==input.length)throw Error('Consolidation omitted observation lineage. Saved reading results are retained; continue the saved analysis to retry.');
 return {...value,attributes};
}
export function prepareReduction(state:any){
 if(state.stage==='reduce'&&state.reduction_version!==REDUCTION_VERSION){state.reduced=[];state.position=0;state.levels=0;state.reduction_version=REDUCTION_VERSION;}
 if(state.stage==='reduce'&&state.observations.length<=FINAL_OBSERVATIONS){state.stage='synthesise';state.reduced=[];state.position=0;}
}
