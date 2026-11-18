// Экран 2.1 «Практика» (вкладка; до 18.11.2026 — «Сьогодні»): сколько слов пройдено сегодня и минут, цель на день,
// три плитки (дні поспіль · вивчено слів · % курсу), «Вчити слова» → 2.2 «Що тренуємо», «Добірки слів» раскрываются на месте,
// карточка «Статистика» — доля выученных слов по уровням.
import { html, useState } from '../../lib/preact-htm.js';
import { feature } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t, L, plural, num } from '../i18n/index.js';
import { progress } from '../core/store.js';
import { dayGoal, myLevel, practicePrefs } from '../core/session.js';
import { GROUP_TYPES } from '../groups/index.js';
import { learnedStats, streak, todayStats } from '../core/stats.js';
import { Screen, Title, Button, Icon, Stat, cx } from '../ui/kit.js';

function greeting() {
  const h = new Date().getHours();
  return t(h < 5 ? 'today.night' : h < 12 ? 'today.morning' : h < 18 ? 'today.day' : 'today.evening');
}

export function Today({ course, go }) {
  const p = progress(course.id);
  const goal = dayGoal(course);
  const learned = learnedStats(course);
  const st = streak();
  const day = todayStats();
  const noLevels = !p.levels.length && !p.queue.length;
  const me = myLevel(p);   // чип «🔥 B1» справа от заголовка: по тесту или самый высокий из выбранных
  const levels = () => go('settings', { pick: 'levels' });
  // Главная кнопка ведёт на 2.2 «Що тренуємо». Цель на день выполнена — «На сьогодні план виконано!» и «Вчити ще».
  const main = noLevels ? html`<${Button} label=${t('today.chooseLevels')} onClick=${levels} />`
    : html`<${Button} label=${t(goal.done ? 'today.learnMore' : 'today.learnWords')} onClick=${() => go('practice')} />`;
  const totalWords = course.words.length;
  // доля в процентах: 245 из 3 447 → «7%»; меньше половины процента, но не ноль → «<1%»
  const share = (a, b) => (!a || !b ? 0 : (a / b) * 100);
  const pctText = (v) => (v > 0 && v < 0.5 ? '<1%' : `${Math.round(v)}%`);
  const perLevel = Object.fromEntries(LEVELS.map((l) => [l, course.words.filter((w) => w.lvl === l).length]));
  return html`<${Screen} cls="screen--tab screen--today" tone="today">
    <div class="today-head">
      ${noLevels ? html`<${Title} main=${greeting()} accent=${t('today.noLevels')} />`
        : goal.done ? html`<${Title} main=${t('today.planDone')} accent=${t('today.planDoneAccent')} />`
        : html`<${Title} main=${t('today.timeToMain')} accent=${t('today.timeToAccent')} />`}
      ${me && html`<button class="level-chip t-label-13" onClick=${levels} aria-label=${`${t('today.yourLevel')} ${me}`}><${Icon} name="flame" size=${18} /><b>${me}</b></button>`}
    </div>
    <div class="hero hero--today"><div class="t-number-hero">${num(day.words)}</div>
      <div class="hero__label"><div class="t-label-16 hero__text">${t('today.passed')}</div>
        <div class="t-label-15 muted">${t('today.about', { n: day.minutes, u: plural(day.minutes, 'minutes') })}</div></div></div>
    <div class="stats">
      <${Stat} value=${num(st.days)} label=${t('today.statStreak', { d: plural(st.days, 'days') })} />
      <${Stat} value=${num(learned.total)} label=${t('today.statLearned')} />
      <${Stat} value=${pctText(share(learned.inCourse, totalWords))} label=${t('today.statCourse')} />
    </div>
    <div class="cta-wrap">${main}</div>
    ${feature('groups') && course.groupList?.length > 0 && html`<${Collections} course=${course} go=${go} />`}
    <div class="card learned-levels">
      <div class="learned-levels__top"><span class="t-label-16-strong">${t('today.stats')}</span></div>
      <div class="level-bars">${LEVELS.map((l) => {
        const v = share(learned.byLevel[l], perLevel[l]);
        return html`<div key=${l} class="level-bars__row"><span class="t-label-13-strong level-bars__lvl">${l}</span>
          <span class="level-bars__track">${v > 0 && html`<i data-level=${l} style=${`width:${Math.max(v, 8)}%`}></i>`}</span>
          <span class="t-label-13-strong level-bars__pct">${pctText(v)}</span></div>`;
      })}</div>
    </div>
  </${Screen}>`;
}

// «Добірки слів» (2.1–2.1b): карточка раскрывается на месте; внутри «В процесі», «Нові», «Пройдені» —
// каждый блок тоже свёрнут, пока не нажать. Свёрнуто — шеврон вниз, развёрнуто — вверх.
// Кнопка у добірки: «Вчити» (в процесі), «Почати» (нова), «Повторити» (пройдена) — занятие по этой добірці.
const BLOCKS = [['learning', 'groupsLearning', 'learn'], ['fresh', 'groupsNew', 'start'], ['done', 'groupsDone', 'repeat']];
function Collections({ course, go }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState({});
  const list = course.groupList.map((g) => ({ g, s: GROUP_TYPES[g.type].stats(course, g) }));
  const of = (k) => list.filter(({ s }) => (k === 'learning' ? s.status === 'learning' || s.status === 'due' : s.status === k));
  const size = practicePrefs(course).size;
  // «3 форми дієслів» открывает свой экран с группами и «Тренажер», остальные добірки — сразу занятие
  const open3 = (g, k) => (GROUP_TYPES[g.type].Screen ? go('group', { group: g.id })
    : go('collection', { groups: [g.id], size, review: k === 'done' }));
  const chev = (on) => html`<${Icon} name=${on ? 'chevron-up' : 'chevron-down'} size=${20} />`;
  return html`<button class=${cx('choice-row', open && 'is-open')} aria-expanded=${open} onClick=${() => setOpen(!open)}>
      <span class="ib ib--white" style="--ib:48px"><${Icon} name="grid" size=${22} /></span>
      <span class="choice-row__text"><span class="t-title-l">${t('today.collections')}</span><span class="t-label-13">${t('today.groupsSub')}</span></span>
      <span class="ib ib--outline" style="--ib:40px">${chev(open)}</span></button>
    ${open && html`<div class="colls">${BLOCKS.map(([k, title, btn]) => {
      const items = of(k);
      if (!items.length) return null;
      const on = !!shown[k];
      return html`<div key=${k} class="card coll-block">
        <button class="coll-block__head" aria-expanded=${on} onClick=${() => setShown({ ...shown, [k]: !on })}>
          <span class="t-title-m">${t('today.' + title)}</span><span class="count-pill t-label-13-medium">${items.length}</span><span class="grow"></span>
          <span class="ib ib--grey" style="--ib:40px">${chev(on)}</span></button>
        ${on && items.map(({ g, s }) => html`<div key=${g.id} class="coll-row">
          <div class="coll-row__head"><div class="coll-row__text"><span class="t-title-m">${L(g.title)}</span><span class="t-label-13 muted">${s.subtitle}</span></div>
            <button class=${'pill-btn pill-btn--' + k + ' t-label-15-medium'} onClick=${() => open3(g, k)}>
              ${k === 'done' && html`<${Icon} name="refresh" size=${16} />`}${t('groups.' + btn)}</button></div>
          ${k === 'learning' && html`<div class="meter"><i style=${`width:${Math.round((s.learned / s.total) * 100)}%`}></i></div>`}
        </div>`)}
      </div>`;
    })}</div>`}`;
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
