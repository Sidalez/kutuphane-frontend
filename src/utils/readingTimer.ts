export type ReadingTimer={startAtMs:number;segmentStartedAtMs:number|null;accumulatedMs:number;status:'running'|'paused'|'finished';endAtMs?:number};
export function elapsedReadingMs(timer:ReadingTimer,now=Date.now()){return Math.max(0,timer.accumulatedMs)+(timer.status==='running'&&timer.segmentStartedAtMs!==null?Math.max(0,now-timer.segmentStartedAtMs):0);}
export function restoreReadingTimer(data:any):ReadingTimer|null {
 if(!Number.isFinite(data?.startAtMs))return null;
 const status=data.status==='paused'?'paused':data.status==='finished'||data.endedAt?'finished':'running';
 const accumulated=Number.isFinite(data.accumulatedMs)?data.accumulatedMs:status==='finished'&&Number.isFinite(data.endAtMs)?data.endAtMs-data.startAtMs:0;
 return {startAtMs:data.startAtMs,status,accumulatedMs:Math.max(0,accumulated),segmentStartedAtMs:status==='running'?(Number.isFinite(data.segmentStartedAtMs)?data.segmentStartedAtMs:data.startAtMs):null,...(Number.isFinite(data.endAtMs)?{endAtMs:data.endAtMs}:{})};
}
export function pauseReadingTimer(timer:ReadingTimer,now=Date.now()):ReadingTimer{return {...timer,accumulatedMs:elapsedReadingMs(timer,now),segmentStartedAtMs:null,status:'paused'};}
export function resumeReadingTimer(timer:ReadingTimer,now=Date.now()):ReadingTimer{return timer.status==='paused'?{...timer,segmentStartedAtMs:now,status:'running'}:timer;}
export function finishReadingTimer(timer:ReadingTimer,now=Date.now()):ReadingTimer{return {...pauseReadingTimer(timer,now),status:'finished',endAtMs:now};}
