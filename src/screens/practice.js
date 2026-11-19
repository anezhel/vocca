// 2.2 «Що тренуємо?» (макеты 2.2 / 2.2a / 2.2b, 19.11.2026): открывается по «Вчити слова» на «Практика». Сразу выбрано то,
// что человек выбрал в прошлый раз (в первый раз — «Нові слова», «твій рівень», 20 слів). Выбор запоминается сразу.
//   Типи слів — один из «Нові слова / Важко згадати / Легко згадати / Слова з добірок» (как радио).
//   Обычные типы: Рівень (можно несколько), под ним Кількість слів. Уровень, на котором нет слов этого типа, бледный и
//     не нажимается; если он был выбран раньше, выбор сохраняется и снова работает, когда слова появятся (2.2a).
//   «Слова з добірок»: уровней нет, под типами — «Добірки» (все добірки курса, одна), потом Кількість слів (2.2b).
//     «Почати» — экраны добірки 3.1–3.10 (для «3 форми дієслів» — карточки 3.13) по «Кількість слів» за раз, итог 3.11.
//   Кількість слів — одно из 10 / 20 / 30 / 40 / «Всі», снять нельзя.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { GROUP_TYPES } from '../groups/index.js';
import { t, L } from '../i18n/index.js';
import { practicePrefs, savePractice, levelCounts, countFor, PRACTICE_KINDS } from '../core/session.js';
import { Screen, Title, Button, IconButton, cx } from '../ui/kit.js';

// Aura/Chip: не выбран — белый с обводкой, выбран — чёрный, без галочки
// off — неактивен (уровень без слов этого типа): бледный, не нажимается; выбор при этом не теряется
const Chip = ({ on, off, label, onClick }) => html`<button class=${cx('choice-chip t-label-15-medium', on && 'is-on')} aria-pressed=${on}
  disabled=${off} onClick=${onClick}>${label}</button>`;

const Section = ({ title, children }) => html`<section class="practice-sec">
  <div class="practice-sec__head"><span class="t-title-m">${title}</span></div>
  ${children}</section>`;

// Добірка по умолчанию: та, что в процессе, иначе первая новая, иначе первая
function defaultGroup(course) {
  const list = course.groupList.map((g) => ({ g, s: GROUP_TYPES[g.type].stats(course, g).status }));
  const hit = list.find(({ s }) => s === 'learning' || s === 'due') || list.find(({ s }) => s === 'fresh') || list[0];
  return hit ? hit.g.id : null;
}

export function Practice({ course, go, back }) {
  const [prefs, setPrefs] = useState(() => { const p = practicePrefs(course); return { ...p, group: p.group || defaultGroup(course) }; });
  const set = (patch) => { const n = { ...prefs, ...patch }; setPrefs(n); savePractice(course, n); };
  const flipLevel = (l) => set({ levels: prefs.levels.includes(l) ? prefs.levels.filter((x) => x !== l) : [...prefs.levels, l] });
  const groupsMode = prefs.kind === 'groups';
  const kinds = PRACTICE_KINDS.filter((k) => k !== 'groups' || course.groupList.length);

  // Обычные типы: уровни без слов этого типа неактивны, в занятие идут только выбранные и доступные
  const counts = groupsMode ? {} : levelCounts(course, [prefs.kind]);
  const off = (l) => !groupsMode && !counts[l];
  const offLevels = LEVELS.filter(off);
  const live = prefs.levels.filter((l) => !off(l));
  const levelHint = groupsMode ? '' : prefs.levels.length > 0 && !live.length ? t('practice.pickOtherLevel')
    : offLevels.length ? t('practice.noLevelWords', { lv: offLevels.join(', '), kind: t('practice.kind.' + prefs.kind) }) : '';

  const canStart = groupsMode ? !!prefs.group : live.length > 0 && countFor(course, { levels: live })[prefs.kind] > 0;
  const start = () => {
    if (!groupsMode) return go('lesson', { prefs: { kinds: [prefs.kind], levels: live, size: prefs.size } });
    const g = course.groupList.find((x) => x.id === prefs.group);
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
          <div class="choice-wrap">${course.groupList.map((g) => html`<${Chip} on=${prefs.group === g.id} label=${L(g.title)} onClick=${() => set({ group: g.id })} />`)}</div>
        </${Section}>
        ${size}` : html`
        <${Section} title=${t('practice.level')}>
          <div class="choice-wrap">${LEVELS.map((l) => html`<${Chip} on=${prefs.levels.includes(l)} off=${off(l)} label=${l} onClick=${() => flipLevel(l)} />`)}</div>
          ${levelHint && html`<p class="t-label-13 muted">${levelHint}</p>`}
        </${Section}>
        ${size}`}
    </div>
  </${Screen}>`;
}
