// Temporary short reference IDs save output tokens; only reference arrays change.
// Original source IDs are restored before any scope checks or persisted findings.
export function compactReferences(observations:any[]){
 const ids=[...new Set<string>(observations.flatMap(o=>[...o.source_ids,...o.counter_source_ids]))];
 const restore=new Map(ids.map((id,i)=>['ref_'+(i+1),id]));const encode=new Map([...restore].map(([short,id])=>[id,short]));
 return {observations:observations.map(o=>({...o,source_ids:o.source_ids.map((id:string)=>encode.get(id)),counter_source_ids:o.counter_source_ids.map((id:string)=>encode.get(id))})),restore};
}
export function restoreReferences(value:any,restore:Map<string,string>){if(!Array.isArray(value?.attributes))return value;return {...value,attributes:value.attributes.map((a:any)=>({...a,source_ids:Array.isArray(a.source_ids)?a.source_ids.map((id:string)=>restore.get(id)||id):a.source_ids,counter_source_ids:Array.isArray(a.counter_source_ids)?a.counter_source_ids.map((id:string)=>restore.get(id)||id):a.counter_source_ids}))};}
export function stageOutputLimit(stage:string,operation?:string){
 if(operation==='profile'){if(stage==='summary_check')return 1200;if(stage==='summary_merge'||stage==='summary')return 5000;return 3000;}
 return stage.startsWith('summary')?2200:operation==='network'?1800:1000;
}
export class IncompleteModelResponse extends Error{
 constructor(public details:Record<string,unknown>,profileJob=false){
  const recovery=profileJob?'Completed batches are saved; use Continue saved analysis to retry this stage.':'Try the question again; no partial JSON was accepted.';
  super((details.reason==='max_output_tokens'||details.finish_reason==='length'?'The model reached its output-length limit before finishing the JSON.':`The model did not finish its response (status: ${String(details.status||details.finish_reason||'unknown')}).`)+' '+recovery);
 }
}
