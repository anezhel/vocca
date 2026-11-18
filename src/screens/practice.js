// 2.2 «Що тренуємо»: открывается по «Вчити слова» на «Практика». Сразу выбрано то, что человек выбрал в прошлый раз
// (в первый раз — «твій рівень», «Нові» + «Важкі», 20 слів). Выбор запоминается сразу, «Почати» — занятие.
//   Рівень — можно несколько. Слова — «Нові / Важкі / Майже вивчені», можно несколько или ни одного.
//   Добірки — необязательно; если выбрана хоть одна, тренируем добірки, а уровень и статус слов не учитываются.
//   Кількість слів — одно из 20 / 30 / 40 / «Без обмежень», снять нельзя.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t, L } from '../i18n/index.js';
import { practicePrefs, savePractice } from '../core/session.js';
import { Screen, Title, Button, IconButton, Icon, cx } from '../ui/kit.js';

// Порядок чипов добірок — как в макете
const GROUP_ORDER = ['synonyms', 'antonyms', 'irregular', 'phrasal', 'idioms', 'collocations', 'false-friends', 'confusing', 'similar', 'word-family', 'pronouns'];

// Aura/Chip: не выбран — белый с обводкой, выбран — чёрный с галочкой (в ряду уровней — без галочки)
const Chip = ({ on, label, onClick, check = true }) => html`<button class=${cx('choice-chip t-label-15-medium', on && 'is-on')} aria-pressed=${on} onClick=${onClick}>
  ${on && check && html`<${Icon} name="check" size=${16} />`}${label}</button>`;

const Section = ({ title, hint, dim, children }) => html`<section class=${cx('practice-sec', dim && 'is-dim')}>
  <div class="practice-sec__head"><span class="t-title-m">${title}</span>${hint && html`<span class="t-label-13 muted">${hint}</span>`}</div>
  ${children}</section>`;

export function Practice({ course, go, back }) {
  const [prefs, setPrefs] = useState(() => practicePrefs(course));
  const set = (patch) => { const n = { ...prefs, ...patch }; setPrefs(n); savePractice(course, n); };
  const flip = (key, v) => set({ [key]: prefs[key].includes(v) ? prefs[key].filter((x) => x !== v) : [...prefs[key], v] });
  const groups = [...course.groupList].sort((a, b) => (GROUP_ORDER.indexOf(a.id) + 1 || 99) - (GROUP_ORDER.indexOf(b.id) + 1 || 99));
  const byGroups = prefs.groups.length > 0;
  const canStart = byGroups || (prefs.levels.length > 0 && prefs.kinds.length > 0);
  const start = () => (byGroups ? go('collection', { groups: prefs.groups, size: prefs.size }) : go('lesson', { prefs }));
  return html`<${Screen} tone="cool" bottom=${html`<${Button} label=${t('practice.start')} disabled=${!canStart} onClick=${start} />`}>
    <div class="top-bar"><${IconButton} icon="arrow-left" size=${48} onClick=${back} label=${t('common.back')} /></div>
    <${Title} main=${t('practice.title')} accent=${t('practice.titleAccent')} />
    <${Section} title=${t('practice.level')} dim=${byGroups}>
      <div class="choice-row6">${LEVELS.map((l) => html`<${Chip} on=${prefs.levels.includes(l)} label=${l} check=${false} onClick=${() => flip('levels', l)} />`)}</div>
    </${Section}>
    <${Section} title=${t('practice.words')} dim=${byGroups}>
      <div class="choice-wrap">${['new', 'hard', 'almost'].map((k) => html`<${Chip} on=${prefs.kinds.includes(k)} label=${t('practice.kind.' + k)} onClick=${() => flip('kinds', k)} />`)}</div>
    </${Section}>
    <${Section} title=${t('practice.groups')} hint=${t('practice.optional')}>
      <div class="choice-wrap">${groups.map((g) => html`<${Chip} on=${prefs.groups.includes(g.id)} label=${L(g.title)} onClick=${() => flip('groups', g.id)} />`)}</div>
      ${byGroups && html`<p class="t-label-13 muted">${t('practice.groupsNote')}</p>`}
    </${Section}>
    <${Section} title=${t('practice.size')}>
      <div class="choice-wrap">${CONFIG.practiceSizes.map((n) => html`<${Chip} on=${prefs.size === n} label=${n === 'all' ? t('practice.all') : String(n)} onClick=${() => set({ size: n })} />`)}</div>
    </${Section}>
  </${Screen}>`;
}
