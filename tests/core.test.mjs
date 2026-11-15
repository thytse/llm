import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';
async function load(file,testEnv={OPENAI_MODEL:'fixture-model'}){const bundle=await build({entryPoints:[file],bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'test-env',setup(b){b.onResolve({filter:/^\.\/service$/},()=>({path:'service',namespace:'mock-service'}));b.onLoad({filter:/.*/,namespace:'mock-service'},()=>({contents:'export class HttpError extends Error {constructor(status,message){super(message);this.status=status}};export function db(){throw Error("No database in pure test")};'}));b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},()=>({contents:'export const env='+JSON.stringify(testEnv)+';'}));}}]});return import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));}
const parser=await load('lib/parser.ts'),agent=await load('lib/agent.ts');
const raw=await readFile('public/sample-chat.txt','utf8');
const parsed=parser.parseChat(raw,'DMY');
const messages=parsed.messages.map((m,i)=>({...m,id:'M'+(i+1),profile_id:'p1',source_id:'s1',body:m.body}));
const answer=m=>({status:'partial',findings:[{text:m.body,category:'current context',support:'directly stated',lifecycle:'current',citations:[{id:m.id,quote:m.body}]}],next_question:'Would you like to clarify the plan?'});
const fake=async(c,s,d)=>({value:s==='review'?{gaps:['recent plans'],actions:d.acquisition_allowed?[{tool:'recent_updates'}]:[]}:s==='final_check'?{approved:true}:answer(d.evidence[0]),input_tokens:50,output_tokens:20});
const opts={question:'What changed on Friday?',messages,profiles:[{id:'p1',name:'Alex'}],context:[],kind:'chat',variant:'C'};
test('TXT participants, dates, exact source offsets and multiline bodies',()=>{assert.equal(messages.length,8);assert.deepEqual(parsed.speakers,['You','Alex']);for(const m of messages)assert.equal(raw.slice(m.start,m.end),m.body);const x=parser.parseChat('[11/13/2026, 8:15:02 PM] Alex: Hello\nSecond line\n[11/13/2026, 8:16:00 PM] You: Hi','MDY');assert.equal(x.messages[0].timestamp,'2026-11-13T20:15:02');assert.equal(x.messages[0].body,'Hello\nSecond line');});
test('Malformed dates, empty histories and message limits reject',()=>{assert.throws(()=>parser.parseChat('31/02/2026, 12:00 - Alex: bad','DMY'));assert.throws(()=>parser.parseChat('no messages'));assert.throws(()=>parser.parseChat('x'.repeat(1500001)));});
test('A/B/C model/tool ceilings and source exposure are accounted',async()=>{for(const [variant,calls,tools]of[['A',1,0],['B',4,0],['C',4,1]]){const r=await agent.runAgent({...opts,variant},fake);assert.equal(r.metrics.model_calls,calls);assert.equal(r.metrics.tool_calls,tools);assert.equal(r.metrics.people_exposed,1);assert.equal(r.metrics.input_tokens,50*calls);}});
test('Adaptive tool choice uses a changed observation',async()=>{let revised=false;const provider=async(c,s,d)=>{if(s==='revise'){revised=true;assert.ok(d.evidence.some(m=>m.body.includes('Update:')))}return fake(c,s,d)};const r=await agent.runAgent({...opts,question:'indie films'},provider);assert.ok(revised);assert.ok(r.trace.some(t=>t.tool==='recent_updates'));});
test('Counterfeit or cross-scope citations are rejected',()=>{for(const citation of[{id:'M2',quote:'invented'},{id:'foreign',quote:messages[0].body}])assert.throws(()=>agent.validate({...answer(messages[0]),findings:[{...answer(messages[0]).findings[0],citations:[citation]}]},messages));});
test('Rejected drafts yield general advice while retaining verification failure for scoring',async()=>{const r=await agent.runAgent(opts,async(c,s,d)=>s==='final_check'?{value:{approved:false},input_tokens:2,output_tokens:2}:fake(c,s,d));assert.equal(r.status,'partial');assert.equal(r.findings[0].kind,'suggestion');assert.deepEqual(r.findings[0].citations,[]);assert.equal(r.metrics.verification_failed,true);assert.equal(r.metrics.model_calls,4)});
test('Dinner fallback is useful without invented preferences',async()=>{const r=await agent.runAgent({...opts,question:'Where should we go for dinner?'},async(c,s,d)=>s==='final_check'?{value:{approved:false},input_tokens:1,output_tokens:1}:fake(c,s,d));assert.match(r.findings[0].text,/general advice/);assert.match(r.findings[0].text,/dessert/);assert.ok(!r.findings[0].text.includes('Alex likes'))});
test('Excess, duplicate and disallowed tools are bounded without executing forbidden operations',async()=>{for(const actions of[[{tool:'send_message'}],Array(3).fill({tool:'recent_updates'})]){const r=await agent.runAgent(opts,async(c,s,d)=>s==='review'?{value:{actions},input_tokens:1,output_tokens:1}:fake(c,s,d));assert.ok(r.metrics.tool_calls<=2);assert.ok(r.trace.some(t=>t.stage==='blocked_action'));assert.ok(!r.trace.some(t=>t.stage==='acquisition'&&t.tool==='send_message'))}});
test('No source evidence still allows a clearly labelled general suggestion without invented citations',async()=>{const output={status:'partial',findings:[{kind:'suggestion',text:'Consider a casual dinner and ask about dietary needs.',category:'uncertainty',support:'tentative',lifecycle:'current',citations:[]}],next_question:'What budget?'};const r=await agent.runAgent({...opts,messages:[]},async(c,s,d)=>({value:s==='review'?{actions:[],gaps:[]}:s==='final_check'?{approved:true}:structuredClone(output),input_tokens:1,output_tokens:1}));assert.equal(r.findings[0].kind,'suggestion');assert.deepEqual(r.findings[0].citations,[]);assert.equal(r.metrics.unique_messages,0)});
test('HKU Azure adapter puts key only in configured header and uses Chat Completions',async()=>{const original=globalThis.fetch;let sent;globalThis.fetch=async(url,init)=>{sent={url,init};return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({ok:true})}}],usage:{prompt_tokens:7,completion_tokens:2}}))};try{const r=await agent.callProvider({key:'synthetic-fixture-secret',model:'gpt-4.1-nano',endpoint:'https://api.hku.hk/openai/student/deployments/gpt-4.1-nano/chat/completions?api-version=2024-10-21',format:'chat',header:'api-key'},'draft',{question:'hello'},1000);assert.equal(sent.init.headers['api-key'],'synthetic-fixture-secret');assert.equal(JSON.parse(sent.init.body).model,'gpt-4.1-nano');assert.equal(JSON.parse(sent.init.body).response_format.type,'json_schema');assert.equal(JSON.parse(sent.init.body).response_format.json_schema.strict,true);assert.ok(!sent.url.includes('synthetic-fixture-secret'));assert.equal(r.input_tokens,7)}finally{globalThis.fetch=original}});
test('Provider HTTP failure is explicit and does not retry',async()=>{const original=globalThis.fetch;let n=0;globalThis.fetch=async()=>{n++;return new Response('{}',{status:429})};try{await assert.rejects(()=>agent.callProvider({key:'fixture',model:'fixture'},'draft',{},1000),/request limit reached/);assert.equal(n,1)}finally{globalThis.fetch=original}});
test('Altered generated quotations are rejected rather than promoted to source evidence',async()=>{const r=await agent.runAgent({...opts,variant:'A'},async(c,s,d)=>({value:{...answer(d.evidence[0]),findings:[{...answer(d.evidence[0]).findings[0],citations:[{id:d.evidence[0].id,quote:'model-copy error'}]}]},input_tokens:1,output_tokens:1}));assert.equal(r.metrics.verification_failed,true);assert.ok(r.findings.every(f=>f.citations.length===0));assert.ok(!JSON.stringify(r.findings).includes('model-copy error'))});
test('Concise profile prose retains separately inspectable original evidence',async()=>{const text='A concise supported observation.';const r=await agent.runAgent({...opts,kind:'analysis',variant:'B'},async(c,s,d)=>s==='draft'||s==='revise'?{value:{...answer(d.evidence[0]),findings:[{...answer(d.evidence[0]).findings[0],text}]},input_tokens:1,output_tokens:1}:fake(c,s,d));assert.equal(r.findings[0].text,text);assert.equal(r.findings[0].citations[0].quote,messages.find(m=>m.id===r.findings[0].citations[0].id).body)});
test('Unsupported personal prose rejected by critic never reaches the displayed suggestion',async()=>{const r=await agent.runAgent(opts,async(c,s,d)=>s==='final_check'?{value:{approved:false},input_tokens:1,output_tokens:1}:fake(c,s,d));assert.equal(r.metrics.verification_failed,true);assert.ok(r.findings.every(f=>f.kind==='suggestion'));assert.ok(r.findings.every(f=>!f.citations.length))});
test('Evidence-free clarification is a valid outcome instead of a schema rejection',()=>{assert.doesNotThrow(()=>agent.validate({status:'needs clarification',findings:[],next_question:'Do you mean when to send the invitation, or which dinner date to suggest?'},[]));assert.throws(()=>agent.validate({status:'answered',findings:[],next_question:''},[]));});
test('General timing suggestions survive rendering without fabricated personal evidence',async()=>{const suggestion='If dinner is next week, you could send a specific invitation a few days ahead and let her suggest another time.';const output={status:'partial',findings:[{kind:'suggestion',text:suggestion,category:'uncertainty',support:'tentative',lifecycle:'current',citations:[]}],next_question:'What day is dinner planned for?'};const r=await agent.runAgent({...opts,question:'When should I ask Elly out for dinner?'},async(c,s,d)=>({value:s==='review'?{gaps:[],actions:[]}:s==='final_check'?{approved:true}:structuredClone(output),input_tokens:1,output_tokens:1}));assert.equal(r.findings[0].text,suggestion);assert.equal(r.findings[0].kind,'suggestion');assert.deepEqual(r.findings[0].citations,[]);assert.equal(r.next_question,'What day is dinner planned for?')});
test('Clarification-only runs finish without creating factual findings',async()=>{const output={status:'needs clarification',findings:[],next_question:'When is the dinner, and do you mean when to send the invitation?'};const r=await agent.runAgent(opts,async(c,s,d)=>({value:s==='review'?{gaps:[],actions:[]}:s==='final_check'?{approved:true}:structuredClone(output),input_tokens:1,output_tokens:1}));assert.equal(r.status,'needs clarification');assert.equal(r.findings.length,0);assert.match(r.next_question,/dinner/)});
const summaryModule=await load('lib/summary.ts');
const attribute=(changes={})=>({category:'Communication style',text:'Alex writes briefly in the reviewed exchanges.',support:'tentative',lifecycle:'historical',time_scope:'2026-11-01 to 2026-11-02',source_ids:['S1','S2','S3'],counter_source_ids:[],...changes});
const exchangeMessages=['2026-11-01T08:00:00','2026-11-01T15:00:00','2026-11-02T08:00:00'].map((timestamp,i)=>({...messages[0],id:'S'+(i+1),speaker:'Alex',timestamp}));
test('Recurring observations require 3 exchanges on 2 days; full-history bridging messages prevent artificial exchanges',()=>{const value={attributes:[attribute({category:'Habits and routines'})],limits:''};assert.equal(summaryModule.checkAttributes(structuredClone(value),exchangeMessages,'Alex').length,1);const bridge={...exchangeMessages[0],id:'bridge',speaker:'You',timestamp:'2026-11-01T12:00:00'};assert.equal(summaryModule.checkAttributes(structuredClone(value),exchangeMessages,'Alex',{all:[...exchangeMessages,bridge]}).length,0);const oneDay=exchangeMessages.map((m,i)=>({...m,timestamp:`2026-11-01T${['00','07','14'][i]}:00:00`}));assert.equal(summaryModule.checkAttributes(structuredClone(value),oneDay,'Alex').length,0)});
test('Personality extension is opt-in and user-only messages cannot establish another person trait',()=>{const value={attributes:[attribute({category:'Personality and behavioural tendencies'})],limits:''};assert.equal(summaryModule.checkAttributes(structuredClone(value),exchangeMessages,'Alex').length,0);assert.equal(summaryModule.checkAttributes(structuredClone(value),exchangeMessages,'Alex',{includeBehaviour:true}).length,1);assert.equal(summaryModule.checkAttributes(structuredClone(value),exchangeMessages.map(m=>({...m,speaker:'You'})),'Alex',{includeBehaviour:true}).length,0)});
test('Separate support/lifecycle and user provenance survive validation; invented computed output is rejected',()=>{const a=attribute({category:'Basic facts',text:'Alex said they studied economics.',source_ids:['S1'],support:'directly stated',lifecycle:'stale'});const [r]=summaryModule.checkAttributes({attributes:[a],limits:''},exchangeMessages,'Alex');assert.equal(r.support,'directly stated');assert.equal(r.lifecycle,'stale');assert.equal(r.provenance,'message');const [u]=summaryModule.checkAttributes({attributes:[{...a,category:'Background',source_ids:['profile_context']}],limits:''},exchangeMessages,'Alex',{context:'User-provided hometown'});assert.equal(u.provenance,'user-provided');assert.deepEqual(summaryModule.checkAttributes({attributes:[{...a,support:'computed'}],limits:''},exchangeMessages,'Alex'),[]);assert.throws(()=>summaryModule.checkAttributes({attributes:[{...a,source_ids:['foreign']}],limits:''},exchangeMessages,'Alex'),/outside/)});
test('Summary renders every required area with scope-limited insufficient evidence and rejects foreign review IDs',async()=>{const a=attribute({category:'Interests',text:'Alex said they like films.',source_ids:['S1'],support:'directly stated'});const provider=async(c,s,d)=>({value:s==='summary'?{attributes:[a],limits:'Sampled'}:{accepted_attribute_ids:['attribute_0'],reason:'Supported'},input_tokens:1,output_tokens:1});const r=await summaryModule.buildSummary({messages:exchangeMessages,person:'Alex',context:'',version:1},provider);assert.equal(r.schema_version,3);assert.equal(r.attributes.length,8);assert.equal(r.attributes.find(a=>a.category==='Interests').support,'directly stated');assert.equal(r.attributes.find(a=>a.category==='Background').support,'insufficient');assert.match(r.attributes.find(a=>a.category==='Background').text,/records reviewed/);await assert.rejects(()=>summaryModule.buildSummary({messages:exchangeMessages,person:'Alex',context:'',version:1},async(c,s,d)=>s==='summary_check'?{value:{accepted_attribute_ids:['S1']},input_tokens:1,output_tokens:1}:provider(c,s,d)),/invalid references/)});
test('Profile observations stay concise while their source IDs remain in scope',()=>{const source={...exchangeMessages[0],body:'I love indie films.'};const [r]=summaryModule.checkAttributes({attributes:[attribute({category:'Interests',support:'directly stated',text:'Alex enjoys indie films.',source_ids:['S1']})],limits:''},[source],'Alex');assert.equal(r.text,'Alex enjoys indie films.');assert.deepEqual(r.source_ids,['S1'])});
const language=await load('lib/language.ts'),tokens=await load('lib/tokens.ts');
test('Cantonese mixed-language exports preserve Chinese periods, fullwidth sender colon and exact offsets',()=>{const raw='[2026/11/14 下午8:15:02] Elly：我讀緊大學，鍾意寫 code 同韓國嘢食。\n[2026/11/15 上午12:05:00] You：今晚去邊食飯？';const parsed=parser.parseChat(raw,'DMY');assert.equal(parsed.messages.length,2);assert.equal(parsed.messages[0].timestamp,'2026-11-14T20:15:02');assert.equal(parsed.messages[1].timestamp,'2026-11-15T00:05:00');for(const m of parsed.messages)assert.equal(raw.slice(m.start,m.end),m.body)});
test('Cantonese retrieval segments Han runs and language matching retains uncertainty',()=>{assert.ok(language.searchTerms('Elly鍾意食韓國嘢食同泡芙').includes('泡芙'));assert.equal(language.responseLanguage('我哋去邊食飯？'),'yue-Hant');assert.match(language.genericSuggestion('今晚去邊食飯？'),/一般建議/)});
test('Token splitting preserves every original character including emoji and budgets are enforced',()=>{const text='廣東話😄 code-switching '.repeat(100);const parts=tokens.splitText(text,40);assert.equal(parts.join(''),text);assert.ok(parts.every(p=>tokens.tokenCount(p)<=40));assert.ok(tokens.tokenCount(tokens.fitEvidence(parts,100))<=100)});

