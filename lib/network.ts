import {currentTimeQuestion} from './time';
import {searchTerms} from './language';
import {chunkMessages} from './retrieval';
import {fitEvidence} from './tokens';
import type {Message} from './types';
export const MATCH_KINDS=['explicit request','explicit preference','repeated observation','shared context','single observation','general'] as const;
export {profileEvidence} from './profile-evidence';
import {profileEvidence} from './profile-evidence';
export function networkEvidence(profiles:any[],raw:Message[],budget=4000){
 const groups=profiles.map(p=>[profileEvidence(p),...raw.filter(m=>m.profile_id===p.id)]);
 const ordered:Message[]=[];for(let i=0;i<Math.max(0,...groups.map(g=>g.length));i++)for(const group of groups)if(group[i])ordered.push(group[i]);
 return fitEvidence(ordered,budget);
}
export function rankNetworkCandidates(candidates:any[],findings:any[],evidence:Message[]){
 const priority=(kind:string)=>MATCH_KINDS.length-(MATCH_KINDS as readonly string[]).indexOf(kind);
 return candidates.map(c=>{
  const ids=[...new Set<string>(c.preference_source_ids)];const refs=evidence.filter(m=>ids.includes(m.id));
  let match_kind=MATCH_KINDS.includes(c.match_kind)?c.match_kind:'general';
  if(!refs.length)match_kind='general';else if(refs.every(m=>m.source_id==='user-provided')&&match_kind!=='general')match_kind='shared context';
  const fit_sources=refs.map(m=>({id:m.id,quote:m.body,profile_id:m.profile_id,source_id:m.source_id,source_version:m.source_version,source_start:m.start,source_end:m.end}));
  const reasons=findings.filter(f=>(f.citations||[]).some((s:any)=>s.profile_id===c.profile_id)).map(f=>f.text);
  return {...c,match_kind,eligible:!c.constraints.some((x:any)=>x.status==='contradicted'),provisional:c.constraints.some((x:any)=>x.status==='unknown'),preference_matches:ids.length,fit_reason:typeof c.fit_reason==='string'?c.fit_reason:reasons.join(' '),fit_sources};
 }).sort((a,b)=>Number(b.eligible)-Number(a.eligible)||priority(b.match_kind)-priority(a.match_kind));
}

export function networkSearchQuery(question:string){
 const aliases=[];
 if(/caf[eé]|coffee|咖啡|cafe/i.test(question))aliases.push('cafe coffee 咖啡 咖啡店');
 if(/study|studying|uni\b|university|溫書|讀書|大學|自修/i.test(question))aliases.push('study studying university classmate 溫書 讀書 大學 同學');
 if(/dinner|eat|food|食飯|晚餐|晚飯/i.test(question))aliases.push('dinner food restaurant 食飯 餐廳');
 return question+' '+aliases.join(' ');
}

export function networkSeed(profiles:any[],messages:Message[],question:string){
 const terms=searchTerms(networkSearchQuery(question));const selected:Message[]=[];
 for(const p of profiles){const own=messages.filter(m=>m.profile_id===p.id&&m.body.length);const hints=new Set<string>();
  if(p.summary&&p.summary_version===p.version){try{const summary=JSON.parse(p.summary);for(const a of summary.attributes||[])if(a.support!=='insufficient'&&terms.some(t=>a.text.toLowerCase().includes(t)))for(const id of [...a.source_ids,...a.counter_source_ids])hints.add(id.split('@')[0]);}catch{/* Invalid profile caches supply no facts. */}}
  const scored=own.map(m=>({m,score:terms.reduce((n,t)=>n+(m.body.toLowerCase().includes(t)?1:0),0)})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score||b.m.timestamp.localeCompare(a.m.timestamp));
  const chosen=[...own.filter(m=>hints.has(m.id)).slice(0,4),...scored.slice(0,3).map(r=>r.m),...own.filter(m=>currentTimeQuestion(question)&&/\b(free|available|busy|unavailable|can't meet)\b|得閒|有空|唔得|冇空/i.test(m.body)).slice(-2)];
  selected.push(...chunkMessages([...new Map(chosen.map(m=>[m.id,m])).values()],p.version));
 }
 return selected;
}
