// Тип группы «irregular»: неправильные глаголы. Глаголы учатся только здесь, в ежедневное занятие не попадают.
// 12  — три карточки сложности («Усі форми однакові», «Дві форми однакові», «Усі форми різні»), внизу кнопка «Тренажер».
// 12b — карточки глаголов одной сложности: «Далі», по CONFIG.verbSessionSize за заход, в конце итог 19c (done.js).
// 12e — тренажёр трёх форм из Vocca (репозиторий Slova-2, src/screens/verbs.js → Drill), в стиле Vocca2:
//       «Вставте дві форми дієслова» — V1 дана, V2 и V3 выбираются из 6 вариантов; после второго выбора ответ проверяется сам,
//       внизу «Наступне дієслово». CONFIG.verbDrillSize глаголов за раунд, в конце — тост «Готово: 8 з 10 правильно».
import { html, useState, useMemo, useRef, useEffect } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { tri } from '../content/index.js';
import { t, L, pn } from '../i18n/index.js';
import { update, progress, getState } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { tts } from '../core/tts.js';
import { Screen, TopBar, Title, Button, SpeakButton, Overline, Mark, Pill, LevelTag, cx } from '../ui/kit.js';
import { GroupDone } from './done.js';

const DAY = 86400000;
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const kindOf = (v) => (norm(v.v1) === norm(v.v2) && norm(v.v2) === norm(v.v3) ? 'same'
  : norm(v.v2) === norm(v.v3) || norm(v.v1) === norm(v.v3) || norm(v.v1) === norm(v.v2) ? 'two' : 'diff');
// подгруппа · сложность · точек
const KINDS = [['same', 'easy', 1], ['two', 'medium', 2], ['diff', 'hard', 3]];
const DIFF = { same: 'easy', two: 'medium', diff: 'hard' };

function load(rows) {
  return rows.filter((r) => r.v1 && r.v2 && r.v3).map((r) => {
    const v = { id: r.v1, v1: r.v1, v2: r.v2, v3: r.v3, ipa: [r.ipa1 || '', r.ipa2 || '', r.ipa3 || ''], lvl: r.level || 'A2', hint: r.hint || '',
      tr: { uk: r.uk || r.ru, ru: r.ru || r.uk }, fakes: (r.fakes || '').split(',').map((s) => s.trim()).filter(Boolean),
      note: r.note_uk || r.note_ru ? { uk: r.note_uk || r.note_ru, ru: r.note_ru || r.note_uk } : null,
      ex: [1, 2, 3].map((i) => tri(r, 'ex' + i)).filter((x) => x && x.en) };
    v.kind = kindOf(v);
    return v;
  });
}

// Запись глагола в прогрессе: seen — карточку посмотрели (12b); step, ivl, due — расписание тренажёра
const cards = (course) => progress(course.id).verbs;
const seen = (c) => !!c;
const trained = (c) => !!c && c.due != null;
const isDue = (c, now = Date.now()) => trained(c) && c.due <= now;

function stats(course, g) {
  const cs = cards(course), total = g.items.length;
  const nSeen = g.items.filter((v) => seen(cs[v.id])).length;
  const due = g.items.filter((v) => isDue(cs[v.id])).length;
  const status = !nSeen ? 'fresh' : nSeen >= total ? 'done' : 'learning';
  const subtitle = !nSeen ? pn(total, 'verbs') : nSeen >= total ? t('groups.allLearned', { n: total }) : t('groups.learnedOf', { a: nSeen, b: total });
  return { total, learned: nSeen, due, status, subtitle, repeatRoute: 'group' };
}

// Очередь тренажёра (как createDrill в Vocca): сначала глаголы, которым пора на повторение, потом ещё не тренированные —
// просмотренные в карточках и новые, от лёгких к сложным. Пусто — тренировать сегодня нечего.
function trainList(course, group, now = Date.now()) {
  const cs = cards(course), items = group.items;
  const order = (v) => KINDS.findIndex(([k]) => k === v.kind);
  const due = items.filter((v) => isDue(cs[v.id], now)).sort((a, b) => cs[a.id].due - cs[b.id].due);
  const fresh = items.filter((v) => !trained(cs[v.id])).sort((a, b) => (!!cs[b.id] - !!cs[a.id]) || (order(a) - order(b)));
  return [...due, ...fresh];
}

