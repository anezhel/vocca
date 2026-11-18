// Слово для показа: учитывает вариант английского (США / Британия) и язык интерфейса.
import { mark } from './srs.js';
import { getState, progress, update } from './store.js';
import { L } from '../i18n/index.js';
import { dayKey as dayKeyOf } from './dates.js';

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

// «Повернути у вивчення»: выученное слово снова в «Важкі» и попадёт в занятие, если выбрать «Важкі»
export function returnToLearning(course, id, now = Date.now()) {
  update(() => {
    const p = progress(course.id), c = p.cards[id] || {};
    const today = new Date(now).toDateString();
    const learnedAt = c.learnedAt || (c.known ? c.last : null);
    if (learnedAt && new Date(learnedAt).toDateString() === today) { const d = getState().log[dayKeyOf(now)]; if (d && d.learned) d.learned--; }
    p.cards[id] = mark(c, 'hard', now);
  });
}
