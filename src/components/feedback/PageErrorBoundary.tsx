import { recordIssue } from "../../utils/appIssue";
import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
export default class PageErrorBoundary extends Component<{children: ReactNode}, {failed: boolean; code?:string}> {
  state: {failed:boolean;code?:string} = {failed: false};
  componentDidCatch() {const issue=recordIssue();this.setState({code:issue.id});}
  static getDerivedStateFromError() { return {failed:true}; }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div role="alert" className="mx-auto my-12 max-w-md rounded-3xl border border-orange-100 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900"><h1 className="text-xl font-semibold">Sayfa açılamadı</h1><p className="my-4 text-sm text-slate-500">Bağlantını kontrol edip yeniden deneyebilirsin. Yeni bir sürüm yayımlandıysa sayfayı yenilemek yardımcı olabilir.</p><p className="mb-3 font-mono text-xs text-slate-500">Takip kodu: {this.state.code || "Hazırlanıyor…"}</p><a href="/support" className="mb-3 block min-h-11 text-sm font-semibold text-orange-600">Sorunu kayıt altına al</a><button type="button" onClick={()=>{const recover=(window as Window & {recoverAppVersion?:(manual:boolean)=>Promise<void>}).recoverAppVersion;if(recover)void recover(true);else window.location.reload();}} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-orange-600 px-5 text-sm font-semibold text-white"><RefreshCw className="h-4 w-4" />Yeniden dene</button></div>;
  }
}
