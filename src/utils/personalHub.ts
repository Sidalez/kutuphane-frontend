export type HubEntity = {id:string;kind:"BOOK"|"MOVIE"|"TV";title:string;image?:string;url:string};
export type HubEvent = {id:string;date:string;title:string;url:string;kind:"BOOK"|"MOVIE"|"TV";minutes:number;pages:number};
export function localDate(date=new Date()) {return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;}
export function monthDays(month:string) {
 const [year,m]=month.split('-').map(Number);const first=new Date(year,m-1,1,12);first.setDate(first.getDate()-(first.getDay()+6)%7);
 return Array.from({length:42},(_,i)=>{const date=new Date(first);date.setDate(first.getDate()+i);return localDate(date)});
}
export function csv(rows:Record<string,unknown>[]) {
 const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
 const escape=(value:unknown)=>{let text=typeof value==='object'&&value!==null?JSON.stringify(value):String(value??'');if(/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;return '"'+text.replace(/"/g,'""')+'"'};
 return '\uFEFF'+[columns.map(escape).join(','),...rows.map(row=>columns.map(key=>escape(row[key])).join(','))].join('\r\n');
}
export function download(name:string,value:string,type='application/json') {
 const url=URL.createObjectURL(new Blob([value],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export function readingEvent(book:HubEntity,log:any):HubEvent {
 return {id:`book:${book.id}:${log.id}`,date:String(log.date||'').slice(0,10),title:book.title,url:book.url,kind:'BOOK',minutes:Math.max(0,Number(log.durationMinutes)||0),pages:Math.max(0,Number(log.totalRead??log.pagesRead??(Number(log.endPage)-Number(log.startPage)))||0)};
}
export function watchEvent(log:any):HubEvent {
 return {id:`watch:${log.id}`,date:String(log.date||'').slice(0,10),title:log.title||'İzleme kaydı',url:`/media/${log.mediaId}`,kind:log.mediaType==='TV'?'TV':'MOVIE',minutes:Math.max(0,Number(log.minutes)||0),pages:0};
}
export function eventStats(events:HubEvent[]) {return events.reduce((sum,item)=>({pages:sum.pages+item.pages,readingMinutes:sum.readingMinutes+(item.kind==='BOOK'?item.minutes:0),watchingMinutes:sum.watchingMinutes+(item.kind!=='BOOK'?item.minutes:0),sessions:sum.sessions+1}),{pages:0,readingMinutes:0,watchingMinutes:0,sessions:0});}
