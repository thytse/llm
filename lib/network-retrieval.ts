import {db} from './service';
import {hybridRetrieve} from './retrieval';
import {networkEvidence,networkSeed,networkSearchQuery} from './network';
import type {Message} from './types';
// The top-level assistant can use supplied context before full indexing. Primary
// benchmark/chat retrieval keeps its strict complete-index requirement.
export async function retrieveNetwork(owner:string,profiles:any[],messages:Message[],question:string,dates:{from?:string;to?:string}={}){
 const rows=(await db().prepare('SELECT profile_id,version,message_id FROM retrieval_chunks WHERE owner=? GROUP BY profile_id,version,message_id').bind(owner).all()).results;
 const indexed=new Set(rows.map(r=>`${r.profile_id}:${r.version}:${r.message_id}`));const ready=profiles.filter(p=>{const own=messages.filter(m=>m.profile_id===p.id&&m.body.length);return own.length>0&&own.every(m=>indexed.has(`${p.id}:${p.version}:${m.id}`))});
 const semantic=ready.length?(await hybridRetrieve(owner,ready,messages.filter(m=>ready.some(p=>p.id===m.profile_id)),networkSearchQuery(question),dates,false,true)).messages:[];
 const seed=networkSeed(profiles,messages,question);const raw=[...new Map([...semantic,...seed].map(m=>[m.id,m])).values()];
 return {messages:networkEvidence(profiles,raw),cache:false,revision:'network-profile-and-available-search-v1',scope:{selected_people:profiles.length,semantically_indexed_people:ready.length,mode:'Profile context, checked summary sources and limited relevant excerpts; semantic search only for ready indexes.'}};
}
