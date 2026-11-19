// 2.2 «Що тренуємо?» (макет 19.11.2026): открывается по «Вчити слова» на «Практика». Сразу выбрано то, что человек выбрал
// в прошлый раз (в первый раз — «твій рівень», 20 слів, «Нові» + «Важкі»). Выбор запоминается сразу, «Почати» — занятие.
//   Порядок как в макете: Типи слів — «Нові / Важкі / Майже вивчені», можно несколько или ни одного;
//   Рівень — можно несколько; Кількість слів — одно из 20 / 30 / 40 / «Без обмежень», снять нельзя.
// Добірок здесь нет (убраны 19.11.2026): они открываются только с «Практика» → «Добірки слів».
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t } from '../i18n/index.js';
import { practicePrefs, savePractice } from '../core/session.js';
import { Screen, Title, Button, IconButton, cx } from '../ui/kit.js';

// Aura/Chip: не выбран — белый с обводкой, выбран — чёрный, без галочки
const Chip = ({ on, label, onClick }) => html`<button class=${cx('choice-chip t-label-15-medium', on && 'is-on')} aria-pressed=${on} onClick=${onClick}>${label}</button>`;

const Section = ({ title, hint, dim, children }) => html`<section class=${cx('practice-sec', dim && 'is-dim')}>
  <div class="practice-sec__head"><span class="t-title-m">${title}</span>${hint && html`<span class="t-label-13 muted">${hint}</span>`}</div>
  ${children}</section>`;

export function Practice({ course, go, back }) {
  const [prefs, setPrefs] = useState(() => ({ ...practicePrefs(course), groups: [] }));
  const set = (patch) => { const n = { ...prefs, ...patch }; setPrefs(n); savePractice(course, n); };
  const flip = (key, v) => set({ [key]: prefs[key].includes(v) ? prefs[key].filter((x) => x !== v) : [...prefs[key], v] });
  const canStart = prefs.levels.length > 0 && prefs.kinds.length > 0;
  const start = () => go('lesson', { prefs });
  return html`<${Screen} cls="screen--grey screen--practice" tone="today" bottom=${html`<${Button} label=${t('practice.start')} disabled=${!canStart} onClick=${start} />`}>
    <div class="top-bar"><${IconButton} icon="arrow-left" size=${48} onClick=${back} label=${t('common.back')} /></div>
    <${Title} main=${t('practice.title')} />
    <div class="practice-secs">
      <${Section} title=${t('practice.words')}>
        <div class="choice-wrap">${['new', 'hard', 'almost'].map((k) => html`<${Chip} on=${prefs.kinds.includes(k)} label=${t('practice.kind.' + k)} onClick=${() => flip('kinds', k)} />`)}</div>
      </${Section}>
      <${Section} title=${t('practice.level')}>
        <div class="choice-row6">${LEVELS.map((l) => html`<${Chip} on=${prefs.levels.includes(l)} label=${l} onClick=${() => flip('levels', l)} />`)}</div>
      </${Section}>
      <${Section} title=${t('practice.size')}>
        <div class="choice-wrap choice-wrap--short">${CONFIG.practiceSizes.map((n) => html`<${Chip} on=${prefs.size === n} label=${n === 'all' ? t('practice.all') : String(n)} onClick=${() => set({ size: n })} />`)}</div>
      </${Section}>
    </div>
  </${Screen}>`;
}
