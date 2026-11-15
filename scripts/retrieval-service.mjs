// Local inference only: no chat text is sent to Hugging Face. Only model files download.
import {pipeline,env} from '@huggingface/transformers';
import {createServer} from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve(new URL('../',import.meta.url).pathname);env.cacheDir=path.join(root,'.cache','models');
const varsPath=path.join(root,'.dev.vars');let vars=await readFile(varsPath,'utf8').catch(()=>'');
const old=vars.split('\n').find(l=>l.startsWith('ENCODER_TOKEN='));const token=old?JSON.parse(old.slice(14)):randomBytes(32).toString('hex');
if(!old){vars+='\nENCODER_TOKEN='+JSON.stringify(token)+'\nENCODER_URL="http://127.0.0.1:8788"\n';await writeFile(varsPath,vars,{mode:0o600})}
const benchmark=process.env.MINILM_BENCHMARK==='1';const model=benchmark?'Xenova/all-MiniLM-L6-v2':'Xenova/paraphrase-multilingual-MiniLM-L12-v2';const revision=benchmark?'751bff37182d3f1213fa05d7196b954e230abad9':'2c4055b12046f11709e9df2c122e59ffbdc2f900';
console.log('Loading pinned local MiniLM encoder (first run downloads public model files)…');
const extractor=await pipeline('feature-extraction',model,{revision,dtype:'q8'});
createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);res.end('{}');return}try{if(req.url==='/health'){res.end(JSON.stringify({model,revision,dimension:384,local:true}));return}if(req.url!=='/embed'||req.method!=='POST'){res.writeHead(404);res.end('{}');return}let raw='';for await(const buf of req){raw+=buf;if(raw.length>200000)throw Error('Payload too large')};const {texts}=JSON.parse(raw);if(!Array.isArray(texts)||texts.length>64||texts.some(t=>typeof t!=='string'||t.length>12000))throw Error('Invalid texts');const vectors=[];for(const text of texts){const encoded=await extractor.tokenizer(text);if(encoded.input_ids.size>256)throw Error('Encoder chunk exceeds 256 tokens');const result=await extractor(text,{pooling:'mean',normalize:true});vectors.push(Array.from(result.data))}res.end(JSON.stringify({vectors,encoder:model+'@'+revision}));}catch{res.writeHead(400);res.end(JSON.stringify({error:'Local encoding failed'}))}}).listen(8788,'127.0.0.1',()=>console.log('Local MiniLM service ready on 127.0.0.1:8788. Restart the app once to load its private service token.'));

setInterval(()=>{const purge=spawn(process.execPath,[path.join(root,'scripts/purge-expired.mjs')],{cwd:root,stdio:['ignore','ignore','ignore']});purge.on('error',()=>console.error('Scheduled local retention purge unavailable.'));},3600000).unref();
