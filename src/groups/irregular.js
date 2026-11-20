// Тип группы «irregular»: неправильные глаголы. Глаголы учатся только здесь, в ежедневное занятие не попадают.
// 12  — три карточки сложности («Усі форми однакові», «Дві форми однакові», «Усі форми різні»), внизу кнопка «Тренажер».
//       Вид экрана — как до 16.11.2026, только карточки лаймовые (bg/accent).
// 12b — карточки глаголов одной сложности (вид — 3.13 из Figma v2, см. VerbCard): «Далі», по CONFIG.verbSessionSize за заход, в конце итог (done.js).
// 12e — тренажёр трёх форм из Vocca (репозиторий Slova-2, src/screens/verbs.js → Drill), в стиле Vocca2:
//       «Вставте дві форми дієслова» — обычно дана V1 (иногда V2 или V3), две другие выбираются из 6 вариантов; глаголы вразброс
//       по сложности; выбранный вариант остаётся активным (формы бывают одинаковые); после второго выбора ответ проверяется сам,
//       внизу «Наступне дієслово». CONFIG.verbDrillSize глаголов за раунд, в конце — тост «Готово: 8 з 10 правильно».
import { html, useState, useMemo, useRef, useEffect } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { tri } from '../content/index.js';
import { t, L, pn } from '../i18n/index.js';
import { update, progress, getState } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { tts } from '../core/tts.js';
import { Screen, TopBar, Title, Button, Icon, SpeakButton, Overline, Mark, Pill, cx, useSwipe, enterCls } from '../ui/kit.js';
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

// Очередь тренажёра: сначала глаголы, которым пора на повторение, потом ещё не тренированные.
// Внутри — вразброс, лёгкие и сложные вперемешку (с 19.11.2026), чтобы нельзя было угадать по порядку. Пусто — тренировать нечего.
function trainList(course, group, now = Date.now()) {
  const cs = cards(course), items = group.items;
  const due = shuffle(items.filter((v) => isDue(cs[v.id], now)));
  const fresh = shuffle(items.filter((v) => !trained(cs[v.id])));
  return [...due, ...fresh];
}

// 3.12 · Групи (макет обновлён 20.11.2026): заголовок «3 форми дієслів», три белые карточки сложности через 8 —
// точки и «Легко / Середньо / Складно», чёрная стрелка, название группы, формы-пример в лаймовых пилюлях, прогресс.
// Нажатие на карточку — 3.13 (картки дієслова этой группы), внизу «Тренажер» (3.14).
// С 2.2 («Слова з добірок» → «3 форми дієслів») сюда же, с выбранной «Кількість слів» (route.size).
function Home({ course, group, route, go, back }) {
  const cs = cards(course);
  return html`<${Screen} cls="screen--grey screen--verbs" tone="sky" bottom=${html`<${Button} label=${t('verbs.trainer')} onClick=${() => go('verbs', { group: group.id, train: true })} />`}>
    <${TopBar} onBack=${back} />
    <${Title} main=${L(group.title)} />
    <div class="diff-cards">${KINDS.map(([kind, diff, dots]) => {
      const list = group.items.filter((v) => v.kind === kind);
      const done = list.filter((v) => seen(cs[v.id])).length;
      const ex = list[0];
      if (!ex) return null;
      return html`<button key=${kind} class="card diff-card" onClick=${() => go('verbs', { group: group.id, kind, size: route.size })}>
        <div class="diff-card__top"><span class="dots">${[1, 2, 3].map((d) => html`<i class=${d <= dots ? 'on' : ''}></i>`)}</span>
          <span class="t-label-13">${t('verbs.' + diff)}</span><span class="ib ib--dark diff-card__go" style="--ib:36px"><${Icon} name="arrow-up-right" size=${16} /></span></div>
        <div class="t-title-l">${t('verbs.' + kind)}</div>
        <div class="diff-card__forms">${kind === 'same' ? html`<${Pill}>${ex.v1} — ${ex.v2} — ${ex.v3}</${Pill}>`
          : kind === 'two' ? html`<${Pill}>${ex.v1}</${Pill}><${Pill}>${ex.v2} — ${ex.v3}</${Pill}>`
          : html`<${Pill}>${ex.v1}</${Pill}><${Pill}>${ex.v2}</${Pill}><${Pill}>${ex.v3}</${Pill}>`}</div>
        <div class="meter-row diff-card__meter"><div class="meter"><i style=${`width:${(done / list.length) * 100}%`}></i></div><span class="t-label-12 muted">${done} / ${list.length}</span></div>
      </button>`;
    })}</div>
  </${Screen}>`;
}

