// Provider payloads reference evidence once. Saved/UI citations retain the full
// verbatim quotation and source coordinates; only the model-bound copy is lean.
function candidatePacket(value:any){if(!value||typeof value!=='object')return value;return {...value,...(Array.isArray(value.findings)?{findings:value.findings.map((f:any)=>({...f,...(Array.isArray(f.citations)?{citations:f.citations.map((c:any)=>({id:c.id}))}:{})}))}:{})};}
export function modelPacket(data:any){
 if(!data||typeof data!=='object')return data;
 return {...data,...(Array.isArray(data.items)?{items:data.items.map((i:any)=>({...i,value:{...i.value,...(Array.isArray(i.value?.citations)?{citations:i.source_ids.map((id:string)=>({id}))}:{})}}))}:{}),...(Array.isArray(data.evidence)?{evidence:data.evidence.map((m:any)=>({id:m.id,...(m.profile_id?{profile_id:m.profile_id}:{}),...(m.source_id?{source_id:m.source_id}:{}),speaker:m.speaker,timestamp:m.timestamp,body:m.body,...(m.exchange_id?{exchange_id:m.exchange_id}:{})}))}:{}),...(data.draft?{draft:candidatePacket(data.draft)}:{}),...(data.candidate?{candidate:candidatePacket(data.candidate)}:{})};
}
