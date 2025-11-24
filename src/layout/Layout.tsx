// src/layout/Layout.tsx
import TopBar from "../components/TopBar";
import SideNav from "../components/SideNav";
import { Outlet } from "react-router-dom";

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#fffff7] dark:bg-slate-950">
      <TopBar />
      <div className="flex flex-1">
        <SideNav />
        <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