// 3.13 · Картка дієслова (макет обновлён 20.11.2026): без заголовка — сразу под верхней строкой три белые карточки через 4 —
// по одной на форму. В карточке: лаймовый тег V1 / V2 / V3 (Label/12 Semibold, сверху 8), форма (Word/L), транскрипция
// (у V1 — Label/16, у V2 и V3 — Label/14), у V1 под ней перевод глагола; озвучка в обводке; через 12 — пример в сером блоке (поля 6 / 16).
// Заголовок (название группы) убран 20.11.2026. Подписей «теперішній час…» и пояснения в макете нет.
// noTr — без перевода у V1: в занятии (2.3b) перевод уже в карточке слова над формами.
export function VerbCard({ v, lang, noTr }) {
  const form = (n) => v['v' + n];
  return html`<div class="verb-forms">${[1, 2, 3].map((n) => {
    const ex = v.ex[n - 1];
    return html`<div key=${n} class="card verb-form">
      <div class="verb-form__head">
        <span class="verb-form__tag t-label-12-strong">V${n}</span>
        <div class="verb-form__text"><div class="t-word-l">${form(n)}</div>
          ${v.ipa[n - 1] && html`<div class=${n === 1 ? 't-label-16-regular muted' : 't-label-14 muted'}>/${v.ipa[n - 1]}/</div>`}
          ${n === 1 && !noTr && v.tr && html`<div class="t-label-14 muted">${L(v.tr)}</div>`}</div>
        <${SpeakButton} text=${form(n).replace(' / ', ', ')} lang=${lang} kind="outline" />
      </div>
      ${ex && html`<div class="verb-ex__box"><div class="t-body-16-medium"><${Mark} text=${ex.en} hl=${form(n).split(' / ')} /></div>
        <div class="t-label-14 muted">${L(ex)}</div></div>`}
    </div>`;
  })}</div>`;
}