test('Communication examples can be inferred from text without an explicit self-description, but frequency claims need repeated exchanges',()=>{const source={...exchangeMessages[0],body:'哈哈 debug到夜晚 😂'};const limited=summaryModule.checkAttributes({attributes:[attribute({text:'Elly uses humour and emoji in these examples.',source_ids:['S1']})],limits:''},[source],'Alex');assert.equal(limited[0].support,'tentative');assert.equal(limited[0].observation_kind,'descriptive examples');assert.equal(summaryModule.checkAttributes({attributes:[attribute({text:'Alex usually uses humour.',source_ids:['S1']})],limits:''},[source],'Alex').length,0)});

const retrieval=await load('lib/retrieval.ts'),jobs=await load('lib/profile-jobs.ts'),runtime=await load('lib/model-runtime.ts');
test('Whole-conversation batches include every original source, preserve exact split spans and never silently truncate',()=>{const ms=Array.from({length:180},(_,i)=>({...messages[0],id:'W'+i,body:('廣東話😄英文 code '+i+' ').repeat(50),start:1000*i,end:1000*i+200}));const parts=jobs.profileParts(ms),batches=jobs.profileBatches(parts);assert.ok(batches.length>1);assert.equal(new Set(batches.flat()).size,parts.length);for(const m of ms){const fragments=parts.filter(p=>p.parent_id===m.id);assert.equal(fragments.map(p=>p.body).join(''),m.body);for(const f of fragments)assert.equal(m.body.slice(f.start-m.start,f.end-m.start),f.body)}});
test('Hybrid RRF can retrieve semantically relevant text with no lexical match and retains scoped source identity',()=>{const rows=[{chunk:{...messages[0],id:'a',parent_id:'P1',body:'cream puffs'},vector:[1,0]},{chunk:{...messages[1],id:'b',parent_id:'P2',body:'exam'},vector:[0,1]}];assert.equal(retrieval.hybridRank(rows,'甜品',[1,0],1)[0].id,'a')});
test('Online token budget stops requests before the provider is invoked',async()=>{await assert.rejects(()=>runtime.beginRequest({key:'fixture',model:'fixture'},'draft',{text:'hello '.repeat(10000)}),/budget exhausted/)});

