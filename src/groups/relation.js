// Тип группы «relation»: слово и связанные слова (синонимы, антонимы, ложные друзья, идиомы, фразовые глаголы…).
// Экраны 11, 19–27. Одна строка таблицы = один экран. Колонки описаны в начале каждой таблицы.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { tri } from '../content/index.js';
import { t, L, pn } from '../i18n/index.js';
import { update, progress } from '../core/store.js';
import { addToLearning, isAdded, ttsLang, tipSeen, setTipSeen } from '../core/words.js';
import { Screen, TopBar, Title, Button, Icon, SpeakButton, Overline, Example, Sheet, cx } from '../ui/kit.js';

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

// Экран группы: по одному экрану, внизу «Далі». За заход — CONFIG.groupSessionSize экранов.
function GroupScreen({ course, group, route, go, back, toast }) {
  const seen = state(course, group).seen;
  const [list] = useState(() => {
    const unseen = group.items.filter((i) => !seen[i.id]);
    return (route.review || !unseen.length ? group.items : unseen).slice(0, CONFIG.groupSessionSize);
  });
  const [pos, setPos] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [, redraw] = useState(0);
  const item = list[pos];
  const lang = ttsLang(course);
  const title = L(group.title);

  const next = () => {
    update(() => { const p = progress(course.id); p.groups[group.id] = p.groups[group.id] || { seen: {} }; p.groups[group.id].seen[item.id] = Date.now(); });
    if (pos + 1 < list.length) { setPos(pos + 1); scrollTo(0, 0); } else { toast(t('groups.finished', { x: pn(list.length, 'screens') })); back(); }
  };

  const learn = (tg) => {
    const text = group.meaning ? item.w : tg.w;
    const ex = item.ex.find((e) => e.en.toLowerCase().includes(text.toLowerCase().split(' ')[0]));
    addToLearning(course, { w: text, ipa: group.meaning ? item.ipa : tg.ipa, lvl: item.lvl, tr: group.meaning ? tg.tr : tg.tr, ex: ex ? [ex] : [] });
    redraw((n) => n + 1);
    if (!tipSeen('added')) setSheet(text);
  };

  const hl = [item.w, ...item.targets.map((x) => x.w)];
  const chip = L(group.chip, { link: item.link });
  return html`<${Screen} bottom=${html`<${Button} label=${t('common.next')} onClick=${next} />`}>
    <${TopBar} onClose=${back} total=${list.length} done=${pos + 1} count=${`${pos + 1} / ${list.length}`} />
    <${Title} main=${title} cls="title--group" />
    <div class="rel">
      <div class="card rel__base">
        <div class="rel__text"><div class="t-word-l">${item.w}</div>
          <div class="t-label-14 muted">${L(item.literal) || L(item.tr)}</div></div>
        ${item.w && html`<${SpeakButton} text=${item.w} lang=${lang} />`}
      </div>
      ${chip && html`<div class="rel__chip t-label-12-strong">${chip}</div>`}
      ${item.targets.map((tg) => {
        const text = group.meaning ? item.w : tg.w;
        const added = isAdded(course, text);
        return html`<div class="card rel__target">
          <div class="rel__row"><div class="rel__text">
            <div class=${group.meaning ? 't-word-l' : 't-word-xl'}>${group.meaning ? L(tg.tr) : tg.w}</div>
            <div class="t-label-14 rel__sub">${group.meaning ? L(item.hint) : L(tg.tr)}</div></div>
            ${!group.meaning && html`<${SpeakButton} text=${tg.w} lang=${lang} kind="outline" />`}</div>
          <button class=${cx('rel__learn', added && 'rel__learn--on')} disabled=${added} onClick=${() => learn(tg)}>
            <${Icon} name=${added ? 'check' : 'plus'} size=${18} /><span class="t-label-16">${added ? t('common.added') : t('common.learn')}</span></button>
        </div>`;
      })}
      ${item.ex.length > 0 && html`<div class="card card--pad"><${Overline}>${L(group.examples)}</${Overline}>
        <div class="examples">${item.ex.map((ex) => html`<${Example} ex=${ex} hl=${hl} />`)}</div></div>`}
      ${item.note && html`<div class="card card--pad"><${Overline}>${L(group.note, { link: item.link })}</${Overline}><p class="t-body-15">${L(item.note)}</p></div>`}
    </div>
    ${sheet && html`<${AddedSheet} word=${sheet} onClose=${() => setSheet(null)} />`}
  </${Screen}>`;
}

// Лист 11a: «huge — у твоїх словах для вивчення»
function AddedSheet({ word, onClose }) {
  const [never, setNever] = useState(false);
  const close = () => { if (never) setTipSeen('added'); onClose(); };
  return html`<${Sheet} onClose=${close}>
    <div class="sheet__head"><div class="t-heading-h2">${t('groups.addedTitle', { w: word })}</div></div>
    <p class="t-body-15">${t('groups.addedText')}</p>
    <p class="t-body-15 muted">${t('groups.addedWhere')}</p>
    <button class="check-row" onClick=${() => setNever(!never)}><span class=${cx('radio radio--box', never && 'radio--on')}>${never && html`<${Icon} name="check" size=${16} />`}</span>
      <span class="t-label-15">${t('groups.dontShow')}</span></button>
    <${Button} variant="outline" label=${t('common.gotIt')} onClick=${close} />
  </${Sheet}>`;
}

export default { load, stats, Screen: GroupScreen };
