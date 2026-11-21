import {callProvider,validate} from './agent';
import {modelConfig,type Provider} from './model-config';
import {validateMessageDraft} from './message-draft';
import {applyItemReviews} from './conversation-items';
import {aliasEvidence,conversationPlan,originalCitation} from './conversation-context';
import {retrieve} from './agent';
import {fitEvidence} from './tokens';
import {hongKongToday} from './time';
import {responseLanguage} from './language';
import type {Message,Answer} from './types';

// A message and its explanatory notes are independent review units. Neither an
// invitation nor a question asserts that the recipient has agreed or is free.
export async function runMessageDraft(options:{question:string;messages:Message[];profiles:any[];context:unknown[];provider:Provider;owner?:string},providerCall=callProvider):Promise<Answer>{
 const cfg=modelConfig(options.provider,options.owner,'conversation'),start=Date.now();
 const metrics:any={model:cfg.model,model_calls:0,input_tokens:0,output_tokens:0,tool_calls:0},trace:any[]=[];
 const plan=conversationPlan(options.messages);
 let evidence=plan.full?plan.messages:fitEvidence(retrieve(options.messages,options.question,30),11000);
 if(!plan.full){const seen=new Set(evidence.map(m=>m.id));for(const m of [...evidence]){const i=plan.messages.findIndex(x=>x.id===m.id.split('@')[0]);for(const n of plan.messages.slice(Math.max(0,i-2),i+3))if(n.source_id===m.source_id&&!seen.has(n.id)){evidence.push(n);seen.add(n.id)}}evidence=fitEvidence(evidence,16000)}
 const {packet,refs}=aliasEvidence(evidence);
 const base={question:options.question,request_mode:'draft',profiles:options.profiles.map(p=>({id:p.id,name:p.name,relationship:p.relationship,context:p.context})),prior_room_context:options.context,evidence:packet,today:hongKongToday(),timezone:'Asia/Hong_Kong'};
 const ask=async(stage:string,data:any)=>{metrics.model_calls++;const r=await providerCall(cfg,stage,data,90000);metrics.input_tokens+=r.input_tokens;metrics.output_tokens+=r.output_tokens;return r.value};
 try{
  const draft=await ask('draft',base);validateMessageDraft(draft);if(!Array.isArray(draft.findings)||draft.findings.length>6)throw Error('Invalid supporting notes.');
  const items:any[]=[],omitted:any[]=[];
  if(draft.draft_message.trim())items.push({id:'message',type:'message',value:{text:draft.draft_message},source_ids:packet.map(m=>m.id),counter_source_ids:[]});
  for(const [i,f] of draft.findings.entries()){try{if(!Array.isArray(f.citations))throw Error();const ids=f.citations.map((c:any)=>c.id);if(ids.some((id:string)=>!refs.has(id)))throw Error();const note={...f,citations:ids.map((id:string)=>originalCitation(refs.get(id)!))};validate({status:'answered',findings:[note],next_question:''},evidence);items.push({id:'note_'+i,type:'finding',value:note,source_ids:ids,counter_source_ids:[]})}catch{omitted.push({id:'note_'+i,reason:'Supporting note failed source validation.'})}}
  if(typeof draft.next_question==='string'&&/[?？]$/.test(draft.next_question.trim()))items.push({id:'next_question',type:'next_question',value:{text:draft.next_question},source_ids:packet.map(m=>m.id),counter_source_ids:[]});
  const verdict=await ask('conversation_check',{...base,prior_room_context:[],items,review_instruction:'Check message independently of notes. An invitation/request needs no evidence of preference, availability or agreement. Factual premises such as "as you agreed" do. Never reject a safe invitation because an unrelated supporting note is unsupported. Reject or qualify that note only.'});
  const reviewed=applyItemReviews(items,verdict);omitted.push(...reviewed.omitted);
  const message=reviewed.accepted.find(i=>i.id==='message')?.value.text||'';
  const findings=reviewed.accepted.filter(i=>i.type==='finding').map(i=>({...i.value,...(i.review_status==='qualified'?{kind:'inference',support:'tentative'}:{})}));
  metrics.omitted_notes=omitted.filter(i=>i.id.startsWith('note_')).length;metrics.unique_messages=evidence.length;metrics.elapsed_seconds=(Date.now()-start)/1000;
  metrics.verification_failed=!!draft.draft_message.trim()&&!message;metrics.outcome=message?'checked_message':metrics.verification_failed?'message_verification_failed':'needs_clarification';
  trace.push({stage:'independent_message_and_note_verdicts',accepted:reviewed.accepted.map(i=>i.id),omitted,coverage:plan.full?'complete scoped conversation':'retrieved excerpts and neighboring turns'});
  return {status:omitted.length?'partial':draft.status,draft_message:message,findings,candidates:[],next_question:reviewed.accepted.find(i=>i.id==='next_question')?.value.text||'',trace,metrics};
 }catch(e){metrics.verification_failed=true;metrics.outcome='draft_technical_failure';metrics.elapsed_seconds=(Date.now()-start)/1000;trace.push({stage:'technical_failure',reason:e instanceof Error?e.message:'Draft failed.'});return {status:'partial',findings:[],next_question:responseLanguage(options.question)==='yue-Hant'?'草稿覆核未能完成，請重試。':'The message check could not finish. Please retry.',trace,metrics};}
}
