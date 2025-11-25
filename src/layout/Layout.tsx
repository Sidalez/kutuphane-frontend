// src/layout/Layout.tsx
import { useState } from "react";
import TopBar from "../components/TopBar";
import SideNav from "../components/SideNav";
import { Outlet } from "react-router-dom";
import { Menu } from "lucide-react";

export default function Layout() {
  // 🟡 Mobil menü açılsın mı kapansın mı state'i
  const [isSideOpen, setIsSideOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#fffff7] dark:bg-slate-950">
      {/* Üst bar her zamanki gibi */}
      <TopBar />

      {/* 🔔 Sadece mobilde görünen hamburger butonu */}
      <button
        type="button"
        onClick={() => setIsSideOpen(true)}
        className="md:hidden fixed top-3 left-3 z-50 p-2 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-700/80 shadow-sm active:scale-95 transition"
      >
        <Menu className="w-5 h-5 text-slate-700 dark:text-slate-100" />
      </button>

      <div className="flex flex-1">
        {/* Sidebar artık prop alıyor */}
        <SideNav
          isOpen={isSideOpen}
          onClose={() => setIsSideOpen(false)}
        />

        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
