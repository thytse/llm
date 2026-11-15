import {authorisedMessages} from '@/lib/provenance';
import {identity,db,input,json,error,profile} from '@/lib/service';
import {indexStep} from '@/lib/retrieval';
import type {Message} from '@/lib/types';
export async function POST(request:Request){try{const owner=await identity(),p=await input(request),person=await profile(owner,p.profileId);const messages=await authorisedMessages(owner,[String(person.id)]);return json(await indexStep(owner,person,messages))}catch(e){return error(e)}}
