export class ProviderJsonError extends Error{
 constructor(public details:Record<string,unknown>){super('Model returned malformed JSON; stopped safely.')}
}
// A single Markdown transport wrapper can be removed without changing JSON or
// its meaning. Never repair JSON, search for an object inside prose, or accept a
// truncated response. The caller checks completion before this parser runs.
export function parseProviderJson(value:unknown){
 if(typeof value!=='string')throw new ProviderJsonError({response_type:typeof value});
 const text=value.replace(/^\uFEFF/,'').trim();
 const fence=text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
 try{return JSON.parse(fence?fence[1]:text)}catch{throw new ProviderJsonError({response_characters:text.length,markdown_wrapper:!!fence,starts_with_object:text.startsWith('{')})}
}
