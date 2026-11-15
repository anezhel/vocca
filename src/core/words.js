// Слово для показа: учитывает вариант английского (США / Британия) и язык интерфейса.
import { getState, progress, update } from './store.js';
import { L } from '../i18n/index.js';

export const wordById = (course, id) => course.byId.get(id) || progress(course.id).custom[id] || null;

export const variantOf = (course) => (course.variants || []).find((v) => v.id === progress(course.id).variant) || (course.variants || [])[0];
export const ttsLang = (course) => (variantOf(course) || {}).tts || course.tts || 'en-US';

export const shown = (course, w) => (variantOf(course)?.id === 'uk' && w.wUk) || w.w;
export const ipaOf = (course, w) => (variantOf(course)?.id === 'uk' && w.ipaUk) || w.ipa || '';
export const trOf = (w) => L(w.tr);

// «+ Вчити» в группе: слово попадает в ежедневное занятие первым среди новых.
// Если такого слова нет в words.tsv, оно сохраняется в прогрессе вместе с переводом и примером.
export function addToLearning(course, item) {
  const key = item.w.toLowerCase();
  const known = course.byText.get(key);
  let id = known ? known.id : 'my:' + key;
  update(() => {
    const p = progress(course.id);
    if (!known && !p.custom[id]) p.custom[id] = { id, w: item.w, ipa: item.ipa || '', pos: item.pos || '', lvl: item.lvl || '', tr: item.tr, ex: item.ex || [], custom: true };
    if (!p.cards[id] && !p.queue.includes(id)) p.queue.push(id);
  });
  return id;
}

export function isAdded(course, text) {
  const p = progress(course.id);
  const known = course.byText.get(text.toLowerCase());
  const id = known ? known.id : 'my:' + text.toLowerCase();
  return p.queue.includes(id) || !!p.cards[id];
}

export const tipSeen = (key) => !!getState().tips[key];
export const setTipSeen = (key) => update((s) => { s.tips[key] = true; });

// 04b «Повернути у вивчення»: выученное слово снова в «Вчу» и придёт уже в ближайшем занятии
export function returnToLearning(course, id, now = Date.now()) {
  update(() => {
    const p = progress(course.id), c = p.cards[id] || {};
    p.cards[id] = { reps: Math.max(1, c.reps || 0), ivl: 0, due: now, last: c.last || now, ease: c.ease || 2.5, mode: p.mode, step: 0, lapses: c.lapses || 0 };
  });
}
