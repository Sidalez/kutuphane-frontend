export async function withDeadline<T>(task:Promise<T>,milliseconds:number,message:string):Promise<T>{
 let timeout:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([task,new Promise<never>((_,reject)=>{timeout=setTimeout(()=>reject(new Error(message)),milliseconds)})]);}
 finally{clearTimeout(timeout);}
}