// Плашка сложности: точки и «Легко / Середньо / Складно»
const DiffTag = ({ kind }) => {
  const [, diff, dots] = KINDS.find(([k]) => k === kind);
  return html`<span class=${cx('diff-tag', 'diff-tag--' + diff)}><span class="dots">${[1, 2, 3].map((d) => html`<i class=${d <= dots ? 'on' : ''}></i>`)}</span>
    <span class="t-label-13-medium">${t('verbs.' + diff)}</span></span>`;
};

// Экран 12: три карточки сложности, внизу «Тренажер»
function Home({ course, group, go, back }) {
  const cs = cards(course);
  const sample = group.items.find((v) => v.v1 === 'go') || group.items.find((v) => v.kind === 'diff');
  const due = group.items.filter((v) => isDue(cs[v.id])).length;
  const train = () => go('verbs', { group: group.id, train: true });
  return html`<${Screen} cls="screen--verbs" bottom=${html`<${Button} label=${t('verbs.trainer')} onClick=${train} />`}>
    <${TopBar} onBack=${back} />
    <${Title} main=${L(group.title)} />
    <div class="pills"><${Pill}>${pn(group.items.length, 'verbs')}</${Pill}>
      ${due > 0 && html`<${Pill} cls="pill--due" onClick=${train}>${t('groups.due', { n: due })}</${Pill}>`}</div>
    ${sample && html`<div class="card verbs-intro">
      <${Overline}>${t('verbs.threeForms')}</${Overline}>
      <div class="forms3">${['v1', 'v2', 'v3'].map((k, i) => html`<div class="forms3__cell"><div class="t-word-m">${sample[k]}</div>
        <div class="t-label-11 muted">${t('verbs.f' + (i + 1))}</div></div>`)}</div>
    </div>`}
    ${KINDS.map(([kind]) => {
      const list = group.items.filter((v) => v.kind === kind);
      const ex = list[0];
      if (!ex) return null;
      const done = list.filter((v) => seen(cs[v.id])).length;
      const status = !done ? 'fresh' : done >= list.length ? 'done' : 'learning';
      const open = () => go('verbs', { group: group.id, kind });
      return html`<div key=${kind} class="card diff-card" role="button" tabindex="0" onClick=${open}>
        <${DiffTag} kind=${kind} />
        <div class="diff-card__head"><div class="diff-card__text"><div class="t-title-l">${t('verbs.' + kind)}</div>
          <div class="t-label-13 muted">${t('verbs.' + kind + 'Sub')}</div></div>
          <button class=${cx('pill-btn', 'pill-btn--' + status)} onClick=${(e) => { e.stopPropagation(); open(); }}>
            ${t(status === 'fresh' ? 'groups.start' : status === 'done' ? 'groups.repeat' : 'groups.learn')}</button></div>
        <div class="diff-card__forms">${kind === 'same' ? html`<span class="pill pill--tag">${ex.v1} — ${ex.v2} — ${ex.v3}</span>`
          : kind === 'two' ? html`<span class="pill pill--tag">${ex.v1}</span><span class="pill pill--tag">${ex.v2} — ${ex.v3}</span>`
          : html`<span class="pill pill--tag">${ex.v1}</span><span class="pill pill--tag">${ex.v2}</span><span class="pill pill--tag">${ex.v3}</span>`}</div>
        <div class="meter-row"><div class="meter"><i style=${`width:${(done / list.length) * 100}%`}></i></div>
          <span class="t-label-12-medium muted">${done} / ${list.length}</span></div>
      </div>`;
    })}
  </${Screen}>`;
}

