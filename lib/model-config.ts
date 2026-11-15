import {env} from 'cloudflare:workers';
import {DEFAULT_PROVIDER,isPoeProvider,type Provider} from './provider-policy';
export type {Provider} from './provider-policy';
export type ModelConfig={key:string;model:string;endpoint?:string;format?:string;header?:string;tokenField?:string;provider?:Provider;owner?:string;operation?:string;jobId?:string};
export function modelConfig(provider:Provider=DEFAULT_PROVIDER,owner?:string,operation='answer'):ModelConfig{return isPoeProvider(provider)?{key:env.POE_API_KEY||'',model:provider==='poe-sonnet'?'claude-sonnet-5.5':provider==='poe-luna'?'GPT-6-Luna':env.POE_MODEL||'GPT-5.4',endpoint:provider==='poe-sonnet'?'https://api.poe.com/v1/chat/completions':'https://api.poe.com/v1/responses',format:provider==='poe-sonnet'?'chat':'responses',header:'Authorization',provider:'poe',owner,operation}:{key:env.OPENAI_API_KEY||'',model:env.OPENAI_MODEL||'',endpoint:env.LLM_ENDPOINT,format:env.LLM_FORMAT,header:env.LLM_AUTH_HEADER,tokenField:env.LLM_TOKEN_FIELD,provider,owner,operation};}
export function providerReady(provider:Provider=DEFAULT_PROVIDER){const cfg=modelConfig(provider);return !!(cfg.key&&cfg.model)}
