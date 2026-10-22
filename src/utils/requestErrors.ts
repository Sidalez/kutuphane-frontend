export function shouldReportRequestError(error:{code?:string;name?:string;config?:{background?:boolean}}){return error.code!=='ERR_CANCELED'&&error.name!=='CanceledError'&&!error.config?.background;}