// Карточка глагола: подпись сверху, глагол, транскрипция, озвучка, уровень и сложность, перевод
const Head = ({ v, lang, over }) => html`<div class="card word-main">
  <div class="new-head"><div class="new-head__text"><${Overline}>${over}</${Overline}>
    <div class="t-word-xl">${v.v1}</div>${v.ipa[0] && html`<div class="t-label-16 muted">/${v.ipa[0]}/</div>`}</div>
    <${SpeakButton} text=${v.v1.replace(' / ', ', ')} lang=${lang} kind="dark" size=${40} /></div>
  <div class="tags tags--word"><${LevelTag} lvl=${v.lvl} size="m" /><${DiffTag} kind=${v.kind} /></div>
  <div class="t-translation-l">${L(v.tr)}</div>
</div>`;

// Три формы (как 07v в занятии): у каждой подпись, транскрипция, озвучка и пример
function Forms({ v, lang }) {
  const labels = [t('verbs.present'), t('verbs.past'), t('verbs.participle')];
  return html`<div class="card forms-card">${[1, 2, 3].map((n) => {
    const form = v['v' + n], ex = v.ex[n - 1];
    return html`<div class="forms-card__row">
      <div class="forms-card__head"><div class="forms-card__text"><${Overline}>${n} · ${labels[n - 1]}</${Overline}>
        <span class="syn-row__line"><span class="t-label-17">${form}</span>${v.ipa[n - 1] && html`<span class="t-label-14 muted">/${v.ipa[n - 1]}/</span>`}</span></div>
        <${SpeakButton} text=${form.replace(' / ', ', ')} lang=${lang} /></div>
      ${ex && html`<div class="forms-card__ex"><div class="t-body-16-medium"><${Mark} text=${ex.en} hl=${form.split(' / ')} /></div>
        <div class="t-label-14 muted">${L(ex)}</div></div>`}
    </div>`;
  })}
  ${v.note && html`<p class="forms-card__note t-label-14 muted">${L(v.note)}</p>`}
  </div>`;
}

// Экран 12b: карточка глагола, внизу «Далі». После порции — итог 19c.
function VerbCards({ course, group, route, back }) {
  const lang = ttsLang(course);
  const N = CONFIG.verbSessionSize;
  const kind = route.kind || 'two';
  const of = group.items.filter((v) => v.kind === kind);
  // сначала непросмотренные; если просмотрены все — вся подгруппа заново
  const [queue] = useState(() => { const cs = cards(course); const unseen = of.filter((v) => !seen(cs[v.id])); return unseen.length ? unseen : of; });
  const [start, setStart] = useState(0);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState(false);
  const list = queue.slice(start, start + N);
  const left = Math.max(0, queue.length - start - list.length);
  const v = list[pos];
  const kindTitle = t('verbs.' + kind);
  const restart = (s) => { setStart(s); setPos(0); setDone(false); scrollTo(0, 0); };

  if (done || !v) {
    const cs = cards(course);
    return html`<${GroupDone} title=${kindTitle} seen=${of.filter((x) => seen(cs[x.id])).length} total=${of.length}
      words=${list.map((x) => x.v1)} left=${left} unit="verbs" onBack=${back} onMore=${() => restart(start + N)} onRepeat=${() => restart(start)} />`;
  }
  const next = () => {
    update(() => { const cs = cards(course); cs[v.id] = { ...(cs[v.id] || {}), seen: Date.now() }; });
    if (pos + 1 < list.length) { setPos(pos + 1); scrollTo(0, 0); } else setDone(true);
  };
  return html`<${Screen} cls="screen--lesson" bottom=${html`<${Button} label=${t('common.next')} onClick=${next} />`}>
    <${TopBar} onClose=${back} total=${list.length} done=${pos + 1} count=${`${pos + 1} / ${list.length}`} />
    <div class="word-pair"><${Head} v=${v} lang=${lang} over=${kindTitle} />
      <span class="word-pair__link t-label-12-medium">${t('lesson.formsLink')}</span><${Forms} v=${v} lang=${lang} /></div>
  </${Screen}>`;
}

