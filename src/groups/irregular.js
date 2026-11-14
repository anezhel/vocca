// Тип группы «irregular»: неправильные глаголы. Экраны 12 (три уровня сложности), 12b (знакомство), 12e (тренажёр), 12f (итог).
// Глаголы учатся только здесь, в ежедневное занятие не попадают.
import { html, useState, useMemo } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { tri } from '../content/index.js';
import { t, L, pn, plural, interval } from '../i18n/index.js';
import { update, progress } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { Screen, TopBar, Title, Button, IconButton, Icon, SpeakButton, Overline, Example, Stat, Pill, cx } from '../ui/kit.js';

const DAY = 86400000;
const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
const kindOf = (v) => (norm(v.v1) === norm(v.v2) && norm(v.v2) === norm(v.v3) ? 'same'
  : norm(v.v2) === norm(v.v3) || norm(v.v1) === norm(v.v3) || norm(v.v1) === norm(v.v2) ? 'two' : 'diff');
const KINDS = [['same', 'easy', 1], ['two', 'medium', 2], ['diff', 'hard', 3]];

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

const cards = (course) => progress(course.id).verbs;
const learned = (c) => !!c && (c.known || c.ivl >= CONFIG.verbLearnedAfterDays);
const dueList = (course, g, now = Date.now()) => g.items.filter((v) => { const c = cards(course)[v.id]; return c && !learned(c) ? c.due <= now : c && c.due <= now; });

function stats(course, g) {
  const cs = cards(course), total = g.items.length;
  const nLearned = g.items.filter((v) => learned(cs[v.id])).length;
  const due = dueList(course, g).length;
  const started = g.items.some((v) => cs[v.id]);
  const status = !started ? 'fresh' : due ? 'due' : nLearned >= total ? 'done' : 'learning';
  const subtitle = !started ? pn(total, 'verbs') : nLearned >= total && !due ? t('groups.allLearned', { n: total })
    : t('groups.learnedOf', { a: nLearned, b: total }) + (due ? ' · ' + t('groups.due', { n: due }) : '');
  return { total, learned: nLearned, due, status, subtitle, repeatRoute: due ? 'verbs' : 'group' };
}

