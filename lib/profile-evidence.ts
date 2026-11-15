import type {Message} from './types';
export function profileEvidence(profile:any):Message{
 const context=String(profile.context||'');const excerpt=Array.from(context).slice(0,160).join('');
 const body=`User-provided profile, not independently verified.\nName: ${profile.name}\nRelationship: ${profile.relationship}\nContext${excerpt.length<context.length?' (excerpt)':''}: ${excerpt||'Not supplied.'}`;
 return {id:`profile:${profile.id}:v${profile.version}`,profile_id:profile.id,source_id:'user-provided',speaker:'User-provided profile',timestamp:String(profile.created||'').slice(0,19),body,start:0,end:body.length,source_version:profile.version};
}
