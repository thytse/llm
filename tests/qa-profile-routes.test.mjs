// Real profile/report route SQL against real migrations in an in-memory SQLite
// database. Identity and the D1 adapter are isolated; no user DB or network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {build} from 'esbuild';

const service=`
import {DatabaseSync} from 'node:sqlite';
export const database=new DatabaseSync(':memory:');
export class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
export async function identity(){return 'qa-owner'}
export function json(value,status=200){return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}})}
export function error(e){return json({error:e.message},e.status||500)}
export function input(r){return r.json()}
function prepare(sql){const statement=database.prepare(sql);return {args:[],bind(...args){this.args=args;return this},async all(){return {results:statement.all(...this.args)}},async first(){return statement.get(...this.args)||null},async run(){const result=statement.run(...this.args);return {meta:{changes:Number(result.changes)}}}}}
export function db(){return {prepare,async batch(statements){database.exec('BEGIN');try{const results=[];for(const s of statements)results.push(await s.run());database.exec('COMMIT');return results}catch(e){database.exec('ROLLBACK');throw e}}}}
export async function profile(owner,id){const p=await db().prepare('SELECT * FROM profiles WHERE owner=? AND id=?').bind(owner,id).first();if(!p)throw new HttpError(404,'Profile not found.');return p}
`;
const bundle=await build({stdin:{contents:`import {DELETE} from './app/api/profiles/route.ts';import {GET} from './app/api/report/route.ts';import {database} from '@/lib/service';export {DELETE,GET,database};`,resolveDir:process.cwd(),sourcefile:'qa-profile-entry.ts'},bundle:true,format:'esm',platform:'node',write:false,plugins:[{name:'qa-sqlite-service',setup(b){b.onResolve({filter:/^@\/lib\/service$/},()=>({path:'qa-service',namespace:'qa'}));b.onLoad({filter:/.*/,namespace:'qa'},()=>({contents:service}));}}]});
const {DELETE,GET,database}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())database.exec(await readFile('drizzle/'+file,'utf8'));
const tables=database.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r=>r.name);
function insert(table,values){
 const row={};for(const c of database.prepare('PRAGMA table_info('+table+')').all())if(c.notnull&&c.dflt_value===null)row[c.name]=c.type.toUpperCase().includes('INT')?0:'synthetic';
 Object.assign(row,values);const keys=Object.keys(row);
 database.prepare('INSERT INTO '+table+' ('+keys.join(',')+') VALUES ('+keys.map(()=>'?').join(',')+')').run(...Object.values(row));
}
function seed(){
 for(const table of tables)database.exec('DELETE FROM '+table);
 for(const [id,owner] of [['qa-delete','qa-owner'],['qa-keep','qa-owner'],['qa-foreign','other-owner']]){
  insert('profiles',{id,owner,name:'Synthetic '+id,relationship:'Friend',context:'Disposable test fixture',version:1,summary:JSON.stringify({attributes:[]})});
  for(const table of ['messages','sources','finding_records','profile_jobs','profile_batch_cache','retrieval_chunks'])insert(table,{id:table+'-'+id,owner,profile_id:id,...(table==='messages'?{source_id:'sources-'+id}:{}),...(table==='finding_records'?{record:JSON.stringify({text:'Synthetic scoped finding',source_ids:['messages-'+id]})}:{})});
 }
 for(const [id,owner,scope] of [
  ['delete-single','qa-owner',[['qa-delete',1]]],
  ['delete-network','qa-owner',[['qa-keep',1],['qa-delete',1]]],
  ['keep-single','qa-owner',[['qa-keep',1]]],
  ['foreign-turn','other-owner',[['qa-delete',1],['qa-foreign',1]]],
 ])insert('turns',{id,owner,scope:JSON.stringify(scope),answer:'{}'});
 insert('retrieval_cache',{id:'owner-cache',owner:'qa-owner'});
 insert('retrieval_cache',{id:'foreign-cache',owner:'other-owner'});
 insert('usage_records',{id:'usage-kept',owner:'qa-owner'});
}
const remove=id=>DELETE(new Request('http://localhost/api/profiles',{method:'DELETE',body:JSON.stringify({id})}));
const report=id=>GET(new Request('http://localhost/api/report?profile='+id));
const ids=table=>database.prepare('SELECT id FROM '+table+' ORDER BY id').all().map(r=>r.id);

test('Actual DELETE SQL removes owned profile data and related turns, preserves other profiles/owners/unrelated turns',async()=>{
 seed();assert.equal((await remove('qa-delete')).status,200);
 assert.deepEqual(ids('profiles'),['qa-foreign','qa-keep']);
 for(const table of ['messages','sources','finding_records','profile_jobs','profile_batch_cache','retrieval_chunks'])assert.deepEqual(ids(table),[table+'-qa-foreign',table+'-qa-keep'].sort(),table);
 assert.deepEqual(ids('turns'),['foreign-turn','keep-single']);
 // Owner-wide derived retrieval cache invalidation is intentional; other-owner
 // caches and usage/accounting records must remain untouched.
 assert.deepEqual(ids('retrieval_cache'),['foreign-cache']);
 assert.deepEqual(ids('usage_records'),['usage-kept']);
});
test('Foreign or missing profile deletion is rejected before any database deletion',async()=>{
 seed();const snapshot=()=>JSON.stringify(tables.map(t=>[t,database.prepare('SELECT * FROM '+t+' ORDER BY id').all()]));
 const before=snapshot();assert.equal((await remove('qa-foreign')).status,404);assert.equal(snapshot(),before);
 assert.equal((await remove('missing')).status,404);assert.equal(snapshot(),before);
});
test('Actual report SQL exports only selected owned profile findings and source metadata',async()=>{
 seed();const result=await report('qa-delete');assert.equal(result.status,200);const data=await result.json();
 assert.equal(data.schema,'undertone-report-v1');assert.equal(data.profile.id,'qa-delete');
 assert.deepEqual(data.sources.map(s=>s.id),['sources-qa-delete']);
 assert.deepEqual(data.findings.map(f=>f.id),['finding_records-qa-delete']);
 assert.equal(data.findings[0].record.text,'Synthetic scoped finding');
 assert.ok(!('raw' in data.sources[0]));assert.ok(!('hash' in data.sources[0]));
 assert.ok(!JSON.stringify(data).includes('qa-foreign'));
});
test('Report export rejects foreign and missing profile scope',async()=>{
 seed();assert.equal((await report('qa-foreign')).status,404);assert.equal((await report('missing')).status,404);
});
test.after(()=>database.close());