const provenance=await load('lib/provenance.ts');
test('Citation comparison permits only exact, NFC and CRLF equivalence; cached spans cannot cross scope',()=>{assert.ok(provenance.equivalentSpan('Cafe\u0301\r\nHello','Café\nHello'));assert.ok(!provenance.equivalentSpan('Hello, world!','hello world'));assert.ok(!provenance.equivalentSpan('message',''));assert.throws(()=>provenance.verifyChunks([{...messages[0],profile_id:'foreign'}],messages),/invalid source spans/)});

const time=await load('lib/time.ts');
test('Hong Kong dates and temporal guards prevent an old tonight statement establishing current availability',()=>{assert.equal(time.hongKongToday(new Date('2026-11-14T20:00:00Z')),'2026-11-15');const source={...messages[0],speaker:'Alex',id:'OLD',timestamp:'2026-11-13T20:00:00',body:'今晚臨時約都得，我今日好得閒。'};const r=time.guardCurrentAvailability('今晚去邊食飯？',[{text:'所以今晚即興約飯係可行。',kind:'evidence',citations:[{id:'OLD'}]}],[source],'2026-11-15');assert.equal(r.changed,1);assert.equal(r.findings[0].support,'insufficient');assert.ok(!r.findings[0].text.includes('係可行'));assert.ok(time.currentAvailabilitySupported([{...source,body:'聽日得閒',timestamp:'2026-11-14T20:00:00'}],'2026-11-15'))});

