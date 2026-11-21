import {orderedEpisodes} from './conversation-order';
import {tokenCount} from './tokens';
// Previous answers anchor follow-ups, but must never become source evidence.
export function packRoomContext(turns:{question:string;answer:string}[],budget=3000){
 const result:any[]=[];
 for(const turn of [...turns].reverse()){
  let a:any;try{a=JSON.parse(turn.answer)}catch{continue}
  const sources=(citations:any[])=>Array.isArray(citations)?citations.slice(0,4).map(c=>c.id):[];
  const prior={question:turn.question.slice(0,500),untrusted_prior_answer:{
   overview:typeof a.overview==='string'?a.overview.slice(0,350):'',
   episodes:orderedEpisodes<any>(a.episodes||[]).slice(0,16).map((e:any,index:number)=>({number:index+1,id:e.id,date:e.date,situation:e.situation?.slice(0,80),interpretation:e.interpretation?.slice(0,140),source_ids:sources(e.citations),counter_source_ids:sources(e.counter_citations)})),
   findings:(a.findings||[]).slice(0,6).map((f:any)=>({text:f.text?.slice(0,250),source_ids:sources(f.citations)})),
   patterns:(a.patterns||[]).slice(0,4).map((p:any)=>({text:p.text?.slice(0,180),source_ids:sources(p.citations)})),
   draft_message:typeof a.draft_message==='string'?a.draft_message.slice(0,1200):'',
   candidates:(a.candidates||[]).slice(0,8).map((c:any)=>({profile_id:c.profile_id,fit_reason:c.fit_reason?.slice(0,160),source_ids:c.preference_source_ids})),
   next_question:typeof a.next_question==='string'?a.next_question.slice(0,250):''
  }};
  if(tokenCount([prior,...result])>budget){
   if(result.length)break;
   // Preserve ordinal episode anchors even if a very large latest answer needs
   // shorter descriptions. Do not silently reorder the previous examples.
   prior.untrusted_prior_answer.overview=prior.untrusted_prior_answer.overview.slice(0,120);
   prior.untrusted_prior_answer.episodes=prior.untrusted_prior_answer.episodes.map((e:any)=>({...e,situation:e.situation?.slice(0,30),interpretation:e.interpretation?.slice(0,50),source_ids:e.source_ids.slice(0,1),counter_source_ids:[]}));
   prior.untrusted_prior_answer.findings=[];prior.untrusted_prior_answer.patterns=[];prior.untrusted_prior_answer.candidates=[];
   if(tokenCount(prior)>budget)continue;
  }
  result.unshift(prior);
 }
 return result;
}
