import {callProvider,validate} from './agent';
import {modelConfig,type Provider} from './model-config';
import {MATCH_KINDS,rankNetworkCandidates} from './network';
import {aliasEvidence,originalCitation} from './conversation-context';
import {applyItemReviews} from './conversation-items';
import {exchangeMap} from './summary';
import {fitEvidence} from './tokens';
import {hongKongToday,currentAvailabilitySupported} from './time';
import {responseLanguage} from './language';
import type {Message,Answer} from './types';

// Detect conflicting import attribution, without guessing which profile is right.
export function conflictingSpeakers(messages:Message[]){
 const groups=new Map<string,Message[]>();
 for(const m of messages){if(m.source_id==='user-provided'||m.body.trim().length<6)continue;const key=m.timestamp+'|'+m.body.trim();groups.set(key,[...(groups.get(key)||[]),m])}
 const ids=new Set<string>();for(const group of groups.values())if(group.some(a=>group.some(b=>a.profile_id!==b.profile_id&&(a.speaker==='You')!==(b.speaker==='You'))))for(const m of group)ids.add(m.id.split('@')[0]);return ids;
}
export function peopleContext(initial:Message[],messages:Message[],budget=8000){
 const groups=initial.map(anchor=>{const own=messages.filter(m=>m.profile_id===anchor.profile_id&&m.source_id===anchor.source_id).sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.start-b.start);const i=own.findIndex(m=>m.id===anchor.id.split('@')[0]);return i<0?[anchor]:[anchor,...own.slice(Math.max(0,i-2),i+3)]});
 const ordered:Message[]=[],seen=new Set<string>();for(let i=0;i<6;i++)for(const group of groups){const m=group[i];if(m&&!seen.has(m.id)){ordered.push(m);seen.add(m.id)}}return fitEvidence(ordered,budget);
}
export async function runPeopleQuestion(options:{question:string;messages:Message[];profiles:any[];context:unknown[];evidence:Message[];provider:Provider;owner?:string},providerCall=callProvider):Promise<Answer>{
 const cfg=modelConfig(options.provider,options.owner,'people'),start=Date.now();const metrics:any={model:cfg.model,provider:cfg.provider,model_calls:0,input_tokens:0,output_tokens:0,tool_calls:0,engine:'people-items-v1'},trace:any[]=[];
 const evidence=peopleContext(options.evidence,options.messages),{packet,refs}=aliasEvidence(evidence),conflicts=conflictingSpeakers(options.messages);
 const ambiguous=packet.filter(m=>conflicts.has(refs.get(m.id)!.id.split('@')[0])).map(m=>m.id);
 const base={question:options.question,request_mode:'network',profiles:options.profiles.map(p=>({id:p.id,name:p.name,relationship:p.relationship})),prior_room_context:options.context,evidence:packet,today:hongKongToday(),timezone:'Asia/Hong_Kong',ambiguous_speaker_source_ids:ambiguous};
 const ask=async(stage:string,data:any)=>{metrics.model_calls++;trace.push({stage,evidence_messages:packet.length});try{const r=await providerCall(cfg,stage,data,120000);metrics.input_tokens+=r.input_tokens;metrics.output_tokens+=r.output_tokens;return r.value}catch(e){const d=(e as any)?.details;if(Number.isFinite(d?.input_tokens)&&Number.isFinite(d?.output_tokens)){metrics.input_tokens+=d.input_tokens;metrics.output_tokens+=d.output_tokens}else metrics.provider_usage_unknown=true;throw e}};
 try{
  const response=await ask('network_answer',base);if(!response||typeof response!=='object'||Array.isArray(response))throw Error('Invalid people-answer schema: expected an object.');
  const candidates=new Map<string,any>(),items:any[]=[],omitted:any[]=[],selected=new Set(options.profiles.map(p=>p.id));
  const section=(key:string,max:number)=>{const value=response[key];if(!Array.isArray(value)){omitted.push({id:'section_'+key,reason:`Invalid ${key} section; omitted before review.`});return [];}if(value.length>max)omitted.push({id:'section_'+key,reason:`${value.length-max} excess ${key} omitted before review.`});return value.slice(0,max);};
  const draft={candidates:section('candidates',3),findings:section('findings',5),next_question:typeof response.next_question==='string'&&response.next_question.length<=2000?response.next_question:''};
  if(omitted.length)trace.push({stage:'people_answer_schema_omissions',fields:omitted.map(x=>x.id)});
  for(const [i,input] of draft.candidates.entries()){const id='person_'+i;try{const c=structuredClone(input);if(!selected.has(c.profile_id)||[...candidates.values()].some(x=>x.profile_id===c.profile_id)||typeof c.fit_reason!=='string'||!c.fit_reason.trim()||c.fit_reason.length>700||!MATCH_KINDS.includes(c.match_kind)||!Array.isArray(c.preference_source_ids)||!Array.isArray(c.constraints)||c.constraints.length>8)throw Error('Invalid candidate schema.');
    const ids=[...c.preference_source_ids,...c.constraints.flatMap((x:any)=>{if(!x||typeof x.name!=='string'||!['supported','contradicted','unknown'].includes(x.status)||!Array.isArray(x.source_ids)||x.status!=='unknown'&&!x.source_ids.length)throw Error('Invalid constraint.');return x.source_ids})];
    if(ids.some((id:string)=>!refs.has(id)||refs.get(id)!.profile_id!==c.profile_id))throw Error('Candidate source belongs to another person or is unavailable.');
    if(ids.some((id:string)=>ambiguous.includes(id)))throw Error('Candidate relies on conflicting imported speaker attribution.');
    if(!c.preference_source_ids.length)c.match_kind='general';if(c.match_kind==='repeated observation'){const own=options.messages.filter(m=>m.profile_id===c.profile_id),exchanges=exchangeMap(own),support=c.preference_source_ids.map((id:string)=>refs.get(id)!).filter((m:Message)=>m.source_id!=='user-provided');const distinct=new Set(support.map((m:Message)=>exchanges.get(m.id.split('@')[0])).filter(Boolean));if(distinct.size<3||new Set(support.map((m:Message)=>m.timestamp.slice(0,10))).size<2)c.match_kind='single observation';}
    for(const x of c.constraints)if(/availab|\btime\b|得閒|有空|時間|檔期/i.test(x.name)&&x.status!=='unknown'){
     const sources=x.source_ids.map((id:string)=>refs.get(id)!);if(!sources.some((m:Message)=>m.timestamp.slice(0,10)===hongKongToday())||x.status==='supported'&&!currentAvailabilitySupported(sources,hongKongToday())){x.status='unknown';x.source_ids=[];}
    }
    if(!c.constraints.some((x:any)=>/availab|得閒|有空|檔期/i.test(x.name)))c.constraints.push({name:'Current availability',status:'unknown',source_ids:[]});
    candidates.set(id,c);items.push({id,type:'candidate',value:{text:c.fit_reason,match_kind:c.match_kind,constraints:c.constraints,profile_id:c.profile_id},source_ids:[...new Set([...c.preference_source_ids,...c.constraints.flatMap((x:any)=>x.source_ids)])],counter_source_ids:[]});
   }catch(e){omitted.push({id,reason:e instanceof Error?e.message:'Candidate validation failed.'})}}
  for(const [i,f] of draft.findings.entries()){try{if(!Array.isArray(f.citations))throw Error('Invalid citations');const ids=f.citations.map((c:any)=>c.id);if(ids.some((id:string)=>!refs.has(id)||ambiguous.includes(id)))throw Error('Finding relies on unavailable or speaker-conflicted evidence.');const value={...f,citations:ids.map((id:string)=>originalCitation(refs.get(id)!))};validate({status:'answered',findings:[value],next_question:''},evidence);items.push({id:'finding_'+i,type:'finding',value,source_ids:ids,counter_source_ids:[]})}catch{omitted.push({id:'finding_'+i,reason:'Finding failed source or schema checks.'})}}
  if(typeof draft.next_question==='string'&&/[?？]$/.test(draft.next_question.trim()))items.push({id:'next_question',type:'next_question',value:{text:draft.next_question},source_ids:[],counter_source_ids:[]});
  const verdict=items.length?await ask('conversation_check',{...base,prior_room_context:[],items,review_instruction:'Review each candidate independently. Its text, match_kind and all supported/contradicted constraints must follow from its OWN source_ids and profile_id. Reject wrong-person or unsupported constraints; do not qualify them into acceptance. Qualify only reason wording when those fields remain valid. Unknown availability is expected, not a reason to reject an invitation suggestion. General options require no personal preference claim. Other people and ambiguous imports are context for detecting errors, never evidence for this person. A bad person/finding must not reject another independently supported option.'}):{items:[]};
  let reviewed:ReturnType<typeof applyItemReviews>;
  try{reviewed=applyItemReviews(items,verdict)}catch{reviewed={accepted:[],omitted:items.map(i=>({id:i.id,reason:'Invalid item review schema.',retryable:true}))};}
  const retryItems=items.filter(i=>i.type==='candidate'&&reviewed.omitted.some(o=>o.id===i.id&&o.retryable===true));
  if(retryItems.length){
   const errors=reviewed.omitted.filter(o=>retryItems.some(i=>i.id===o.id)).map(o=>({id:o.id,reason:o.reason}));
   trace.push({stage:'candidate_review_retry',items:retryItems.map(i=>i.id),errors});
   try{
    const retryVerdict=await ask('conversation_check',{...base,prior_room_context:[],items:retryItems,format_errors:errors,review_instruction:'Independently review only the listed candidates against their own evidence and constraints. Return exactly one verdict per listed ID, with decision supported, qualify or reject; reason must be a string of at most 250 characters; revised_interpretation must be a string of at most 700 characters and must be nonempty for qualify. Reject unsupported claims. Do not approve an item merely to repair formatting.'});
    const retry=applyItemReviews(retryItems,retryVerdict);const retried=new Set(retryItems.map(i=>i.id));reviewed={accepted:[...reviewed.accepted,...retry.accepted],omitted:[...reviewed.omitted.filter(o=>!retried.has(o.id)),...retry.omitted]};
   }catch{trace.push({stage:'candidate_review_retry_failure',reason:'Candidate review retry did not complete.'});}
  }
  omitted.push(...reviewed.omitted);
  const accepted=reviewed.accepted.filter(i=>i.type==='candidate').map(i=>{const c=candidates.get(i.id);return {...c,fit_reason:i.value.text,preference_source_ids:c.preference_source_ids.map((id:string)=>refs.get(id)!.id),constraints:c.constraints.map((x:any)=>({...x,source_ids:x.source_ids.map((id:string)=>refs.get(id)!.id)}))}});
  const findings=reviewed.accepted.filter(i=>i.type==='finding').map(i=>({...i.value,...(i.review_status==='qualified'?{kind:i.value.citations.length?'inference':'suggestion',support:'tentative'}:{})}));
  metrics.omitted_candidates=omitted.filter(i=>i.id.startsWith('person_')).length;metrics.omitted_items=omitted.length;metrics.ambiguous_source_messages=ambiguous.length;metrics.unique_messages=new Set(evidence.filter(m=>m.source_id!=='user-provided').map(m=>m.id.split('@')[0])).size;metrics.people_exposed=options.profiles.length;metrics.elapsed_seconds=(Date.now()-start)/1000;metrics.outcome=accepted.length?'checked_people_options':'no_checked_people_options';
  trace.push({stage:'independent_people_verdicts',accepted:reviewed.accepted.map(i=>i.id),omitted});
  const yue=responseLanguage(options.question)==='yue-Hant';const notices=[...(ambiguous.length?[yue?'部分匯入對話有相同訊息但講者標籤互相矛盾，未用作個人喜好證據。':'Some imported messages repeat across profiles with conflicting speaker labels; they were excluded as preference evidence.']:[]),...(reviewed.omitted.some(o=>o.retryable&&String(o.id).startsWith('person_'))?[yue?'部分建議對象嘅覆核未能完成，唔代表佢哋唔適合。':'Some candidate reviews could not be completed; this does not mean those people are unsuitable.']:[]),...(!accepted.length?[yue?'今次未有完成檢查嘅個人建議；呢個唔代表冇合適對象。':'No checked person-specific recommendation is available; this does not mean nobody is suitable.']:[])];
  return {status:omitted.length||!accepted.length?'partial':'answered',candidates:rankNetworkCandidates(accepted,findings,evidence),findings,next_question:reviewed.accepted.find(i=>i.id==='next_question')?.value.text||'',trace,metrics,...(notices.length?{analysis_notice:notices.join(' ')}:{})};
 }catch(e){metrics.verification_failed=true;metrics.outcome='people_technical_failure';metrics.elapsed_seconds=(Date.now()-start)/1000;trace.push({stage:'technical_failure',reason:e instanceof Error?e.message:'People analysis failed.'});return {status:'partial',candidates:[],findings:[],next_question:'',trace,metrics};}
}
