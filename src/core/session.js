// Занятие «Вчити слова» и цель на день. С 18.11.2026 без интервального повторения:
// человек сам выбирает на 2.2 «Що тренуємо», какие слова тренировать (уровни, «Нові / Важкі / Майже вивчені», количество),
// а кнопками на карточке ставит слову статус (src/core/srs.js).
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { getState, update, progress, dayLog } from './store.js';
import { dayKey } from './dates.js';
import { bucket, mark } from './srs.js';
import { wordById } from './words.js';

export const minutesFor = (nNew, nReview) => Math.max(1, Math.round((nNew * CONFIG.secondsPerNew + nReview * CONFIG.secondsPerReview) / 60));

// «Мій рівень»: уровень по тесту, если он среди выбранных, иначе самый высокий из выбранных
export function myLevel(p) {
  const levels = LEVELS.filter((l) => p.levels.includes(l));
  if (!levels.length) return null;
  return p.testLevel && levels.includes(p.testLevel) ? p.testLevel : levels[levels.length - 1];
}

// ── 2.2 «Що тренуємо»: выбор человека запоминается; по умолчанию — «твій рівень», «Нові» + «Важкі», 20 слів ──
export function practicePrefs(course) {
  const p = progress(course.id);
  const base = { ...CONFIG.practiceDefault, levels: [myLevel(p) || p.levels[0] || LEVELS[0]] };
  const saved = p.practice || {};
  return {
    levels: (saved.levels || base.levels).filter((l) => LEVELS.includes(l)),
    kinds: saved.kinds || base.kinds,
    groups: (saved.groups || base.groups).filter((id) => course.groupList.some((g) => g.id === id)),
    size: CONFIG.practiceSizes.includes(saved.size) ? saved.size : base.size,
  };
}
export const savePractice = (course, prefs) => update(() => { progress(course.id).practice = { ...prefs }; });

