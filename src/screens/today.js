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
  // 04: одна кнопка «Вчити слова» — в занятии сначала повторение, потом новые слова.
  // 04s (план выполнен): «Ще 5 нових слів». «Повторити слова, які вчу» — на итоге занятия (08);
  // здесь она появляется, только если новых слов больше нет.
  const cta = plan.noLevels ? html`<${Button} label=${t('today.chooseLevels')} onClick=${() => go('settings', { pick: 'levels' })} />`
    : !done ? html`<${Button} label=${t('today.learnWords')} onClick=${() => go('lesson')} />`
    : freshLeft(course) ? html`<${Button} label=${t('today.moreNew', { n: p.newPerDay })} onClick=${() => go('lesson', { extra: true })} />`
    : learning > 0 ? html`<${Button} variant="accent" icon="refresh" label=${t('today.repeatLearning')} onClick=${() => go('lesson', { practice: true })} />` : '';
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
    <button class="card learned-card" onClick=${() => go('learned')}>
      <div class="learned-card__head"><div><div class="t-stat-l">${num(learned.total)}</div><div class="t-label-13-medium muted">${t('today.learned')}</div></div>
        <span class="ib ib--glass" style="--ib:44px"><${Icon} name="arrow-up-right" size=${20} /></span></div>
      <div class="level-bar">${LEVELS.filter((l) => !learned.total || learned.byLevel[l]).map((l) => {
        const share = learned.total ? learned.byLevel[l] / learned.total : 1;   // узкий сегмент — без подписи, капсулой
        return html`<span class=${cx('level-bar__seg', share < 0.08 && 'level-bar__seg--thin')} data-level=${l}
          style=${`flex:${learned.total ? learned.byLevel[l] : 1}`}>${share >= 0.08 && html`<span class="t-label-13-strong">${l}</span>`}</span>`;
      })}</div>
    </button>
    ${feature('forecast') && html`<${StatsCard} title=${t('today.statsRepeated')} field="repeated" min=${8} />
      <${StatsCard} title=${t('today.statsLearned')} field="learned" min=${4} />`}
  </${Screen}>`;
}

// Статистика на главной: «Повторено слів» и «Додано у вивчені» — оба линией.
// Прошедшие дни и сегодня; сегодняшнее число меняется сразу после занятия. После сегодня — пунктир до «Завтра».
// «7 днів ⌄» открывает лист 7 / 14 / 30 (CONFIG.statsDays) — одинаково в обоих блоках.
function StatsCard({ title, field, min }) {
  const [days, setDays] = useState(CONFIG.statsDays[0]);
  const [sel, setSel] = useState(null);
  const [pick, setPick] = useState(false);
  const rows = history(days);
  const values = rows.map((r) => r[field]);
  const names = t('week');
  const label = (i) => i === days - 1 ? t('today.todayShort') : days <= 7 ? names[weekday(rows[i].ts)]
    : (() => { const d = new Date(rows[i].ts); return `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, '0')}`; })();
  const at = sel == null ? days - 1 : sel;
  return html`<div class="card stats-card">
    <div class="stats-card__head"><div class="stats-card__text"><div class="t-title-m">${title}</div><div class="t-label-13 muted">${t('today.statsSub')}</div></div>
      <button class="pill pill--glass stats-card__pill" onClick=${() => setPick(true)}>${pn(days, 'days')} <${Icon} name="chevron-down" size=${16} /></button></div>
    <${HistoryChart} values=${values} labels=${values.map((_, i) => label(i))} sel=${at} onSel=${setSel} min=${min} />
    ${pick && html`<${PickSheet} title=${t('today.forecastTitle')} confirm=${t('today.show')} value=${days} onClose=${() => setPick(false)}
      onPick=${(v) => { setDays(v); setSel(null); }}
      options=${CONFIG.statsDays.map((n) => ({ value: n, lead: html`<span class="t-number-s pick__num">${n}</span>`, label: plural(n, 'days') }))} />`}
  </div>`;
}

// График по дням (по макету 04): плавная линия, точки при 7 днях, выбранная точка лаймовая с числом над ней.
// После «Сьог.» — серый пунктир примерно на том же уровне к пустой точке «Завтра» (данных ещё нет).
// Подписи: при 7 днях — каждый день и «Завтра» (приглушённо), при 14 и 30 — даты через 3 / 7 дней, без «Завтра».
function HistoryChart({ values, labels, sel, onSel, min = 8 }) {
  const W = 310, H = 172, n = values.length, top = 42, base = 138;
  const xNext = W - (n <= 7 ? 18 : n <= 14 ? 12 : 8);              // «Завтра»
  const xNow = xNext - (n <= 7 ? 46 : n <= 14 ? 22 : 10);          // «Сьог.»
  const pad = n <= 7 ? 14 : n <= 14 ? 10 : 8;
  const gap = (xNow - pad) / Math.max(1, n - 1);
  const max = Math.max(min, ...values);
  const x = (i) => pad + i * gap;
  const y = (v) => base - (v / max) * (base - top);
  const step = n <= 7 ? 1 : n <= 14 ? 3 : 7;
  const showLabel = (i) => (n - 1 - i) % step === 0 && (i === n - 1 || n - 1 - i >= step || n <= 7);
  const clamp = (v, a, b) => Math.min(Math.max(v, Math.min(a, b)), Math.max(a, b));
  const pts = values.map((v, i) => [x(i), y(v)]);
  let d = '';
  pts.forEach(([px, py], i) => {
    if (!i) { d = `M${px},${py}`; return; }
    const p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1], p3 = pts[Math.min(n - 1, i + 1)];
    const c1 = clamp(p1[1] + (py - p0[1]) / 6, p1[1], py), c2 = clamp(py - (p3[1] - p1[1]) / 6, p1[1], py);
    d += ` C${p1[0] + (px - p1[0]) / 3},${c1} ${px - (px - p1[0]) / 3},${c2} ${px},${py}`;
  });
  const [nx, ny] = pts[n - 1], ty0 = Math.min(ny + 2, base), half = (xNext - nx) / 2;
  const tail = `M${nx},${ny} C${nx + half},${ny} ${xNext - half},${ty0} ${xNext},${ty0}`;
  const tipText = String(values[sel]);
  const tw = 20 + tipText.length * 7.5, tx = Math.min(Math.max(x(sel) - tw / 2, 0), W - tw), tyy = y(values[sel]) - 42;
  return html`<svg class="chart chart--line" viewBox=${`0 0 ${W} ${H}`} role="img">
    ${[top, (top + base) / 2, base].map((gy) => html`<line x1="0" x2=${W} y1=${gy} y2=${gy} class="chart__grid" />`)}
    <line x1=${x(sel)} x2=${x(sel)} y1=${y(values[sel]) + 8} y2=${base} class="chart__guide" />
    <path d=${tail} class="chart__tail" /><circle cx=${xNext} cy=${ty0} r="3.5" class="chart__next" />
    <path d=${d} class="chart__line" />
    ${pts.map(([px, py], i) => (n <= 7 || i === sel) && html`<circle cx=${px} cy=${py} r=${i === sel ? 8 : 3.5} class=${i === sel ? 'is-sel' : ''} />`)}
    ${values.map((_, i) => html`<g class="chart__pt" onClick=${() => onSel(i)}><rect x=${x(i) - gap / 2} y="0" width=${gap} height=${H} fill="transparent" />
      ${showLabel(i) && html`<text x=${Math.min(Math.max(x(i), 14), W - 16)} y=${H - 7} text-anchor="middle" class=${i === sel ? 'is-sel' : ''}>${labels[i]}</text>`}</g>`)}
    ${n <= 7 && html`<text x=${Math.min(xNext, W - 21)} y=${H - 7} text-anchor="middle" class="chart__next-label">${t('today.tomorrow')}</text>`}
    <g class="chart__tip"><rect x=${tx} y=${tyy} width=${tw} height="26" rx="13" /><text x=${tx + tw / 2} y=${tyy + 17} text-anchor="middle">${tipText}</text></g>
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
