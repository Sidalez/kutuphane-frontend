// src/components/TopBar.tsx
import { useTheme } from "../theme/ThemeContext";
import {
  Moon,
  SunMedium,
  LibraryBig,
  UserCircle2,
  LogOut,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";

export default function TopBar() {
  const { theme, toggleTheme } = useTheme();
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
const location = useLocation();

const isMediaModule = location.pathname.startsWith("/media") || 
                      location.pathname.startsWith("/add-media");

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-slate-200/80 dark:border-slate-800/80 bg-gradient-to-r from-orange-50/90 via-white/90 to-slate-50/90 dark:from-slate-950/90 dark:via-slate-900/90 dark:to-slate-950/90 backdrop-blur-md shadow-sm">
      {/* Sol logo alanı */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary to-orange-500 flex items-center justify-center shadow-md shadow-orange-200/70 dark:shadow-orange-900/40">
          <LibraryBig className="w-5 h-5 text-white" />
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-[15px] tracking-tight text-slate-900 dark:text-slate-50">
            Kütüphanem
          </span>
          <span className="text-[12px] font-medium text-slate-600 dark:text-slate-400">
            Kişisel kitap &amp; medya panon
          </span>
        </div>
      </div>

      {/* Orta kısım: modüller (şimdilik kitaplar aktif) */}
 <div className="hidden md:flex items-center">
  <div className="inline-flex items-center p-1 rounded-full bg-slate-900/5 dark:bg-slate-50/5 border border-slate-200/60 dark:border-slate-700/70">
    <button
      onClick={() => navigate("/library")}
      className={[
        "px-3 py-1.5 rounded-full text-xs font-semibold transition",
        !isMediaModule
          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
          : "text-slate-400 dark:text-slate-500",
      ].join(" ")}
    >
      Kitaplar
    </button>

    <button
      onClick={() => navigate("/media")}
      className={[
        "px-3 py-1.5 rounded-full text-xs font-semibold transition",
        isMediaModule
          ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-sm"
          : "text-slate-400 dark:text-slate-500",
      ].join(" ")}
    >
      Film &amp; Diziler
    </button>
  </div>
</div>


      {/* Sağ taraf: tema + kullanıcı */}
      <div className="flex items-center gap-3">
        {/* Tema butonu */}
        <button
          onClick={toggleTheme}
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-slate-200/80 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label="Tema değiştir"
        >
          {theme === "dark" ? (
            <SunMedium className="w-4 h-4 text-amber-300" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Kullanıcı durumu */}
        {loading ? (
          <div className="w-32 h-8 rounded-full bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
        ) : user ? (
          <div className="flex items-center gap-2">
            {/* Avatar + isim: profili açar */}
            <button
              onClick={() => navigate("/profile")}
              className="flex items-center gap-2 bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-700 rounded-full pl-1.5 pr-3 py-1 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/90 to-orange-500/90 text-xs flex items-center justify-center font-semibold text-white overflow-hidden">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName ?? "Kullanıcı"}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserCircle2 className="w-5 h-5 text-white" />
                )}
              </div>
              <div className="hidden sm:flex flex-col leading-tight text-left max-w-[130px]">
                <span className="text-[12px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                  {user.displayName ?? "Kullanıcı"}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Profilim
                </span>
              </div>
            </button>

            {/* Çıkış butonu */}
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 text-white text-[11px] font-semibold px-3 py-1.5 shadow-sm hover:brightness-110 dark:bg-slate-100 dark:text-slate-900 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Çıkış</span>
            </button>
          </div>
        ) : (
          <button
            onClick={() => navigate("/login")}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 text-white text-[13px] font-semibold px-3 py-1.5 shadow-sm hover:brightness-110 dark:bg-slate-100 dark:text-slate-900 transition"
          >
            <span>🔑 Giriş yap</span>
          </button>
        )}
      </div>
    </header>
  );
}