test('Explicit education is displayed under Basic facts rather than inferred family Background',()=>{const m={...exchangeMessages[0],body:'我讀緊大學，主修 computer science。'};const [a]=summaryModule.checkAttributes({attributes:[attribute({category:'Background',text:'Elly 讀緊大學，主修 computer science。',support:'directly stated',source_ids:['S1']})],limits:''},[m],'Alex');assert.equal(a.category,'Basic facts');assert.equal(a.support,'directly stated')});

test('A fully supported draft can terminate after review without hidden revision or extra calls',async()=>{const r=await agent.runAgent(opts,async(c,s,d)=>s==='review'?{value:{complete:true,approved:true,gaps:[],actions:[]},input_tokens:1,output_tokens:1}:fake(c,s,d));assert.equal(r.metrics.model_calls,2);assert.equal(r.metrics.tool_calls,0);assert.ok(r.trace.some(t=>t.stage==='verdict'&&t.approved));assert.ok(!r.trace.some(t=>t.stage==='revise'))});

test('Final recommendation check retains uncited explicit wants alongside a weaker cited purchase',async()=>{
 const weak={...messages[0],id:'PUFF',speaker:'Alex',body:'I bought cream puffs yesterday.'};
 const strong={...messages[1],id:'WANT',speaker:'Alex',body:'For dinner this time I want Korean food, no dessert.'};
 let checked=false;
 const r=await agent.runAgent({...opts,question:'Where should we go for dinner?',messages:[weak,strong],initialEvidence:[weak,strong],variant:'B'},async(c,stage,data)=>{
  if(stage==='final_check'){checked=true;assert.deepEqual(new Set(data.evidence.map(m=>m.id)),new Set(['PUFF','WANT']));return {value:{approved:false,reason:'Draft ignores the explicit current request.'},input_tokens:1,output_tokens:1};}
  return {value:stage==='review'?{complete:false,approved:false,gaps:['Check explicit request'],actions:[]}:{status:'partial',findings:[{kind:'suggestion',text:'Perhaps try a dessert cafe, based only on the one purchase.',category:'interest',support:'tentative',lifecycle:'current',citations:[{id:'PUFF'}]}],next_question:''},input_tokens:1,output_tokens:1};
 });
 assert.ok(checked);assert.equal(r.metrics.verification_failed,true);assert.ok(!r.findings.some(f=>f.text.includes('one purchase')));
});

test('Profile observation source checks keep valid observations and discard an entire claim with unseen support or counterevidence',()=>{
 const a=attribute({source_ids:['S1@0:12']});const part={...exchangeMessages[0],id:'S1@0:12',parent_id:'S1'};
 const result=jobs.profileObservations({attributes:[structuredClone(a),{...a,text:'Unsupported claim',source_ids:['invented']},{...a,text:'Missing counterexample',counter_source_ids:['foreign']}]},new Set([part.id]),false,[part]);
 assert.equal(result.attributes.length,1);assert.equal(result.attributes[0].text,a.text);assert.equal(result.warnings[0].count,2);
 assert.throws(()=>jobs.profileObservations({attributes:[{...a,source_ids:['invented']}]},new Set([part.id]),false,[part]),/No profile observations passed/);
});
test('Profile source resolution allows only a single in-batch parent part and explicitly supplied user context',()=>{
 const one={...exchangeMessages[0],id:'S1@0:12',parent_id:'S1'},two={...one,id:'S1@12:24'};
 const input=()=>({attributes:[attribute({source_ids:['S1']})]});
 assert.deepEqual(jobs.profileObservations(input(),new Set([one.id]),false,[one]).attributes[0].source_ids,[one.id]);
 assert.throws(()=>jobs.profileObservations(input(),new Set([one.id,two.id]),false,[one,two]),/No profile observations passed/);
 assert.throws(()=>jobs.profileObservations(input(),new Set(['OTHER']),false,[one]),/No profile observations passed/);
 const context=()=>({attributes:[attribute({category:'Relationship context',source_ids:['profile_context']})]});
 assert.equal(jobs.profileObservations(context(),new Set(),false,[],'We met at university.').attributes.length,1);
 assert.throws(()=>jobs.profileObservations(context(),new Set(),false),/No profile observations passed/);
});

