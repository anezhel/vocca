// Тип группы «irregular»: неправильные глаголы. Глаголы учатся только здесь, в ежедневное занятие не попадают.
// 12  — три карточки сложности («Усі форми однакові», «Дві форми однакові», «Усі форми різні»), внизу кнопка «Тренажер».
// 12b — карточки глаголов одной сложности: «Далі», по CONFIG.verbSessionSize за заход, в конце итог 19c (done.js).
// 12e — тренажёр (логика из первой версии Vocca, 14.11.2026; вернули 16.11.2026 в стиле Vocca2):
//       новый глагол — знакомство («Я знаю це» / «Тренувати») → выбрать 2-ю и 3-ю форму из вариантов → ответ → … → итог 12f.
//       Верно с первого раза — следующий повтор по лестнице CONFIG.verbLadder, ошибка — завтра и ещё раз в конце тренировки.
import { html, useState, useMemo } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { tri } from '../content/index.js';
import { t, L, pn, interval } from '../i18n/index.js';
import { update, progress } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { Screen, TopBar, Title, Button, Icon, SpeakButton, Overline, Mark, Pill, LevelTag, cx } from '../ui/kit.js';
import { GroupDone, Ring } from './done.js';

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
const learned = (c) => trained(c) && (c.known || c.ivl >= CONFIG.verbLearnedAfterDays);
const isDue = (c, now = Date.now()) => trained(c) && c.due <= now;

function stats(course, g) {
  const cs = cards(course), total = g.items.length;
  const nSeen = g.items.filter((v) => seen(cs[v.id])).length;
  const due = g.items.filter((v) => isDue(cs[v.id])).length;
  const status = !nSeen ? 'fresh' : nSeen >= total ? 'done' : 'learning';
  const subtitle = !nSeen ? pn(total, 'verbs') : nSeen >= total ? t('groups.allLearned', { n: total }) : t('groups.learnedOf', { a: nSeen, b: total });
  return { total, learned: nSeen, due, status, subtitle, repeatRoute: 'group' };
}

