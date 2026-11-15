import {MAX_IMPORT_BYTES,MAX_IMPORT_MESSAGES} from './limits';
export type Parsed={speaker:string;timestamp:string;body:string;start:number;end:number};
export function parseChat(raw:string,order:'DMY'|'MDY'='DMY'):{messages:Parsed[];speakers:string[];skipped:number}{
 if(new TextEncoder().encode(raw).length>MAX_IMPORT_BYTES)throw Error('TXT exports support up to 1.5 MB per import. Split larger files by date range.');
 const lines=raw.split(/\n/);const out:Parsed[]=[];let offset=0,skipped=0;
 for(const line of lines){
  const clean=line.replace(/\r$/,'');
  const m=clean.match(/^\u200e?\[?(?<a>\d{1,4})[\/.\-](?<b>\d{1,2})[\/.\-](?<c>\d{1,4}),?\s+(?:(?<pre>上午|下午|早上|晚上|中午)\s*)?(?<h>\d{1,2}):(?<min>\d{2})(?::(?<sec>\d{2}))?\s*(?<post>[APap][Mm]|上午|下午)?(?:\]|\s[-–])?\s+(?<speaker>[^:：]+)[:：]\s?(?<body>.*)$/);
  if(m?.groups){const g=m.groups;let a=Number(g.a),b=Number(g.b),c=Number(g.c);let year=a>31?a:c<100?2000+c:c;let month=a>31?b:order==='DMY'?b:a;let day=a>31?c:order==='DMY'?a:b;let h=Number(g.h);const min=Number(g.min),sec=Number(g.sec||0),period=g.pre||g.post;
   if(period){if(h<1||h>12)throw Error('Invalid 12-hour time.');h=h%12+(/pm|下午|晚上|中午/i.test(period)?12:0);}
   const d=new Date(Date.UTC(year,month-1,day,h,min,sec));
   if(year<1990||year>2100||d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day||h>23||min>59||sec>59)throw Error('Invalid date/time. Check the selected date order.');
   const body=g.body;const localStart=clean.length-body.length;
   out.push({speaker:g.speaker.trim(),timestamp:d.toISOString().slice(0,19),body,start:offset+localStart,end:offset+clean.length});
  }else if(out.length&&clean&&!/^\[?\d{1,4}[\/.-]\d/.test(clean)){
   const last=out[out.length-1];last.end=offset+clean.length;last.body=raw.slice(last.start,last.end);
  }else if(clean)skipped++;
  offset+=line.length+1;
 }
 if(!out.length)throw Error('No supported WhatsApp messages found. Use a TXT export with timestamps and sender names.');
 if(out.length>MAX_IMPORT_MESSAGES)throw Error('Upload at most 10,000 messages at a time. Split larger exports by date range.');
 if(out.some(m=>m.body.length>12000))throw Error('A message is too long (12,000 character maximum).');
 return {messages:out,speakers:[...new Set(out.map(m=>m.speaker))],skipped};
}
