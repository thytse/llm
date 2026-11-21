'use client';
import {orderedEpisodes} from '@/lib/conversation-order';
import {FileText} from 'lucide-react';
import type {Answer} from '@/lib/types';
export function ConversationResult({answer,onEvidence}:{answer:Answer;onEvidence:(ids:string[],counterIds?:string[])=>void}){
 const scope=answer.analysis_scope;if(!scope&&!answer.analysis_notice)return null;
 const yue=answer.response_language==='yue-Hant';
 const ordered=orderedEpisodes(answer.episodes||[]);
 const labels:Record<string,string>=yue?{positive:'正面／欣賞嘅片段',negative:'不滿／失落嘅可能解讀',mixed:'情緒有轉變嘅片段',ambiguous:'意思未明確嘅片段'}:{positive:'Positive / appreciative moments',negative:'Possible frustration / hurt',mixed:'Mixed moments and changes',ambiguous:'Ambiguous moments'};
 return <section className="conversation-result" aria-label="Detailed conversation analysis">
  {answer.analysis_notice&&<p className="notice" role="status">{answer.analysis_notice}</p>}
  {scope&&<p className="footnote">{yue?'所選範圍':'Selected scope'}: {scope.messages_in_scope} {yue?'則訊息':'messages'} · {scope.mode==='full_context'?(yue?'向分析及覆核提供全部對話':'Full conversation supplied to analysis and review'):(yue?`已讀取全部批次；回答選用 ${scope.originals_for_answer} 則原文`:`All reading batches processed; ${scope.originals_for_answer} originals selected for this answer`)}</p>}
  {answer.overview&&<p className="analysis-overview">{answer.overview}</p>}
  {Object.entries(labels).map(([section,label])=>{const episodes=ordered.filter(e=>e.section===section);return episodes.length?<section key={section}><h3>{label}</h3>{episodes.map(e=><article className="finding" key={e.id}>
   <div className="tags"><span>{e.date}</span><span>{e.support==='tentative'?(yue?'暫時解讀':'Tentative interpretation'):e.support}</span>{e.review_status==='qualified'&&<span>{yue?'覆核後修訂':'Qualified after review'}</span>}</div>
   <h4>{ordered.indexOf(e)+1}. {e.situation}</h4><blockquote>{e.literal_wording}</blockquote><p>{e.interpretation}</p>
   <p><strong>{yue?'對話線索：':'Contextual clues: '}</strong>{e.clues}</p>
   {e.alternative&&<p><strong>{yue?'另一個可能：':'Alternative reading: '}</strong>{e.alternative}</p>}
   <button className="text-button" onClick={()=>onEvidence(e.citations.map(c=>c.id),e.counter_citations.map(c=>c.id))}><FileText size={12}/>{yue?'查看原文及前後回應':'View originals and relevant replies'}</button>
  </article>)}</section>:null})}
  {!!answer.patterns?.length&&<section><h3>{yue?'跨片段嘅暫時觀察':'Tentative patterns across exchanges'}</h3>{answer.patterns.map((p,i)=><div className="finding" key={i}><p>{p.text}</p><button className="text-button" onClick={()=>onEvidence(p.citations.map(c=>c.id),p.counter_citations.map(c=>c.id))}><FileText size={12}/>{yue?'查看支持及反例':'View support and counterexamples'}</button></div>)}</section>}
  {Number(answer.metrics.omitted_items)>0&&<p className="footnote">{yue?`有 ${answer.metrics.omitted_items} 項未通過或未完成檢查，已省略；其餘已覆核內容保留。`:`${answer.metrics.omitted_items} items did not pass or complete checks and were omitted; independently checked items are retained.`}</p>}
  {answer.limits&&<p className="context-note">{answer.limits}</p>}
 </section>;
}
