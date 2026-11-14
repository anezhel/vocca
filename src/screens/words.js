// Экран 18 «Слова» (все слова курса с фильтрами) и 04a «Вивчені слова».
import { html, useState, useMemo } from '../../lib/preact-htm.js';
import { LEVELS } from '../content/index.js';
import { t, L, num } from '../i18n/index.js';
import { progress } from '../core/store.js';
import { status, isLearned } from '../core/srs.js';
import { shown, ttsLang } from '../core/words.js';
import { Screen, Title, Segmented, WordRow, TopBar, Icon, cx } from '../ui/kit.js';

const PAGE = 60;
const DAY = 86400;

function allWords(course) {
  const p = progress(course.id);
  return [...Object.values(p.custom), ...course.words];
}

export function Words({ course }) {
  const p = progress(course.id);
  const [filter, setFilter] = useState('all');
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
  const tog = (l) => { setLevels(levels.includes(l) ? levels.filter((x) => x !== l) : [...levels, l]); setShownN(PAGE); };
  return html`<${Screen} cls="screen--tab">
    <div class="top-space"></div>
    <${Title} main=${t('words.title')} accent=${t('words.inCourse', { n: num(course.words.length) })} />
    <${Segmented} cls="seg--wide" value=${filter} onChange=${(v) => { setFilter(v); setShownN(PAGE); }}
      options=${[['all', 'all'], ['learning', 'learning'], ['learned', 'learned'], ['fresh', 'fresh']].map(([v, k]) => ({ value: v, label: t('words.' + k) }))} />
    <div class="level-tiles">${LEVELS.map((l) => html`<button class=${cx('level-tile', levels.includes(l) && 'level-tile--on')} data-level=${l} onClick=${() => tog(l)}>
      <span class="t-number-xs">${l}</span><span class="t-label-12">${num(counts[l])} ${t('pl.words.2')}</span>
      ${levels.includes(l) && html`<span class="level-tile__check"><${Icon} name="check" size=${14} /></span>`}</button>`)}</div>
    <div class="word-list">${list.length ? list.slice(0, shownN).map((w) => {
      const s = p.queue.includes(w.id) && !p.cards[w.id] ? 'learning' : status(p.cards[w.id]);
      return html`<${WordRow} key=${w.id} word=${shown(course, w)} lvl=${w.lvl} tr=${L(w.tr)} status=${s} speak=${{ text: shown(course, w), lang }} />`;
    }) : html`<p class="t-body-15 muted center">${t('words.empty')}</p>`}</div>
    ${list.length > shownN && html`<button class="more t-label-15-medium" onClick=${() => setShownN(shownN + PAGE)}>${t('common.more')}</button>`}
  </${Screen}>`;
}

export function Learned({ course, back }) {
  const p = progress(course.id);
  const [lvl, setLvl] = useState('all');
  const words = allWords(course).filter((w) => { const c = p.cards[w.id]; return c && (isLearned(c) || (c.ivl || 0) >= 7 * DAY); });
  const learnedN = words.filter((w) => isLearned(p.cards[w.id])).length;
  const list = words.filter((w) => lvl === 'all' || w.lvl === lvl);
  const lang = ttsLang(course);
  return html`<${Screen}>
    <${TopBar} onBack=${back} />
    <${Title} main=${t('words.learnedTitle')} accent=${t('words.learnedOf', { a: num(learnedN), b: num(course.words.length) })} />
    <div class="chips">${['all', ...LEVELS].map((l) => html`<button class=${cx('chip', lvl === l && 'chip--on')} onClick=${() => setLvl(l)}>
      ${l === 'all' ? t('words.allN', { n: words.length }) : l}</button>`)}</div>
    <div class="word-list">${list.length ? list.map((w) => html`<${WordRow} key=${w.id} word=${shown(course, w)} lvl=${w.lvl} tr=${L(w.tr)}
      status=${isLearned(p.cards[w.id]) ? 'learned' : 'learning'} statusLabel=${isLearned(p.cards[w.id]) ? null : t('words.status.reinforcing')} speak=${{ text: shown(course, w), lang }} />`)
      : html`<p class="t-body-15 muted center">${t('words.empty')}</p>`}</div>
  </${Screen}>`;
}
