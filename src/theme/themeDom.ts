export type Theme = "light" | "dark";
export const THEME_COLORS = { light: "#fffaf3", dark: "#020617" } as const;

export function readTheme(): Theme {
  try {
    const saved = window.localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch { /* The theme still works when browser storage is unavailable. */ }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function meta(name: string, content: string) {
  let element = document.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.setAttribute("content", content);
}

/** Keep the browser chrome and safe-area canvas in sync with the app's own theme. */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
  root.style.backgroundColor = THEME_COLORS[theme];
  document.body.style.backgroundColor = THEME_COLORS[theme];
  meta("theme-color", THEME_COLORS[theme]);
  meta("color-scheme", theme);
  meta("apple-mobile-web-app-status-bar-style", theme === "dark" ? "black" : "default");
  try { window.localStorage.setItem("theme", theme); } catch {}
}
