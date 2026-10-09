// src/layout/Layout.tsx
import { useEffect, useState } from "react";
import TopBar from "../components/TopBar";
import SideNav from "../components/SideNav";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { LibraryBig, Clapperboard, Plus, Sparkles, Menu } from "lucide-react";

export default function Layout() {
  // 🟡 Mobil menü açılsın mı kapansın mı state'i
  const [isSideOpen, setIsSideOpen] = useState(false);
  const { pathname } = useLocation();
  const isMedia = pathname.startsWith("/media") || pathname === "/add-media";
  useEffect(() => { setIsSideOpen(false); }, [pathname]);
  useEffect(() => {
    if (!isSideOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setIsSideOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [isSideOpen]);
  const tabs = [
    { to: "/library", label: "Kitaplar", icon: LibraryBig, active: pathname.startsWith("/library") || pathname.startsWith("/edit/") },
    { to: "/media", label: "Film & Dizi", icon: Clapperboard, active: pathname.startsWith("/media") && !pathname.includes("suggestions") && !pathname.includes("reports") },
    { to: isMedia ? "/add-media" : "/add-book", label: "Ekle", icon: Plus, active: pathname.startsWith("/add-"), primary: true },
    { to: isMedia ? "/media/suggestions" : "/suggestions", label: "Keşfet", icon: Sparkles, active: pathname.includes("suggestions") },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] flex flex-col bg-[#fffaf3] dark:bg-slate-950">
      {/* Üst bar her zamanki gibi */}
      <TopBar />


      <div className="flex flex-1">
        {/* Sidebar artık prop alıyor */}
        <SideNav
          isOpen={isSideOpen}
          onClose={() => setIsSideOpen(false)}
        />

        <main className="min-w-0 flex-1 px-4 py-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-6 lg:px-6 lg:py-6">
          <Outlet />
        </main>
      </div>
      <nav aria-label="Ana gezinme" className="fixed bottom-0 inset-x-0 z-30 grid grid-cols-5 border-t border-orange-100/80 bg-white/95 px-2 pt-2 pb-[calc(.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_32px_rgba(15,23,42,.06)] backdrop-blur-xl md:hidden dark:border-slate-800 dark:bg-slate-950/95">
        {tabs.map(({ to, label, icon: Icon, active, primary }) => (
          <NavLink key={label} to={to} aria-current={active ? "page" : undefined} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold transition active:scale-95 ${active ? "text-primary" : "text-slate-500 dark:text-slate-400"}`}>
            <span className={primary ? "-mt-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white shadow-lg shadow-orange-200/60 ring-4 ring-white dark:ring-slate-950 dark:shadow-none" : `flex h-7 w-10 items-center justify-center rounded-xl ${active ? "bg-orange-50 dark:bg-primary/15" : ""}`}><Icon className={primary ? "h-6 w-6" : "h-5 w-5"} strokeWidth={active ? 2.5 : 1.8} /></span>
            {label}
          </NavLink>
        ))}
        <button type="button" aria-label="Diğer menüleri aç" aria-expanded={isSideOpen} aria-controls="app-navigation" onClick={() => setIsSideOpen(true)} className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl text-[10px] font-semibold active:scale-95 ${isSideOpen || ["/profile", "/goals", "/statistics", "/media/reports"].includes(pathname) ? "text-primary" : "text-slate-500 dark:text-slate-400"}`}><span className="flex h-7 w-10 items-center justify-center"><Menu className="h-5 w-5" /></span>Diğer</button>
      </nav>
    </div>
  );
}
