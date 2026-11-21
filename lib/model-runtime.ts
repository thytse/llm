import {env} from 'cloudflare:workers';
import {tokenCount,TOKENIZER} from './tokens';
import type {ModelConfig} from './model-config';
export class RuntimeLimit extends Error{constructor(message:string,public retryAfter=0){super(message)}}
export async function beginRequest(config:ModelConfig,stage:string,body:unknown){const tokens=tokenCount(body)+100;const offline=config.operation==='profile';const ceiling=config.operation==='people'?24000:config.operation==='conversation'?45000:offline?16000:config.operation==='network'?12000:8000;if(tokens>ceiling)throw new RuntimeLimit(`Input budget exhausted: ${tokens} conservative ${TOKENIZER} tokens exceeds ${ceiling}. No model request made.`);if(!config.owner||!env.DB)return {id:'',tokens};const now=new Date().toISOString(),cutoff=new Date(Date.now()-60000).toISOString();const limit=config.provider==='poe'?30:5;const id=crypto.randomUUID();const r=await env.DB.prepare("INSERT INTO usage_records(id,owner,provider,model,operation,status,record,created) SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM usage_records WHERE provider=? AND created>?)<?").bind(id,config.owner,config.provider||'hku',config.model,config.operation||stage,'started',JSON.stringify({stage,job_id:config.jobId||null,estimated_input_tokens:tokens,tokenizer:TOKENIZER}),now,config.provider||'hku',cutoff,limit).run();if(!r.meta.changes)throw new RuntimeLimit('Provider request window is full. This job is saved; resume after the cooldown.',15);return {id,tokens};}
export async function endRequest(id:string,result:Record<string,unknown>,success:boolean){if(id&&env.DB)await env.DB.prepare('UPDATE usage_records SET status=?,record=json_patch(record,?) WHERE id=?').bind(success?'completed':'failed',JSON.stringify(result),id).run();}

// Admission failures happen before a provider call. Preserve in-flight analysis
// while waiting for a slot; never repeat a request that reached the provider.
export async function withRequestWindow<T>(run:()=>Promise<T>,onWait:(seconds:number)=>void,wait=(ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms))):Promise<T>{
 let waited=0;
 for(;;){try{return await run()}catch(error){
  if(!(error instanceof RuntimeLimit)||!Number.isFinite(error.retryAfter)||error.retryAfter<=0||waited+error.retryAfter>65)throw error;
  waited+=error.retryAfter;onWait(error.retryAfter);await wait(error.retryAfter*1000);
 }}
}
