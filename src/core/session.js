// План на сегодня и ход занятия: сначала повторение, потом новые слова.
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { getState, update, progress, dayLog } from './store.js';
import { dayKey, endOfDay, startOfDay } from './dates.js';
import { schedule, markKnown, asRating, status, isLearned } from './srs.js';
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
    if (c.known && !CONFIG.recheckKnown) continue;
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

// Очередь занятия: сначала все слова на повторение, потом новые (между ними — экран «Повторення готово»).
// practice = «Повторити слова, які вчу»: слова со статусом «Вчу», без изменения расписания.
export function startLesson(course, plan, practice = false) {
  let queue;
  if (practice) {
    const ids = learningIds(course);
    queue = ids.sort(() => Math.random() - 0.5).slice(0, CONFIG.repeatSize).map((id) => ({ kind: 'recall', id }));
  } else {
    queue = [...plan.reviews.map((id) => ({ kind: 'recall', id })), ...plan.fresh.map((id) => ({ kind: 'new', id }))];
  }
  return { queue, total: queue.length, done: 0, practice, reviewTotal: practice ? 0 : plan.reviews.length,
    startedAt: Date.now(), stats: { reviews: 0, fresh: 0 }, freshIds: [] };
}

// Повторение ещё идёт и после него есть новые слова — тогда видна кнопка «Перейти до нових слів»
export const canSkipReviews = (lesson, item) => !lesson.practice && item.kind === 'recall' && !item.fresh && lesson.queue.some((x) => x.kind === 'new');

// «Перейти до нових слів»: оставшиеся повторения убираем из занятия. Расписание не меняется —
// эти слова остаются в «повторити» на главной и придут в следующем занятии.
export function skipReviews(lesson) {
  const rest = lesson.queue.filter((x) => x.kind === 'recall' && !x.fresh);
  lesson.queue = lesson.queue.filter((x) => !rest.includes(x));
  lesson.total -= rest.length;
  lesson.skipped = rest.length;
}

// Экран «Повторення готово» перед первым новым словом — если в занятии было повторение и его не пропустили
export const reviewBreak = (lesson, item) => item.kind === 'new' && lesson.reviewTotal > 0 && !lesson.skipped && !lesson.breakSeen && lesson.stats.reviews > 0;

// Слова со статусом «Вчу» — для «Повторити слова, які вчу»
export function learningIds(course) {
  return Object.entries(progress(course.id).cards).filter(([id, c]) => wordById(course, id) && status(c) === 'learning').map(([id]) => id);
}

// «Ще 5 нових слів» после плана: новые слова сверх дневного лимита
export function extraPlan(course) {
  const p = progress(course.id);
  const fresh = pickFresh(course, p, p.newPerDay);
  return { reviews: [], fresh, total: fresh.length };
}
export const freshLeft = (course) => pickFresh(course, progress(course.id), 1).length > 0;

// Новое слово: «Вчити» → вспомним его через пару карточек (в карточках — по расписанию); «Я знаю це» → сразу выучено.
// Знакомое слово дневной план не тратит: вместо него сразу приходит следующее новое.
export function learnNew(course, lesson, id, known) {
  if (known) {
    update(() => { progress(course.id).cards[id] = markKnown(); dropFromQueue(course, id); countLearned(); });
    const inLesson = new Set(lesson.queue.map((x) => x.id));
    const next = pickFresh(course, progress(course.id), 50).find((x) => !inLesson.has(x));
    if (next) lesson.queue.splice(1, 0, { kind: 'new', id: next });
    else lesson.done++;
  } else {
    lesson.queue.splice(Math.min(CONFIG.repeatGap - 1, lesson.queue.length), 0, { kind: 'recall', id, fresh: true });
    lesson.freshIds.push(id);
  }
}

// «Додано у вивчені» на главной: +1 к сегодняшнему дню (вызывать внутри update)
export function countLearned(delta = 1) { const d = dayLog(dayKey()); d.learned = Math.max(0, (d.learned || 0) + delta); }

function dropFromQueue(course, id) { const p = progress(course.id); p.queue = p.queue.filter((x) => x !== id); }

// Оценка после ответа. «Забуто» в умном режиме — слово вернётся в этом же занятии
// (с кнопками 'simple' — один раз, чтобы занятие не шло по кругу).
// «Знаю це слово» — слово сразу выучено.
export function rate(course, lesson, item, rating) {
  const p = progress(course.id);
  if (rating === 'known') {
    update(() => {
      p.cards[item.id] = markKnown(); dropFromQueue(course, item.id); countLearned();
      const d = dayLog(dayKey()); if (lesson.practice) d.practice = (d.practice || 0) + 1; else if (item.fresh) d.fresh++; else d.reviews++;
    });
    lesson.done++;
    if (item.fresh) lesson.stats.fresh++; else lesson.stats.reviews++;
    return;
  }
  const simple = CONFIG.answerButtons === 'simple';
  rating = asRating(rating);
  const again = rating === 'again' && p.mode === 'smart' && !(simple && item.retry);
  if (!lesson.practice) {
    update(() => {
      const was = isLearned(p.cards[item.id]);
      p.cards[item.id] = schedule(p.cards[item.id], rating, p.mode);
      if (!was && isLearned(p.cards[item.id])) { p.cards[item.id].learnedAt = Date.now(); countLearned(); }
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

// «Вчити» на карточке (lessonStyle: 'cards'): слово остаётся в «Вчу» и вернётся по расписанию режима.
// В «Повторити слова, які вчу» расписание не меняется.
export function keepLearning(course, lesson, item) {
  const p = progress(course.id);
  const isNew = item.kind === 'new' || item.fresh;
  if (lesson.practice) update(() => { const d = dayLog(dayKey()); d.practice = (d.practice || 0) + 1; });
  if (!lesson.practice) {
    update(() => {
      const was = isLearned(p.cards[item.id]);
      p.cards[item.id] = schedule(p.cards[item.id], 'learn', p.mode);
      if (!was && isLearned(p.cards[item.id])) { p.cards[item.id].learnedAt = Date.now(); countLearned(); }
      dropFromQueue(course, item.id);
      const d = dayLog(dayKey()); if (isNew) d.fresh++; else d.reviews++;
    });
  }
  if (item.kind === 'new') lesson.freshIds.push(item.id);
  lesson.done++;
  if (isNew) lesson.stats.fresh++; else lesson.stats.reviews++;
}

export function finishLesson(lesson) {
  const sec = Math.round((Date.now() - lesson.startedAt) / 1000);
  lesson.sec = sec;
  if (!lesson.practice) update(() => { dayLog(dayKey()).sec += sec; dayLog(dayKey()).lessons = (dayLog(dayKey()).lessons || 0) + 1; });
}
