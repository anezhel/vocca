// Тип группы «relation»: слово и связанные слова (синонимы, антонимы, ложные друзья, идиомы, фразовые глаголы…).
// Экраны 11, 19–27. Одна строка таблицы = один экран. Колонки описаны в начале каждой таблицы.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { tri } from '../content/index.js';
import { t, L, pn } from '../i18n/index.js';
import { update, progress } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { Screen, TopBar, Title, Button, SpeakButton, Overline, Example } from '../ui/kit.js';
import { GroupDone } from './done.js';

function load(rows) {
  const ids = new Set();
  return rows.filter((r) => r.word).map((r) => {
    let id = r.word; while (ids.has(id)) id += '+'; ids.add(id);
    const targets = [1, 2, 3].map((i) => ({ w: r[`to${i}`] || '', ipa: r[`to${i}_ipa`] || '', tr: tri(r, `to${i}`) }))
      .filter((x) => x.w || (x.tr && (x.tr.uk || x.tr.ru)));
    return {
      id, w: r.word, ipa: r.ipa || '', lvl: r.level || '', link: r.link || '',
      tr: r.uk || r.ru ? { uk: r.uk || r.ru, ru: r.ru || r.uk } : null,
      literal: r.literal_uk || r.literal_ru ? { uk: r.literal_uk || r.literal_ru, ru: r.literal_ru || r.literal_uk } : null,
      hint: r.hint_uk || r.hint_ru ? { uk: r.hint_uk || r.hint_ru, ru: r.hint_ru || r.hint_uk } : null,
      targets, ex: [1, 2, 3].map((i) => tri(r, 'ex' + i)).filter((x) => x && x.en),
      note: r.note_uk || r.note_ru ? { uk: r.note_uk || r.note_ru, ru: r.note_ru || r.note_uk } : null,
    };
  });
}

const state = (course, g) => progress(course.id).groups[g.id] || { seen: {} };

// Счёт в словах: сколько слов можно выучить в группе (связанные слова или сама идиома)
const size = (g, i) => (g.meaning ? 1 : Math.max(1, i.targets.length));

function stats(course, g) {
  const seen = state(course, g).seen;
  const total = g.items.reduce((n, i) => n + size(g, i), 0);
  const learned = g.items.reduce((n, i) => n + (seen[i.id] ? size(g, i) : 0), 0);
  const status = !learned ? 'fresh' : learned >= total ? 'done' : 'learning';
  const subtitle = status === 'fresh' ? pn(total, 'words') : status === 'done' ? t('groups.allLearned', { n: total }) : t('groups.learnedOf', { a: learned, b: total });
  return { total, learned, due: 0, status, subtitle };
}

// Экран группы: по одному экрану, внизу «Далі». За заход — CONFIG.groupSessionSize экранов,
// потом экран итога 19c (done.js): «Продовжити вчити» / «Повторити» / «Повернутися».
function GroupScreen({ course, group, route, go, back, toast }) {
  const seen = state(course, group).seen;
  const N = CONFIG.groupSessionSize;
  // Очередь на этот заход: сначала непросмотренные; если всё просмотрено или «Повторити» — вся группа
  const [queue, setQueue] = useState(() => {
    const unseen = group.items.filter((i) => !seen[i.id]);
    return route.review || !unseen.length ? group.items : unseen;
  });
  const [start, setStart] = useState(0);
  const [done, setDone] = useState(false);
  const list = queue.slice(start, start + N);
  const left = Math.max(0, queue.length - start - list.length);
  const [pos, setPos] = useState(0);
  const item = list[pos];
  const lang = ttsLang(course);
  const title = L(group.title);

  const next = () => {
    update(() => { const p = progress(course.id); p.groups[group.id] = p.groups[group.id] || { seen: {} }; p.groups[group.id].seen[item.id] = Date.now(); });
    if (pos + 1 < list.length) { setPos(pos + 1); scrollTo(0, 0); } else setDone(true);
  };
  const restart = (q, s) => { setQueue(q); setStart(s); setPos(0); setDone(false); scrollTo(0, 0);
  };


  if (done) {
    const seenNow = state(course, group).seen;
    return html`<${GroupDone} title=${title} seen=${group.items.filter((i) => seenNow[i.id]).length} total=${group.items.length}
      words=${list.map((i) => i.w)} left=${left} onBack=${back}
      onMore=${() => restart(queue, start + N)} onRepeat=${() => restart(queue, start)} />`;
  }

  const hl = [item.w, ...item.targets.map((x) => x.w)];
  const chip = L(group.chip, { link: item.link });
  return html`<${Screen} bottom=${html`<${Button} label=${t('common.next')} onClick=${next} />`}>
    <${TopBar} onClose=${back} total=${list.length} done=${pos + 1} count=${`${pos + 1} / ${list.length}`} />
    <${Title} main=${title} cls="title--group" />
    <div class="rel">
      <div class="rel__pair">
      <div class="card rel__base">
        <div class="rel__text"><div class="t-word-l">${item.w}</div>
          <div class="t-label-14 muted">${L(item.literal) || L(item.tr)}</div></div>
        ${item.w && html`<${SpeakButton} text=${item.w} lang=${lang} kind="outline" />`}
      </div>
      ${chip && html`<div class="rel__chip t-label-12-strong">${chip}</div>`}
      <div class="rel__targets">${item.targets.map((tg) => html`<div class="card rel__target">
          <div class="rel__row"><div class="rel__text">
            <div class=${group.meaning ? 't-word-l' : 't-word-xl'}>${group.meaning ? L(tg.tr) : tg.w}</div>
            <div class="t-label-14 rel__sub">${group.meaning ? L(item.hint) : L(tg.tr)}</div></div>
            ${!group.meaning && html`<${SpeakButton} text=${tg.w} lang=${lang} kind="outline" />`}</div>
        </div>`)}</div>
      </div>
      ${item.ex.length > 0 && html`<div class="card card--pad"><${Overline}>${L(group.examples)}</${Overline}>
        <div class="examples">${item.ex.map((ex) => html`<${Example} ex=${ex} hl=${hl} />`)}</div></div>`}
      ${item.note && html`<div class="card card--pad"><${Overline}>${L(group.note, { link: item.link })}</${Overline}><p class="t-body-15">${L(item.note)}</p></div>`}
    </div>
  </${Screen}>`;
}



export default { load, stats, Screen: GroupScreen };
