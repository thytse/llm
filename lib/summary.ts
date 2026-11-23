import {modelConfig} from './model-config';
import {hongKongToday} from './time';
import {env} from 'cloudflare:workers';
import {callProvider,sample,retrieve} from './agent';
import {SUMMARY_CATEGORIES,RECURRING_AREAS} from './summary-contract';
import type {Message,PersonSummary,SummaryAttribute} from './types';
export function exchangeMap(messages:Message[]){const map=new Map<string,string>();let previous=-Infinity,episode=0;for(const m of [...messages].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.start-b.start)){const time=Date.parse(m.timestamp+'Z');if(time-previous>=6*60*60*1000)episode++;map.set(m.id,'exchange_'+episode);previous=time;}return map;}
export function checkAttributes(value:any,evidence:Message[],person:string,options:{all?:Message[];context?:string;includeBehaviour?:boolean}={}):SummaryAttribute[]{
 if(!value||!Array.isArray(value.attributes)||value.attributes.length>32||typeof value.limits!=='string')throw Error('Invalid summary format; nothing was saved.');
 const refs=new Map(evidence.map(m=>[m.id,m]));const episodes=exchangeMap(options.all||evidence);const seen=new Set<string>();
 const valid=value.attributes.filter((a:any)=>{
  if(!SUMMARY_CATEGORIES.includes(a.category)||typeof a.text!=='string'||!a.text.trim()||a.text.length>350||!['directly stated','tentative','conflicting','insufficient'].includes(a.support)||!['current','historical','stale'].includes(a.lifecycle)||typeof a.time_scope!=='string'||!a.time_scope.trim()||!Array.isArray(a.source_ids)||!Array.isArray(a.counter_source_ids))return false;
  a.source_ids=[...new Set(a.source_ids)];a.counter_source_ids=[...new Set(a.counter_source_ids)];
  if(a.support==='insufficient')return false;
  if(a.category==='Background'&&/student|stud(?:y|ies|ied|ying)|university|degree|主修|大學|學生|讀緊/i.test(a.text)&&!/family|parents|hometown|家人|家庭|老竇|阿媽|故鄉|家鄉/i.test(a.text))a.category='Basic facts';
  // Recover a narrowly identifiable interest that a small model put in Basic facts.
  // Keep only matching original statements; never retain the model's mixed prose.
  if(a.category==='Basic facts'){
   const cited=a.source_ids.map((id:string)=>refs.get(id)).filter(Boolean) as Message[];
   const basic=/\b(stud(?:y|ies|ied|ying)|occupation|university|school|work as|my name|job|economics|degree)\b/i;
   const interest=/\b(films?|movies?|restaurants?|sports?|music|books?|travel|hiking)\b/i;
   if(cited.length&&!cited.some(m=>basic.test(m.body))&&cited.some(m=>interest.test(m.body))){a.category='Interests';a.source_ids=cited.filter(m=>m.speaker===person&&interest.test(m.body)).map(m=>m.id);}
  }

  const userProvided=a.source_ids.length===1&&a.source_ids[0]==='profile_context'&&!!options.context;
  if(!a.source_ids.length||[...a.source_ids,...a.counter_source_ids].some(id=>!refs.has(id)&&!(id==='profile_context'&&options.context)))throw Error('Summary source is outside the reviewed records.');
  if(a.category==='Personality and behavioural tendencies'&&!options.includeBehaviour)return false;
  const own=a.source_ids.map((id:string)=>refs.get(id)).filter((m:Message|undefined)=>m?.speaker===person) as Message[];
  if(RECURRING_AREAS.includes(a.category)){
   const repeated=new Set(own.map(m=>episodes.get(m.id))).size>=3&&new Set(own.map(m=>m.timestamp.slice(0,10))).size>=2;
   if(userProvided||!own.length)return false;
   if(!repeated){if(a.category!=='Communication style'||/usually|always|often|tends|recurring|經常|通常|成日|一貫|總係/i.test(a.text))return false;a.observation_kind='descriptive examples';a.text='In the cited message examples only, '+a.text;}else a.observation_kind='recurring';
   if(a.support!=='conflicting')a.support='tentative';
   if(a.counter_source_ids.length)a.text+=' (There are cited counterexamples; this is provisional, not an invariant preference.)';
  }else if(!own.length&&!userProvided)return false;
  if(a.support==='conflicting'&&!a.counter_source_ids.length)return false;
  if(a.support==='tentative'&&!RECURRING_AREAS.includes(a.category))return false;
  a.provenance=userProvided?'user-provided':'message';
  const sourceDates=[...a.source_ids,...a.counter_source_ids].map((id:string)=>refs.get(id)?.timestamp.slice(0,10)).filter(Boolean).sort();
  a.time_scope=userProvided?'User-provided context at summary generation':`Source dates: ${sourceDates[0]} to ${sourceDates.at(-1)}`;
  // Display checked concise observations; exact originals stay behind Evidence.

  return true;
 }) as SummaryAttribute[];
 const merged:SummaryAttribute[]=[];
 for(const a of valid){const previous=merged.find(p=>p.category===a.category&&p.provenance===a.provenance&&p.support===a.support&&p.lifecycle===a.lifecycle&&p.observation_kind===a.observation_kind);if(previous){previous.text+=' '+a.text;previous.source_ids=[...new Set([...previous.source_ids,...a.source_ids])];previous.counter_source_ids=[...new Set([...previous.counter_source_ids,...a.counter_source_ids])]}else merged.push(a)}
 return merged;
}

