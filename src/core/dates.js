export const DAY = 86400000;
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (ts = Date.now()) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
export const startOfDay = (ts = Date.now()) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
export const endOfDay = (ts = Date.now()) => startOfDay(addDays(ts, 1)) - 1;
export const addDays = (ts, n) => { const d = new Date(ts); d.setDate(d.getDate() + n); return d.getTime(); };
export const daysFrom = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY);
// last n day keys, oldest first, today last
export const lastDays = (n, now = Date.now()) => Array.from({ length: n }, (_, i) => dayKey(addDays(now, i - n + 1)));
// Monday-based index 0..6
export const weekday = (ts = Date.now()) => (new Date(ts).getDay() + 6) % 7;
export const startOfWeek = (ts = Date.now()) => startOfDay(addDays(ts, -weekday(ts)));
const p2 = (n) => String(n).padStart(2, '0');
export const clock = (ts) => { const d = new Date(ts); return `${d.getHours()}:${p2(d.getMinutes())}`; };
