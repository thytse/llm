'use client';
import {useEffect,useState} from 'react';
import {Check,Copy,FileText} from 'lucide-react';
import {answerFailureNotice} from '@/lib/answer-status';
import type {Answer} from '@/lib/types';
export function DraftResult({answer,onEvidence}:{answer:Answer;onEvidence:(id:string)=>void}){
 const [text,setText]=useState(answer.draft_message||''),[copied,setCopied]=useState(false),[copyError,setCopyError]=useState('');
 useEffect(()=>{setText(answer.draft_message||'');setCopied(false);setCopyError('')},[answer]);
 const failed=answer.metrics.verification_failed===true;
 async function copy(){try{await navigator.clipboard.writeText(text);setCopied(true);setCopyError('')}catch{setCopyError('Copy was unavailable. Select the message text and copy it manually.')}}
 return <div className="draft-result">
 {failed&&<p className="notice" role="status">{answerFailureNotice(answer)}</p>}
 {!failed&&answer.draft_message&&<section className="draft-message-card" aria-label="Proposed message">
  <div className="section-title"><div><small>YOUR MESSAGE</small><h3>Proposed message</h3></div><button type="button" className="primary" onClick={copy} disabled={!text.trim()} aria-label="Copy message">{copied?<Check size={14}/>:<Copy size={14}/>} {copied?'Copied':'Copy message'}</button></div>
  <label className="sr-only" htmlFor="proposed-message">Edit your message</label><textarea id="proposed-message" rows={5} value={text} maxLength={1200} onChange={e=>{setText(e.target.value);setCopied(false)}}/>
  <p className="footnote">Edit before copying. Your edits are not checked again. Nothing is sent automatically.</p><span className="sr-only" role="status">{copied?'Message copied to clipboard.':''}</span>{copyError&&<p role="alert" className="error-text">{copyError}</p>}
 </section>}
 {!failed&&!answer.draft_message&&<p className="notice">{answer.next_question||'This older draft mixes the message with analysis. Generate a new draft to separate them.'}</p>}
 {Number(answer.metrics.omitted_notes)>0&&<p className="footnote">{String(answer.metrics.omitted_notes)} supporting notes were omitted after checks. The message was reviewed separately.</p>}
 <section className="draft-support" aria-label="Supporting evidence and reasoning"><h3>Supporting evidence &amp; reasoning</h3><p className="footnote">These notes are separate from the message and are never included when you copy it.</p>
 {answer.findings.map((f,i)=><div className="finding" key={i}><div className="tags"><span>{f.kind==='evidence'?'Supporting evidence':f.kind==='inference'?'Tentative interpretation':'Reasoning & guidance'}</span><span>{f.support}</span></div><p>{f.text}</p><div className="citations">{f.citations.map(c=><button key={c.id} type="button" onClick={()=>onEvidence(c.id)}><FileText size={11}/>View evidence</button>)}</div></div>)}
 {!answer.findings.length&&<p className="footnote">No person-specific supporting evidence was provided.</p>}{answer.next_question&&<p className="context-note">{answer.next_question}</p>}
 </section></div>;
}