// Неверные варианты, похожие на настоящие: beginned, begined, begon, begain … (fakeForms из Vocca)
const reg = (x) => (x.endsWith('e') ? x + 'd' : /[^aeiou][aeiou][bdgmnprt]$/.test(x) && x.length <= 6 ? x + x.slice(-1) + 'ed'
  : /[^aeiou]y$/.test(x) ? x.slice(0, -1) + 'ied' : x + 'ed');
function fakeForms(v) {
  const b = v.v1.toLowerCase();
  const real = new Set([b, ...v.v2.split('/'), ...v.v3.split('/')].map((x) => x.trim()));
  const swaps = (x) => { const m = /([aeiou]+)([^aeiou]*)$/.exec(x); if (!m) return []; const head = x.slice(0, m.index), tail = m[2]; return ['o', 'ai', 'a', 'u', 'ou', 'ee'].map((vw) => head + vw + tail); };
  const v2 = v.v2.split('/')[0].trim(), v3 = v.v3.split('/')[0].trim();
  const cand = [reg(b), b + 'ed', ...swaps(b), b + 'en', v2 + 'en', reg(v2), v3 + 'ed', ...swaps(v2), b + 't', v2 + 'n'];
  const out = [];
  for (const c of cand) if (c && c.length > 1 && !real.has(c) && !out.includes(c)) out.push(c);
  return out;
}
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// 6 вариантов: V2 и V3 (одна кнопка, если они совпадают) + неверные из таблицы (колонка fakes), не хватает — из fakeForms
function drillOptions(v) {
  const right = [...new Set([v.v2, v.v3])];
  const real = new Set([v.v1, v.v2, v.v3].map(norm));
  const fakes = [...new Set([...shuffle([...v.fakes]), ...fakeForms(v)])].filter((x) => !real.has(norm(x)));
  return shuffle([...right, ...fakes.slice(0, 6 - right.length)]);
}

// Расписание (rateVerb из Vocca, интервалы — CONFIG.verbLadder в днях): обе формы верно — ступенька вверх;
// одна — ступенька та же; ни одной — глагол снова в тренажёре уже сегодня
function rateVerb(course, v, ok2, ok3) {
  update(() => {
    const cs = cards(course), c = cs[v.id] || {}, now = Date.now();
    const prev = trained(c) && c.step >= 0 ? c.step : -1;
    const step = ok2 && ok3 ? Math.min(prev + 1, CONFIG.verbLadder.length - 1) : ok2 || ok3 ? prev : -1;
    const days = step >= 0 ? CONFIG.verbLadder[step] : 0;
    cs[v.id] = { ...c, step, ivl: days, due: now + days * DAY, n: (c.n || 0) + 1, l: (c.l || 0) + (ok2 && ok3 ? 0 : 1), last: now };
  });
}

