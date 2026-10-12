export type AppIssue={id:string;path:string;status:number;createdAt:number};
export function recordIssue(status=0,id?:string):AppIssue {
 const issue={id:id&&/^[A-Za-z0-9-]{4,80}$/.test(id)?id:`APP-${crypto.randomUUID().slice(0,8).toUpperCase()}`,path:window.location.pathname,status,createdAt:Date.now()};
 try{sessionStorage.setItem('last-app-issue',JSON.stringify(issue))}catch{}
 window.dispatchEvent(new CustomEvent('app-issue',{detail:issue}));return issue;
}
export function lastIssue():AppIssue|null {try {const value=JSON.parse(sessionStorage.getItem('last-app-issue')||'null');return value&&typeof value.id==='string'&&typeof value.path==='string'?value:null}catch{return null}}
