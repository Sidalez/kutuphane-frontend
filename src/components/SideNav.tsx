// src/components/SideNav.tsx
import { NavLink } from "react-router-dom";
import {
  LibraryBig,
  PlusSquare,
  Target,
  BarChart2,
  Sparkles,
  UserCircle2,
  X,
} from "lucide-react";

const navItems = [
  { to: "/library", label: "Kütüphanem", icon: LibraryBig },
  { to: "/add-book", label: "Kitap Ekle", icon: PlusSquare },
  { to: "/goals", label: "Okuma Hedefleri", icon: Target },
  { to: "/statistics", label: "İstatistikler", icon: BarChart2 },
  { to: "/suggestions", label: "Öneriler", icon: Sparkles },
  { to: "/profile", label: "Profilim", icon: UserCircle2 },
];

interface SideNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SideNav({ isOpen, onClose }: SideNavProps) {
  return (
    <>
      {/* 🕶 Mobilde sidebar açıldığında arkadaki karartma */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 md:hidden transition-opacity ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      <aside
        className={[
          // temel stil
          "flex flex-col w-60 border-r border-slate-200/80 dark:border-slate-800/80",
          "bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm",
          "transition-transform duration-200 ease-out",
          // konum
          "fixed inset-y-0 left-0 z-40 md:static",
          // desktop'ta her zaman açık
          "md:translate-x-0",
          // mobilde aç/kapa
          isOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        {/* Üst kısım */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 font-semibold">
            Kitap Modülü
          </p>

          {/* Mobilde kapanma butonu */}
          <button
            type="button"
            onClick={onClose}
            className="md:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-900"
          >
            <X className="w-4 h-4 text-slate-600 dark:text-slate-300" />
          </button>
        </div>

        {/* Menü linkleri */}
        <nav className="flex-1 px-2 pb-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                // mobilde menüye tıklayınca kapanması için:
                onClick={onClose}
                className={({ isActive }) =>
                  [
                    "flex items-center gap-3 px-3 py-2 rounded-xl text-[15px] font-semibold transition group",
                    isActive
                      ? "bg-gradient-to-r from-primary-soft/90 to-orange-50 text-primary dark:from-primary/20 dark:to-slate-900 dark:text-primary shadow-sm shadow-orange-100/70 dark:shadow-orange-900/40"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-slate-900",
                  ].join(" ")
                }
              >
                <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 group-hover:border-primary">
                  <Icon className="w-4 h-4" />
                </span>
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Alt kısım: ipucu kartı */}
        <div className="mt-auto px-3 pb-4">
          <div className="rounded-2xl border border-dashed border-primary/40 bg-primary-soft/60 dark:bg-primary/10 px-3 py-3 text-xs text-slate-700 dark:text-slate-100">
            <p className="font-semibold mb-1 text-[11px] text-primary/90 dark:text-primary/90">
              İpucu ✨
            </p>
            <p className="leading-snug">
              Okuma hedeflerini & istatistiklerini doldurdukça,{" "}
              <span className="font-medium">öneriler</span> bölümü daha akıllı
              hale gelecek.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