export function completeAreas(attributes:SummaryAttribute[],includeBehaviour:boolean,from:string,to:string):SummaryAttribute[]{return SUMMARY_CATEGORIES.flatMap(category=>attributes.some(a=>a.category===category)?attributes.filter(a=>a.category===category):[{category,text:category==='Personality and behavioural tendencies'&&!includeBehaviour?'Optional behavioural reflection is disabled and excluded from the primary benchmark.':`No reliable evidence for ${category.toLowerCase()} was found in the authorised records reviewed.`,support:'insufficient',lifecycle:'current',time_scope:`Reviewed scope: ${from} to ${to}`,provenance:'none',source_ids:[],counter_source_ids:[]}]);}
export async function buildSummary(input:{messages:Message[];person:string;context:string;version:number;relationship?:string;includeBehaviour?:boolean},provider=callProvider):Promise<PersonSummary>{
 const start=Date.now();const {messages,person,context,version}=input;const includeBehaviour=input.includeBehaviour===true;
 if(!messages.length)throw Error('Upload a conversation before generating a summary.');
 const cfg=modelConfig();
 const bounded=(ms:Message[])=>{let chars=0;return ms.filter(m=>{if(chars+m.body.length>18000)return false;chars+=m.body.length;return true})};
 const episodes=exchangeMap(messages);const packet=(ms:Message[])=>ms.map(m=>({...m,exchange_id:episodes.get(m.id)}));
 const probes=['study occupation work university job family hometown grew up moved','film restaurant sports music books travel','usually routine every morning weekend'];
 const initial=bounded([...new Map([...sample(messages),...probes.flatMap(q=>retrieve(messages,q,5))].map(m=>[m.id,m])).values()]);
 const today=hongKongToday();const base={person,user_context:context,include_behaviour:includeBehaviour,today,source_version:version,total_messages:messages.length,sampled_messages:initial.length,evidence:packet(initial)};
 const generated=await provider(cfg,'summary',base,45000);const attrs=checkAttributes(generated.value,initial,person,{all:messages,context,includeBehaviour});
 const additional=attrs.filter(a=>RECURRING_AREAS.includes(a.category)||a.support==='conflicting').flatMap(a=>retrieve(messages,a.text,8));
 const evidence=bounded([...new Map([...attrs.flatMap(a=>[...a.source_ids,...a.counter_source_ids]).map(id=>initial.find(m=>m.id===id)).filter((m):m is Message=>!!m),...additional,...initial].map(m=>[m.id,m])).values()]);
 const candidate={attributes:attrs.map((a,index)=>({attribute_id:'attribute_'+index,...a})),limits:generated.value.limits};
 const review=await provider(cfg,'summary_check',{person,user_context:context,include_behaviour:includeBehaviour,today,candidate,evidence:packet(evidence)},Math.max(1,Math.min(45000,90000-(Date.now()-start))));
 const accepted=review.value?.accepted_attribute_ids;
 if(!Array.isArray(accepted)||accepted.some((id:unknown)=>typeof id!=='string'||!candidate.attributes.some(a=>a.attribute_id===id)))throw Error('Summary review returned invalid references; nothing was saved.');
 const attributes=attrs.filter((_,index)=>accepted.includes('attribute_'+index));
 if(!attributes.some(a=>a.category==='Basic facts'))attributes.push({category:'Basic facts',text:`User-provided profile name: ${person}. This label is not an independently verified identity.`,support:'directly stated',lifecycle:'current',time_scope:'Profile metadata at summary generation',provenance:'user-provided',source_ids:['profile_metadata'],counter_source_ids:[]});
 if(input.relationship&&!attributes.some(a=>a.category==='Relationship context'))attributes.push({category:'Relationship context',text:`User-provided relationship label: ${input.relationship}.`+(context?' User-provided context: '+context.slice(0,200):''),support:'directly stated',lifecycle:'current',time_scope:'Profile metadata at summary generation',provenance:'user-provided',source_ids:['profile_metadata'],counter_source_ids:[]});
 const dates=messages.map(m=>m.timestamp.slice(0,10)).sort();const from=dates[0],to=dates.at(-1)!;
 const limits=`Reviewed ${evidence.length} of ${messages.length} messages dated ${from} to ${to}. Missing evidence is limited to this reviewed scope; it does not establish that a fact or trait is absent. Self-reports and user-provided details are not independently verified. Recurring observations require three exchanges on two days, separated by at least six hours of inactivity. Personality reflection is optional and excluded from the primary benchmark.`;
 if(Date.now()-start>90000)throw Error('Summary deadline exceeded; nothing was saved.');
 return {schema_version:3,include_behaviour:includeBehaviour,attributes:completeAreas(attributes,includeBehaviour,from,to),limits,reviewed_messages:evidence.length,total_messages:messages.length,from,to,generated:new Date().toISOString(),model:cfg.model,model_calls:2,version};
}
