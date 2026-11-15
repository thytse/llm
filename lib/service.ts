import {providerReady} from './model-config';
import {purgeExpired} from './retention';
import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
export async function identity(){const u=await getChatGPTUser();if(!u)throw new HttpError(401,'Please sign in to your private workspace.');await purgeExpired(u.userId);return u.userId;}
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export function db(){if(!env.DB)throw new HttpError(503,'Database is not configured.');return env.DB;}
export function configured(){return providerReady();}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store'}})}
export function error(e:unknown){return json({error:e instanceof HttpError?e.message:'The request failed safely. Please retry; no answer was verified.'},e instanceof HttpError?e.status:500)}
export async function input(request:Request,maxBytes=650000){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new HttpError(403,'Request origin rejected.');const raw=await request.text();if(new TextEncoder().encode(raw).length>maxBytes)throw new HttpError(413,'Request too large.');try{return JSON.parse(raw)}catch{throw new HttpError(400,'Invalid JSON request.')}}
export async function profile(owner:string,id:string){const p=await db().prepare('SELECT * FROM profiles WHERE owner=? AND id=?').bind(owner,id).first();if(!p)throw new HttpError(404,'Profile not found.');return p;}
