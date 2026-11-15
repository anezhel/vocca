// Экран 04 «Сьогодні»: сколько слов на сегодня, кнопка «Вчити слова», выучено, прогноз повторений.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG, feature } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t, pn, plural, num, interval, L } from '../i18n/index.js';
import { progress } from '../core/store.js';
import { planToday, learningIds, freshLeft } from '../core/session.js';
import { learnedStats, history, streak } from '../core/stats.js';
import { clock, addDays, weekday } from '../core/dates.js';
import { Screen, Title, Button, Icon, IconButton, Pill, PickSheet, cx } from '../ui/kit.js';

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
  const finished = done && plan.doneToday > 0;   // 04s · план на сьогодні виконано
  const learning = learningIds(course).length;
  // Без лимитов: после плана — «Ще 5 нових слів»; повторить слова, которые учишь, можно всегда
  const main = plan.noLevels ? html`<${Button} label=${t('today.chooseLevels')} onClick=${() => go('settings', { pick: 'levels' })} />`
    : !done ? html`<${Button} cls="btn--circle-white" label=${t('today.learnNew')} onClick=${() => go('lesson')} />`
    : freshLeft(course) ? html`<${Button} cls="btn--circle-white" label=${t('today.moreNew', { n: p.newPerDay })} onClick=${() => go('lesson', { extra: true })} />` : '';
  // 04: сверху лаймовая «Повторити слова, які вчу» (иконка повтора в белом кружке), под ней чёрная «Вчити нові слова»
  const repeat = !plan.noLevels && learning > 0 && html`<${Button} variant="accent" icon="refresh" label=${t('today.repeatLearning')} onClick=${() => go('lesson', { practice: true })} />`;
  const cta = html`${repeat}${main}`;
  return html`<${Screen} cls="screen--tab" tone="today">
    <div class="top-bar"><span class="t-brand-wordmark brand">Vocca</span><span class="top-bar__mid"></span>
      ${feature('streak') && html`<span class="pill pill--glass streak-pill"><${Icon} name="flame" size=${18} /><span class="t-label-15-medium">${st.days}</span></span>`}</div>
    ${finished ? html`<${Title} main=${t('today.planDone')} accent=${t('today.planDoneAccent')} />`
      : plan.noLevels || done ? html`<${Title} main=${greeting()} accent=${plan.noLevels ? t('today.noLevels') : t('today.allDone')} />`
      : html`<${Title} main=${t('today.timeToMain')} accent=${t('today.timeToAccent')} />`}
    <div class="hero hero--today"><div class="t-number-hero">${finished ? plan.doneToday : plan.total}</div>
      <div><div class="t-label-17">${finished ? t('today.wordsDone', { w: plural(plan.doneToday, 'words') }) : t('today.wordsToday', { w: plural(plan.total, 'words') })}</div>
        ${!done && html`<div class="t-label-14 muted">${t('today.about', { n: plan.minutes, u: plural(plan.minutes, 'minutes') })}</div>`}</div></div>
    <div class="pills">
      ${finished && plan.doneToday - plan.freshToday > 0 && html`<${Pill}>${t('today.repeated', { n: plan.doneToday - plan.freshToday })}</${Pill}>`}
      ${finished && plan.freshToday > 0 && html`<${Pill}>${t('today.freshDone', { n: plan.freshToday })}</${Pill}>`}
      ${plan.reviews.length > 0 && html`<${Pill}>${t('today.review', { n: plan.reviews.length })}</${Pill}>`}
      ${plan.fresh.length > 0 && html`<${Pill}>${t('today.fresh', { n: plan.fresh.length })}</${Pill}>`}
      ${p.levels.length > 0 && html`<${Pill} cls="pill--glass" onClick=${() => go('settings', { pick: 'levels' })}>${p.levels.join(' · ')}</${Pill}>`}
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
    ${feature('forecast') && html`<${StatsCard} kind="line" title=${t('today.statsRepeated')} field="repeated" />
      <${StatsCard} kind="bars" title=${t('today.statsLearned')} field="learned" />`}
  </${Screen}>`;
}

