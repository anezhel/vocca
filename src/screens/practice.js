// 2.2 «Що тренуємо» (макет 19.11.2026): открывается по «Вчити слова» на «Практика». Сразу выбрано то, что человек выбрал
// в прошлый раз (в первый раз — «твій рівень», 20 слів, «Нові» + «Важкі»). Выбор запоминается сразу, «Почати» — занятие.
//   Рівень — можно несколько. Кількість слів — одно из 20 / 30 / 40 / «Без обмежень», снять нельзя.
//   Типи слів — «Нові / Важкі / Майже вивчені», можно несколько или ни одного.
//   Добірки — необязательно и только одна (как радиокнопка; повторное нажатие снимает выбор). Если добірка выбрана,
//   тренируем её слова выбранных уровней, количество — как выбрано; «Типи слів» не учитываются (секция бледнеет).
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t, L } from '../i18n/index.js';
import { practicePrefs, savePractice } from '../core/session.js';
import { Screen, Title, Button, IconButton, Icon, cx } from '../ui/kit.js';

// Порядок чипов добірок — как в макете
const GROUP_ORDER = ['synonyms', 'antonyms', 'irregular', 'phrasal', 'idioms', 'collocations', 'false-friends', 'confusing', 'similar', 'word-family', 'pronouns'];

// Aura/Chip: не выбран — белый с обводкой, выбран — чёрный, без галочки
const Chip = ({ on, label, onClick, radio }) => html`<button class=${cx('choice-chip t-label-15-medium', on && 'is-on')}
  role=${radio ? 'radio' : undefined} aria-checked=${radio ? on : undefined} aria-pressed=${radio ? undefined : on} onClick=${onClick}>${label}</button>`;

const Section = ({ title, hint, dim, children }) => html`<section class=${cx('practice-sec', dim && 'is-dim')}>
  <div class="practice-sec__head"><span class="t-title-m">${title}</span>${hint && html`<span class="t-label-13 muted">${hint}</span>`}</div>
  ${children}</section>`;

export function Practice({ course, go, back }) {
  const [prefs, setPrefs] = useState(() => { const p = practicePrefs(course); return { ...p, groups: p.groups.slice(0, 1) }; });
  const set = (patch) => { const n = { ...prefs, ...patch }; setPrefs(n); savePractice(course, n); };
  const flip = (key, v) => set({ [key]: prefs[key].includes(v) ? prefs[key].filter((x) => x !== v) : [...prefs[key], v] });
  const pickGroup = (id) => set({ groups: prefs.groups[0] === id ? [] : [id] });
  const groups = [...course.groupList].sort((a, b) => (GROUP_ORDER.indexOf(a.id) + 1 || 99) - (GROUP_ORDER.indexOf(b.id) + 1 || 99));
  const group = groups.find((g) => g.id === prefs.groups[0]);
  // сколько слов добірки на выбранных уровнях: нет ни одного — «Почати» неактивна и подсказка
  const inLevels = group ? group.items.filter((x) => prefs.levels.includes(x.lvl)).length : 0;
  const canStart = prefs.levels.length > 0 && (group ? inLevels > 0 : prefs.kinds.length > 0);
  const start = () => (group ? go('collection', { groups: [group.id], size: prefs.size, levels: prefs.levels }) : go('lesson', { prefs }));
  return html`<${Screen} cls="screen--grey screen--practice" tone="today" bottom=${html`<${Button} label=${t('practice.start')} disabled=${!canStart} onClick=${start} />`}>
    <div class="top-bar"><${IconButton} icon="arrow-left" size=${48} onClick=${back} label=${t('common.back')} /></div>
    <${Title} main=${t('practice.title')} />
    <div class="practice-secs">
      <${Section} title=${t('practice.level')}>
        <div class="choice-row6">${LEVELS.map((l) => html`<${Chip} on=${prefs.levels.includes(l)} label=${l} onClick=${() => flip('levels', l)} />`)}</div>
      </${Section}>
      <${Section} title=${t('practice.size')}>
        <div class="choice-wrap choice-wrap--short">${CONFIG.practiceSizes.map((n) => html`<${Chip} on=${prefs.size === n} label=${n === 'all' ? t('practice.all') : String(n)} onClick=${() => set({ size: n })} />`)}</div>
      </${Section}>
      <${Section} title=${t('practice.words')} dim=${!!group}>
        <div class="choice-wrap">${['new', 'hard', 'almost'].map((k) => html`<${Chip} on=${prefs.kinds.includes(k)} label=${t('practice.kind.' + k)} onClick=${() => flip('kinds', k)} />`)}</div>
      </${Section}>
      <${Section} title=${t('practice.groups')} hint=${t('practice.optional')}>
        <div class="choice-wrap choice-wrap--tight" role="radiogroup" aria-label=${t('practice.groups')}>${groups.map((g) => html`<${Chip} radio on=${g === group} label=${L(g.title)} onClick=${() => pickGroup(g.id)} />`)}</div>
        ${group && html`<p class="t-label-13 muted">${prefs.levels.length && !inLevels ? t('practice.noneAtLevel') : t('practice.groupsNote')}</p>`}
      </${Section}>
    </div>
  </${Screen}>`;
}