test('Poe reads three independent batches concurrently and preserves successful results when one fails; HKU stays serial',async()=>{
 let active=0,peak=0;const started=[],releases=new Map();
 const run=jobs.readProfileWave([0,1,2,3],'poe',index=>new Promise((resolve,reject)=>{started.push(index);active++;peak=Math.max(peak,active);releases.set(index,()=>{active--;index===1?reject(Error('fixture failure')):resolve('batch '+index)});}));
 assert.deepEqual(started,[0,1,2]);assert.equal(peak,3);releases.get(2)();releases.get(0)();releases.get(1)();
 const result=await run;assert.deepEqual(result.filter(r=>r.result.status==='fulfilled').map(r=>r.index),[0,2]);assert.equal(result[1].result.status,'rejected');
 const state={stage:'read',position:2,batches:[['a'],['b'],['c'],['d']],completed_batches:[0,2]};assert.deepEqual(jobs.pendingProfileBatches(state),[1,3]);
 const serial=await jobs.readProfileWave([1,3],'hku',async i=>i);assert.equal(serial.length,1);
 assert.deepEqual(jobs.pendingProfileBatches({...state,completed_batches:undefined}),[2,3]);
});
test('Profile batch cache fingerprints isolate owners, profiles, model settings, source content and dates',async()=>{
 const config={provider:'poe',model:'GPT-5.4',today:'2026-11-15',include_behaviour:false},packet=[{id:'P@0:3',body:'abc',speaker:'Alex',exchange_id:'e1'}];
 const key=await jobs.profileBatchKey('owner','person',config,packet);
 assert.equal(key,await jobs.profileBatchKey('owner','person',structuredClone(config),structuredClone(packet)));
 for(const args of [['other','person',config,packet],['owner','other',config,packet],['owner','person',{...config,model:'other'},packet],['owner','person',{...config,today:'2026-11-16'},packet],['owner','person',config,[{...packet[0],body:'new'}]],['owner','person',{...config,include_behaviour:true},packet]])assert.notEqual(key,await jobs.profileBatchKey(...args));
});
test('Preliminary profiles expose only covered sources and never claim complete coverage or include unseen citations',()=>{
 const ms=exchangeMessages.map((m,i)=>({...m,body:'I study economics.',id:'P'+i,start:0,end:18})),parts=jobs.profileParts(ms);
 const state={stage:'read',covered:[parts[0].id],observations:[attribute({category:'Basic facts',support:'directly stated',text:'Alex reports studying economics.',source_ids:[parts[0].id]}),attribute({category:'Interests',text:'Unseen interpretation',source_ids:['foreign']})],includeBehaviour:false};
 const preview=jobs.preliminaryProfile(state,{name:'Alex',context:''},ms);
 assert.equal(preview.preliminary,true);assert.equal(preview.reviewed_messages,1);assert.equal(preview.total_messages,3);assert.equal(preview.attributes.length,1);assert.deepEqual(preview.attributes[0].source_ids,[parts[0].id]);
 assert.equal(jobs.preliminaryProfile({...state,covered:[]},{name:'Alex'},ms),null);assert.equal(jobs.preliminaryProfile({...state,stage:'done'},{name:'Alex'},ms),null);
});

test('Empty export messages need no search vectors, while profile coverage still counts them',()=>{
 const empty={...messages[0],id:'EMPTY',body:'',start:8,end:8},text={...messages[1],id:'TEXT',body:'hello'};
 assert.deepEqual(retrieval.missingIndexMessages([empty,text],new Set(['TEXT'])),[]);
 assert.deepEqual(retrieval.missingIndexMessages([empty,text],new Set()).map(m=>m.id),['TEXT']);
 const parts=jobs.profileParts([empty,text]);assert.ok(parts.some(p=>p.parent_id==='EMPTY'&&p.body===''&&p.start===p.end));
 const chunks=retrieval.chunkMessages([empty,text],1);assert.equal(chunks.length,1);assert.equal(chunks[0].parent_id,'TEXT');
});
test('Search-index completion counts matching expected chunks, not stale rows or duplicate writes',()=>{
 const chunks=[{id:'a'},{id:'b'}];assert.deepEqual(retrieval.indexCoverage(chunks,['a','stale']),{done:false,indexed:1,total:2});
 assert.deepEqual(retrieval.indexCoverage(chunks,['a','a','b','stale']),{done:true,indexed:2,total:2});
});

test('An uncited personal inference is omitted before review without erasing a useful practical suggestion',async()=>{
 const output={status:'answered',findings:[{kind:'inference',text:'Alex wants dessert tonight.',category:'interest',support:'tentative',lifecycle:'current',citations:[]},{kind:'suggestion',text:'Offer two dinner options and ask which they prefer.',category:'uncertainty',support:'tentative',lifecycle:'current',citations:[]}],next_question:''};
 const r=await agent.runAgent({...opts,question:'Where should we have dinner?'},async(c,s,d)=>{if(s==='review'){assert.ok(!d.draft.findings.some(f=>f.text.includes('wants dessert')));return {value:{complete:true,approved:true,gaps:[],actions:[]},input_tokens:1,output_tokens:1}}return {value:structuredClone(output),input_tokens:1,output_tokens:1};});
 assert.equal(r.status,'partial');assert.equal(r.findings.length,1);assert.match(r.findings[0].text,/two dinner options/);assert.equal(r.metrics.omitted_personal_observations,1);assert.ok(!r.metrics.verification_failed);
});

const capacities=await load('lib/limits.ts');
test('Larger chat imports preserve every message and exact spans beyond the old 6,000-message boundary',()=>{
 const raw=Array.from({length:6501},(_,i)=>`[15/11/2026, 10:00:00] ${i%2?'You':'Alex'}: fixture ${i}`).join('\n');
 const p=parser.parseChat(raw);assert.equal(p.messages.length,6501);assert.equal(p.messages.at(-1).body,'fixture 6500');for(const m of p.messages)assert.equal(raw.slice(m.start,m.end),m.body);
 assert.throws(()=>parser.parseChat(Array.from({length:10001},()=>`[15/11/2026, 10:00:00] Alex: x`).join('\n')),/10,000/);
});
test('Workspace and person capacities are distinct, with explicit rejection instead of source truncation',()=>{
 assert.equal(capacities.importCapacity(6000,2000,6501),null);
 assert.equal(capacities.importCapacity(40000,10000,10000),null);
 assert.match(capacities.importCapacity(40000,10000,10001),/20,000/);
 assert.match(capacities.importCapacity(49000,100,1001),/50,000/);
 const records=Array.from({length:6501},(_,id)=>({id,body:'廣東話🧡'}));const batches=capacities.importRecords(records);
 assert.deepEqual(batches.flat(),records);assert.ok(batches.every(b=>b.length<=256&&new TextEncoder().encode(JSON.stringify(b)).length<=1500000));
});

