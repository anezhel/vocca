// План на сегодня и ход занятия: новое слово → «Згадай» → ответ → оценка.
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { getState, update, progress, dayLog } from './store.js';
import { dayKey, endOfDay, startOfDay } from './dates.js';
import { schedule, markKnown } from './srs.js';
import { wordById } from './words.js';

export const minutesFor = (nNew, nReview) => Math.max(1, Math.round((nNew * CONFIG.secondsPerNew + nReview * CONFIG.secondsPerReview) / 60));

// Новые слова по порядку: сначала добавленные из групп, потом по уровням (уровень из теста — первым).
function pickFresh(course, p, quota) {
  const out = [];
  for (const id of p.queue) { if (out.length >= quota) return out; if (!p.cards[id] && wordById(course, id)) out.push(id); }
  const levels = LEVELS.filter((l) => p.levels.includes(l));
  if (p.testLevel && levels.includes(p.testLevel)) levels.sort((a, b) => (a === p.testLevel ? -1 : b === p.testLevel ? 1 : 0));
  for (const lvl of levels) {
    for (const w of course.words) {
      if (out.length >= quota) return out;
      if (w.lvl === lvl && !p.cards[w.id] && !out.includes(w.id)) out.push(w.id);
    }
  }
  return out;
}

export function planToday(course, now = Date.now()) {
  const p = progress(course.id);
  const log = getState().log[dayKey(now)] || { reviews: 0, fresh: 0 };
  const until = p.mode === 'fixed' ? now : endOfDay(now);
  const due = [];
  const later = [];
  for (const [id, c] of Object.entries(p.cards)) {
    if (!wordById(course, id)) continue;
    if (c.due <= until) due.push([id, c]);
    else if (c.due <= endOfDay(now)) later.push(c.due);
  }
  due.sort((a, b) => a[1].due - b[1].due);
  const doneToday = log.reviews + log.fresh;
  const cap = Math.max(0, p.perDay - doneToday);
  const reviews = due.slice(0, p.mode === 'fixed' ? due.length : cap).map((r) => r[0]);
  const quota = Math.max(0, Math.min(p.newPerDay - log.fresh, cap - reviews.length));
  const fresh = pickFresh(course, p, quota);
  later.sort((a, b) => a - b);
  return {
    reviews, fresh, total: reviews.length + fresh.length, doneToday, freshToday: log.fresh,
    minutes: minutesFor(fresh.length, reviews.length),
    later: later.length, nextAt: later[0] || null,
    noLevels: !p.levels.length && !p.queue.length,
  };
}

// Очередь занятия. practice = «Повторити ще раз»: слова сегодняшнего дня без изменения интервалов.
export function startLesson(course, plan, practice = false) {
  let queue;
  if (practice) {
    const p = progress(course.id), start = startOfDay();
    const ids = Object.entries(p.cards).filter(([id, c]) => c.last >= start && wordById(course, id)).map(([id]) => id);
    queue = ids.sort(() => Math.random() - 0.5).slice(0, 20).map((id) => ({ kind: 'recall', id }));
  } else {
    queue = [];
    const r = [...plan.reviews], f = [...plan.fresh];
    while (r.length || f.length) {
      for (let i = 0; i < 2 && r.length; i++) queue.push({ kind: 'recall', id: r.shift() });
      if (f.length) queue.push({ kind: 'new', id: f.shift() });
    }
  }
  return { queue, total: queue.length, done: 0, practice, startedAt: Date.now(), stats: { reviews: 0, fresh: 0 }, freshIds: [] };
}

// Новое слово: «Вчити» → вспомним его через пару карточек; «Я знаю це» → сразу выучено.
export function learnNew(course, lesson, id, known) {
  if (known) {
    update(() => { progress(course.id).cards[id] = markKnown(); dropFromQueue(course, id); dayLog(dayKey()).fresh++; });
    lesson.done++; lesson.stats.fresh++;
  } else {
    lesson.queue.splice(Math.min(CONFIG.repeatGap - 1, lesson.queue.length), 0, { kind: 'recall', id, fresh: true });
    lesson.freshIds.push(id);
  }
}

function dropFromQueue(course, id) { const p = progress(course.id); p.queue = p.queue.filter((x) => x !== id); }

// Оценка после ответа. «Забуто» в умном режиме — слово вернётся в этом же занятии.
export function rate(course, lesson, item, rating) {
  const p = progress(course.id);
  const again = rating === 'again' && p.mode === 'smart';
  if (!lesson.practice) {
    update(() => {
      p.cards[item.id] = schedule(p.cards[item.id], rating, p.mode);
      dropFromQueue(course, item.id);
      if (!again) { const d = dayLog(dayKey()); if (item.fresh) d.fresh++; else d.reviews++; }
    });
  }
  if (again) {
    lesson.queue.splice(Math.min(CONFIG.repeatGap, lesson.queue.length), 0, { ...item, retry: true });
  } else {
    lesson.done++;
    if (item.fresh) lesson.stats.fresh++; else lesson.stats.reviews++;
  }
}

export function finishLesson(lesson) {
  const sec = Math.round((Date.now() - lesson.startedAt) / 1000);
  lesson.sec = sec;
  if (!lesson.practice) update(() => { dayLog(dayKey()).sec += sec; dayLog(dayKey()).lessons = (dayLog(dayKey()).lessons || 0) + 1; });
}
