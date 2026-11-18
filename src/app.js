// Оболочка приложения: какой экран открыт, нижнее меню, тосты. Экраны перечислены в ROUTES — новый экран = одна строка.
import { html, useState, useEffect, useReducer, useRef } from '../lib/preact-htm.js';
import { CONFIG, feature } from './config.js';
import { getCourse, loadCourse } from './content/index.js';
import { GROUP_TYPES } from './groups/index.js';
import { getState, subscribe } from './core/store.js';
import { refreshFreezes } from './core/stats.js';
import { tts } from './core/tts.js';
import { setUiLang, t } from './i18n/index.js';
import { Nav, Toast } from './ui/kit.js';
import { Welcome, Course, Levels, Goal, Reminder, Paywall } from './screens/onboarding.js';
import { TestIntro, TestRun, TestResult } from './screens/level-test.js';
import { Today } from './screens/today.js';
import { Lesson } from './screens/lesson.js';
import { Groups } from './screens/groups.js';
import { Practice } from './screens/practice.js';
import { Collection, GroupRoute } from './screens/collection.js';
import { Words } from './screens/words.js';
import { Settings } from './screens/settings.js';

export const ROUTES = {
  welcome: Welcome, course: Course, levels: Levels,                   // 1.1–1.3 первый запуск (дизайн v2, 18.11.2026)
  'goal-new': Goal, 'goal-repeat': Goal, reminder: Reminder, paywall: Paywall, // 1.4–1.7
  'test-intro': TestIntro, test: TestRun, 'test-result': TestResult,  // 02a–02d
  today: Today, practice: Practice, lesson: Lesson,                   // 2.1 «Практика», 2.2 «Що тренуємо», 2.3–2.5 занятие
  collection: Collection,                                             // 3.1–3.11 занятие по добіркам
  group: GroupRoute, verbs: GroupRoute,                               // 3.12–3.14 «3 форми дієслів»: групи, картки, тренажер
  groups: Groups,                                                     // прежний список групп (из меню не открывается)
  words: Words,                                                       // 18
  settings: Settings,                                                 // 10
};

let current = null;
// Вкладки меню. «Групи» убраны из меню 16.11.2026: группы — на главной (блоки «В процесі», «Нові», «Пройдені»).
const tabs = () => ['today', feature('wordsTab') && 'words', 'settings'].filter(Boolean);

export function applyTheme() {
  const th = getState().theme;
  document.documentElement.dataset.theme = CONFIG.themes.includes(th) ? th : CONFIG.themes[0];
  const canvas = getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim();
  if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', canvas);
}

export function App() {
  const [, force] = useReducer((x) => x + 1, 0);
  useEffect(() => subscribe(force), []);
  useEffect(() => tts.onChange(force), []);
  useEffect(() => { refreshFreezes(); }, []);
  const s = getState();
  setUiLang(s.ui);
  useEffect(applyTheme, [s.theme]);

  const course = getCourse(s.course || CONFIG.defaultCourse);
  current = course;
  const [loading, setLoading] = useState(!course.loaded);
  useEffect(() => { if (!course.loaded) { setLoading(true); loadCourse(course, GROUP_TYPES).then(() => setLoading(false)); } }, [course.id]);

  const [stack, setStack] = useState(() => [{ name: s.onboarded && s.course ? 'today' : 'welcome', n: 0 }]);
  const [msg, setMsg] = useState(null);
  const timer = useRef(0);
  const route = stack[stack.length - 1];

  const go = (name, params = {}, replace = false) => {
    const next = { name, ...params, n: Date.now() };
    if (tabs().includes(name) && !params.pick) setStack([next]);
    else setStack(replace ? [...stack.slice(0, -1), next] : [...stack, next]);
    scrollTo(0, 0);
  };
  const back = () => { setStack(stack.length > 1 ? stack.slice(0, -1) : [{ name: 'today', n: Date.now() }]); scrollTo(0, 0); };
  const toast = (text) => { setMsg(text); clearTimeout(timer.current); timer.current = setTimeout(() => setMsg(null), 2600); };

  if (loading) return html`<div class="loading"><span class="t-brand-wordmark">Vocca</span></div>`;
  const Screen = ROUTES[route.name] || Today;
  const isTab = tabs().includes(route.name);
  return html`
    <${Screen} key=${route.name + route.n} course=${course} route=${route} go=${go} back=${back} toast=${toast} />
    ${isTab && s.onboarded && html`<${Nav} active=${route.name} onNav=${go} tabs=${tabs()} />`}
    ${msg && html`<${Toast} text=${msg} />`}`;
}

export const errorText = () => t('error');
