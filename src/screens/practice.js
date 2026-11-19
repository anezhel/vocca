// 2.2 «Що тренуємо?» (макет 19.11.2026): открывается по «Вчити слова» на «Практика». Сразу выбрано то, что человек выбрал
// в прошлый раз (в первый раз — «твій рівень», 20 слів, «Нові» + «Важкі»). Выбор запоминается сразу, «Почати» — занятие.
//   Порядок как в макете: Типи слів — «Нові / Важкі / Майже вивчені», можно несколько или ни одного;
//   Рівень — можно несколько; Кількість слів — одно из 20 / 30 / 40 / «Без обмежень», снять нельзя.
// Добірок здесь нет (убраны 19.11.2026): они открываются только с «Практика» → «Добірки слів».
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t } from '../i18n/index.js';
import { practicePrefs, savePractice, levelCounts, countFor } from '../core/session.js';
import { Screen, Title, Button, IconButton, cx } from '../ui/kit.js';

// Aura/Chip: не выбран — белый с обводкой, выбран — чёрный, без галочки
// off — неактивен (уровень без слов под выбранные типы): бледный, не нажимается; выбор при этом не теряется
const Chip = ({ on, off, label, onClick }) => html`<button class=${cx('choice-chip t-label-15-medium', on && 'is-on')} aria-pressed=${on}
  disabled=${off} onClick=${onClick}>${label}</button>`;

const Section = ({ title, hint, dim, children }) => html`<section class=${cx('practice-sec', dim && 'is-dim')}>
  <div class="practice-sec__head"><span class="t-title-m">${title}</span>${hint && html`<span class="t-label-13 muted">${hint}</span>`}</div>
  ${children}</section>`;

export function Practice({ course, go, back }) {
  const [prefs, setPrefs] = useState(() => ({ ...practicePrefs(course), groups: [] }));
  const set = (patch) => { const n = { ...prefs, ...patch }; setPrefs(n); savePractice(course, n); };
  const flip = (key, v) => set({ [key]: prefs[key].includes(v) ? prefs[key].filter((x) => x !== v) : [...prefs[key], v] });
  // Уровни без слов под выбранные типы (например, «Легко згадати» и C1 / C2) неактивны. Если уровень был выбран раньше,
  // выбор сохраняется (чип чёрный, но бледный) и снова работает, когда под другие типы слова на этом уровне есть.
  // В занятие идут только выбранные и доступные уровни; под рядом уровней — подсказка, почему часть из них неактивна.
  const counts = levelCounts(course, prefs.kinds);
  const off = (l) => prefs.kinds.length > 0 && !counts[l];
  const offLevels = LEVELS.filter(off);
  const live = prefs.levels.filter((l) => !off(l));
  const found = prefs.kinds.length && live.length ? Object.values(countFor(course, { ...prefs, levels: live })).some((n) => n > 0) : false;
  const canStart = found;
  const start = () => go('lesson', { prefs: { ...prefs, levels: live } });
  const levelHint = prefs.levels.length > 0 && prefs.kinds.length > 0 && !live.length ? t('practice.pickOtherLevel')
    : offLevels.length ? (prefs.kinds.length === 1
      ? t('practice.noLevelWords', { lv: offLevels.join(', '), kind: t('practice.kind.' + prefs.kinds[0]) })
      : t('practice.noLevelWordsAny', { lv: offLevels.join(', ') })) : '';
  return html`<${Screen} cls="screen--grey screen--practice" tone="today" bottom=${html`<${Button} label=${t('practice.start')} disabled=${!canStart} onClick=${start} />`}>
    <div class="top-bar"><${IconButton} icon="arrow-left" size=${48} onClick=${back} label=${t('common.back')} /></div>
    <${Title} main=${t('practice.title')} accent=${t('practice.titleAccent')} />
    <div class="practice-secs">
      <${Section} title=${t('practice.words')}>
        <div class="choice-wrap choice-wrap--tight">${['new', 'hard', 'almost'].map((k) => html`<${Chip} on=${prefs.kinds.includes(k)} label=${t('practice.kind.' + k)} onClick=${() => flip('kinds', k)} />`)}</div>
      </${Section}>
      <${Section} title=${t('practice.level')}>
        <div class="choice-row6">${LEVELS.map((l) => html`<${Chip} on=${prefs.levels.includes(l)} off=${off(l)} label=${l} onClick=${() => flip('levels', l)} />`)}</div>
        ${levelHint && html`<p class="t-label-13 muted">${levelHint}</p>`}
      </${Section}>
      <${Section} title=${t('practice.size')}>
        <div class="choice-wrap choice-wrap--count">${CONFIG.practiceSizes.map((n) => html`<${Chip} on=${prefs.size === n} label=${n === 'all' ? t('practice.all') : String(n)} onClick=${() => set({ size: n })} />`)}</div>
      </${Section}>
    </div>
  </${Screen}>`;
}
