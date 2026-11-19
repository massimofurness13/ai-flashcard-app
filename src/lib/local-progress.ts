import { listRecords, readRecord } from "./device-db";
import { readOfflineStudy } from "./offline-study";
import { toLocalDateKey } from "./timezone";
import type { LibraryManifest } from "./local-library";
import type { PendingReview } from "./review-outbox";
/** Display-only projection. Never manufactures logs or server completion evidence. */
export async function projectLocalProgress<T>(owner:string,url:string,value:T,savedAt:number,now=new Date()):Promise<T> {
  if(url!=="/api/library"&&!url.startsWith("/api/stats"))return value;
  const manifest=(await readRecord<LibraryManifest>(owner,"library:manifest"))?.value;
  const data=structuredClone(value) as Record<string,unknown>;
  const tz=manifest?.timeZone || (data.reviewTimeZone as string) || "UTC";
  let today:string;try{today=toLocalDateKey(now,tz);}catch{today=toLocalDateKey(now,"UTC");}
  const changes=new Map<string,number>();
  for(const item of await listRecords(owner,"local-review:")) {
    if(item.savedAt<savedAt)continue;
    const r=item.value as PendingReview;
    if(r.quality<=0)continue;
    let day:string;try{day=toLocalDateKey(new Date(r.reviewedAt),tz);}catch{continue;}
    changes.set(day,(changes.get(day)||0)+(r.operation==="undo"?-1:1));
  }
  const baseDay=typeof data.reviewDay==="string"?data.reviewDay:toLocalDateKey(new Date(savedAt),tz);
  data.cardsReviewedToday=Math.max(0,(baseDay===today?Number(data.cardsReviewedToday||0):0)+(changes.get(today)||0));
  if(baseDay===today||changes.has(today))data.reviewDay=today;
  if(url==="/api/library") {
    const saved=await readOfflineStudy(owner,"study:daily");
    if(saved?.data.daily?.day===today) {
      const snapshot=saved.snapshot;
      data.dailyStudy={day:today,timeZone:tz,total:saved.data.daily.total,completed:snapshot?Math.min(saved.data.daily.total,snapshot.stats.cardsReviewed):saved.data.daily.completed};
    }
  } else {
    data.goalHitToday=Number(data.cardsReviewedToday)>=Number(data.dailyGoal);
    data.totalReviews=Math.max(0,Number(data.totalReviews||0)+[...changes.values()].reduce((a,b)=>a+b,0));
    for(const key of ["dailyCounts","heatmapData","calendarMonth"]) {
      if(!Array.isArray(data[key]))continue;
      const rows=data[key] as {date:string;count:number}[];
      for(const row of rows)row.count=Math.max(0,row.count+(changes.get(row.date)||0));
    }
  }
  return data as T;
}
