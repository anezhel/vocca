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

// ── 2.2 «Що тренуємо»: выбор человека запоминается; по умолчанию — «Нові слова», «твій рівень», 20 слів ──
// kind — один тип слов (как радио): 'new' «Нові слова» | 'groups' «Добірки» | 'review' «Повторити вивчені»
// (с 25.11.2026, макет 2.2a: «Важко згадати» и «Легко згадати» объединены в «Повторити вивчені»).
// group — выбранная добірка (для 'groups'); null — выберет экран 2.2. Старый выбор из нескольких типов (kinds) → первый из них,
// старые 'hard' / 'almost' → 'review' (с 25.11.2026 «Повторити вивчені» — это выученные слова).
export const PRACTICE_KINDS = ['new', 'groups', 'review'];
// Какие статусы слов входят в тип
export const KIND_BUCKETS = { new: ['new'], review: ['learned'] };   // с 25.11.2026 «Повторити вивчені» — выученные слова
const OLD_KINDS = { hard: 'review', almost: 'review' };
export function practicePrefs(course) {
  const p = progress(course.id);
  const base = { ...CONFIG.practiceDefault, levels: [myLevel(p) || p.levels[0] || LEVELS[0]] };
  const saved = p.practice || {};
  const legacy = Array.isArray(saved.kinds) ? saved.kinds[0] : null;
  const kind = [saved.kind, legacy].map((k) => OLD_KINDS[k] || k).find((k) => PRACTICE_KINDS.includes(k)) || base.kind;
  return {
    kind: kind === 'groups' && !course.groupList.length ? base.kind : kind,
    levels: (saved.levels || base.levels).filter((l) => LEVELS.includes(l)),
    group: course.groupList.some((g) => g.id === saved.group) ? saved.group : null,
    size: CONFIG.practiceSizes.includes(saved.size) ? saved.size : base.size,
  };
}
const kindsOf = (prefs) => prefs.kinds || (prefs.kind ? [prefs.kind] : []);
export const savePractice = (course, prefs) => update(() => { progress(course.id).practice = { ...prefs }; });

