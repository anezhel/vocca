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

export function Today({ course, go, toast }) {
  const p = progress(course.id);
  const goal = dayGoal(course);
  const learned = learnedStats(course);
  const st = streak();
  const day = todayStats();
  const noLevels = !p.levels.length && !p.queue.length;
  // Заголовков «Час повторити слова» и «Сьогодні план виконано!» нет (19.11.2026): сверху только чип «🔥 B1» справа,
  // и всё содержимое поднимается выше. Заголовок остался лишь в редком случае, когда уровни не выбраны («Обери рівні»).
  const me = myLevel(p);   // уровень: по тесту или самый высокий из выбранных
  const levels = () => go('settings', { pick: 'levels' });
  // Главная кнопка ведёт на 2.2 «Що тренуємо». Цель на день выполнена — «Вчити ще», иначе «Вчити слова».
  const main = noLevels ? html`<${Button} label=${t('today.chooseLevels')} onClick=${levels} />`
    : html`<${Button} spring label=${t(goal.done ? 'today.learnMore' : 'today.learnWords')} onClick=${() => go('practice')} />`;
  const totalWords = course.words.length;
  // доля в процентах: 245 из 3 447 → «7%»; меньше половины процента, но не ноль → «<1%»
  const share = (a, b) => (!a || !b ? 0 : (a / b) * 100);
  const pctText = (v) => (v > 0 && v < 0.5 ? '<1%' : `${Math.round(v)}%`);
  const perLevel = Object.fromEntries(LEVELS.map((l) => [l, course.words.filter((w) => w.lvl === l).length]));
  return html`<${Screen} cls="screen--tab screen--today" tone="today">
    ${(noLevels || me) && html`<div class=${cx('today-head', noLevels && 'today-head--title')}>
      ${noLevels && html`<${Title} main=${greeting()} accent=${t('today.noLevels')} />`}
      ${me && html`<button class="level-chip t-label-13" onClick=${levels} aria-label=${`${t('today.yourLevel')} ${me}`}><${Icon} name="flame" size=${18} /><b>${me}</b></button>`}
    </div>`}
    <div class="hero hero--today"><div class="t-number-hero">${num(day.words)}</div>
      <div class="hero__label"><div class="t-label-16 hero__text">${t('today.passed')}</div>
        <div class="t-label-15 muted">${t('today.about', { n: day.minutes, u: plural(day.minutes, 'minutes') })}</div></div></div>
    <div class="stats">
      <${Stat} value=${num(st.days)} label=${t('today.statStreak', { d: plural(st.days, 'days') })} />
      <${Stat} value=${num(learned.total)} label=${t('today.statLearned')} />
      <${Stat} value=${pctText(share(learned.inCourse, totalWords))} label=${t('today.statCourse')} />
    </div>
    <div class="cta-wrap">${main}</div>
    <div class="practice-rows">
      ${feature('groups') && course.groupList?.length > 0 && html`<${Topics} course=${course} go=${go} section="words" icon="grid" title="today.collections" sub="today.groupsSub" toast=${toast} />`}
      <${Topics} course=${course} go=${go} section="grammar" icon="doc" title="today.grammar" sub="today.grammarSub" mint soon="today.grammarSoon" toast=${toast} />
    </div>
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

// «Добірки слів» и «Граматика» (2.1–2.1c): строка раскрывается на месте, внутри — блоки-темы (course.topics в pack.js:
// «Дієслова», «Зв’язки слів», «Вирази», «Не плутай»; в «Граматиці» — «Граматичні слова»). Каждый блок тоже свёрнут, пока
// не нажать; рядом с названием — сколько в теме добірок. Свёрнуто — шеврон вниз, развёрнуто — вверх.
// В теме сначала добірки в процессе, потом новые, потом пройденные. Кнопка у добірки: «Вчити» (в процесі),
// «Почати» (нова), «Повторити» (пройдена) — занятие по этой добірці; у в процессе — полоска прогресса.
const STATUS = { learning: ['learning', 'learn'], due: ['learning', 'learn'], fresh: ['fresh', 'start'], done: ['done', 'repeat'] };
const RANK = { learning: 0, fresh: 1, done: 2 };
function topicsOf(course, section) {
  const list = course.groupList.map((g) => ({ g, s: GROUP_TYPES[g.type].stats(course, g) }))
    .map((x) => ({ ...x, k: STATUS[x.s.status][0], btn: STATUS[x.s.status][1] }));
  const topics = (course.topics || []).filter((tp) => (tp.section || 'words') === section);
  const known = new Set((course.topics || []).map((tp) => tp.id));
  const blocks = topics.map((tp) => ({ id: tp.id, title: L(tp.title), items: list.filter(({ g }) => g.topic === tp.id) }));
  // добірки без темы (или с темой, которой нет в списке) — в «Інші добірки»
  if (section === 'words') blocks.push({ id: 'other', title: t('today.groupsOther'), items: list.filter(({ g }) => !known.has(g.topic)) });
  return blocks.filter((b) => b.items.length).map((b) => ({ ...b, items: [...b.items].sort((x, y) => RANK[x.k] - RANK[y.k]) }));
}

// Строка «Добірки слів» / «Граматика» с раскрывающимися темами. Тем нет — строка показывает тост (soon), если он задан.
// Под темами — чёрная кнопка «Тренажер» (решение дизайнера, 25.11.2026, макет 2.1c).
function Topics({ course, go, section, icon, title, sub, mint, soon, toast }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState({});
  const blocks = topicsOf(course, section);
  const size = practicePrefs(course).size;
  // «3 форми дієслів» открывает свой экран с группами и «Тренажер», остальные добірки — сразу занятие
  const open3 = (g, k) => (GROUP_TYPES[g.type].Screen ? go('group', { group: g.id })
    : go('collection', { groups: [g.id], size, review: k === 'done' }));
  const chev = (on) => html`<${Icon} name=${on ? 'chevron-up' : 'chevron-down'} size=${20} />`;
  const tap = () => (blocks.length ? setOpen(!open) : soon && toast && toast(t(soon)));
  // «Тренажер»: в «Добірках слів» — тренажёр «3 форми дієслів» (3.14; решение дизайнера, 25.11.2026 — раньше открывался с 3.12),
  // в «Граматиці» (и если добірки глаголов нет) — пока тост «незабаром»
  const verbs = section === 'words' && course.groupList.find((g) => g.type === 'irregular');
  const trainer = () => (verbs ? go('verbs', { group: verbs.id, train: true }) : toast && toast(t('today.trainerSoon')));
  // строка и раскрытые темы — одной группой: между ними 2 px, как в макете 2.1a (а не 20, как между блоками экрана)
  return html`<div class="colls-wrap"><button class=${cx('choice-row', mint && 'choice-row--mint', open && 'is-open')} aria-expanded=${open} onClick=${tap}>
      <span class="ib ib--white" style="--ib:48px"><${Icon} name=${icon} size=${22} /></span>
      <span class="choice-row__text"><span class="t-title-l">${t(title)}</span><span class="t-label-13">${t(sub)}</span></span>
      <span class="ib ib--outline" style="--ib:40px">${chev(open)}</span></button>
    ${open && html`<div class=${cx('colls', mint && 'colls--mint')}>${blocks.map((b) => {
      const on = !!shown[b.id];
      return html`<div key=${b.id} class="card coll-block">
        <button class="coll-block__head" aria-expanded=${on} onClick=${() => setShown({ ...shown, [b.id]: !on })}>
          <span class="t-title-m">${b.title}</span><span class="count-pill t-label-13-medium">${b.items.length}</span><span class="grow"></span>
          <span class="ib ib--grey" style="--ib:40px">${chev(on)}</span></button>
        ${on && b.items.map(({ g, s, k, btn }) => html`<div key=${g.id} class="coll-row">
          <div class="coll-row__head"><div class="coll-row__text"><span class="t-title-m">${L(g.title)}</span><span class="t-label-13 muted">${s.subtitle}</span></div>
            <button class=${'pill-btn pill-btn--' + k + ' t-label-15-medium'} onClick=${() => open3(g, k)}>
              ${k === 'done' && html`<${Icon} name="refresh" size=${16} />`}${t('groups.' + btn)}</button></div>
          ${k === 'learning' && html`<div class="meter"><i style=${`width:${Math.round((s.learned / s.total) * 100)}%`}></i></div>`}
        </div>`)}
      </div>`;
    })}
      <button class="trainer-btn t-label-16-strong" onClick=${trainer}>${t('today.trainer')}</button>
    </div>`}</div>`;
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