// Статистика на главной: «Повторено слів» (линия) и «Додано у вивчені» (столбики).
// Только прошедшие дни и сегодня (последним); сегодняшнее число меняется сразу после занятия.
// «7 днів ⌄» открывает лист 7 / 14 / 30 (CONFIG.statsDays) — одинаково в обоих блоках.
function StatsCard({ kind, title, field }) {
  const [days, setDays] = useState(CONFIG.statsDays[0]);
  const [sel, setSel] = useState(null);
  const [pick, setPick] = useState(false);
  const rows = history(days);
  const values = rows.map((r) => r[field]);
  const names = t('week');
  const label = (i) => i === days - 1 ? t('today.todayShort') : days <= 7 ? names[weekday(rows[i].ts)]
    : (() => { const d = new Date(rows[i].ts); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const at = sel == null ? days - 1 : sel;
  return html`<div class="card card--pad stats-card">
    <div class="row-between"><div class="t-title-m stats-card__title">${title}</div>
      <button class="pill" onClick=${() => setPick(true)}>${pn(days, 'days')} <${Icon} name="chevron-down" size=${16} /></button></div>
    <${HistoryChart} kind=${kind} values=${values} labels=${values.map((_, i) => label(i))} sel=${at} onSel=${setSel} tip=${(v) => pn(v, 'words')} />
    ${pick && html`<${PickSheet} title=${t('today.forecastTitle')} confirm=${t('today.show')} value=${days} onClose=${() => setPick(false)}
      onPick=${(v) => { setDays(v); setSel(null); }}
      options=${CONFIG.statsDays.map((n) => ({ value: n, lead: html`<span class="t-number-s pick__num">${n}</span>`, label: plural(n, 'days') }))} />`}
  </div>`;
}

// График по дням: линия (точки при 7 днях) или столбики. Подписи: при 7 днях — каждый день,
// при 14 и 30 — даты через несколько дней, последней всегда «Сьог.».
function HistoryChart({ kind, values, labels, sel, onSel, tip }) {
  const W = 310, H = 150, n = values.length, pad = n > 14 ? 8 : 14, base = H - 28, top = 26;
  const max = Math.max(kind === 'bars' ? 4 : 8, ...values);
  const x = (i) => pad + (i * (W - pad * 2)) / Math.max(1, n - 1);
  const y = (v) => base - (v / max) * (base - top);
  const step = n <= 7 ? 1 : n <= 14 ? 3 : 7;
  const showLabel = (i) => (n - 1 - i) % step === 0 && (i === n - 1 || n - 1 - i >= step || n <= 7);
  const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  const pts = values.map((v, i) => [x(i), y(v)]);
  let d = '';
  if (kind === 'line') pts.forEach(([px, py], i) => {
    if (!i) { d = `M${px},${py}`; return; }
    const p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1], p3 = pts[Math.min(n - 1, i + 1)];
    const c1 = clamp(p1[1] + (py - p0[1]) / 6, p1[1], py), c2 = clamp(py - (p3[1] - p1[1]) / 6, p1[1], py);
    d += ` C${p1[0] + (px - p1[0]) / 3},${c1} ${px - (px - p1[0]) / 3},${c2} ${px},${py}`;
  });
  const bw = n <= 7 ? 22 : n <= 14 ? 12 : 6;
  const tipText = tip(values[sel]);
  const tw = 20 + tipText.length * 7, tx = Math.min(Math.max(x(sel) - tw / 2, 0), W - tw);
  const ty = (kind === 'bars' ? y(values[sel]) : y(values[sel]) - 8) - 32;
  return html`<svg class=${'chart chart--' + kind} viewBox=${`0 0 ${W} ${H}`} role="img">
    ${[top, (top + base) / 2, base].map((gy) => html`<line x1="0" x2=${W} y1=${gy} y2=${gy} class="chart__grid" />`)}
    ${kind === 'bars' && values.map((v, i) => v > 0 && html`<rect x=${x(i) - bw / 2} y=${y(v)} width=${bw} height=${base - y(v)} rx=${Math.min(7, bw / 2)}
      class=${cx('chart__bar', i === sel && (n > 14 ? 'is-sel-solid' : 'is-sel'))} />`)}
    ${kind === 'line' && html`<line x1=${x(sel)} x2=${x(sel)} y1=${y(values[sel]) + 8} y2=${base} class="chart__guide" /><path d=${d} class="chart__line" />`}
    ${kind === 'line' && pts.map(([px, py], i) => (n <= 7 || i === sel) && html`<circle cx=${px} cy=${py} r=${i === sel ? 7 : 3.5} class=${i === sel ? 'is-sel' : ''} />`)}
    ${values.map((_, i) => html`<g class="chart__pt" onClick=${() => onSel(i)}><rect x=${x(i) - W / n / 2} y="0" width=${W / n} height=${H} fill="transparent" />
      ${showLabel(i) && html`<text x=${Math.min(Math.max(x(i), 14), W - 16)} y=${H - 4} text-anchor="middle" class=${i === sel ? 'is-sel' : ''}>${labels[i]}</text>`}</g>`)}
    <g class="chart__tip"><rect x=${tx} y=${ty} width=${tw} height="24" rx="12" /><text x=${tx + tw / 2} y=${ty + 16} text-anchor="middle">${tipText}</text></g>
  </svg>`;
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
