// 2.2 «Що тренуємо?» (новый макет дизайнера, 25.11.2026): открывается по «Вчити слова» на «Практика». Выбор запоминается.
//   Сверху — три плитки (как радио): «Слова за рівнями» · «Добірки слів» · «Повторити вивчене».
//   Под ними — плитки уровней «Слова A1» … «Слова C2» (можно несколько; уровень без слов этого типа бледный и не нажимается;
//   если выбор не остался ни на одном — выбирается доступный, ближайший к «моему»), а для «Добірки слів» — плитки добірок (одна).
//   Плитки 3 в ряд, 70 высотой, скругление 10: невыбранная белая с обводкой, выбранная чёрная.
//   Сколько слов за заход — всегда 20 (выбора «Кількість слів» больше нет). Подсказок и кружков с числом нет.
//   Раньше (19–25.11.2026): секции «Слова» / «Рівень» / «Добірки» / «Кількість слів» с чипами.
import { html, useState } from '../../lib/preact-htm.js';
import { LEVELS } from '../content/index.js';
import { GROUP_TYPES } from '../groups/index.js';
import { t, L } from '../i18n/index.js';
import { practicePrefs, savePractice, levelCounts, countFor, myLevel, PRACTICE_KINDS, KIND_BUCKETS } from '../core/session.js';
import { progress } from '../core/store.js';
import { Screen, Title, Button, IconButton, cx } from '../ui/kit.js';

// Плитка: не выбрана — белая с обводкой, выбрана — чёрная; off — уровень без слов этого типа: бледная, не нажимается
const Tile = ({ on, off, label, onClick }) => html`<button class=${cx('pick-tile t-label-15-medium', on && 'is-on')} aria-pressed=${on} disabled=${off} onClick=${onClick}>${label}</button>`;
const SIZE = 20;   // слов (экранов) за заход — всегда 20 (решение дизайнера, 25.11.2026; раньше «Кількість слів» 10 / 20 / 30 / 40 / «Всі»)

// Добірка по умолчанию: та, что в процессе, иначе первая новая, иначе первая
function defaultGroup(course) {
  const list = course.groupList.map((g) => ({ g, s: GROUP_TYPES[g.type].stats(course, g).status }));
  const hit = list.find(({ s }) => s === 'learning' || s === 'due') || list.find(({ s }) => s === 'fresh') || list[0];
  return hit ? hit.g.id : null;
}

// Уровни на 2.2 — только те, что выбраны в настройках («Рівні»), по порядку A1 → C2 (решение дизайнера, 20.11.2026).
// Если в настройках пусто — все.
const shownLevels = () => LEVELS;   // с 25.11.2026 (новый макет 2.2) — все шесть уровней

// Уровни под выбранный тип: с уровней без слов этого типа и с уровней, которых нет в настройках, выбор снимается. Если при открытии экрана или смене типа не осталось
// ни одного — выбирается доступный уровень, ближайший к «моему» (при равенстве — тот, что ниже); снять все уровни вручную
// по-прежнему можно (тогда «Почати» неактивна). Для «Слова з добірок» уровни не трогаем.
function fitLevels(course, p, pick = true) {
  if (p.kind === 'groups') return p;
  const counts = levelCounts(course, KIND_BUCKETS[p.kind]);
  const shown = shownLevels();
  const levels = p.levels.filter((l) => counts[l] && shown.includes(l));
  if (!levels.length && pick) {
    const me = LEVELS.indexOf(myLevel(progress(course.id)) || p.levels[0] || LEVELS[0]);
    const near = shown.filter((l) => counts[l]).sort((a, b) => Math.abs(LEVELS.indexOf(a) - me) - Math.abs(LEVELS.indexOf(b) - me) || LEVELS.indexOf(a) - LEVELS.indexOf(b))[0];
    if (near) levels.push(near);
  }
  return levels.length === p.levels.length && levels.every((l, i) => l === p.levels[i]) ? p : { ...p, levels };
}

export function Practice({ course, go, back }) {
  const [prefs, setPrefs] = useState(() => {
    const p = practicePrefs(course), n = fitLevels(course, { ...p, group: p.group || defaultGroup(course) });
    if (n.levels !== p.levels) savePractice(course, n);
    return n;
  });
  const set = (patch) => { const n = fitLevels(course, { ...prefs, ...patch }, 'kind' in patch); setPrefs(n); savePractice(course, n); };
  const flipLevel = (l) => set({ levels: prefs.levels.includes(l) ? prefs.levels.filter((x) => x !== l) : [...prefs.levels, l] });
  const groupsMode = prefs.kind === 'groups';
  const kinds = PRACTICE_KINDS.filter((k) => k !== 'groups' || course.groupList.length);

  // Уровни без слов этого типа неактивны, в занятие идут только выбранные и доступные
  const counts = groupsMode ? {} : levelCounts(course, KIND_BUCKETS[prefs.kind]);
  const off = (l) => !groupsMode && !counts[l];
  const live = prefs.levels.filter((l) => !off(l));
  const found = countFor(course, { levels: live });
  const canStart = groupsMode ? !!prefs.group : live.length > 0 && KIND_BUCKETS[prefs.kind].some((b) => found[b] > 0);
  const start = () => {
    if (!groupsMode) return go('lesson', { prefs: { kinds: KIND_BUCKETS[prefs.kind], levels: live, size: SIZE } });
    const g = course.groupList.find((x) => x.id === prefs.group);
    if (GROUP_TYPES[g.type].Screen) return go('group', { group: g.id, size: SIZE });   // «3 форми дієслів» — сначала группы 3.12
    go('collection', { groups: [prefs.group], size: SIZE, review: GROUP_TYPES[g.type].stats(course, g).status === 'done' });
  };

  return html`<${Screen} cls="screen--grey screen--practice" tone="today" bottom=${html`<${Button} label=${t('practice.start')} disabled=${!canStart} onClick=${start} />`}>
    <div class="top-bar"><${IconButton} icon="arrow-left" size=${48} onClick=${back} label=${t('common.back')} /></div>
    <${Title} main=${t('practice.title')} accent=${t('practice.titleAccent')} />
    <div class="practice-secs">
      <div class="pick-grid">${kinds.map((k) => html`<${Tile} on=${prefs.kind === k} label=${t('practice.kind.' + k)} onClick=${() => set({ kind: k })} />`)}</div>
      ${groupsMode
        ? html`<div class="pick-grid">${course.groupList.map((g) => html`<${Tile} on=${prefs.group === g.id} label=${L(g.title)} onClick=${() => set({ group: g.id })} />`)}</div>`
        : html`<div class="pick-grid">${LEVELS.map((l) => html`<${Tile} on=${prefs.levels.includes(l)} off=${off(l)} label=${t('practice.levelTile', { lv: l })} onClick=${() => flipLevel(l)} />`)}</div>`}
    </div>
  </${Screen}>`;
}
