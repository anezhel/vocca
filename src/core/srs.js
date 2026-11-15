// Три режима повторения (экран 03). Интервалы — в CONFIG.modes, здесь только правила.
//   smart — интервал растёт от оценки: Забуто · Важко · Знаю · Легко
//   fixed — лестница 15 хв → 2 год → 4 год → 1 день → …, оценки «Не пам’ятаю / Пам’ятаю»
//   daily — лестница в днях, повторения раз в день
import { CONFIG } from '../config.js';

const DAY = 86400;
const UNIT = { m: 60, h: 3600, d: DAY };
const parse = (s) => (typeof s === 'number' ? s * DAY : parseFloat(s) * UNIT[s.slice(-1)]);
const ladder = (mode) => CONFIG.modes[mode].ladder.map(parse);

export const RATINGS = { smart: ['again', 'hard', 'good', 'easy'], fixed: ['again', 'remember'], daily: ['again', 'remember'], simple: ['dontKnow', 'forgot', 'known'] };
export const ratingsFor = (mode) => (CONFIG.answerButtons === 'simple' ? RATINGS.simple : RATINGS[mode] || RATINGS.smart);
// «Не знаю» и «Забуто» (CONFIG.answerButtons = 'simple') для интервалов — то же, что «Забуто» в шкале
export const asRating = (r) => (r === 'dontKnow' || r === 'forgot' ? 'again' : r);

// Ступень лестницы по текущему интервалу (когда режим поменяли посреди учёбы)
function stepOf(card, mode) {
  if (card.mode === mode && card.step != null) return card.step;
  if (!card.reps) return 0;
  const l = ladder(mode);
  let s = 0;
  l.forEach((v, i) => { if ((card.ivl || 0) >= v) s = i; });
  return s;
}

// Интервал в секундах после оценки. Карточка не меняется.
// 'learn' — «Вчити» на карточке: новое слово — первая ступень, повторение — следующая (в умном режиме — как «Знаю»).
export function nextInterval(card, rating, mode) {
  card = card || {};
  rating = asRating(rating);
  if (rating === 'learn') {
    if (mode === 'smart') return !card.reps || !card.ivl ? CONFIG.modes.smart.first.hard * DAY : nextInterval(card, 'good', mode);
    const l = ladder(mode);
    return l[card.reps ? Math.min(stepOf(card, mode) + 1, l.length - 1) : 0];
  }
  if (mode === 'smart') {
    const m = CONFIG.modes.smart;
    const ivl = (card.ivl || 0) / DAY, ease = card.ease || m.startEase;
    if (rating === 'again') return 0;
    if (!card.reps || !ivl) return m.first[rating] * DAY;
    if (rating === 'hard') return Math.max(1, ivl * m.hardFactor) * DAY;
    if (rating === 'good') return Math.max(ivl + 1, ivl * ease) * DAY;
    return Math.max(ivl + 2, ivl * ease * m.easyBonus) * DAY;
  }
  const l = ladder(mode);
  const step = rating === 'again' ? 0 : Math.min(stepOf(card, mode) + 1, l.length - 1);
  return l[Math.max(0, step)];
}

export function schedule(card, rating, mode, now = Date.now()) {
  const c = { ...(card || {}) };
  rating = asRating(rating);
  const ivl = nextInterval(c, rating, mode);
  if (mode === 'smart') {
    const m = CONFIG.modes.smart;
    c.ease = c.ease || m.startEase;
    if (rating === 'again') { c.ease = Math.max(m.minEase, c.ease - 0.2); c.lapses = (c.lapses || 0) + 1; }
    if (rating === 'hard') c.ease = Math.max(m.minEase, c.ease - 0.15);
    if (rating === 'easy') c.ease += 0.15;
    c.step = null;
  } else {
    c.step = rating === 'again' || (rating === 'learn' && !c.reps) ? 0 : Math.min(stepOf(c, mode) + 1, ladder(mode).length - 1);
    if (rating === 'again') c.lapses = (c.lapses || 0) + 1;
  }
  c.mode = mode;
  c.ivl = ivl;
  c.due = now + ivl * 1000;
  c.reps = (c.reps || 0) + 1;
  c.last = now;
  return c;
}

// «Я знаю це» / «Знаю це слово» — слово сразу выучено. Вернётся на проверку через месяц, только если CONFIG.recheckKnown
export const markKnown = (now = Date.now()) => ({ known: true, learnedAt: now, ivl: 30 * DAY, due: now + 30 * DAY * 1000, reps: 1, last: now, ease: CONFIG.modes.smart.startEase });

export const isLearned = (card) => !!card && (card.known || (card.ivl || 0) >= CONFIG.learnedAfterDays * DAY);
export const status = (card) => (!card ? 'fresh' : isLearned(card) ? 'learned' : 'learning');
