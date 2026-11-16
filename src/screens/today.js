// Экран 04 «Сьогодні» (макет 04i): сколько слов на сегодня, «Вчити слова» и «Повторити слова», выучено, группы слов.
import { html } from '../../lib/preact-htm.js';
import { feature } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t, pn, plural, num, interval, L } from '../i18n/index.js';
import { progress } from '../core/store.js';
import { planToday, learningIds, freshLeft, myLevel } from '../core/session.js';
import { learnedStats, streak } from '../core/stats.js';
import { clock } from '../core/dates.js';
import { Screen, Title, Button, Icon, Pill, cx } from '../ui/kit.js';
import { GROUP_TYPES } from '../groups/index.js';

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
  const me = myLevel(p);   // «Мій рівень» справа вверху: по тесту или самый высокий из выбранных
  // 04: «Вчити слова» (в занятии сначала повторение, потом новые), под ней лаймовая «Повторити слова» —
  // повторить слова со статусом «Вчу», когда угодно. 04s (план выполнен): «Ще 5 нових слів».
  const main = plan.noLevels ? html`<${Button} label=${t('today.chooseLevels')} onClick=${() => go('settings', { pick: 'levels' })} />`
    : !done ? html`<${Button} label=${t('today.learnWords')} onClick=${() => go('lesson')} />`
    : freshLeft(course) ? html`<${Button} label=${t('today.moreNew', { n: p.newPerDay })} onClick=${() => go('lesson', { extra: true })} />` : '';
  const repeat = !plan.noLevels && learning > 0 && html`<${Button} variant="accent" icon="refresh" label=${t('today.repeatWords')} onClick=${() => go('lesson', { practice: true })} />`;
  return html`<${Screen} cls="screen--tab screen--today" tone="today">
    <div class="top-bar"><span class="t-brand-wordmark brand">Vocca</span><span class="top-bar__mid"></span>
      ${me && html`<button class="my-level t-label-14-medium" onClick=${() => go('settings', { pick: 'levels' })}>${t('today.myLevel')}
        <span class="level-tag level-tag--white">${me}</span></button>`}</div>
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
    ${(main || repeat) && html`<div class="cta-wrap">${main}${repeat}</div>`}
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
    <${GroupsHome} course=${course} go=${go} />
  </${Screen}>`;
}

// 04 · Групи слів: заголовок над блоками; блоки «В процесі», «Нові», «Пройдені» идут один под другим
// (пустой блок не показываем), группы внутри — через тонкую линию. Нажатие на строку открывает группу.
// Кнопки: «Вчити» (лаймовая) — продолжить, «Почати» (лавандовая) — начать, «Повторити» (мятная) — повторить пройденную группу.
const BLOCKS = [['learning', 'today.groupsLearning', 'groups.learn'], ['fresh', 'today.groupsNew', 'groups.start'], ['done', 'today.groupsDone', 'groups.repeat']];
function GroupsHome({ course, go }) {
  if (!feature('groups') || !course.groupList?.length) return null;
  const list = course.groupList.map((g) => ({ g, s: GROUP_TYPES[g.type].stats(course, g) }));
  const open = (g) => go('group', { group: g.id });
  const repeat = (g, s) => go(s.repeatRoute || 'group', { group: g.id, review: true });
  return html`<section class="groups-home"><h2 class="t-heading-h2">${t('groups.title')}</h2>
    ${BLOCKS.map(([status, title, btn]) => {
      const items = list.filter(({ s }) => s.status === status || (status === 'learning' && s.status === 'due'));
      return items.length > 0 && html`<div key=${status} class="card group-block"><div class="t-title-m group-block__title">${t(title)}</div>
        ${items.map(({ g, s }) => html`<div key=${g.id} class="group-row" role="button" tabindex="0" onClick=${() => open(g)}>
          <div class="group-row__head"><div class="group-row__text"><div class="t-title-l">${L(g.title)}</div>
            <div class="t-label-12-medium muted">${status === 'learning' ? t('groups.learnedOf', { a: s.learned, b: s.total }) : s.subtitle}</div></div>
            <button class=${cx('pill-btn', 'pill-btn--' + status)} onClick=${(e) => { e.stopPropagation(); if (status === 'done') repeat(g, s); else open(g); }}>${t(btn)}</button></div>
          ${status === 'learning' && html`<div class="meter"><i style=${`width:${Math.round((s.learned / Math.max(1, s.total)) * 100)}%`}></i></div>`}
        </div>`)}</div>`;
    })}
  </section>`;
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
