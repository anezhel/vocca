// Статус слова. С 25.11.2026 (решение дизайнера) статусов два: «Нові» и «Вивчено». Важких и майже вивчених больше нет.
//   new     — «Нові»: карточки нет. Новое слово, пролистанное стрелкой ›, остаётся новым (идёт в конец своего уровня);
//             «Повернути в нові» на повторении и во вкладке «Слова» — карточка удаляется.
//   learned — «Вивчено»: «Уже знаю» на новом слове; › на повторении («пам’ятаю») оставляет вивченим.
// Карточка: { st, at — когда отметили, n — сколько раз отмечали, learnedAt — когда стало «Вивчено» }.
// Прогресс до 25.11.2026 переводится один раз (store.progress → migrateTwoStatuses): майже вивчені → вивчено, важкі → нові.

const DAY = 86400;
export const BUCKETS = ['new', 'learned'];

// Статус карточки до перевода: интервалы (до 18.11.2026) и три статуса (до 25.11.2026)
export function legacyBucket(card) {
  if (!card) return 'new';
  if (card.st) return card.st;
  const ivl = card.ivl || 0;
  if (card.known || ivl >= 21 * DAY) return 'learned';
  if (ivl >= 7 * DAY) return 'almost';
  return 'hard';
}
export function bucket(card) {
  const b = legacyBucket(card);
  return b === 'learned' || b === 'almost' ? 'learned' : 'new';
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
// Для фильтра «Усі / Вчу / Вивчено / Нові» на вкладке «Слова»: fresh / learned («Вчу» — слова, пройденные сегодня, см. words.js)
export const status = (card) => (bucket(card) === 'learned' ? 'learned' : 'fresh');
