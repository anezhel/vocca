// Статус слова. С 18.11.2026 интервального повторения нет: статус ставит сам человек кнопками на карточке,
// а что и когда тренировать, выбирает на экране 2.2 «Що тренуємо».
//   new     — «Нові»: слово ещё не встречалось (карточки нет)
//   hard    — «Важкі»: «Вчити» на новом слове или «Важко» на повторении
//   almost  — «Майже вивчені»: «Легко» на повторении
//   learned — «Вивчено»: «Я знаю це» на новом слове или «Вивчено» на повторении
// Карточка: { st, at — когда отметили, n — сколько раз отмечали, learnedAt — когда стало «Вивчено» }.

const DAY = 86400;
export const BUCKETS = ['new', 'hard', 'almost', 'learned'];

// Статус карточки. Карточки до 18.11.2026 (интервалы) переводятся так: выучено или интервал от 21 дня — «Вивчено»,
// от 7 дней — «Майже вивчені», остальные — «Важкі».
export function bucket(card) {
  if (!card) return 'new';
  if (card.st) return card.st;
  const ivl = card.ivl || 0;
  if (card.known || ivl >= 21 * DAY) return 'learned';
  if (ivl >= 7 * DAY) return 'almost';
  return 'hard';
}

// Новая карточка со статусом st (предыдущая — чтобы сохранить счётчик и дату «Вивчено»)
export function mark(card, st, now = Date.now()) {
  const was = bucket(card);
  const c = { st, at: now, n: ((card && (card.n || card.reps)) || 0) + 1 };
  if (st === 'learned') c.learnedAt = was === 'learned' && card.learnedAt ? card.learnedAt : now;
  return c;
}
export const markKnown = (now = Date.now()) => mark(null, 'learned', now);

export const isLearned = (card) => bucket(card) === 'learned';
// Для фильтра «Усі / Вчу / Вивчено / Нові» на вкладке «Слова»: «Вчу» — это «Важкі» и «Майже вивчені»
export const status = (card) => { const b = bucket(card); return b === 'new' ? 'fresh' : b === 'learned' ? 'learned' : 'learning'; };
