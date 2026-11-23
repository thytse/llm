// Classify saved failures without exposing raw provider output or user data.
export function answerFailureNotice(answer:any){
 if(!answer?.metrics?.verification_failed)return '';
 const failure=[...(Array.isArray(answer.trace)?answer.trace:[])].reverse().find((t:any)=>t?.stage==='technical_failure');
 const reason=String(failure?.reason||'');
 const suffix=' Any suggestions below are general advice, not a verified personalised answer.';
 if(/output.length limit|did not finish its response|response incomplete/i.test(reason))return 'The model response was cut off before analysis could finish. Ask again to retry.'+suffix;
 if(/citation|source.*outside|outside.*evidence|not acquired/i.test(reason))return 'A generated citation could not be matched to the available evidence. The personalised draft was withheld.'+suffix;
 if(/budget exhausted|input budget|request.size/i.test(reason)||answer.metrics.outcome==='budget_exhausted')return 'The analysis exceeded the app’s request-size limit before its next model call.'+suffix;
 if(/timeout|timed out|exceeded \d+ seconds|deadline/i.test(reason))return 'The model request timed out before analysis could finish.'+suffix;
 if(failure)return 'The model service or analysis encountered a technical error before checking finished. Inspect the trace for details.'+suffix;
 return 'The personalised draft did not pass evidence review and was withheld.'+suffix;
}

// Partial answers with independently checked content are not treated as failures.
export function isRetryableAnswer(answer:any){
 const outcome=String(answer?.metrics?.outcome||'');
 return answer?.metrics?.verification_failed===true||['no_checked_items','no_checked_people_options','conversation_technical_failure','people_technical_failure','technical_failure','budget_exhausted','verification_failed'].includes(outcome)||Array.isArray(answer?.trace)&&answer.trace.some((entry:any)=>entry?.stage==='technical_failure');
}
