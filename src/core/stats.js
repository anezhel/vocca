// Цифры для главной и итогов: выучено, прогноз, серия дней, неделя.
import { LEVELS } from '../content/index.js';
import { getState, progress, update } from './store.js';
import { dayKey, addDays, startOfWeek, daysFrom, endOfDay } from './dates.js';
import { isLearned } from './srs.js';
import { CONFIG } from '../config.js';
import { wordById } from './words.js';

// total — все выученные (как в списке «Вивчені слова», вместе со словами из групп);
// inCourse и byLevel — только слова курса (words.tsv): по ним считаются «% курсу» и полоски уровней.
const courseIds = new WeakMap();   // id слов курса — чтобы не перебирать список на каждое слово
const inCourseSet = (course) => { if (!courseIds.has(course)) courseIds.set(course, new Set(course.words.map((w) => w.id))); return courseIds.get(course); };

export function learnedStats(course) {
  const p = progress(course.id);
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  const base = inCourseSet(course);
  let total = 0, inCourse = 0;
  for (const [id, c] of Object.entries(p.cards)) {
    if (!isLearned(c)) continue;
    const w = wordById(course, id); if (!w) continue;
    total++;
    if (!base.has(id)) continue;
    inCourse++; if (byLevel[w.lvl] != null) byLevel[w.lvl]++;
  }
  return { total, inCourse, byLevel };
}

// Сегодня (крупное число на «Практика»): сколько слов пройдено — повторено и выучено в «Вчити слова»
// (вместе с новыми, отмеченными «Я знаю це») и в «Повторити слова, які вчу», — и сколько минут ушло на занятия.
const dayWords = (d) => (d.reviews || 0) + (d.fresh || 0) + (d.practice || 0) + (d.knownNew || 0);
export function todayStats(now = Date.now()) {
  const d = getState().log[dayKey(now)] || {};
  const sec = d.sec || 0;
  return { words: dayWords(d), minutes: sec > 0 ? Math.max(1, Math.round(sec / 60)) : 0 };
}

// Сколько слов к повторению по дням: [сегодня, завтра, …]
export function forecast(course, days = 5, now = Date.now()) {
  const p = progress(course.id);
  const out = Array(days).fill(0);
  for (const [id, c] of Object.entries(p.cards)) {
    if (!wordById(course, id) || c.due == null) continue;
    if (c.known && !CONFIG.recheckKnown) continue; // «Я знаю це» — больше не придёт
    const d = c.due <= endOfDay(now) ? 0 : daysFrom(now, c.due);
    if (d < days) out[d]++;
  }
  return out;
}

// Статистика по дням для главной: последние `days` дней, сегодня — последний.
// repeated — слова, пройденные в «Вчити слова» и «Повторити слова, які вчу»; learned — добавлено в «Вивчено».
export function history(days, now = Date.now()) {
  const log = getState().log;
  return Array.from({ length: days }, (_, i) => {
    const ts = addDays(now, i - days + 1), d = log[dayKey(ts)] || {};
    return { ts, repeated: (d.reviews || 0) + (d.fresh || 0) + (d.practice || 0), learned: Math.max(0, d.learned || 0) };
  });
}

// день засчитывается в серию, если в нём было занятие: «Вчити слова» или «Повторити слова, які вчу»
const studied = (key) => { const d = getState().log[key]; return !!d && dayWords(d) > 0; };

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