const network=await load('lib/network.ts');
test('Network evidence includes user-provided relationship context and distinct source records from multiple people',()=>{
 const profiles=[{id:'elly',name:'Elly',relationship:'University friend',context:'We attend the same university.',version:1},{id:'alex',name:'Alex',relationship:'Friend',context:'',version:2}];
 const raw=[{...messages[0],id:'CAFE',profile_id:'alex',speaker:'Alex',body:'I like working in cafes.'},{...messages[1],id:'STUDY',profile_id:'elly',speaker:'Elly',body:'I study at university.'}];
 const packet=network.networkEvidence(profiles,raw);assert.deepEqual(new Set(packet.map(m=>m.profile_id)),new Set(['elly','alex']));assert.ok(packet.some(m=>m.source_id==='user-provided'&&m.body.includes('University friend')));assert.ok(packet.some(m=>m.id==='CAFE'));
 assert.notEqual(network.profileEvidence(profiles[0]).id,network.profileEvidence({...profiles[0],version:2}).id);
 assert.ok(!network.networkEvidence([profiles[0]],raw.filter(m=>m.profile_id==='elly')).some(m=>m.profile_id==='alex'));
});
test('Network ranking prefers explicit preferences over many weak clues and keeps unavailable people excluded',()=>{
 const source=(id,profile_id,source_id='s')=>({...messages[0],id,profile_id,source_id});const candidates=[{profile_id:'elly',match_kind:'shared context',preference_source_ids:['E1','E2','E3'],constraints:[{name:'Current availability',status:'unknown'}]},{profile_id:'alex',match_kind:'explicit preference',preference_source_ids:['A1'],constraints:[{name:'Current availability',status:'unknown'}]},{profile_id:'busy',match_kind:'explicit request',preference_source_ids:['B1'],constraints:[{name:'Current availability',status:'contradicted'}]}];
 const ranked=network.rankNetworkCandidates(candidates,[],[source('E1','elly'),source('E2','elly'),source('E3','elly'),source('A1','alex'),source('B1','busy')]);assert.equal(ranked[0].profile_id,'alex');assert.equal(ranked[0].provisional,true);assert.equal(ranked.at(-1).eligible,false);
 const [metadata]=network.rankNetworkCandidates([{...candidates[1],preference_source_ids:['META']}],[],[source('META','alex','user-provided')]);assert.equal(metadata.match_kind,'shared context');
});
test('Network café study suggestions retain complementary people while availability remains unconfirmed',async()=>{
 const ps=[{id:'elly',name:'Elly',relationship:'University friend',context:'We attend the same university.',version:1},{id:'alex',name:'Alex',relationship:'Friend',context:'',version:1}];const meta=network.profileEvidence(ps[0]),cafe={...messages[0],id:'CAFE',profile_id:'alex',speaker:'Alex',body:'I love working in cafes.'};
 const value={status:'answered',findings:[{kind:'suggestion',text:'Ask Alex about studying at a cafe; he reports enjoying cafe work.',category:'interest',support:'tentative',lifecycle:'current',citations:[{id:cafe.id}]}],candidates:[{profile_id:'elly',match_kind:'shared context',fit_reason:'Your university friend could be a study companion; this is a tentative fit.',preference_source_ids:[meta.id],constraints:[]},{profile_id:'alex',match_kind:'explicit preference',fit_reason:'Alex said he enjoys working in cafes.',preference_source_ids:[cafe.id],constraints:[]}],next_question:'Which area and time would suit you?'};
 const r=await agent.runAgent({...opts,question:'I want to study at a cafe this afternoon. Who should I ask?',kind:'network',profiles:ps,messages:[cafe],initialEvidence:[meta,cafe]},async(c,s,d)=>({value:s==='review'?{complete:true,approved:true,gaps:[],actions:[]}:structuredClone(value),input_tokens:1,output_tokens:1}));
 assert.ok(!r.metrics.verification_failed);assert.equal(r.candidates.length,2);assert.equal(r.candidates[0].profile_id,'alex');assert.ok(r.candidates.every(c=>c.provisional));assert.ok(r.candidates[1].fit_sources.some(s=>s.source_id==='user-provided'));assert.equal(r.metrics.unique_messages,1);
});
test('Network candidate citations cannot cross the selected person boundary',async()=>{
 const ps=[{id:'elly',name:'Elly'},{id:'alex',name:'Alex'}],source={...messages[0],id:'A1',profile_id:'alex'};
 const r=await agent.runAgent({...opts,kind:'network',profiles:ps,messages:[source],initialEvidence:[source]},async()=>({value:{status:'partial',findings:[],next_question:'Where?',candidates:[{profile_id:'elly',match_kind:'explicit preference',fit_reason:'Unsupported attribution',constraints:[],preference_source_ids:['A1']}]},input_tokens:1,output_tokens:1}));
 assert.equal(r.metrics.verification_failed,true);assert.ok(!r.candidates?.length);
 assert.ok(time.currentTimeQuestion('I want to study at a cafe this afternoon.'));
 assert.ok(!time.currentAvailabilitySupported([{...source,source_id:'user-provided',speaker:'User-provided profile',body:'Alex is free today.',timestamp:'2026-11-15T10:00:00'}],'2026-11-15'));
});

test('The top layer can suggest the only person from user-provided context without uploaded chat',async()=>{
 const profile={id:'only',name:'Elly',relationship:'University friend',context:'We study together.',version:0};const meta=network.profileEvidence(profile);
 const value={status:'answered',findings:[],candidates:[{profile_id:'only',match_kind:'shared context',fit_reason:'Your university friend may be a study companion.',constraints:[],preference_source_ids:[meta.id]}],next_question:'What time would you like to propose?'};
 const r=await agent.runAgent({...opts,kind:'network',profiles:[profile],messages:[],initialEvidence:[meta]},async(c,s)=>({value:s==='review'?{complete:true,approved:true,gaps:[],actions:[]}:structuredClone(value),input_tokens:1,output_tokens:1}));
 assert.ok(!r.metrics.verification_failed);assert.equal(r.candidates.length,1);assert.equal(r.candidates[0].provisional,true);assert.equal(r.metrics.unique_messages,0);
});

