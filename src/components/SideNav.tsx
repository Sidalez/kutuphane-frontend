// src/components/SideNav.tsx
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useRef } from "react";
import {
  LibraryBig,
  PlusSquare,
  Target,
  BarChart2,
  Sparkles,
  UserCircle2,
  X,
  Clapperboard,
  Settings,
} from "lucide-react";

const bookNavItems = [
  { to: "/library", label: "Kütüphanem", icon: LibraryBig },
  { to: "/add-book", label: "Kitap Ekle", icon: PlusSquare },
  { to: "/goals", label: "Okuma Hedefleri", icon: Target },
  { to: "/statistics", label: "İstatistikler", icon: BarChart2 },
  { to: "/suggestions", label: "Öneriler", icon: Sparkles },
  { to: "/profile", label: "Profilim", icon: UserCircle2 },
];

const mediaNavItems = [
  { to: "/media", label: "Film & Dizilerim", icon: Clapperboard },
  { to: "/add-media", label: "Film / Dizi Ekle", icon: PlusSquare },
  { to: "/media/reports", label: "İzleme Raporları", icon: BarChart2 },
  { to: "/media/suggestions", label: "Film / Dizi Önerileri", icon: Sparkles }
];

interface SideNavProps {
  isOpen: boolean;
  onClose: () => void;
}

function getNavLinkClass(isActive: boolean) {
  return [
    "flex items-center gap-3 px-3 py-2 rounded-xl text-[15px] font-semibold transition group",
    isActive
      ? "bg-gradient-to-r from-primary-soft/90 to-orange-50 text-primary dark:from-primary/20 dark:to-slate-900 dark:text-primary shadow-sm shadow-orange-100/70 dark:shadow-orange-900/40"
      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-900",
  ].join(" ");
}

export default function SideNav({ isOpen, onClose }: SideNavProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, [isOpen]);
  const location = useLocation();

  const isMediaModule =
    location.pathname.startsWith("/media") ||
    location.pathname.startsWith("/add-media");

  const activeItems = isMediaModule ? mediaNavItems : bookNavItems;

  const moduleTitle = isMediaModule ? "Film & Dizi Modülü" : "Kitap Modülü";

  const tipText = isMediaModule
    ? "Film ve dizi kayıtlarını düzenli tuttukça, izleme istatistiklerin daha anlamlı hale gelir."
    : "Okuma hedeflerini & istatistiklerini doldurdukça, öneriler bölümü daha akıllı hale gelecek.";

  return (
    <>
      <div
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm md:hidden transition-opacity ${
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        id="app-navigation"
        aria-label="Tüm menüler"
        onKeyDown={(event) => {
          if (!isOpen || event.key !== "Tab") return;
          const elements = event.currentTarget.querySelectorAll<HTMLElement>('a[href], button');
          const first = elements[0]; const last = elements[elements.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}
        className={[
          "flex flex-col w-full md:w-60 md:shrink-0 border-r border-slate-200/80 dark:border-slate-800/80",
          "bg-white dark:bg-slate-950 rounded-t-3xl md:rounded-none overflow-y-auto overscroll-contain",
          "transition-transform duration-200 ease-out",
          "fixed bottom-0 left-0 max-h-[85dvh] z-50 md:sticky md:top-16 md:h-[calc(100dvh-4rem)] md:max-h-none self-start pb-[env(safe-area-inset-bottom)]",
          "md:translate-y-0 md:visible",
          isOpen ? "translate-y-0 visible" : "translate-y-full invisible",
        ].join(" ")}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 font-semibold">
            {moduleTitle}
          </p>

          <button
            ref={closeButton}
            aria-label="Menüyü kapat"
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            <X className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2 mx-4 mb-4 rounded-2xl bg-slate-100 p-1 dark:bg-slate-900 md:hidden">
          <NavLink to="/library" onClick={onClose} className={`rounded-xl py-2.5 text-center text-sm font-semibold ${!isMediaModule ? "bg-white text-primary shadow-sm dark:bg-slate-800" : "text-slate-500"}`}>Kitaplar</NavLink>
          <NavLink to="/media" onClick={onClose} className={`rounded-xl py-2.5 text-center text-sm font-semibold ${isMediaModule ? "bg-white text-primary shadow-sm dark:bg-slate-800" : "text-slate-500"}`}>Film & Dizi</NavLink>
        </div>

        <nav className="flex-1 px-2 pb-4 space-y-1">
          {activeItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/media"}
                onClick={onClose}
                className={({ isActive }) => getNavLinkClass(isActive)}
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 group-hover:border-primary">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
          {isMediaModule && <NavLink to="/profile" onClick={onClose} className={({ isActive }) => getNavLinkClass(isActive)}><span className="flex h-8 w-8 items-center justify-center"><UserCircle2 className="h-4 w-4" /></span>Profilim</NavLink>}
          <NavLink to="/settings" onClick={onClose} className={({ isActive }) => getNavLinkClass(isActive)}><span className="flex h-8 w-8 items-center justify-center"><Settings className="h-4 w-4" /></span>Ayarlar</NavLink>
        </nav>

        <div className="mt-auto px-3 pb-4">
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary-soft/60 dark:bg-primary/10 px-3 py-3 text-xs text-slate-700 dark:text-slate-100">
            <p className="font-semibold mb-1 text-[11px] text-primary/90 dark:text-primary/90">
              İpucu ✨
            </p>
            <p className="leading-snug">{tipText}</p>
          </div>
        </div>
      </aside>
    </>
  );
}
