import {readRecord,listRecords} from './device-db';
import type {SavedStudy} from './offline-study';
import type {PendingReview} from './review-outbox';
import {dailyResults,type ResultLog} from './study-results';
/** Display results from genuine saved events. Does not create completion evidence. */
export async function localDailyResults(owner:string,day:string) {
 const data=(await readRecord<SavedStudy>(owner,'study:daily'))?.value;
 const daily=data?.daily,context=daily?.resultContext;
 if(!context||daily?.day!==day||!daily.picks)return null;
 // Older locally created sets may have classified missing history as empty.
 // Wait for the server reconciliation rather than claim invented promotions.
 if(daily.timingKey?.startsWith("local:") && context.historyComplete!==true)return null;
 const logs=new Map(context.logs.map(l=>[l.id,{...l,reviewedAt:new Date(l.reviewedAt)}]));
 const journal=(await listRecords(owner,'local-review:')).sort((a,b)=>((a.value as PendingReview).sequence??a.savedAt)-((b.value as PendingReview).sequence??b.savedAt));
 for(const item of journal){
  const event=item.value as PendingReview;
  if(new Date(event.reviewedAt).getTime()<new Date(context.startedAt).getTime()||event.quality<=0)continue;
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${owner}:${event.eventId}`));
  const id=[...new Uint8Array(digest)].map(n=>n.toString(16).padStart(2,'0')).join('');
  if(event.operation==='undo')logs.delete(id);
  else logs.set(id,{id,cardId:event.cardId,direction:event.direction??null,quality:event.quality,reviewedAt:new Date(event.reviewedAt)});
 }
 return dailyResults(daily.picks,context.before.map(c=>({...c,recallStates:c.recallStates?.map(r=>({...r,lastReviewedAt:new Date(r.lastReviewedAt)})),reviews:c.reviews.map(r=>({...r,reviewedAt:new Date(r.reviewedAt)}))})),[...logs.values()] as ResultLog[]);
}