// Новые слова выбранных уровней: сначала добавленные из групп, потом вразнобой с выбранных уровней — поровну
// (решение дизайнера, 19.11.2026; раньше больше со «своего» уровня). Каждый круг — по слову с каждого уровня
// в случайном порядке, поэтому подряд с одного уровня не больше двух. Кончились слова уровня — добирают другие.
// Внутри уровня — от частых слов; пропущенные кнопкой «Пізніше» — в конце уровня (раньше пропущенные — раньше).
// Случайность «на день»: в течение дня подбор тот же.
function seeded(key) {   // mulberry32 от строки
  let h = 1779033703;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 3432918353), h = (h << 13) | (h >>> 19);
  return () => { h |= 0; h = (h + 0x6d2b79f5) | 0; let t = Math.imul(h ^ (h >>> 15), 1 | h); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffled(list, rnd) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function pickFresh(course, p, quota, chosen) {
  const out = [];
  for (const id of p.queue) { if (out.length >= quota) return out; if (!p.cards[id] && wordById(course, id)) out.push(id); }
  const levels = LEVELS.filter((l) => chosen.includes(l));
  if (!levels.length) return out;
  const sk = p.skipped || {};
  const pools = levels.map((l) => {
    const ids = course.words.filter((w) => w.lvl === l && !p.cards[w.id] && !out.includes(w.id)).map((w) => w.id);
    return [...ids.filter((id) => !sk[id]), ...ids.filter((id) => sk[id]).sort((a, b) => sk[a] - sk[b])];
  });
  const rnd = seeded(course.id + dayKey());
  const next = levels.map(() => 0);
  while (out.length < quota) {
    const live = levels.map((_, i) => i).filter((i) => next[i] < pools[i].length);
    if (!live.length) break;
    for (const i of shuffled(live, rnd)) { if (out.length >= quota) break; out.push(pools[i][next[i]++]); }
  }
  return out;
}

function known(course, p, b, levels) {
  const lv = new Set(levels);
  return Object.entries(p.cards)
    .filter(([id, c]) => { if (bucket(c) !== b) return false; const w = wordById(course, id); return w && (w.custom || lv.has(w.lvl)); })
    .sort((a, z) => (a[1].at || a[1].last || 0) - (z[1].at || z[1].last || 0))
    .map(([id]) => id);
}

// 2.2: сколько слов каждого уровня есть под выбранные типы (новые — ещё без карточки; важкі / майже вивчені — по статусу).
// Уровень без слов на 2.2 неактивен. Свои слова (без уровня) не считаем — они попадают в занятие при любом уровне.
export function levelCounts(course, kinds) {
  const p = progress(course.id);
  const out = Object.fromEntries(LEVELS.map((l) => [l, 0]));
  if (kinds.includes('new')) for (const w of course.words) if (!p.cards[w.id] && w.lvl in out) out[w.lvl]++;
  for (const [id, c] of Object.entries(p.cards)) {
    if (!kinds.includes(bucket(c))) continue;
    const w = wordById(course, id);
    if (w && !w.custom && w.lvl in out) out[w.lvl]++;
  }
  return out;
}

// Сколько слов найдётся под выбор — для подписи и пустого состояния
export function countFor(course, prefs) {
  const p = progress(course.id);
  return { new: pickFresh(course, p, 1, prefs.levels).length, learned: known(course, p, 'learned', prefs.levels).length };
}

// Очередь занятия: выбранные типы слов поровну (по одному по кругу): «Вивчено» (повторение — от давно отмеченных), «Нові»
export function buildQueue(course, prefs) {
  const p = progress(course.id);
  const N = prefs.size === 'all' ? CONFIG.practiceAllCap : prefs.size;
  const kinds = kindsOf(prefs);
  const order = ['learned', 'new'].filter((k) => kinds.includes(k));
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
  return { queue, total: queue.length, done: 0, history: [], prefs, startedAt: Date.now(), stats: { reviews: 0, fresh: 0, learned: 0, skipped: 0 } };
}

// «Додано у вивчені» за день (вызывать внутри update)
export function countLearned(delta = 1) { const d = dayLog(dayKey()); d.learned = Math.max(0, (d.learned || 0) + delta); }
function dropFromQueue(course, id) { const p = progress(course.id); p.queue = p.queue.filter((x) => x !== id); }

// «Уже знаю» в добірках, на глаголах 3.13 и правилах (решение дизайнера, 25.11.2026): слова экрана, которые есть в словаре курса
// (основное и связанные; у глагола — сам глагол), сразу в «Вивчено», как «Уже знаю» в занятии. Слов нет в словаре — ничего.
export function knowWords(course, texts) {
  update(() => {
    const p = progress(course.id);
    for (const x of texts) {
      const w = x && course.byText && course.byText.get(String(x).toLowerCase());
      if (!w) continue;
      dropFromQueue(course, w.id);
      const was = bucket(p.cards[w.id]);
      if (was === 'learned') continue;
      p.cards[w.id] = mark(p.cards[w.id], 'learned');
      countLearned();
    }
  });
}
const setSkipped = (p, id, on) => { p.skipped = p.skipped || {}; if (on) p.skipped[id] = Date.now(); else delete p.skipped[id]; };
// Ответ на карточке (с 25.11.2026 статусов два — «Нові» и «Вивчено»):
//   'learned' — «Уже знаю» на новом слове, › («пам’ятаю») на повторении → «Вивчено»;
//   'seen'    — › на новом слове: слово остаётся новым (без карточки) и уходит в конец своего уровня, но пройдено сегодня;
//   'new'     — «Повернути в нові» на повторении: карточка удаляется.
// Каждое пройденное слово попадает в список дня (d.ids) — это фильтр «Вчу» на вкладке «Слова».
function applyStatus(p, id, prev, st) {
  if (st === 'learned') { p.cards[id] = mark(prev, 'learned'); setSkipped(p, id, false); }
  else { delete p.cards[id]; setSkipped(p, id, st === 'seen'); }
}
const noteToday = (d, id) => { d.ids = d.ids || []; if (!d.ids.includes(id)) d.ids.push(id); };
export function answer(course, lesson, item, st) {
  let prev = null;
  update(() => {
    const p = progress(course.id);
    prev = p.cards[item.id] ? { ...p.cards[item.id] } : null;
    dropFromQueue(course, item.id);
    const was = bucket(p.cards[item.id]);
    applyStatus(p, item.id, p.cards[item.id], st);
    if (st === 'learned' && was !== 'learned') countLearned();
    const d = dayLog(dayKey()); if (item.kind === 'new') d.fresh++; else d.reviews++;
    noteToday(d, item.id);
  });
  lesson.done++;
  if (item.kind === 'new') lesson.stats.fresh++; else lesson.stats.reviews++;
  if (st === 'learned') lesson.stats.learned++;
  lesson.history.push({ item, prev, st });   // для свайпа назад: карточка, какой она была до ответа, и ответ
}

// Другой ответ на уже пройденную карточку (вернулись свайпом): статус считается заново от того, каким он был до занятия.
// Число пройденных карточек не растёт (карточка та же); меняется «вивчено», если ответ стал или перестал быть «Вивчено»,
// а «Пізніше» ↔ ответ — ещё «слова за день» и итог: пропущенное слово снова без карточки, отвеченное — с карточкой.
export function reanswer(course, lesson, entry, st) {
  if (entry.st === st) return;
  update(() => {
    const p = progress(course.id);
    const id = entry.item.id;
    const was = bucket(entry.prev);
    applyStatus(p, id, entry.prev, st);
    const before = entry.st === 'learned' && was !== 'learned', after = st === 'learned' && was !== 'learned';
    if (before !== after) countLearned(after ? 1 : -1);
  });
  if (entry.st === 'learned') lesson.stats.learned--;
  if (st === 'learned') lesson.stats.learned++;
  entry.st = st;
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
  for (const [id, c] of Object.entries(p.cards)) { if (bucket(c) === 'learned' && wordById(course, id)) toRepeat++; }
  const repeatNeed = Math.min(p.repeatGoal, reviews + toRepeat);
  return { fresh, reviews, newGoal: p.newGoal, repeatGoal: p.repeatGoal, done: fresh >= p.newGoal && reviews >= repeatNeed };
}
