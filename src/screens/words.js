// Экран 18 «Слова» (все слова курса с фильтрами) и 04a «Вивчено» (выученные, можно вернуть в изучение).
// В строках нет меток статуса: звук и стрелка с примерами; у выученных — «Повернути у вивчення».
import { html, useState, useMemo } from '../../lib/preact-htm.js';
import { LEVELS } from '../content/index.js';
import { t, L, num } from '../i18n/index.js';
import { progress } from '../core/store.js';
import { status, isLearned } from '../core/srs.js';
import { shown, ipaOf, ttsLang, returnToLearning } from '../core/words.js';
import { Screen, Title, Segmented, WordRow, TopBar, Icon, IconButton, Button, Sheet, LevelTag, SpeakButton, Example, cx } from '../ui/kit.js';

const PAGE = 60;
const DAY = 86400;

function allWords(course) {
  const p = progress(course.id);
  return [...Object.values(p.custom), ...course.words];
}

export function Words({ course, toast }) {
  const p = progress(course.id);
  const [filter, setFilter] = useState('all');
  const [open, setOpen] = useState(null);
  const [ask, setAsk] = useState(null);
  const [, redraw] = useState(0);
  const [levels, setLevels] = useState([]);
  const [shownN, setShownN] = useState(PAGE);
  const words = allWords(course);
  const counts = useMemo(() => Object.fromEntries(LEVELS.map((l) => [l, course.words.filter((w) => w.lvl === l).length])), [course.id]);
  const list = words.filter((w) => {
    const s = status(p.cards[w.id]);
    if (filter === 'learning' && s !== 'learning' && !p.queue.includes(w.id)) return false;
    if (filter === 'learned' && s !== 'learned') return false;
    if (filter === 'fresh' && (s !== 'fresh' || p.queue.includes(w.id))) return false;
    return !levels.length || levels.includes(w.lvl);
  });
  const lang = ttsLang(course);
  const giveBack = (w) => {
    returnToLearning(course, w.id);
    setAsk(null); redraw((n) => n + 1);
    if (toast) toast(t('words.returned', { w: shown(course, w) }));
  };
  const tog = (l) => { setLevels(levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l]); setShownN(PAGE); };
  return html`<${Screen} cls="screen--tab">
    <div class="top-space"></div>
    <${Title} main=${t('words.title')} />
    <${Segmented} cls="seg--wide" value=${filter} onChange=${(v) => { setFilter(v); setShownN(PAGE); }}
      options=${[['all', 'all'], ['learning', 'learning'], ['learned', 'learned'], ['fresh', 'fresh']].map(([v, k]) => ({ value: v, label: t('words.' + k) }))} />
    <div class="level-tiles">${LEVELS.map((l) => html`<button class=${cx('level-tile', levels.includes(l) && 'level-tile--on')} data-level=${l} onClick=${() => tog(l)}>
      <span class="t-number-xs">${l}</span><span class="t-label-12">${num(counts[l])} ${t('pl.words.2')}</span>
      ${levels.includes(l) && html`<span class="level-tile__check"><${Icon} name="check" size=${14} /></span>`}</button>`)}</div>
    <div class="word-list word-list--tight">${list.length ? list.slice(0, shownN).map((w) => html`<${ExpandRow} key=${w.id} course=${course} w=${w} lang=${lang}
      open=${open === w.id} onToggle=${() => setOpen(open === w.id ? null : w.id)}
      onReturn=${status(p.cards[w.id]) === 'learned' ? () => setAsk(w) : null} />`)
      : html`<p class="t-body-15 muted center">${t('words.empty')}</p>`}</div>
    ${list.length > shownN && html`<button class="more t-label-15-medium" onClick=${() => setShownN(shownN + PAGE)}>${t('common.more')}</button>`}
    ${ask && html`<${ReturnSheet} course=${course} w=${ask} onClose=${() => setAsk(null)} onYes=${() => giveBack(ask)} />`}
  </${Screen}>`;
}

