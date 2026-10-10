import { useEffect } from "react";
export default function MobileRuntime() {
  useEffect(() => {
    const viewport = window.visualViewport;
    const update = () => {
      const editing = document.activeElement?.matches("input, textarea, select");
      document.documentElement.classList.toggle("keyboard-open", Boolean(editing && viewport && window.innerHeight - viewport.height > 150));
    };
    viewport?.addEventListener("resize", update); document.addEventListener("focusin", update); document.addEventListener("focusout", update);
    return () => { viewport?.removeEventListener("resize", update); document.removeEventListener("focusin", update); document.removeEventListener("focusout", update); document.documentElement.classList.remove("keyboard-open"); };
  }, []);
  return null;
}
