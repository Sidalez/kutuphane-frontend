let active = 0;
const listeners = new Set<() => void>();
export const subscribeActivity = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const getActivity = () => active;
export function beginActivity() {
  active++; listeners.forEach(listener => listener());
  let finished = false;
  return () => { if (finished) return; finished = true; active = Math.max(0, active - 1); listeners.forEach(listener => listener()); };
}
