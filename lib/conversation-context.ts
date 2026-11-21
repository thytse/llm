import {tokenCount,splitText} from './tokens';
import type {Message} from './types';
export const FULL_CONTEXT_BUDGET=24000;
export const MEMORY_BATCH_BUDGET=8500;
export function questionRoom(ids:string[],from='',to='',sourceIds:string[]=[],network=false){return (network?'network::':'')+[...ids].sort().join('|')+(from||to?'::'+from+':'+to:'')+(sourceIds.length?'::files:'+ [...sourceIds].sort().join('|'):'');}
export function conversationPacket(messages:Message[]){return messages.map((m,i)=>({id:'m'+(i+1),profile_id:m.profile_id,speaker:m.speaker,timestamp:m.timestamp,body:m.body}));}
export function conversationExchanges(messages:Message[]){
 const sorted=[...messages].sort((a,b)=>a.source_id.localeCompare(b.source_id)||a.timestamp.localeCompare(b.timestamp)||a.start-b.start);
 const result:Message[][]=[];let group:Message[]=[];
 for(const m of sorted){const last=group.at(-1);if(last&&(last.source_id!==m.source_id||last.profile_id!==m.profile_id||Date.parse(m.timestamp)-Date.parse(last.timestamp)>=6*3600000)){result.push(group);group=[]}group.push(m)}if(group.length)result.push(group);return result;
}
export function conversationPlan(messages:Message[]){
 const sorted=[...messages].sort((a,b)=>a.timestamp.localeCompare(b.timestamp)||a.source_id.localeCompare(b.source_id)||a.start-b.start);
 if(tokenCount(conversationPacket(sorted))<=FULL_CONTEXT_BUDGET)return {full:true,messages:sorted,batches:[] as Message[][]};
 const batches:Message[][]=[];let current:Message[]=[];
 const flush=()=>{if(current.length){batches.push(current);current=[]}};
 for(const exchange of conversationExchanges(messages)){
  if(tokenCount(conversationPacket(exchange))<=MEMORY_BATCH_BUDGET){if(current.length&&tokenCount(conversationPacket([...current,...exchange]))>MEMORY_BATCH_BUDGET)flush();current.push(...exchange);continue;}
  flush();let part:Message[]=[];
  for(const original of exchange){let offset=0;const pieces=tokenCount(original.body)>1500?splitText(original.body,1500):[original.body];for(const body of pieces){const m=pieces.length===1?original:{...original,id:original.id+'@'+(original.start+offset)+':'+(original.start+offset+body.length),start:original.start+offset,end:original.start+offset+body.length,body};offset+=body.length;
   if(part.length&&tokenCount(conversationPacket([...part,m]))>MEMORY_BATCH_BUDGET){batches.push(part);part=part.slice(-2);while(part.length&&tokenCount(conversationPacket([...part,m]))>MEMORY_BATCH_BUDGET)part.shift();}part.push(m);
  }}if(part.length)batches.push(part);
 }flush();return {full:false,messages:sorted,batches};
}
export function aliasEvidence(messages:Message[]){const packet=conversationPacket(messages),refs=new Map(packet.map((m,i)=>[m.id,messages[i]]));return {packet,refs};}
export function originalCitation(m:Message){return {id:m.id,quote:m.body,profile_id:m.profile_id,source_id:m.source_id,source_version:m.source_version,source_start:m.start,source_end:m.end};}
