export function orderedEpisodes<T extends {section:string}>(episodes:T[]){
 const order=['positive','negative','mixed','ambiguous'];
 return [...episodes].sort((a,b)=>order.indexOf(a.section)-order.indexOf(b.section));
}