// Очередь тренажёра: сначала глаголы, которым пора на повторение, потом просмотренные в карточках,
// потом новые — от лёгких к сложным. Если тренировать нечего, берём те, чьё повторение ближе всего.
function trainList(course, group, now = Date.now()) {
  const cs = cards(course), items = group.items;
  const order = (v) => KINDS.findIndex(([k]) => k === v.kind);
  const due = items.filter((v) => isDue(cs[v.id], now)).sort((a, b) => cs[a.id].due - cs[b.id].due);
  const seenOnly = items.filter((v) => cs[v.id] && !trained(cs[v.id]));
  const fresh = items.filter((v) => !cs[v.id]).sort((a, b) => order(a) - order(b));
  return [...due, ...seenOnly, ...fresh];
}
function trainQueue(course, group) {
  let list = trainList(course, group);
  if (!list.length) {
    const cs = cards(course);
    list = [...group.items].sort((a, b) => (learned(cs[a.id]) - learned(cs[b.id])) || (cs[a.id].due - cs[b.id].due));
  }
  return list.slice(0, CONFIG.verbSessionSize).map((v) => v.id);
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

// Три формы (как 07v): у каждой подпись, транскрипция, озвучка и пример.
// mode: view — просмотр; quiz — 2-я и 3-я форма пустые, под активной — варианты ответа; result — ✓ / ✗ у 2-й и 3-й
function Forms({ v, lang, mode = 'view', picks = {}, active, options, onPick, onSlot }) {
  const labels = [t('verbs.present'), t('verbs.past'), t('verbs.participle')];
  return html`<div class="card forms-card">${[1, 2, 3].map((n) => {
    const form = v['v' + n], ex = v.ex[n - 1];
    const over = html`<${Overline}>${n} · ${labels[n - 1]}</${Overline}>`;
    if (mode === 'quiz' && n > 1) {
      const picked = picks[n], on = active === n;
      return html`<div class="forms-card__row">
        <div class="forms-card__text">${over}
          <button class=${cx('slot', on && 'slot--active', picked && 'slot--picked')} onClick=${() => onSlot && onSlot(n)}>
            <span class=${on && !picked ? 't-label-16' : 't-label-17'}>${picked || (on ? (n === 3 ? t('verbs.pick3') : t('verbs.pick', { n })) : '?')}</span></button></div>
        ${on && html`<div class="options">${options.map((o) => html`<button class="option" onClick=${() => onPick(o)}>${o}</button>`)}</div>`}
      </div>`;
    }
    const ok = mode === 'result' && n > 1 ? !!picks['r' + n] : null;
    return html`<div class="forms-card__row">
      <div class="forms-card__head"><div class="forms-card__text">${over}
        <span class="syn-row__line"><span class="t-label-17">${form}</span>${v.ipa[n - 1] && html`<span class="t-label-14 muted">/${v.ipa[n - 1]}/</span>`}</span>
        ${ok === false && picks[n] && !picks.giveUp && html`<span class="t-label-14 verdict-text">${t('verbs.yourAnswer', { a: picks[n] })}</span>`}</div>
        ${ok != null && html`<span class=${cx('verdict', ok ? 'verdict--ok' : 'verdict--bad')} aria-label=${ok ? t('verbs.right') : ''}><${Icon} name=${ok ? 'check' : 'close'} size=${16} /></span>`}
        <${SpeakButton} text=${form.replace(' / ', ', ')} lang=${lang} /></div>
      ${mode !== 'quiz' && ex && html`<div class="forms-card__ex"><div class="t-body-16-medium"><${Mark} text=${ex.en} hl=${form.split(' / ')} /></div>
        <div class="t-label-14 muted">${L(ex)}</div></div>`}
    </div>`;
  })}
  ${mode === 'view' && v.note && html`<p class="forms-card__note t-label-14 muted">${L(v.note)}</p>`}
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

// Варианты ответа: верная форма + неверные из таблицы + похожие формы других глаголов
function options(v, k, all) {
  const right = v['v' + k];
  const pool = [...v.fakes];
  if (k === 3 && norm(v.v2) !== norm(v.v3)) pool.unshift(v.v2);
  if (k === 2 && norm(v.v2) !== norm(v.v3)) pool.unshift(v.v3);
  // похожая форма другого глагола: buy → bought, а рядом brought (от bring)
  const tail = (a, b) => { let n = 0; while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++; return n; };
  const look = all.filter((x) => x.id !== v.id && norm(x['v' + k]) !== norm(right) && x['v' + k][0] === right[0])
    .sort((a, b) => tail(b['v' + k], right) - tail(a['v' + k], right))[0];
  if (look && tail(look['v' + k], right) >= 2) pool.unshift(look['v' + k]);
  pool.push(v.v1 + 'ed');
  const uniq = [...new Set(pool.filter((x) => norm(x) !== norm(right)))].slice(0, 3);
  return [right, ...uniq].sort(() => Math.random() - 0.5);
}

// Экран 12e: тренажёр — знакомство (новый глагол) → вопрос → ответ → … → итог 12f
function Trainer({ course, group, route, go, back }) {
  const lang = ttsLang(course);
  const [s, setS] = useState(() => {
    const queue = route.ids || trainQueue(course, group);
    return { queue, total: queue.length, pos: 0, step: 'intro', picks: {}, ok: [], bad: [], startedAt: Date.now() };
  });
  const vid = s.queue[s.pos];
  const v = group.items.find((x) => x.id === vid);
  const opts = useMemo(() => (v ? { 2: options(v, 2, group.items), 3: options(v, 3, group.items) } : {}), [vid, s.pos]);

  if (!v) return html`<${Summary} course=${course} group=${group} s=${s} go=${go} back=${back} />`;

  const kindTitle = t('verbs.' + v.kind);
  const count = (n) => `${Math.min(n, s.total)} / ${s.total}`;
  const isNew = !cards(course)[v.id] && !s.bad.includes(v.id);
  const step = s.step === 'intro' && !isNew ? 'quiz' : s.step;
  const set = (patch) => setS({ ...s, ...patch });
  const head = html`<${Head} v=${v} lang=${lang} over=${kindTitle} /><span class="word-pair__link t-label-12-medium">${t('lesson.formsLink')}</span>`;

  const save = (correct) => update(() => {
    const cs = cards(course), c = cs[v.id] || {};
    const prev = trained(c) ? c.step : -1;
    const stepN = correct ? Math.min(prev + 1, CONFIG.verbLadder.length - 1) : 0;
    const days = correct ? CONFIG.verbLadder[stepN] : 1;
    cs[v.id] = { ...c, step: stepN, ivl: days, due: Date.now() + days * DAY, last: Date.now() };
  });
  const nextVerb = () => { setS({ ...s, pos: s.pos + 1, step: 'intro', picks: {} }); scrollTo(0, 0); };
  const knowIt = () => {
    update(() => { const cs = cards(course); cs[v.id] = { ...(cs[v.id] || {}), known: true, step: 3, ivl: 16, due: Date.now() + 16 * DAY, last: Date.now() }; });
    setS({ ...s, ok: [...s.ok, v.id], pos: s.pos + 1, step: 'intro', picks: {} }); scrollTo(0, 0);
  };

  // Знакомство с новым глаголом (12b в тренажёре)
  if (step === 'intro') {
    return html`<${Screen} cls="screen--lesson" bottom=${html`<div class="row-2"><${Button} variant="secondary" label=${t('common.iKnow')} onClick=${knowIt} />
        <${Button} label=${t('common.train')} onClick=${() => set({ step: 'quiz' })} /></div>`}>
      <${TopBar} onClose=${back} total=${s.total} done=${s.pos} count=${count(s.pos + 1)} />
      <div class="word-pair">${head}<${Forms} v=${v} lang=${lang} /></div>
    </${Screen}>`;
  }

  // Вопрос: сначала 2-я форма, потом 3-я. Нажатие на заполненную ячейку — выбрать заново
  if (step === 'quiz') {
    const k = s.picks[2] == null ? 2 : 3;
    const ready = s.picks[2] != null && s.picks[3] != null;
    const check = (giveUp) => {
      const r2 = !giveUp && norm(s.picks[2]) === norm(v.v2), r3 = !giveUp && norm(s.picks[3]) === norm(v.v3);
      const correct = r2 && r3;
      const first = !s.bad.includes(v.id);
      if (first) save(correct);
      const patch = { step: 'answer', picks: { ...s.picks, giveUp, r2, r3 } };
      if (!correct && first) { patch.bad = [...s.bad, v.id]; patch.queue = [...s.queue, v.id]; patch.total = s.total + 1; }
      if (correct && first) patch.ok = [...s.ok, v.id];
      setS({ ...s, ...patch }); scrollTo(0, 0);
    };
    return html`<${Screen} cls="screen--lesson" bottom=${html`<div class="row-2"><${Button} variant="secondary" label=${t('common.dontRemember')} onClick=${() => check(true)} />
        <${Button} label=${t('common.check')} disabled=${!ready} onClick=${() => check(false)} /></div>`}>
      <${TopBar} onClose=${back} total=${s.total} done=${s.pos} count=${count(s.pos + 1)} />
      <div class="word-pair">${head}
        <${Forms} v=${v} lang=${lang} mode="quiz" picks=${s.picks} active=${ready ? 0 : k} options=${ready ? [] : opts[k]}
          onPick=${(o) => set({ picks: { ...s.picks, [k]: o } })} onSlot=${(n) => set({ picks: n === 2 ? {} : { 2: s.picks[2] } })} /></div>
    </${Screen}>`;
  }

  // Ответ: ✓ / ✗ у форм и «Запам’ятай»
  const p = s.picks;
  const notes = [];
  if (v.kind === 'same') notes.push(t('verbs.sameNote', { v: v.v1, which: t('verbs.which123'), f: v.v1 }));
  else if (norm(v.v2) === norm(v.v3)) notes.push(t('verbs.sameNote', { v: v.v1, which: t('verbs.which23'), f: v.v2 }));
  else if (norm(v.v1) === norm(v.v3)) notes.push(t('verbs.sameNote', { v: v.v1, which: t('verbs.which13'), f: v.v3 }));
  for (const wrong of [!p.r2 && p[2], !p.r3 && p[3]].filter(Boolean)) {
    const other = group.items.find((x) => x.id !== v.id && [x.v1, x.v2, x.v3].some((f) => norm(f) === norm(wrong)));
    if (other) notes.push(t('verbs.fromVerb', { w: wrong, v: other.v1, tr: L(other.tr) }));
  }
  if (v.note) notes.push(L(v.note));
  else if (!notes.length && course.verbHints && course.verbHints[v.hint]) notes.push(L(course.verbHints[v.hint]));
  if (!(p.r2 && p.r3) && s.queue.indexOf(v.id, s.pos + 1) > s.pos) notes.push(t('verbs.repeatEnd', { v: v.v1 }));
  return html`<${Screen} cls="screen--lesson" bottom=${html`<${Button} label=${t('common.next')} onClick=${nextVerb} />`}>
    <${TopBar} onClose=${back} total=${s.total} done=${s.pos + 1} count=${count(s.pos + 1)} />
    <div class="word-pair">${head}<${Forms} v=${v} lang=${lang} mode="result" picks=${p} /></div>
    ${notes.length > 0 && html`<div class="card card--lesson"><${Overline}>${t('verbs.remember')}</${Overline}><p class="t-body-16">${notes.join(' ')}</p></div>`}
  </${Screen}>`;
}

// Экран 12f: итог тренировки — кольцо «без помилок», глаголы тренировки (с ошибкой — коралловые), когда следующая тренировка
function Summary({ course, group, s, go, back }) {
  const cs = cards(course);
  const ids = [...new Set(s.queue)];
  const bad = new Set(s.bad);
  const next = Math.min(...ids.map((id) => cs[id]?.due || Infinity));
  const left = trainList(course, group).length;
  const verbs = [...ids.filter((id) => bad.has(id)), ...ids.filter((id) => !bad.has(id))];
  const shown = verbs.slice(0, 10), more = verbs.length - shown.length;
  return html`<${Screen} cls="screen--done" bottom=${html`<div class="done-actions">
      ${left > 0 && html`<${Button} label=${t('verbs.trainMore')} onClick=${() => go('verbs', { group: group.id, train: true }, true)} />`}
      <${Button} variant="secondary" label=${t('groups.repeat')} onClick=${() => go('verbs', { group: group.id, train: true, ids }, true)} />
      <button class="link-btn t-title-m" onClick=${back}>${t('groups.back')}</button></div>`}>
    <div class="done">
      <${Ring} value=${ids.length - bad.size} total=${ids.length} caption=${t('verbs.ringCap', { n: ids.length })} />
      <div class="done__head"><h1 class="t-heading-h1">${t('verbs.doneTitle')}</h1>
        ${isFinite(next) && html`<p class="t-body-16 muted">${t('verbs.nextTrain', { x: interval(Math.max(60, (next - Date.now()) / 1000)) })}</p>`}</div>
      <div class="done__words">${shown.map((id) => html`<span class=${cx('counter t-label-15', bad.has(id) && 'counter--wrong')}>${id}</span>`)}
        ${more > 0 && html`<span class="counter counter--dark t-label-15">+${more}</span>`}</div>
    </div>
  </${Screen}>`;
}

function GroupScreen(props) {
  if (props.route.name !== 'verbs') return html`<${Home} ...${props} />`;
  return props.route.train ? html`<${Trainer} ...${props} />` : html`<${VerbCards} ...${props} />`;
}

export default { load, stats, Screen: GroupScreen, routes: ['verbs'] };