// Новые слова выбранных уровней: сначала добавленные из групп, потом вперемешку по уровням.
// Больше всего — с «моего уровня», меньше — с соседних (вес по расстоянию 4 · 2 · 1 · 0,5). Внутри уровня — от частых слов.
// Случайность «на день»: в течение дня подбор тот же.
const DIST_WEIGHT = [4, 2, 1, 0.5];
function seeded(key) {   // mulberry32 от строки
  let h = 1779033703;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 3432918353), h = (h << 13) | (h >>> 19);
  return () => { h |= 0; h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function pickFresh(course, p, quota, chosen) {
  const out = [];
  for (const id of p.queue) { if (out.length >= quota) return out; if (!p.cards[id] && wordById(course, id)) out.push(id); }
  const levels = LEVELS.filter((l) => chosen.includes(l));
  if (!levels.length) return out;
  const pools = levels.map((l) => course.words.filter((w) => w.lvl === l && !p.cards[w.id] && !out.includes(w.id)).map((w) => w.id));
  const me = LEVELS.indexOf(myLevel(p) || levels[0]);
  const weights = levels.map((l) => DIST_WEIGHT[Math.min(3, Math.abs(LEVELS.indexOf(l) - me))]);
  const rnd = seeded(course.id + dayKey());
  const next = levels.map(() => 0);
  while (out.length < quota) {
    const live = weights.map((w, i) => (next[i] < pools[i].length ? w : 0));
    const sum = live.reduce((a, b) => a + b, 0);
    if (!sum) break;
    let r = rnd() * sum, i = 0;
    while (r >= live[i]) { r -= live[i]; i++; }
    out.push(pools[i][next[i]++]);
  }
  return out;
}

// Слова со статусом b (hard / almost) выбранных уровней: сначала те, что дольше всего не тренировали
function known(course, p, b, levels) {
  const lv = new Set(levels);
  return Object.entries(p.cards)
    .filter(([id, c]) => { if (bucket(c) !== b) return false; const w = wordById(course, id); return w && (w.custom || lv.has(w.lvl)); })
    .sort((a, z) => (a[1].at || a[1].last || 0) - (z[1].at || z[1].last || 0))
    .map(([id]) => id);
}

// Сколько слов найдётся под выбор — для подписи и пустого состояния
export function countFor(course, prefs) {
  const p = progress(course.id);
  return { new: pickFresh(course, p, 1, prefs.levels).length, hard: known(course, p, 'hard', prefs.levels).length, almost: known(course, p, 'almost', prefs.levels).length };
}

// Очередь занятия: выбранные группы слов поровну (по одному по кругу), потом по порядку — «Важкі», «Майже вивчені», «Нові»
export function buildQueue(course, prefs) {
  const p = progress(course.id);
  const N = prefs.size === 'all' ? CONFIG.practiceAllCap : prefs.size;
  const order = ['hard', 'almost', 'new'].filter((k) => prefs.kinds.includes(k));
  const pools = Object.fromEntries(order.map((k) => [k, k === 'new' ? pickFresh(course, p, N, prefs.levels) : known(course, p, k, prefs.levels)]));
  const take = Object.fromEntries(order.map((k) => [k, 0]));
  let total = 0;
  while (total < N && order.some((k) => take[k] < pools[k].length)) {
    for (const k of order) if (total < N && take[k] < pools[k].length) { take[k]++; total++; }
  }
  return order.flatMap((k) => pools[k].slice(0, take[k]).map((id) => ({ kind: k === 'new' ? 'new' : 'review', id })));
}

export function startLesson(course, prefs) {
  const queue = buildQueue(course, prefs);
  return { queue, total: queue.length, done: 0, prefs, startedAt: Date.now(), stats: { reviews: 0, fresh: 0, learned: 0 } };
}

// «Додано у вивчені» за день (вызывать внутри update)
export function countLearned(delta = 1) { const d = dayLog(dayKey()); d.learned = Math.max(0, (d.learned || 0) + delta); }
function dropFromQueue(course, id) { const p = progress(course.id); p.queue = p.queue.filter((x) => x !== id); }

// Кнопка на карточке: новое слово — «Я знаю це» (learned) / «Вчити» (hard);
// повторение — «Важко» (hard) / «Легко» (almost) / «Вивчено» (learned)
export function answer(course, lesson, item, st) {
  update(() => {
    const p = progress(course.id);
    const was = bucket(p.cards[item.id]);
    p.cards[item.id] = mark(p.cards[item.id], st);
    if (st === 'learned' && was !== 'learned') countLearned();
    dropFromQueue(course, item.id);
    const d = dayLog(dayKey()); if (item.kind === 'new') d.fresh++; else d.reviews++;
  });
  lesson.done++;
  if (item.kind === 'new') lesson.stats.fresh++; else lesson.stats.reviews++;
  if (st === 'learned') lesson.stats.learned++;
}

export function finishLesson(lesson) {
  const sec = Math.round((Date.now() - lesson.startedAt) / 1000);
  lesson.sec = sec;
  update(() => { const d = dayLog(dayKey()); d.sec = (d.sec || 0) + sec; d.lessons = (d.lessons || 0) + 1; });
}

// ── Цель на день (1.4, 1.5): новых слов и повторений. Пока цель не выполнена — кнопка «Вчити слова»,
// после — «Вчити ще». Если повторять пока почти нечего, цель по повторениям — сколько есть.
export function dayGoal(course, now = Date.now()) {
  const p = progress(course.id);
  const d = getState().log[dayKey(now)] || {};
  const fresh = (d.fresh || 0) + (d.knownNew || 0);
  const reviews = (d.reviews || 0) + (d.practice || 0);
  let toRepeat = 0;
  for (const [id, c] of Object.entries(p.cards)) { const b = bucket(c); if ((b === 'hard' || b === 'almost') && wordById(course, id)) toRepeat++; }
  const repeatNeed = Math.min(p.repeatGoal, reviews + toRepeat);
  return { fresh, reviews, newGoal: p.newGoal, repeatGoal: p.repeatGoal, done: fresh >= p.newGoal && reviews >= repeatNeed };
}
