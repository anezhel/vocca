// Цифры для главной и итогов: выучено, прогноз, серия дней, неделя.
import { LEVELS } from '../content/index.js';
import { getState, progress, update } from './store.js';
import { dayKey, addDays, startOfWeek, daysFrom, endOfDay } from './dates.js';
import { isLearned } from './srs.js';
import { wordById } from './words.js';

export function learnedStats(course) {
  const p = progress(course.id);
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  let total = 0;
  for (const [id, c] of Object.entries(p.cards)) {
    if (!isLearned(c)) continue;
    const w = wordById(course, id); if (!w) continue;
    total++; if (byLevel[w.lvl] != null) byLevel[w.lvl]++;
  }
  return { total, byLevel };
}

// Сколько слов к повторению по дням: [сегодня, завтра, …]
export function forecast(course, days = 5, now = Date.now()) {
  const p = progress(course.id);
  const out = Array(days).fill(0);
  for (const [id, c] of Object.entries(p.cards)) {
    if (!wordById(course, id) || c.due == null) continue;
    const d = c.due <= endOfDay(now) ? 0 : daysFrom(now, c.due);
    if (d < days) out[d]++;
  }
  return out;
}

const studied = (key) => { const d = getState().log[key]; return !!d && (d.reviews + d.fresh > 0); };

// Серия: дни подряд с занятием. Один пропущенный день закрывает заморозка (одна в неделю).
export function streak(now = Date.now()) {
  let n = 0, freezes = freezesLeft(now), day = now;
  if (!studied(dayKey(day))) day = addDays(day, -1);
  for (let i = 0; i < 400; i++) {
    if (studied(dayKey(day))) n++;
    else if (freezes > 0 && studied(dayKey(addDays(day, -1)))) freezes--;
    else break;
    day = addDays(day, -1);
  }
  return { days: n, freezes: freezesLeft(now) };
}

function weekId(ts) { return dayKey(startOfWeek(ts)); }
export function freezesLeft(now = Date.now()) {
  const f = getState().freezes;
  return f.week === weekId(now) ? f.left : 1;
}
export function refreshFreezes(now = Date.now()) {
  const f = getState().freezes;
  if (f.week !== weekId(now)) update((s) => { s.freezes = { left: 1, week: weekId(now) }; });
}

// Неделя для графика: слов в каждый день, понедельник — первый
export function week(now = Date.now()) {
  const start = startOfWeek(now);
  return Array.from({ length: 7 }, (_, i) => {
    const ts = addDays(start, i), d = getState().log[dayKey(ts)];
    return { count: d ? d.reviews + d.fresh : 0, future: ts > now, today: dayKey(ts) === dayKey(now) };
  });
}
