// Весь прогресс хранится на телефоне (localStorage). Сервер не нужен.
import { legacyBucket } from './srs.js';
import { CONFIG } from '../config.js';

const KEY = 'vocca:aura:v1';

const fresh = () => ({
  app: 'vocca', v: 2,
  ui: CONFIG.uiLanguages.includes((navigator.language || '').slice(0, 2)) ? navigator.language.slice(0, 2) : CONFIG.uiLanguages[0],
  theme: CONFIG.themes[0],
  course: null,        // какой язык учим (id пакета)
  onboarded: false,
  autoplay: true,      // «Озвучувати слова»
  aloud: true,         // «Відповідати вголос»: пауза перед ответом
  reminder: { on: true, time: CONFIG.reminderDefault },   // 1.6 «Нагадування» (уведомлений пока нет)
  tips: {},            // подсказки, которые больше не показывать
  courses: {},         // по языкам: настройки и прогресс
  log: {},             // по дням: сколько повторено, новых, секунд
  freezes: { left: 1, week: '' },
});

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s && s.app === 'vocca') return Object.assign(fresh(), s); }
  } catch (e) { console.warn('vocca: cannot read progress', e); }
  return fresh();
}

let state = load();
const subs = new Set();
let timer;

export const getState = () => state;
export function flush() { clearTimeout(timer); try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { console.warn('vocca: cannot save', e); } }
const save = () => { clearTimeout(timer); timer = setTimeout(flush, 200); };
const emit = () => subs.forEach((f) => f());

export function update(fn) { fn(state); save(); emit(); }
export const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };

// Настройки и прогресс одного языка
// 25.11.2026: статусов два — «Нові» и «Вивчено» (решение дизайнера). Один раз: майже вивчені → вивчено (дата — когда отметили),
// важкі → нові (карточка удаляется). Выученные не трогаем.
function migrateTwoStatuses(c) {
  for (const [id, card] of Object.entries(c.cards)) {
    const b = legacyBucket(card);
    if (b === 'hard') delete c.cards[id];
    else if (b === 'almost') { const at = card.at || card.last || Date.now(); c.cards[id] = { st: 'learned', at, n: card.n || card.reps || 1, learnedAt: at }; }
  }
  c.twoStatuses = true;
}

export function progress(id = state.course) {
  if (!state.courses[id]) state.courses[id] = {};
  const c = state.courses[id];
  c.levels = c.levels || [];
  c.perDay = c.perDay || CONFIG.perDayDefault;
  c.newPerDay = c.newPerDay || CONFIG.newPerDayDefault;
  c.newGoal = c.newGoal || CONFIG.newGoalDefault;        // цель на день: новых слов (1.4)
  c.repeatGoal = c.repeatGoal || CONFIG.repeatGoalDefault; // цель на день: повторений (1.5)
  c.practice = c.practice || null;                        // выбор на «Що тренуємо» (2.2); null — ещё не меняли
  c.mode = CONFIG.defaultMode; // один ритм для всех; уже выученные слова переходят на него при следующем повторении
  c.variant = c.variant || 'us';
  c.cards = c.cards || {};     // слово → карточка повторения
  c.custom = c.custom || {};   // слова из групп, которых нет в words.tsv
  c.queue = c.queue || [];     // добавлены кнопкой «Вчити» — идут первыми среди новых
  c.skipped = c.skipped || {}; // новые слова, пропущенные кнопкой «Пізніше» (слово → время) — идут в конце своего уровня
  c.groups = c.groups || {};   // группа → { seen: { экран: время } }
  c.verbs = c.verbs || {};     // неправильный глагол → карточка
  if (!c.twoStatuses) migrateTwoStatuses(c);
  return c;
}

export function resetCourse(id) { update((s) => { delete s.courses[id]; }); }

export function dayLog(key) {
  if (!state.log[key]) state.log[key] = { reviews: 0, fresh: 0, sec: 0 };
  return state.log[key];
}

addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