// Экран 12b: карточка глагола, внизу «Далі». После порции — итог 19c. Свайп вправо — предыдущий глагол, влево — вперёд до уже просмотренного.
function VerbCards({ course, group, route, back }) {
  const lang = ttsLang(course);
  const N = route.size === 'all' ? Infinity : route.size || CONFIG.verbSessionSize;   // «Кількість слів» с 2.2
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
  const [far, setFar] = useState(0);
  const [enter, setEnter] = useState(null);
  const step = (p, dir) => { setPos(p); setEnter(dir); scrollTo(0, 0); };
  useSwipe(done ? () => { setDone(false); setEnter('left'); scrollTo(0, 0); } : pos > 0 ? () => step(pos - 1, 'left') : null,
    !done && pos < far ? () => step(pos + 1, 'right') : null);
  const restart = (s) => { setStart(s); setPos(0); setFar(0); setEnter(null); setDone(false); scrollTo(0, 0); };

  if (done || !v) {
    const cs = cards(course);
    return html`<${GroupDone} title=${kindTitle} seen=${of.filter((x) => seen(cs[x.id])).length} total=${of.length}
      left=${left} next=${Math.min(N, left)} unit="verbs" onFinish=${back} onMore=${() => restart(start + N)} onRepeat=${() => restart(start)} />`;
  }
  const next = () => {
    update(() => { const cs = cards(course); cs[v.id] = { ...(cs[v.id] || {}), seen: Date.now() }; });
    if (pos + 1 < list.length) { step(pos + 1, null); setFar(Math.max(far, pos + 1)); } else { setFar(Math.max(far, pos)); setDone(true); }
  };
  return html`<${Screen} key=${start + ':' + pos} cls=${cx('screen--lesson screen--grey', enterCls(enter))} tone="sky" bottom=${html`<${Button} label=${t('common.next')} onClick=${next} />`}>
    <${TopBar} onClose=${back} total=${list.length} done=${pos + 1} count=${`${pos + 1} / ${list.length}`} />
    <${VerbCard} v=${v} lang=${lang} />
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

// Какая форма дана (0 — V1, 1 — V2, 2 — V3): обычно 1-я, иногда 2-я или 3-я — тогда выбирать надо и 1-ю форму
const pickGiven = () => (Math.random() < CONFIG.verbDrillOtherGiven ? 1 + Math.floor(Math.random() * 2) : 0);
const FORMS = ['v1', 'v2', 'v3'];

// 6 вариантов: две нужные формы (одна кнопка, если они совпадают) + неверные из таблицы (колонка fakes), не хватает — из fakeForms.
// Если дана не 1-я форма, данная тоже среди вариантов: её легко принять за 1-ю.
function drillOptions(v, given) {
  const blanks = [0, 1, 2].filter((k) => k !== given);
  const right = [...new Set(blanks.map((k) => v[FORMS[k]]))];
  const real = new Set([v.v1, v.v2, v.v3].map(norm));
  const decoy = given > 0 && !right.some((x) => norm(x) === norm(v[FORMS[given]])) ? [v[FORMS[given]]] : [];
  const fakes = [...new Set([...shuffle([...v.fakes]), ...fakeForms(v)])].filter((x) => !real.has(norm(x)));
  return shuffle([...right, ...decoy, ...fakes.slice(0, 6 - right.length - decoy.length)]);
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
  if (!D.current) {
    const list = trainList(course, group).slice(0, CONFIG.verbDrillSize);
    D.current = { ids: list.map((v) => v.id), given: list.map(pickGiven), right: 0 };
  }
  const [i, setI] = useState(0);
  const [slots, setSlots] = useState([null, null]);
  const [checked, setChecked] = useState(false);
  const v = group.items.find((x) => x.id === D.current.ids[i]);
  const given = D.current.given[i] || 0;
  const blanks = [0, 1, 2].filter((k) => k !== given);          // какие формы заполнить, по порядку
  const answer = (j) => v[FORMS[blanks[j]]];
  const options = useMemo(() => (v ? drillOptions(v, given) : []), [i]);
  useEffect(() => { if (!v) { toast && toast(t('drill.nothing')); back(); } }, []);
  if (!v) return null;
  const n = D.current.ids.length;
  const ok = [norm(slots[0] || '') === norm(answer(0)), norm(slots[1] || '') === norm(answer(1))];
  const allOk = ok[0] && ok[1];

  // выбранный вариант остаётся активным: следующая форма бывает такой же (had — had)
  const pick = (o) => {
    if (checked) return;
    const k = slots[0] == null ? 0 : 1;
    const ns = [...slots]; ns[k] = o; setSlots(ns);
    if (k === 1) {
      const r1 = norm(ns[0]) === norm(answer(0)), r2 = norm(ns[1]) === norm(answer(1));
      setChecked(true);
      rateVerb(course, v, r1, r2);
      if (r1 && r2) D.current.right++;
      if (getState().autoplay) tts.speak(`${v.v1}, ${v.v2.replace(' / ', ', ')}, ${v.v3.replace(' / ', ', ')}`, lang);
    }
  };
  // нажатие на заполненную ячейку до проверки — выбрать заново (V2 — сбрасывает и V3)
  const clear = (k) => { if (checked || slots[k] == null) return; const ns = [...slots]; ns[k] = null; if (k === 0) ns[1] = null; setSlots(ns); };
  const next = () => {
    if (i + 1 >= n) { toast && toast(t('drill.done', { n: D.current.right, total: n })); back(); return; }
    setI(i + 1); setSlots([null, null]); setChecked(false); scrollTo(0, 0);
  };
  // после проверки в ячейке остаётся выбор человека: мятная — верно, коралловая — ошибка (правильные формы — в итоге ниже)
  const slotState = (k) => (checked ? (ok[k] ? 'correct' : 'wrong') : slots[k] != null ? 'filled' : k === (slots[0] == null ? 0 : 1) ? 'active' : 'empty');
  const optState = (o) => {
    if (!checked) return '';
    if (o === answer(0) || o === answer(1)) return 'correct';
    return slots.includes(o) ? 'wrong' : 'dim';
  };
  const hint = [course.verbHints && L(course.verbHints[v.hint]), v.note && L(v.note)].filter(Boolean).join(' ');

  // 3.14 / 3.14a / 3.14b (макет 19.11.2026): без строки «Неправильні дієслова · A1» и подсказки «Вставте дві форми дієслова»,
  // слово Word/XL (36), озвучка в обводке, активная ячейка лавандовая; фон серый с голубым и лавандовым пятнами, как у добірок
  return html`<${Screen} cls="screen--drill screen--grey" tone="sky" bottom=${html`<${Button} label=${t('drill.nextVerb')} onClick=${next} disabled=${!checked} />`}>
    <${TopBar} onClose=${back} total=${n} done=${i + (checked ? 1 : 0)} count=${`${i + 1} / ${n}`} />
    <div class="card drill-card" aria-label=${t('drill.task')}>
      <div class="drill-card__head"><div class="drill-card__text">
        <span class="t-word-xl">${v[FORMS[given]]}</span><span class="t-translation-m muted">${L(v.tr)}</span></div>
        <${SpeakButton} text=${v[FORMS[given]].replace(' / ', ', ')} lang=${lang} kind="outline" size=${40} /></div>
      <div class="drill-slots">${['V1', 'V2 · Past', 'V3'].map((head, f) => {
        const k = blanks.indexOf(f);
        return html`<div class="drill-slots__col" key=${head}>
        <span class="t-label-12-medium muted">${head}</span>
        ${k < 0 ? html`<span class="dslot dslot--given">${v[FORMS[f]]}</span>`
          : html`<button class=${'dslot dslot--' + slotState(k)} onClick=${() => clear(k)}>${slots[k] || ''}</button>`}</div>`;
      })}</div>
    </div>
    <div class="drill-opts">${options.map((o) => html`<button key=${o} class=${cx('dopt', optState(o) && 'dopt--' + optState(o))} onClick=${() => pick(o)}>${o}</button>`)}</div>
    ${checked && html`<div class="card drill-result">
      <div class="drill-result__top"><span class=${cx('pill', allOk ? 'pill--lime' : 'pill--coral')}>${allOk ? t('drill.right') : t('drill.wrong')}</span>
        <span class="t-label-16-strong">${v.v1} — ${v.v2} — ${v.v3}</span></div>
      ${hint && html`<p class="t-label-14 muted">${hint}</p>`}</div>`}
  </${Screen}>`;
}

// Для занятия по добіркам (src/screens/collection.js): глаголы по одному с «Далі» — сначала непросмотренные,
// от простых (все формы одинаковые) к сложным; если просмотрены все или «Повторити» — все заново.
const KIND_ORDER = { same: 0, two: 1, diff: 2 };
function queue(course, g, review) {
  const cs = cards(course);
  const sorted = [...g.items].sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
  const unseen = sorted.filter((v) => !seen(cs[v.id]));
  return review || !unseen.length ? sorted : unseen;
}
function markSeen(course, g, v) { update(() => { const cs = cards(course); cs[v.id] = { ...(cs[v.id] || {}), seen: Date.now() }; }); }
function progressOf(course, g) { const cs = cards(course); return { seen: g.items.filter((v) => seen(cs[v.id])).length, total: g.items.length }; }
function Item({ course, item }) {
  return html`<${VerbCard} v=${item} lang=${ttsLang(course)} />`;
}

function GroupScreen(props) {
  if (props.route.name !== 'verbs') return html`<${Home} ...${props} />`;
  return props.route.train ? html`<${Trainer} ...${props} />` : html`<${VerbCards} ...${props} />`;
}

export default { load, stats, queue, markSeen, progressOf, Item, noTitle: true, Screen: GroupScreen, routes: ['verbs'] };