// Экран 12: три уровня сложности
function Home({ course, group, go, back }) {
  const cs = cards(course);
  const sample = group.items.find((v) => v.v1 === 'go') || group.items.find((v) => v.kind === 'diff');
  return html`<${Screen}>
    <${TopBar} onBack=${back} />
    <${Title} main=${L(group.title)} />
    <div class="card card--pad">
      <${Overline}>${t('verbs.threeForms')}</${Overline}>
      <div class="forms3">${['v1', 'v2', 'v3'].map((k, i) => html`<div class="forms3__cell"><div class="t-word-m">${sample[k]}</div><div class="t-label-11 muted">${t('verbs.f' + (i + 1))}</div></div>`)}</div>
    </div>
    ${KINDS.map(([kind, diff, dots]) => {
      const list = group.items.filter((v) => v.kind === kind);
      const done = list.filter((v) => learned(cs[v.id])).length;
      const ex = list[0];
      if (!ex) return null;
      return html`<button class="card diff-card" onClick=${() => go('verbs', { group: group.id, kind })}>
        <div class="diff-card__top"><span class="dots">${[1, 2, 3].map((d) => html`<i class=${d <= dots ? 'on' : ''}></i>`)}</span>
          <span class="t-label-13">${t('verbs.' + diff)}</span><span class="ib ib--dark diff-card__go" style="--ib:36px"><${Icon} name="arrow-up-right" size=${16} /></span></div>
        <div class="t-title-l">${t('verbs.' + kind)}</div><div class="t-label-13 muted">${t('verbs.' + kind + 'Sub')}</div>
        <div class="diff-card__forms">${kind === 'same' ? html`<${Pill}>${ex.v1} — ${ex.v2} — ${ex.v3}</${Pill}>`
          : kind === 'two' ? html`<${Pill}>${ex.v1}</${Pill}><${Pill}>${ex.v2} — ${ex.v3}</${Pill}>`
          : html`<${Pill}>${ex.v1}</${Pill}><${Pill}>${ex.v2}</${Pill}><${Pill}>${ex.v3}</${Pill}>`}</div>
        <div class="meter-row"><div class="meter"><i style=${`width:${(done / list.length) * 100}%`}></i></div><span class="t-label-12 muted">${done} / ${list.length}</span></div>
      </button>`;
    })}
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

// Тренировка: знакомство (12b) → вопрос (12e) → ответ → … → итог (12f)
function Trainer({ course, group, route, go, back }) {
  const lang = ttsLang(course);
  const [s, setS] = useState(() => {
    const cs = cards(course), now = Date.now();
    let list;
    if (route.review) list = dueList(course, group, now);
    else {
      const of = group.items.filter((v) => v.kind === route.kind);
      list = [...of.filter((v) => cs[v.id] && cs[v.id].due <= now), ...of.filter((v) => !cs[v.id])];
      if (!list.length) list = of.filter((v) => !learned(cs[v.id])).concat(of).slice(0, CONFIG.verbSessionSize);
    }
    const queue = list.slice(0, CONFIG.verbSessionSize).map((v) => v.id);
    return { queue, total: queue.length, pos: 0, step: 'intro', picks: {}, ok: [], bad: [], startedAt: now };
  });
  const vid = s.queue[s.pos];
  const v = group.items.find((x) => x.id === vid);
  const kindTitle = t('verbs.' + (route.kind || v?.kind || 'two'));
  const label = t('groups.counter', { title: kindTitle, n: Math.min(s.pos + 1, s.total), total: s.total });
  const isNew = v && !cards(course)[v.id] && !s.bad.includes(v.id);
  const step = s.step === 'intro' && !isNew ? 'quiz' : s.step;
  const set = (patch) => setS({ ...s, ...patch });
  const opts = useMemo(() => v ? { 2: options(v, 2, group.items), 3: options(v, 3, group.items) } : {}, [vid, s.pos]);

  if (!v) return html`<${Summary} course=${course} group=${group} s=${s} title=${kindTitle} go=${go} back=${back} kind=${route.kind} />`;

  const save = (correct) => update(() => {
    const cs = cards(course), c = cs[v.id] || { step: -1 };
    const stepN = correct ? Math.min(c.step + 1, CONFIG.verbLadder.length - 1) : 0;
    const days = correct ? CONFIG.verbLadder[stepN] : 1;
    cs[v.id] = { step: stepN, ivl: days, due: Date.now() + days * DAY, last: Date.now() };
  });
  const nextVerb = () => { setS({ ...s, pos: s.pos + 1, step: 'intro', picks: {} }); scrollTo(0, 0); };
  const knowIt = () => { update(() => { cards(course)[v.id] = { known: true, step: 3, ivl: 16, due: Date.now() + 16 * DAY, last: Date.now() }; }); setS({ ...s, ok: [...s.ok, v.id], pos: s.pos + 1, step: 'intro', picks: {} }); };

  if (step === 'intro') {
    return html`<${Screen} bottom=${html`<div class="row-2"><${Button} variant="secondary" label=${t('common.iKnow')} onClick=${knowIt} /><${Button} label=${t('common.train')} onClick=${() => set({ step: 'quiz' })} /></div>`}>
      <${TopBar} onClose=${back} label=${label} total=${s.total} done=${s.pos} />
      <div class="verb-head"><div class="t-word-xl">${v.v1}</div><div class="t-translation-m muted">${L(v.tr)}</div></div>
      <${Forms} v=${v} lang=${lang} />
      ${v.ex.length > 0 && html`<div class="card card--pad card--lavender examples">${v.ex.map((ex) => html`<${Example} ex=${ex} hl=${[v.v1, v.v2, v.v3]} />`)}</div>`}
    </${Screen}>`;
  }

  const k = s.picks[2] == null ? 2 : 3;
  if (step === 'quiz') {
    const ready = s.picks[2] != null && s.picks[3] != null;
    const check = (giveUp) => {
      const r2 = !giveUp && norm(s.picks[2]) === norm(v.v2), r3 = !giveUp && norm(s.picks[3]) === norm(v.v3);
      const correct = r2 && r3;
      const first = !s.bad.includes(v.id);
      if (first) save(correct);
      const patch = { step: 'answer', picks: { ...s.picks, giveUp, r2, r3 } };
      if (!correct && first) { patch.bad = [...s.bad, v.id]; patch.queue = [...s.queue, v.id]; patch.total = s.total + 1; }
      if (correct && first) patch.ok = [...s.ok, v.id];
      setS({ ...s, ...patch });
    };
    return html`<${Screen} bottom=${html`<div class="row-2"><${Button} variant="secondary" label=${t('common.dontRemember')} onClick=${() => check(true)} /><${Button} label=${t('common.check')} disabled=${!ready} onClick=${() => check(false)} /></div>`}>
      <${TopBar} onClose=${back} label=${label} total=${s.total} done=${s.pos} />
      <div class="verb-head"><div class="t-word-xl">${v.v1}</div><div class="t-translation-m muted">${L(v.tr)}</div></div>
      <${Forms} v=${v} lang=${lang} quiz=${s.picks} active=${ready ? 0 : k} onCell=${(n) => n > 1 && set({ picks: n === 2 ? {} : { 2: s.picks[2] } })} />
      ${!ready && html`<div class="card card--pad"><${Overline}>${t('verbs.pick', { n: k })}</${Overline}>
        <div class="options">${opts[k].map((o) => html`<button class="option" onClick=${() => set({ picks: { ...s.picks, [k]: o } })}>${o}</button>`)}</div></div>`}
    </${Screen}>`;
  }

  // Ответ
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
  if (!(p.r2 && p.r3) && s.queue.indexOf(v.id) > s.pos) notes.push(t('verbs.repeatEnd', { v: v.v1 }));
  return html`<${Screen} bottom=${html`<${Button} label=${t('common.next')} onClick=${nextVerb} />`}>
    <${TopBar} onClose=${back} label=${label} total=${s.total} done=${s.pos + 1} />
    <div class="verb-head"><div class="t-word-xl">${v.v1}</div><div class="t-translation-m muted">${L(v.tr)}</div></div>
    <${Forms} v=${v} lang=${lang} result=${p} />
    <div class="card card--pad"><${Overline}>${t('verbs.remember')}</${Overline}><p class="t-body-15">${notes.join(' ')}</p></div>
  </${Screen}>`;
}

// Три формы: 1 — дана, 2 и 3 — ответ или «?»
function Forms({ v, lang, quiz, active, onCell, result }) {
  const labels = [t('verbs.present'), t('verbs.past'), t('verbs.participle')];
  return html`<div class="forms">${[1, 2, 3].map((n) => {
    const form = v['v' + n];
    if (quiz && n > 1) {
      const picked = quiz[n];
      return html`<button class=${cx('form', 'form--empty', active === n && 'form--active', picked && 'form--picked')} onClick=${() => onCell && onCell(n)}>
        <span class="t-number-s form__n">${n}</span><span class="form__text"><span class="t-word-m">${picked || '?'}</span><span class="t-label-11 muted">${labels[n - 1]}</span></span></button>`;
    }
    let state = '', sub = labels[n - 1];
    if (result && n > 1) {
      const ok = result['r' + n];
      state = ok ? 'form--right' : 'form--wrong';
      sub += ok ? ' · ' + t('verbs.right') : result[n] && !result.giveUp ? ' · ' + t('verbs.yourAnswer', { a: result[n] }) : '';
    }
    return html`<div class=${cx('form', 'card', state)}>
      <span class="t-number-s form__n">${n}</span>
      <span class="form__text"><span class="t-word-m">${form}${v.ipa[n - 1] && html` <span class="t-label-15 muted">/${v.ipa[n - 1]}/</span>`}</span><span class="t-label-11 muted">${sub}</span></span>
      <${SpeakButton} text=${form.replace(' / ', ', ')} lang=${lang} />
    </div>`;
  })}</div>`;
}

function Summary({ course, group, s, title, go, back, kind }) {
  const min = Math.max(1, Math.round((Date.now() - s.startedAt) / 60000));
  const cs = cards(course);
  const next = Math.min(...[...new Set(s.queue)].map((id) => cs[id]?.due || Infinity));
  const inDays = isFinite(next) ? Math.max(1, Math.round((next - Date.now()) / DAY)) : 2;
  const mistakes = [...new Set(s.bad)].map((id) => group.items.find((x) => x.id === id)).filter(Boolean);
  const n = new Set(s.queue).size;
  return html`<${Screen} bottom=${html`<div class="row-2"><${Button} variant="secondary" label=${t('common.again')} onClick=${() => go('verbs', { group: group.id, kind: kind || 'two' }, true)} />
      <${Button} label=${t('verbs.toGroups')} onClick=${() => go('groups')} /></div>`}>
    <div class="top-space"></div>
    <${Title} main=${t('verbs.doneTitle')} accent=${title} />
    <div class="hero"><div class="t-number-xl">${n}</div><div class="t-label-16">${t('verbs.inTraining', { v: plural(n, 'verbs') })}</div></div>
    <div class="stats"><${Stat} value=${n - mistakes.length} label=${t('verbs.firstTry')} /><${Stat} value=${mistakes.length} label=${t('verbs.withError')} /><${Stat} value=${`${min} ${t('common.min')}`} label=${t('summary.time')} /></div>
    <div class="card info-card"><span class="ib ib--accent" style="--ib:48px"><${Icon} name="bell" size=${22} /></span>
      <div><div class="t-label-16-strong">${t('verbs.nextReview', { x: interval(inDays * 86400, true) })}</div><div class="t-label-13 muted">${t('verbs.nextReviewSub')}</div></div></div>
    ${mistakes.length > 0 && html`<div class="card card--pad"><${Overline}>${t('verbs.repeatAtEnd')}</${Overline}>
      ${mistakes.map((m) => html`<div class="t-label-17">${m.v1} — ${m.v2} — ${m.v3}</div>`)}</div>`}
  </${Screen}>`;
}

function GroupScreen(props) {
  return props.route.name === 'verbs' ? html`<${Trainer} ...${props} />` : html`<${Home} ...${props} />`;
}

export default { load, stats, Screen: GroupScreen, routes: ['verbs'] };
