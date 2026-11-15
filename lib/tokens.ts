import {Tiktoken} from 'js-tiktoken/lite';
import ranks from 'js-tiktoken/ranks/o200k_base';
let encoder:Tiktoken;
export const TOKENIZER='o200k_base';
export function tokenCount(value:unknown){encoder||=new Tiktoken(ranks);return encoder.encode(typeof value==='string'?value:JSON.stringify(value)).length;}
export function fitEvidence<T>(values:T[],budget:number){const chosen:T[]=[];for(const v of values){if(tokenCount([...chosen,v])<=budget)chosen.push(v)}return chosen;}
export function splitText(text:string,budget=160){const parts:string[]=[];let rest=text;while(rest){let lo=1,hi=rest.length;while(lo<hi){const mid=Math.ceil((lo+hi)/2);if(tokenCount(rest.slice(0,mid))<=budget)lo=mid;else hi=mid-1}let cut=lo;if(cut<rest.length&&/[\uD800-\uDBFF]/.test(rest[cut-1]))cut--;if(cut<1)throw Error('Cannot split source within token budget');parts.push(rest.slice(0,cut));rest=rest.slice(cut)}return parts;}
