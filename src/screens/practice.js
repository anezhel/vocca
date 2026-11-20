// 2.2 «Що тренуємо?» (макеты 2.2 / 2.2a / 2.2b, 19.11.2026): открывается по «Вчити слова» на «Практика». Сразу выбрано то,
// что человек выбрал в прошлый раз (в первый раз — «Нові слова», «твій рівень», 20 слів). Выбор запоминается сразу.
//   Типи слів — один из «Нові слова / Важко згадати / Легко згадати / Слова з добірок» (как радио).
//   Обычные типы: Рівень (можно несколько), под ним Кількість слів. Уровень, на котором нет слов этого типа, бледный и
//     не нажимается, а если был выбран — выбор с него снимается (решение дизайнера 19.11.2026; раньше выбор сохранялся).
//     Если так не осталось ни одного выбранного уровня — выбирается доступный, ближайший к «моему» (2.2a).
//     У «Важко згадати» и «Легко згадати» на уровне кружок — сколько карточек этого типа можно повторить (у «Нові слова» нет);
//     у уровня без таких карточек — 0 (сам чип бледный, а под уровнями подсказка).
//   «Слова з добірок»: уровней нет, под типами — «Добірки» (все добірки курса, одна; в кружке — сколько в ней карточок,
//     как на «Практика» и в счётчике занятия), потом Кількість слів (2.2b).
//     «Почати» — экраны добірки 3.1–3.10 (для «3 форми дієслів» — карточки 3.13) по «Кількість слів» за раз, итог 3.11.
//   Кількість слів — одно из 10 / 20 / 30 / 40 / «Всі», снять нельзя.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { GROUP_TYPES } from '../groups/index.js';
import { t, L } from '../i18n/index.js';
import { practicePrefs, savePractice, levelCounts, countFor, myLevel, PRACTICE_KINDS } from '../core/session.js';
import { progress } from '../core/store.js';
import { Screen, Title, Button, IconButton, cx } from '../ui/kit.js';

// Aura/Chip: не выбран — белый с обводкой, выбран — чёрный, без галочки
// off — неактивен (уровень без слов этого типа): бледный, не нажимается; выбранным такой уровень не бывает (fitLevels)
// count — число в кружке справа: у добірок — сколько карточек, у уровней — сколько слов выбранного типа (у неактивных — 0);
// серый кружок, у выбранного чипа — серый на чёрном
const Chip = ({ on, off, label, count, onClick }) => html`<button class=${cx('choice-chip t-label-15-medium', on && 'is-on', count != null && 'choice-chip--count')}
  aria-pressed=${on} disabled=${off} onClick=${onClick}>${label}${count != null && html`<span class="choice-chip__count t-label-11">${count}</span>`}</button>`;

const Section = ({ title, children }) => html`<section class="practice-sec">
  <div class="practice-sec__head"><span class="t-title-m">${title}</span></div>
  ${children}</section>`;

// Добірка по умолчанию: та, что в процессе, иначе первая новая, иначе первая
function defaultGroup(course) {
  const list = course.groupList.map((g) => ({ g, s: GROUP_TYPES[g.type].stats(course, g).status }));
  const hit = list.find(({ s }) => s === 'learning' || s === 'due') || list.find(({ s }) => s === 'fresh') || list[0];
  return hit ? hit.g.id : null;
}

// Уровни под выбранный тип: с уровней без слов этого типа выбор снимается. Если при открытии экрана или смене типа не осталось
// ни одного — выбирается доступный уровень, ближайший к «моему» (при равенстве — тот, что ниже); снять все уровни вручную
// по-прежнему можно (тогда «Почати» неактивна). Для «Слова з добірок» уровни не трогаем.
function fitLevels(course, p, pick = true) {
  if (p.kind === 'groups') return p;
  const counts = levelCounts(course, [p.kind]);
  const levels = p.levels.filter((l) => counts[l]);
  if (!levels.length && pick) {
    const me = LEVELS.indexOf(myLevel(progress(course.id)) || p.levels[0] || LEVELS[0]);
    const near = LEVELS.filter((l) => counts[l]).sort((a, b) => Math.abs(LEVELS.indexOf(a) - me) - Math.abs(LEVELS.indexOf(b) - me) || LEVELS.indexOf(a) - LEVELS.indexOf(b))[0];
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

  // Обычные типы: уровни без слов этого типа неактивны, в занятие идут только выбранные и доступные
  const counts = groupsMode ? {} : levelCounts(course, [prefs.kind]);
  const off = (l) => !groupsMode && !counts[l];
  const offLevels = LEVELS.filter(off);
  const live = prefs.levels.filter((l) => !off(l));
  const levelHint = groupsMode || !offLevels.length ? '' : t('practice.noLevelWords', { lv: offLevels.join(', '), kind: t('practice.kind.' + prefs.kind) });

  const canStart = groupsMode ? !!prefs.group : live.length > 0 && countFor(course, { levels: live })[prefs.kind] > 0;
  const start = () => {
    if (!groupsMode) return go('lesson', { prefs: { kinds: [prefs.kind], levels: live, size: prefs.size } });
    const g = course.groupList.find((x) => x.id === prefs.group);
    if (GROUP_TYPES[g.type].Screen) return go('group', { group: g.id, size: prefs.size });   // «3 форми дієслів» — сначала группы 3.12
    go('collection', { groups: [prefs.group], size: prefs.size, review: GROUP_TYPES[g.type].stats(course, g).status === 'done' });
  };

  const size = html`<${Section} title=${t('practice.size')}>
    <div class="choice-wrap">${CONFIG.practiceSizes.map((n) => html`<${Chip} on=${prefs.size === n} label=${n === 'all' ? t('practice.all') : String(n)} onClick=${() => set({ size: n })} />`)}</div>
  </${Section}>`;
  return html`<${Screen} cls="screen--grey screen--practice" tone="today" bottom=${html`<${Button} label=${t('practice.start')} disabled=${!canStart} onClick=${start} />`}>
    <div class="top-bar"><${IconButton} icon="arrow-left" size=${48} onClick=${back} label=${t('common.back')} /></div>
    <${Title} main=${t('practice.title')} accent=${t('practice.titleAccent')} />
    <div class="practice-secs">
      <${Section} title=${t('practice.words')}>
        <div class="choice-wrap">${kinds.map((k) => html`<${Chip} on=${prefs.kind === k} label=${t('practice.kind.' + k)} onClick=${() => set({ kind: k })} />`)}</div>
      </${Section}>
      ${groupsMode ? html`
        <${Section} title=${t('practice.groups')}>
          <div class="choice-wrap">${course.groupList.map((g) => html`<${Chip} on=${prefs.group === g.id} label=${L(g.title)}
            count=${GROUP_TYPES[g.type].stats(course, g).total} onClick=${() => set({ group: g.id })} />`)}</div>
        </${Section}>
        ${size}` : html`
        <${Section} title=${t('practice.level')}>
          <div class="choice-wrap">${LEVELS.map((l) => html`<${Chip} on=${prefs.levels.includes(l)} off=${off(l)} label=${l}
            count=${counts[l] || 0} onClick=${() => flipLevel(l)} />`)}</div>
          ${levelHint && html`<p class="t-label-13 muted">${levelHint}</p>`}
        </${Section}>
        ${size}`}
    </div>
  </${Screen}>`;
}
