import {elapsedReadingMs,type ReadingTimer} from './readingTimer';
export function observeReadingClock(timer:ReadingTimer,publish:(milliseconds:number)=>void,win:Window=window,doc:Document=document){
 const refresh=()=>publish(elapsedReadingMs(timer));
 const visible=()=>{if(doc.visibilityState==='visible')refresh();};
 refresh();
 const interval=timer.status==='running'?win.setInterval(refresh,1000):null;
 win.addEventListener('focus',refresh);win.addEventListener('pageshow',refresh);doc.addEventListener('visibilitychange',visible);
 return()=>{if(interval!==null)win.clearInterval(interval);win.removeEventListener('focus',refresh);win.removeEventListener('pageshow',refresh);doc.removeEventListener('visibilitychange',visible);};
}