test('The top layer finds complementary source excerpts before any semantic index or full summary exists',()=>{
 const ps=[{id:'elly',version:0},{id:'alex',version:1}];const raw=[{...messages[0],id:'A-cafe',profile_id:'alex',body:'我鍾意喺咖啡店溫書。'},{...messages[1],id:'E-study',profile_id:'elly',body:'I study at university.'}];
 const seed=network.networkSeed(ps,raw,'I want to study at a cafe this afternoon.');assert.ok(seed.some(m=>m.parent_id==='A-cafe'));assert.ok(seed.some(m=>m.parent_id==='E-study'));assert.ok(network.networkSearchQuery('下晝去咖啡店溫書').includes('university'));
});

const providerPolicy=await load('lib/provider-policy.ts'),modelSettings=await load('lib/model-config.ts');
test('Sonnet is the default while Luna, GPT-5.4 and HKU remain explicit and existing profile leases outlast their request deadlines',()=>{
 assert.equal(providerPolicy.DEFAULT_PROVIDER,'poe-sonnet');assert.equal(modelSettings.modelConfig().provider,'poe');assert.equal(modelSettings.modelConfig().model,'claude-sonnet-5.5');assert.equal(modelSettings.modelConfig().format,'chat');assert.equal(modelSettings.modelConfig('poe-luna').model,'GPT-6-Luna');assert.equal(modelSettings.modelConfig('poe').model,'GPT-5.4');assert.equal(modelSettings.modelConfig('hku').provider,'hku');
 assert.equal(providerPolicy.profileRequestTimeout('poe'),180000);assert.equal(providerPolicy.profileRequestTimeout('hku'),90000);assert.ok(providerPolicy.profileLeaseTimeout('poe')>providerPolicy.profileRequestTimeout('poe'));
});
test('A provider timeout explains saved progress and does not silently retry or claim a credential failure',async()=>{
 const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw new DOMException('The operation was aborted due to timeout','TimeoutError')};
 try{await assert.rejects(()=>agent.callProvider({key:'fixture',model:'GPT-5.4',provider:'poe',operation:'profile',endpoint:'https://api.poe.com/v1/responses',format:'responses'},'summary_observe',{evidence:[]},180000),e=>{assert.match(e.message,/Poe reading batch exceeded 180 seconds/);assert.match(e.message,/completed batches are saved/i);assert.match(e.message,/Continue saved analysis/);assert.ok(!/invalid key|credential/i.test(e.message));return true});assert.equal(requests,1)}finally{globalThis.fetch=original}
});

const references=await load('lib/profile-references.ts');
test('Merge reference compression preserves every original support and counterexample without rewriting prose',()=>{
 const originals=[attribute({source_ids:['long-original-A','long-original-B'],counter_source_ids:['long-original-C'],text:'Keep the literal words ref_1 in this text.'})];const compact=references.compactReferences(originals);
 assert.deepEqual(compact.observations[0].source_ids,['ref_1','ref_2']);assert.equal(compact.observations[0].text,originals[0].text);
 const restored=references.restoreReferences({attributes:compact.observations},compact.restore);assert.deepEqual(restored.attributes,originals);
 const bad=references.restoreReferences({attributes:[{...compact.observations[0],source_ids:['invented-ref']}]},compact.restore);assert.equal(bad.attributes[0].source_ids[0],'invented-ref');
 assert.throws(()=>jobs.profileObservations(bad,new Set(['long-original-A']),false),/No profile observations passed/);
 assert.equal(references.stageOutputLimit('summary_merge','profile'),5000);assert.equal(references.stageOutputLimit('draft','answer'),1000);
});
test('Incomplete output identifies the length limit and is not accepted as partial JSON',async()=>{
 const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({status:'incomplete',incomplete_details:{reason:'max_output_tokens'},usage:{input_tokens:100,output_tokens:5000},output:[{type:'message',content:[{type:'output_text',text:'{"attributes":['}]}]}))};
 try{await assert.rejects(()=>agent.callProvider({key:'fixture',model:'GPT-5.4',provider:'poe',operation:'profile'},'summary_merge',{observations:[]},1000),e=>{assert.match(e.message,/output-length limit/);assert.equal(e.details.reason,'max_output_tokens');assert.equal(e.details.output_limit,5000);return true});assert.equal(requests,1)}finally{globalThis.fetch=original}
});
test('Unavailable Sonnet falls back visibly to GPT-5.4 and unavailable Luna is blocked',async()=>{
 const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({data:[{id:'gpt-5.4'}]}))};
 try{const availability=await load('lib/model-availability.ts',{POE_API_KEY:'synthetic-availability-fixture'});const services=await availability.modelServices();assert.equal(services.default_provider,'poe-sonnet');assert.equal(services.active_default_provider,'poe');assert.equal(services.providers['poe-luna'],false);assert.match(services.model_notice,/active fallback/);assert.equal(await availability.resolveProvider(undefined),'poe');await assert.rejects(()=>availability.resolveProvider('poe-luna'),/not currently available/);assert.equal(requests,1)}finally{globalThis.fetch=original}
});
test('Sonnet becomes the active default when Poe lists it and Luna remains an explicit option',async()=>{
 const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({data:[{id:'gpt-6-luna'},{id:'claude-sonnet-5.5'}]}));
 try{const availability=await load('lib/model-availability.ts',{POE_API_KEY:'synthetic-luna-ready-fixture'});const services=await availability.modelServices();assert.equal(services.active_default_provider,'poe-sonnet');assert.equal(services.model_notice,'');assert.equal(await availability.resolveProvider('poe-luna'),'poe-luna');assert.equal(providerPolicy.profileRequestTimeout('poe-luna'),180000);const wave=await jobs.readProfileWave([0,1,2,3],'poe-luna',async i=>i);assert.equal(wave.length,3)}finally{globalThis.fetch=original}
});

test('Sonnet support review has room to finish structured JSON without retrying',async()=>{
 const original=globalThis.fetch;let calls=0;globalThis.fetch=async(url,init)=>{calls++;const body=JSON.parse(init.body);assert.equal(body.max_tokens,2200);assert.equal(body.response_format.type,'json_schema');return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify({complete:true,approved:true,gaps:[],actions:[]})}}],usage:{prompt_tokens:5,completion_tokens:5}}))};
 try{const r=await agent.callProvider({key:'fixture',model:'claude-sonnet-5.5',provider:'poe',format:'chat',endpoint:'https://api.poe.com/v1/chat/completions'},'review',{evidence:[]},1000);assert.equal(r.value.approved,true);assert.equal(calls,1)}finally{globalThis.fetch=original}
});

