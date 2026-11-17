// Экран 08 «Сьогодні» (новый дизайн, 18.11.2026): сколько слов на сегодня, три плитки (сегодня · дни подряд · % курса),
// «Вчити слова», карточка «Групи слів» (→ экран групп), карточка «Вивчено» по уровням (→ «Вивчені слова»).
import { html } from '../../lib/preact-htm.js';
import { feature } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t, plural, num } from '../i18n/index.js';
import { progress } from '../core/store.js';
import { planToday, freshLeft, myLevel } from '../core/session.js';
import { learnedStats, streak } from '../core/stats.js';
import { Screen, Title, Button, Icon, Stat } from '../ui/kit.js';

function greeting() {
  const h = new Date().getHours();
  return t(h < 5 ? 'today.night' : h < 12 ? 'today.morning' : h < 18 ? 'today.day' : 'today.evening');
}

export function Today({ course, go }) {
  const p = progress(course.id);
  const plan = planToday(course);
  const learned = learnedStats(course);
  const st = streak();
  const done = plan.total === 0;
  const finished = done && plan.doneToday > 0;   // план на сьогодні виконано
  const me = myLevel(p);   // «A2 твій рівень» справа вверху: по тесту или самый высокий из выбранных
  const levels = () => go('settings', { pick: 'levels' });
  // одна главная кнопка: «Вчити слова» (в занятии сначала повторение, потом новые), после плана — «Ще 5 нових слів»
  const main = plan.noLevels ? html`<${Button} label=${t('today.chooseLevels')} onClick=${levels} />`
    : !done ? html`<${Button} label=${t('today.learnWords')} onClick=${() => go('lesson')} />`
    : freshLeft(course) ? html`<${Button} label=${t('today.moreNew', { n: p.newPerDay })} onClick=${() => go('lesson', { extra: true })} />` : '';
  const totalWords = course.words.length;
  const pct = (a, b) => (!a || !b ? 0 : Math.max(1, Math.round((a / b) * 100)));   // хоть одно слово — уже 1 %
  const perLevel = Object.fromEntries(LEVELS.map((l) => [l, course.words.filter((w) => w.lvl === l).length]));
  return html`<${Screen} cls="screen--tab screen--today" tone="today">
    <div class="top-bar"><span class="t-brand-wordmark brand">Vocca</span><span class="top-bar__mid"></span>
      ${me && html`<button class="level-chip t-label-13" onClick=${levels}><${Icon} name="flame" size=${18} /><b>${me}</b> ${t('today.yourLevel')}</button>`}</div>
    ${finished ? html`<${Title} main=${t('today.planDone')} accent=${t('today.planDoneAccent')} />`
      : plan.noLevels || done ? html`<${Title} main=${greeting()} accent=${plan.noLevels ? t('today.noLevels') : t('today.allDone')} />`
      : html`<${Title} main=${t('today.timeToMain')} accent=${t('today.timeToAccent')} />`}
    <div class="hero hero--today"><div class="t-number-hero">${finished ? plan.doneToday : plan.total}</div>
      <div class="hero__label"><div class="t-label-16">${finished ? t('today.wordsDone', { w: plural(plan.doneToday, 'words') }) : t('today.wordsToday', { w: plural(plan.total, 'words') })}</div>
        ${!done && html`<div class="t-label-15 muted">${t('today.about', { n: plan.minutes, u: plural(plan.minutes, 'minutes') })}</div>`}</div></div>
    <div class="stats">
      <${Stat} value=${num(plan.doneToday)} label=${t('today.statToday')} />
      <${Stat} value=${num(st.days)} label=${t('today.statStreak', { d: plural(st.days, 'days') })} />
      <${Stat} value=${`${pct(learned.total, totalWords)}%`} label=${t('today.statCourse')} />
    </div>
    ${main && html`<div class="cta-wrap">${main}</div>`}
    ${feature('groups') && course.groupList?.length > 0 && html`<button class="choice-row" onClick=${() => go('groups')}>
      <span class="ib ib--white" style="--ib:48px"><${Icon} name="grid" size=${22} /></span>
      <span class="choice-row__text"><span class="t-title-l">${t('groups.title')}</span><span class="t-label-13">${t('today.groupsSub')}</span></span>
      <span class="ib ib--outline" style="--ib:40px"><${Icon} name="arrow-right" size=${20} /></span></button>`}
    <button class="card learned-levels" onClick=${() => go('learned')}>
      <div class="learned-levels__top"><span class="t-label-16-strong">${t('today.learnedShort')}</span>
        <span class="t-label-15 muted">${num(learned.total)} ${plural(learned.total, 'words')}</span></div>
      <div class="level-bars">${LEVELS.map((l) => {
        const v = pct(learned.byLevel[l], perLevel[l]);
        return html`<div key=${l} class="level-bars__row"><span class="t-label-13-strong level-bars__lvl">${l}</span>
          <span class="level-bars__track">${v > 0 && html`<i data-level=${l} style=${`width:${Math.max(v, 8)}%`}></i>`}</span>
          <span class="t-label-13-strong level-bars__pct">${v}%</span></div>`;
      })}</div>
    </button>
  </${Screen}>`;
}