// Экран 12e: тренажёр трёх форм (Drill из Vocca)
function Trainer({ course, group, back, toast }) {
  const lang = ttsLang(course);
  const D = useRef(null);
  if (!D.current) D.current = { ids: trainList(course, group).slice(0, CONFIG.verbDrillSize).map((v) => v.id), right: 0 };
  const [i, setI] = useState(0);
  const [slots, setSlots] = useState([null, null]);
  const [checked, setChecked] = useState(false);
  const v = group.items.find((x) => x.id === D.current.ids[i]);
  const options = useMemo(() => (v ? drillOptions(v) : []), [i]);
  useEffect(() => { if (!v) { toast && toast(t('drill.nothing')); back(); } }, []);
  if (!v) return null;
  const n = D.current.ids.length;
  const ok = [norm(slots[0] || '') === norm(v.v2), norm(slots[1] || '') === norm(v.v3)];
  const allOk = ok[0] && ok[1];

  const pick = (o) => {
    if (checked) return;
    const k = slots[0] == null ? 0 : 1;
    const ns = [...slots]; ns[k] = o; setSlots(ns);
    if (k === 1) {
      const r2 = norm(ns[0]) === norm(v.v2), r3 = norm(ns[1]) === norm(v.v3);
      setChecked(true);
      rateVerb(course, v, r2, r3);
      if (r2 && r3) D.current.right++;
      if (getState().autoplay) tts.speak(`${v.v1}, ${v.v2.replace(' / ', ', ')}, ${v.v3.replace(' / ', ', ')}`, lang);
    }
  };
  // нажатие на заполненную ячейку до проверки — выбрать заново (V2 — сбрасывает и V3)
  const clear = (k) => { if (checked || slots[k] == null) return; const ns = [...slots]; ns[k] = null; if (k === 0) ns[1] = null; setSlots(ns); };
  const next = () => {
    if (i + 1 >= n) { toast && toast(t('drill.done', { n: D.current.right, total: n })); back(); return; }
    setI(i + 1); setSlots([null, null]); setChecked(false); scrollTo(0, 0);
  };
  const slotState = (k) => (checked ? (ok[k] ? 'correct' : 'wrong') : slots[k] != null ? 'filled' : k === (slots[0] == null ? 0 : 1) ? 'active' : 'empty');
  const optState = (o) => {
    if (!checked) return slots.includes(o) ? 'used' : '';
    if (o === v.v2 || o === v.v3) return 'correct';
    return slots.includes(o) ? 'wrong' : 'dim';
  };
  const hint = [course.verbHints && L(course.verbHints[v.hint]), v.note && L(v.note)].filter(Boolean).join(' ');

  return html`<${Screen} cls="screen--drill" bottom=${html`<${Button} label=${t('drill.nextVerb')} onClick=${next} disabled=${!checked} />`}>
    <${TopBar} onClose=${back} total=${n} done=${i + (checked ? 1 : 0)} count=${`${i + 1} / ${n}`} />
    <div class="tags"><span class="pill pill--lavender">${t('drill.chip')}</span><${LevelTag} lvl=${v.lvl} size="m" /></div>
    <div class="card drill-card">
      <div class="drill-card__head"><div class="drill-card__text"><span class="t-label-14 muted">${t('drill.task')}</span>
        <span class="t-word-xl">${v.v1}</span><span class="t-translation-m muted">${L(v.tr)}</span></div>
        <${SpeakButton} text=${v.v1} lang=${lang} kind="dark" size=${48} /></div>
      <div class="drill-slots">${[['V1', null], ['V2 · Past', 0], ['V3', 1]].map(([head, k]) => html`<div class="drill-slots__col" key=${head}>
        <span class="t-label-12-medium muted">${head}</span>
        ${k === null ? html`<span class="dslot dslot--given">${v.v1}</span>`
          : html`<button class=${'dslot dslot--' + slotState(k)} onClick=${() => clear(k)}>${checked ? [v.v2, v.v3][k] : slots[k] || ''}</button>`}</div>`)}</div>
    </div>
    <div class="drill-opts">${options.map((o) => html`<button key=${o} class=${cx('dopt', optState(o) && 'dopt--' + optState(o))} onClick=${() => pick(o)}>${o}</button>`)}</div>
    ${checked && html`<div class="card drill-result">
      <div class="drill-result__top"><span class=${cx('pill', allOk ? 'pill--lime' : 'pill--coral')}>${allOk ? t('drill.right') : t('drill.wrong')}</span>
        <span class="t-label-16-strong">${v.v1} — ${v.v2} — ${v.v3}</span></div>
      ${hint && html`<p class="t-label-14 muted">${hint}</p>`}</div>`}
  </${Screen}>`;
}

function GroupScreen(props) {
  if (props.route.name !== 'verbs') return html`<${Home} ...${props} />`;
  return props.route.train ? html`<${Trainer} ...${props} />` : html`<${VerbCards} ...${props} />`;
}

export default { load, stats, Screen: GroupScreen, routes: ['verbs'] };