const reduction=await load('lib/profile-reduction.ts');
test('Consolidation terminates with long citation lists while preserving support and contrary lineage',()=>{
 let observations=Array.from({length:137},(_,i)=>attribute({text:'Observed example '+i,source_ids:Array.from({length:20},(_,j)=>'long-source-'+i+'-'+j+'@120:150'),counter_source_ids:['contrary-'+i]}));
 const allSupport=new Set(observations.flatMap(a=>a.source_ids)),allCounter=new Set(observations.flatMap(a=>a.counter_source_ids));let rounds=0,calls=0;
 while(observations.length>reduction.FINAL_OBSERVATIONS){const previous=observations.length;observations=reduction.reductionGroups(observations).flatMap(group=>{if(group.length<=8)return group;calls++;const attrs=[];const stride=Math.ceil(group.length/8);for(let i=0;i<group.length;i+=stride)attrs.push(attribute({source_ids:group.slice(i,i+stride).map((_,j)=>'observation_'+(i+j+1)),counter_source_ids:[]}));return reduction.expandMerge({attributes:attrs},group).attributes;});assert.ok(observations.length<previous);assert.ok(++rounds<10);}
 assert.deepEqual(new Set(observations.flatMap(a=>a.source_ids)),allSupport);assert.deepEqual(new Set(observations.flatMap(a=>a.counter_source_ids)),allCounter);assert.ok(calls<25);assert.ok(rounds<=5);
});
test('Nonshrinking, invented and omitted-lineage merges stop before another round',()=>{
 const input=Array.from({length:10},()=>attribute());
 assert.throws(()=>reduction.expandMerge({attributes:Array.from({length:10},(_,i)=>attribute({source_ids:['observation_'+(i+1)]}))},input),/at most 8/);
 assert.throws(()=>reduction.expandMerge({attributes:[attribute({source_ids:['observation_999']})]},input),/unknown observation/);
 assert.throws(()=>reduction.expandMerge({attributes:[attribute({source_ids:['observation_1']})]},input),/omitted observation lineage/);
});
test('Old reduction checkpoints preserve completed reading and recover from the old eight-level failure',()=>{
 const state={stage:'reduce',position:2,levels:8,observations:Array.from({length:20},()=>attribute()),reduced:[attribute()],covered:['original-message'],completed_batches:[0,1],calls:19};
 reduction.prepareReduction(state);assert.equal(state.position,0);assert.equal(state.levels,0);assert.equal(state.reduced.length,0);assert.equal(state.observations.length,20);assert.deepEqual(state.covered,['original-message']);assert.deepEqual(state.completed_batches,[0,1]);assert.equal(state.calls,19);
 state.observations=[attribute()];reduction.prepareReduction(state);assert.equal(state.stage,'synthesise');
});
test('Observation packet size is independent of citation lengths and negative references retain originals',()=>{
 const original=attribute({source_ids:['original-positive'],counter_source_ids:['original-counter']});const other=attribute({source_ids:['original-negative'],counter_source_ids:[]});
 const packet=reduction.observationPacket([original,other]);assert.deepEqual(packet[0].source_ids,['observation_1']);assert.equal(packet[0].has_counterexamples,true);
 const merged=reduction.expandMerge({attributes:[attribute({source_ids:['observation_1'],counter_source_ids:['observation_2']})]},[original,other]);assert.deepEqual(merged.attributes[0].source_ids,['original-positive']);assert.deepEqual(merged.attributes[0].counter_source_ids,['original-counter','original-negative']);
});

const packets=await load('lib/model-packet.ts');
test('Review payload removes duplicated quotes without changing originals or losing surrounding evidence',()=>{
 const original={question:'Is this sarcasm?',evidence:[{id:'M1',profile_id:'P',source_id:'original',speaker:'Alex',timestamp:'2026-11-15',body:'You are very punctual.'.repeat(100),start:10,end:2100},{id:'M2',profile_id:'P',speaker:'You',body:'I am 45 minutes late.',timestamp:'2026-11-15'}],draft:{findings:[{kind:'inference',text:'Possible irony',citations:[{id:'M1',quote:'You are very punctual.'.repeat(100),source_start:10,source_end:2100},{id:'M2',quote:'I am 45 minutes late.'}]}]}};
 const before=structuredClone(original),lean=packets.modelPacket(original);assert.deepEqual(original,before);assert.deepEqual(lean.draft.findings[0].citations,[{id:'M1'},{id:'M2'}]);assert.equal(lean.evidence.length,2);assert.equal(lean.evidence[0].body,original.evidence[0].body);assert.equal(lean.evidence[1].body,original.evidence[1].body);assert.equal(lean.evidence[0].timestamp,original.evidence[0].timestamp);assert.ok(tokens.tokenCount(lean)<tokens.tokenCount(original));
});
test('Expanded-evidence revision fits the real 8,000-token guard when duplicate citation quotes are removed',async()=>{
 const original=globalThis.fetch;let calls=0;const evidence=Array.from({length:4},(_,i)=>({id:'M'+i,profile_id:'fixture',speaker:'Alex',timestamp:'2026-11-15',body:('context '+i+' ').repeat(180)}));const draft={status:'partial',findings:Array.from({length:3},()=>({kind:'inference',text:'Tentative reading',citations:evidence.map(m=>({id:m.id,quote:m.body}))}))};
 const data={question:'What does this mean?',evidence,draft};assert.ok(tokens.tokenCount(data)>8000);
 globalThis.fetch=async(url,init)=>{calls++;const body=JSON.parse(init.body),input=JSON.parse(body.input);assert.ok(input.draft.findings.every(f=>f.citations.every(c=>Object.keys(c).join()==='id')));assert.deepEqual(input.evidence.map(m=>m.body),evidence.map(m=>m.body));return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:'{"ok":true}'}]}],usage:{input_tokens:100,output_tokens:5}}))};
 try{const r=await agent.callProvider({key:'fixture',model:'GPT-5.4',provider:'poe'},'revise',data,1000);assert.equal(r.value.ok,true);assert.equal(calls,1);assert.ok(draft.findings[0].citations[0].quote)}finally{globalThis.fetch=original}
});