// Линейный график с точками: прогноз на главной и неделя в итоге занятия
export function LineChart({ values, labels, sel, onSel, tip, hollowFrom = Infinity, height = 120 }) {
  const W = 310, H = height, pad = 14, n = values.length;
  const max = Math.max(1, ...values);
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, n - 1);
  const y = (v) => H - 28 - (v / max) * (H - 60);
  const pts = values.map((v, i) => [x(i), y(v)]);
  const every = n > 7 ? Math.ceil(n / 6) : 1;          // при 10 и 30 днях подписи не у каждой точки
  const r = n > 14 ? 3 : 4.5;
  const upto = Math.min(n, hollowFrom);
  let d = '';
  pts.slice(0, upto).forEach(([px, py], i, a) => {
    if (!i) { d = `M${px},${py}`; return; }
    const [qx, qy] = a[i - 1], cx = (qx + px) / 2;
    d += ` C${cx},${qy} ${cx},${py} ${px},${py}`;
  });
  return html`<svg class="chart" viewBox=${`0 0 ${W} ${H}`} role="img">
    ${[0.3, 0.55, 0.8].map((k) => html`<line x1="0" x2=${W} y1=${H * k - 10} y2=${H * k - 10} class="chart__grid" />`)}
    ${sel != null && html`<line x1=${x(sel)} x2=${x(sel)} y1=${y(values[sel])} y2=${H - 24} class="chart__guide" />`}
    <path d=${d} class="chart__line" />
    ${pts.map(([px, py], i) => html`<g onClick=${() => onSel && onSel(i)} class="chart__pt">
      <circle cx=${px} cy=${i >= hollowFrom ? H - 34 : py} r=${i === sel ? 7 : r} class=${i >= hollowFrom ? 'is-hollow' : i === sel ? 'is-sel' : ''} />
      <rect x=${px - (W / n) / 2} y="0" width=${W / n} height=${H} fill="transparent" />
      ${(i % every === 0 || (every === 1 && i === sel)) && html`<text x=${px} y=${H - 4} text-anchor="middle" class=${i === sel ? 'is-sel' : ''}>${labels[i]}</text>`}</g>`)}
    ${sel != null && tip && values[sel] != null && html`<g class="chart__tip"><rect x=${Math.min(Math.max(x(sel), 34), W - 34) - 32} y=${y(values[sel]) - 34} width="64" height="24" rx="12" />
      <text x=${Math.min(Math.max(x(sel), 34), W - 34)} y=${y(values[sel]) - 18} text-anchor="middle">${tip(values[sel])}</text></g>`}
  </svg>`;
}
