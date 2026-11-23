import type {Message} from './types';
import {originalCitation} from './conversation-context';
const sections=['positive','negative','mixed','ambiguous'];
export type Episode={id:string;quote_source_id?:string;section:string;date:string;situation:string;literal_wording:string;interpretation:string;clues:string;alternative:string;support:string;source_ids:string[];counter_source_ids:string[];review_status?:string;review_note?:string};
export function checkedEpisode(value:any,refs:Map<string,Message>):Episode{
 const e=structuredClone(value);if(typeof e?.quote_source_id==='string'){const quoted=refs.get(e.quote_source_id);if(!quoted||!Array.isArray(e.source_ids)||!e.source_ids.includes(e.quote_source_id)||quoted.timestamp.slice(0,10)!==e.date)throw Error('Quote anchor is outside the episode sources or date.');let quote=quoted.body.slice(0,160);const last=quote.charCodeAt(quote.length-1);if(last>=0xD800&&last<=0xDBFF)quote=quote.slice(0,-1);e.literal_wording=quote;}for(const [key,max] of Object.entries({id:80,date:10,situation:120,literal_wording:180,interpretation:700,clues:700,alternative:350}))if(typeof e[key]!=='string'||e[key].length>max||(['id','date','situation','literal_wording','interpretation','clues'].includes(key)&&!e[key].trim()))throw Error('Invalid episode '+key);
 if(!sections.includes(e.section))throw Error('Invalid episode section enum.');if(!['directly stated','tentative'].includes(e.support))throw Error('Invalid episode support enum.');if(!Array.isArray(e.source_ids)||!e.source_ids.length||!Array.isArray(e.counter_source_ids))throw Error('Invalid episode source arrays.');
 for(const id of [...e.source_ids,...e.counter_source_ids])if(!refs.has(id))throw Error('Episode source is outside the supplied originals.');
 const sources=e.source_ids.map((id:string)=>refs.get(id)!);if(!sources.some((m:Message)=>m.timestamp.slice(0,10)===e.date))throw Error('Episode date does not match a cited original.');if(!sources.some((m:Message)=>m.body.includes(e.literal_wording)))throw Error('Episode quotation is not verbatim.');
 e.source_ids=[...new Set(e.source_ids)];e.counter_source_ids=[...new Set(e.counter_source_ids)];return e;
}
export function restoreEpisode(e:Episode,refs:Map<string,Message>){return {...e,...(e.quote_source_id?{quote_source_id:refs.get(e.quote_source_id)!.id}:{}),source_ids:e.source_ids.map(id=>refs.get(id)!.id),counter_source_ids:e.counter_source_ids.map(id=>refs.get(id)!.id)};}
export function episodeView(e:Episode,refs:Map<string,Message>){return {...e,...(e.quote_source_id?{quote_source_id:refs.get(e.quote_source_id)!.id}:{}),citations:e.source_ids.map(id=>originalCitation(refs.get(id)!)),counter_citations:e.counter_source_ids.map(id=>originalCitation(refs.get(id)!))};}
export function applyItemReviews(items:any[],verdict:any){
 if(!Array.isArray(verdict?.items))throw Error('Invalid item review schema.');
 const known=new Set(items.map(i=>i.id)),byId=new Map<string,any>(),invalid=new Map<string,string>();
 for(const r of verdict.items){
  if(!r||typeof r.id!=='string'||!known.has(r.id))continue;
  if(byId.has(r.id)||invalid.has(r.id)){byId.delete(r.id);invalid.set(r.id,'Multiple review verdicts for this item.');continue;}
  if(!['supported','qualify','reject'].includes(r.decision)||typeof r.reason!=='string'||r.reason.length>250||typeof r.revised_interpretation!=='string'||r.revised_interpretation.length>700){invalid.set(r.id,'Invalid review verdict for this item.');continue;}
  byId.set(r.id,r);
 }
 const accepted:any[]=[],omitted:any[]=[];for(const item of items){const review=byId.get(item.id);if(!review||review.decision==='reject'){omitted.push({id:item.id,reason:invalid.get(item.id)||review?.reason||'No review verdict returned.'});continue}if(review.decision==='qualify'&&!review.revised_interpretation.trim()){omitted.push({id:item.id,reason:'Qualification was empty.'});continue}
 const value=structuredClone(item.value);if(review.decision==='qualify'){if(item.type==='episode'){value.interpretation=review.revised_interpretation;value.support='tentative';}else value.text=review.revised_interpretation;}
 accepted.push({...item,value,review_status:review.decision==='qualify'?'qualified':'supported',review_note:review.reason});}
 return {accepted,omitted};
}