// 04a «Вивчено»: только выученные слова. Строка раскрывается (стрелка или нажатие на строку):
// примеры и «Повернути у вивчення» → лист 04b с подтверждением.
export function Learned({ course, back, toast }) {
  const p = progress(course.id);
  const [lvl, setLvl] = useState('all');
  const [open, setOpen] = useState(null);
  const [ask, setAsk] = useState(null);
  const [shownN, setShownN] = useState(PAGE);
  const [, redraw] = useState(0);
  const words = allWords(course).filter((w) => isLearned(p.cards[w.id]));
  const list = words.filter((w) => lvl === 'all' || w.lvl === lvl);
  const lang = ttsLang(course);
  const giveBack = (w) => {
    returnToLearning(course, w.id);
    setAsk(null); setOpen(null); redraw((n) => n + 1);
    if (toast) toast(t('words.returned', { w: shown(course, w) }));
  };
  return html`<${Screen}>
    <${TopBar} onBack=${back} />
    <${Title} main=${t('words.learnedTitle')} />
    <div class="chips chips--learned">${['all', ...LEVELS].map((l) => html`<button class=${cx('chip', lvl === l && 'chip--on')} onClick=${() => { setLvl(l); setShownN(PAGE); }}>
      ${l === 'all' ? t('words.allN', { n: words.length }) : l}</button>`)}</div>
    <div class="word-list word-list--tight">${list.length ? list.slice(0, shownN).map((w) => html`<${ExpandRow} key=${w.id} course=${course} w=${w} lang=${lang}
      open=${open === w.id} onToggle=${() => setOpen(open === w.id ? null : w.id)} onReturn=${() => setAsk(w)} />`)
      : html`<p class="t-body-15 muted center">${t('words.empty')}</p>`}</div>
    ${list.length > shownN && html`<button class="more t-label-15-medium" onClick=${() => setShownN(shownN + PAGE)}>${t('common.more')}</button>`}
    ${ask && html`<${ReturnSheet} course=${course} w=${ask} onClose=${() => setAsk(null)} onYes=${() => giveBack(ask)} />`}
  </${Screen}>`;
}

// Строка слова с примерами (компонент Aura/Word row expand: Collapsed / Expanded) — экраны 18 и 04a.
// onReturn — только у выученных слов: кнопка «Повернути у вивчення».
function ExpandRow({ course, w, lang, open, onToggle, onReturn }) {
  const word = shown(course, w);
  return html`<div class=${cx('learned-row card', open && 'learned-row--open')}>
    <div class="learned-row__top" onClick=${onToggle}>
      <div class="word-row__text"><div class="word-row__head"><span class="t-label-17">${word}</span>${ipaOf(course, w) && html`<span class="t-label-14 muted word-row__ipa">/${ipaOf(course, w)}/</span>`}<${LevelTag} lvl=${w.lvl} /></div>
        <div class="t-label-14 muted">${L(w.tr)}</div></div>
      <${SpeakButton} text=${word} lang=${lang} />
      <span class="ib ib--grey learned-row__chev" style="--ib:40px" role="button" aria-expanded=${open} aria-label=${t('words.examples')}><${Icon} name="chevron-down" size=${18} /></span>
    </div>
    ${open && html`<div class="learned-row__body">
      ${w.ex.length > 0 && html`<div class="examples">${w.ex.slice(0, 2).map((ex) => html`<${Example} ex=${ex} hl=${[w.w]} />`)}</div>`}
      ${onReturn && html`<button class="learned-row__back t-label-14-strong" onClick=${onReturn}><${Icon} name="refresh" size=${16} />${t('words.returnToLearning')}</button>`}
    </div>`}
  </div>`;
}

// Лист 04b: «Повернути у вивчення?»
function ReturnSheet({ course, w, onClose, onYes }) {
  return html`<${Sheet} onClose=${onClose}>
    <div class="sheet__head sheet__head--row"><div><div class="t-heading-h2">${shown(course, w)}</div><div class="t-label-15 muted">${L(w.tr)}</div></div>
      <${IconButton} icon="close" onClick=${onClose} label=${t('common.close')} /></div>
    <p class="t-body-15 muted">${t('words.returnText')}</p>
    <${Button} variant="dark" label=${t('words.returnToLearning')} onClick=${onYes} />
  </${Sheet}>`;
}
