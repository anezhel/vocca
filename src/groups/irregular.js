// Тип группы «irregular»: неправильные глаголы. Экраны 12 (три уровня сложности) и 12b (карточка глагола).
// Глаголы смотрятся как остальные группы: карточка → «Далі», по CONFIG.verbSessionSize за заход, в конце — итог 19c.
// Глаголы учатся только здесь, в ежедневное занятие не попадают. Тренировку (12e, 12f) убрали 15.11.2026.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { tri } from '../content/index.js';
import { t, L, pn } from '../i18n/index.js';
import { update, progress } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { Screen, TopBar, Title, Button, Icon, SpeakButton, Overline, Example, Pill } from '../ui/kit.js';
import { GroupDone } from './done.js';

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
// Глагол пройден, когда его карточку посмотрели (есть запись; старые записи тренировки тоже считаются)
const seen = (c) => !!c;

function stats(course, g) {
  const cs = cards(course), total = g.items.length;
  const nSeen = g.items.filter((v) => seen(cs[v.id])).length;
  const status = !nSeen ? 'fresh' : nSeen >= total ? 'done' : 'learning';
  const subtitle = !nSeen ? pn(total, 'verbs') : nSeen >= total ? t('groups.allLearned', { n: total }) : t('groups.learnedOf', { a: nSeen, b: total });
  return { total, learned: nSeen, due: 0, status, subtitle, repeatRoute: 'group' };
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
      const done = list.filter((v) => seen(cs[v.id])).length;
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
  return html`<${Screen} bottom=${html`<${Button} label=${t('common.next')} onClick=${next} />`}>
    <${TopBar} onClose=${back} total=${list.length} done=${pos + 1} count=${`${pos + 1} / ${list.length}`} />
    <div class="verb-head"><${Overline}>${kindTitle}</${Overline}><div class="t-word-xl">${v.v1}</div><div class="t-translation-m muted">${L(v.tr)}</div></div>
    <${Forms} v=${v} lang=${lang} />
    ${v.ex.length > 0 && html`<div class="card card--pad card--lavender examples">${v.ex.map((ex) => html`<${Example} ex=${ex} hl=${[v.v1, v.v2, v.v3]} />`)}</div>`}
  </${Screen}>`;
}

// Три формы глагола со звуком
function Forms({ v, lang }) {
  const labels = [t('verbs.present'), t('verbs.past'), t('verbs.participle')];
  return html`<div class="forms">${[1, 2, 3].map((n) => {
    const form = v['v' + n];
    return html`<div class="form card">
      <span class="t-number-s form__n">${n}</span>
      <span class="form__text"><span class="t-word-m">${form}${v.ipa[n - 1] && html` <span class="t-label-15 muted">/${v.ipa[n - 1]}/</span>`}</span><span class="t-label-11 muted">${labels[n - 1]}</span></span>
      <${SpeakButton} text=${form.replace(' / ', ', ')} lang=${lang} />
    </div>`;
  })}</div>`;
}

function GroupScreen(props) {
  return props.route.name === 'verbs' ? html`<${VerbCards} ...${props} />` : html`<${Home} ...${props} />`;
}

export default { load, stats, Screen: GroupScreen, routes: ['verbs'] };
