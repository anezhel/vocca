// Экран 04 «Сьогодні»: сколько слов на сегодня, кнопка «Вчити слова», выучено, прогноз повторений.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG, feature } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t, pn, plural, num, interval, L } from '../i18n/index.js';
import { progress } from '../core/store.js';
import { planToday } from '../core/session.js';
import { learnedStats, forecast, streak } from '../core/stats.js';
import { clock, addDays, weekday } from '../core/dates.js';
import { Screen, Title, Button, Icon, IconButton, Pill, PickSheet } from '../ui/kit.js';

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
  const cta = plan.noLevels ? html`<${Button} label=${t('today.chooseLevels')} onClick=${() => go('settings', { pick: 'levels' })} />`
    : done ? html`<${Button} label=${t('today.learnMore')} disabled=${!plan.doneToday} onClick=${() => go('lesson', { practice: true })} />`
    : html`<${Button} label=${t('today.learn')} onClick=${() => go('lesson')} />`;
  return html`<${Screen} cls="screen--tab">
    <div class="top-bar"><span class="t-brand-wordmark brand">Vocca</span><span class="top-bar__mid"></span>
      ${feature('streak') && html`<span class="pill pill--glass streak-pill"><${Icon} name="flame" size=${18} /><span class="t-label-15-medium">${st.days}</span></span>`}</div>
    <${Title} main=${greeting()} accent=${plan.noLevels ? t('today.noLevels') : done ? t('today.allDone') : t('today.timeTo')} />
    <div class="hero hero--today"><div class="t-number-hero">${plan.total}</div>
      <div><div class="t-label-17">${t('today.wordsToday', { w: plural(plan.total, 'words') })}</div>
        ${!done && html`<div class="t-label-14 muted">${t('today.about', { n: plan.minutes, u: plural(plan.minutes, 'minutes') })}</div>`}</div></div>
    <div class="pills">
      ${plan.reviews.length > 0 && html`<${Pill}>${t('today.review', { n: plan.reviews.length })}</${Pill}>`}
      ${plan.fresh.length > 0 && html`<${Pill}>${t('today.fresh', { n: plan.fresh.length })}</${Pill}>`}
      ${p.levels.length > 0 && html`<${Pill} onClick=${() => go('settings', { pick: 'levels' })}>${p.levels.join(' · ')}</${Pill}>`}
    </div>
    <div class="cta-wrap">${cta}</div>
    ${plan.later > 0 && html`<div class="card info-card"><span class="ib ib--accent" style="--ib:48px"><${Icon} name="clock" size=${22} /></span>
      <div><div class="t-label-16-strong">${t('today.nextAt', { time: clock(plan.nextAt) })}</div>
      <div class="t-label-13 muted">${t('today.nextIn', { x: pn(plan.later, 'words'), when: interval((plan.nextAt - Date.now()) / 1000) })}</div></div></div>`}
    <button class="card card--pad learned-card" onClick=${() => go('learned')}>
      <div class="row-between"><span class="t-label-13 muted">${t('today.learned')}</span><span class="ib ib--glass" style="--ib:44px"><${Icon} name="arrow-up-right" size=${20} /></span></div>
      <div class="t-stat-l">${num(learned.total)}</div>
      <div class="level-bar">${LEVELS.filter((l) => !learned.total || learned.byLevel[l]).map((l) => html`<span class="level-bar__seg" data-level=${l}
        style=${`flex:${learned.total ? learned.byLevel[l] : 1}`}><span class="t-label-12-medium">${l}</span></span>`)}</div>
    </button>
    ${feature('forecast') && html`<${Forecast} course=${course} />`}
  </${Screen}>`;
}

// Карточка прогноза; «5 днів ⌄» открывает лист снизу с выбором периода (CONFIG.forecastDays)
function Forecast({ course }) {
  const [days, setDays] = useState(CONFIG.forecastDays[0]);
  const [sel, setSel] = useState(1);
  const [pick, setPick] = useState(false);
  const data = forecast(course, days);
  const names = t('week');
  const label = (i) => {
    if (i === 0) return t('today.todayShort');
    if (i === 1) return t('today.tomorrow');
    const d = new Date(addDays(Date.now(), i));
    return days > 7 ? `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}` : names[weekday(d.getTime())];
  };
  return html`<div class="card card--pad">
    <div class="row-between"><div><div class="t-title-m">${t('today.forecast')}</div><div class="t-label-12 muted">${t('today.forecastSub')}</div></div>
      <button class="pill" onClick=${() => setPick(true)}>${pn(days, 'days')} <${Icon} name="chevron-down" size=${16} /></button></div>
    <${LineChart} values=${data} labels=${data.map((_, i) => label(i))} sel=${sel} onSel=${setSel} tip=${(v) => pn(v, 'words')} />
    ${pick && html`<${PickSheet} title=${t('today.forecast')} sub=${t('today.forecastPick')} value=${days} onClose=${() => setPick(false)}
      onPick=${(v) => { setDays(v); setSel(1); }}
      options=${CONFIG.forecastDays.map((n) => ({ value: n, lead: html`<span class="t-number-s pick__num">${n}</span>`, label: plural(n, 'days'), sub: t('today.period.' + n) }))} />`}
  </div>`;
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
