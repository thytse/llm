// Storage/import capacities are separate from per-request LLM evidence budgets.
export const MAX_IMPORT_BYTES=1_500_000;
export const MAX_IMPORT_MESSAGES=10_000;
export const MAX_PROFILE_MESSAGES=20_000;
export const MAX_WORKSPACE_MESSAGES=50_000;
export const MAX_IMPORT_REQUEST_BYTES=10_000_000;
export const MAX_PROFILE_CALLS=1_000;
export function importCapacity(workspaceCount:number,profileCount:number,incoming:number){
 if(profileCount+incoming>MAX_PROFILE_MESSAGES)return `This relationship supports up to ${MAX_PROFILE_MESSAGES.toLocaleString('en-US')} messages. This import adds ${incoming.toLocaleString('en-US')} to ${profileCount.toLocaleString('en-US')}. Try a smaller date range.`;
 if(workspaceCount+incoming>MAX_WORKSPACE_MESSAGES)return `Workspace capacity is ${MAX_WORKSPACE_MESSAGES.toLocaleString('en-US')} messages; this import would reach ${(workspaceCount+incoming).toLocaleString('en-US')}. Existing data has been kept.`;
 return null;
}
export function importRecords<T>(records:T[]){const batches:T[][]=[];let batch:T[]=[],bytes=2;for(const record of records){const size=new TextEncoder().encode(JSON.stringify(record)).length+1;if(batch.length&&(batch.length>=256||bytes+size>1_500_000)){batches.push(batch);batch=[];bytes=2}batch.push(record);bytes+=size}if(batch.length)batches.push(batch);return batches;}
