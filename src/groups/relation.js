// Тип группы «relation»: слово и связанные слова (синонимы, антонимы, ложные друзья, идиомы, фразовые глаголы…).
// Экраны 3.1–3.10 (раньше 11, 19–27). Одна строка таблицы = один экран. Колонки описаны в начале каждой таблицы.
import { html } from '../../lib/preact-htm.js';
import { tri } from '../content/index.js';
import { t, L, pn } from '../i18n/index.js';
import { update, progress } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { SpeakButton, Overline, Example, Note, cx, markRegExp } from '../ui/kit.js';
import { phraseForms } from '../core/forms.js';

const nl = (s) => s.replace(/¶/g, '\n');
const plain = (en) => (en || '').replace(/[[\]]/g, '').trim().toLowerCase();
const marks = (en) => [...(en || '').matchAll(/\[([^\]]+)\]/g)].map((x) => x[1]).join(' ').toLowerCase().replace(/’/g, "'");

// Уровень связанного слова (A1–C2) — для серой плашки в занятии (24.11.2026): колонка toN_level, иначе — из words.tsv
const lvlOf = (r, i, w, course) => r[`to${i}_level`] || (w && course && course.byText && (course.byText.get(w.toLowerCase()) || {}).lvl) || '';

// К какому слову строки пример (slot — номер связанного слова, −1 — само слово, undefined — не знаем): по выделенной [фразе]
// (с формами: [gave up] → give up; разорванный «[put] the milk [back]» → put back), иначе по месту — ex1 ↔ to1, или ex1 —
// само слово, ex2 ↔ to1, если примеров на один больше. Считаем по строке, до склейки строк одного слова в экран.
function rowSlots(ex, targets, word) {
  const tw = targets.map((tg) => (tg.w ? phraseForms(tg.w.toLowerCase()) : null));
  const w = (word || '').toLowerCase();
  const wf = phraseForms(w);
  const found = ex.map((e) => {
    const k = marks(e.en);
    if (!k) return { k };
    const exact = targets.findIndex((tg) => (tg.w || '').toLowerCase() === k);   // your / yours, beautiful / beautifully — сначала точное совпадение
    const slot = exact >= 0 ? exact : tw.findIndex((f) => f && f.has(k));
    return { k, slot: slot >= 0 ? slot : k === w || wf.has(k) ? -1 : undefined };   // [employed], [appeared] — форма самого слова
  });
  const taken = new Set(found.map((x) => x.slot).filter((x) => x >= 0));
  return ex.map((e, j) => {
    let { k, slot } = found[j];
    // выделено, но не узнали ([laid off] — неправильная форма lay off) — к первому слову строки, у которого ещё нет примера
    if (slot === undefined && k) { slot = targets.findIndex((tg, i) => tg.w && !taken.has(i)); if (slot < 0) slot = undefined; else taken.add(slot); }
    // выделения нет — по месту в строке: ex1 ↔ to1, или ex1 — само слово, ex2 ↔ to1, если примеров на один больше
    else if (slot === undefined) slot = ex.length === targets.length ? j : ex.length === targets.length + 1 ? j - 1 : undefined;
    return { ...e, slot };
  });
}

// Несколько строк одного слова (фразові: give up / give in и give back / away / out) — один экран со всеми
// связанными словами списком: связанные слова, примеры и пояснения строк подряд (решение дизайнера, 26.11.2026;
// раньше каждая строка таблицы была своим экраном — run: 2 экрана, get: 7). Счёт карточек — по экранам.
function load(rows, g, course) {
  const items = rows.filter((r) => r.word).map((r) => one(r, course));
  const by = new Map();
  for (const it of items) {
    const a = by.get(it.id);
    if (!a) { by.set(it.id, it); continue; }
    const off = a.targets.length; a.targets.push(...it.targets); a.ex.push(...it.ex.map((e) => (e.slot >= 0 ? { ...e, slot: e.slot + off } : e)));
    if (it.note) a.note = a.note ? { uk: a.note.uk + '\n' + it.note.uk, ru: a.note.ru + '\n' + it.note.ru } : it.note;
    a.lvl = a.lvl || it.lvl; a.ipa = a.ipa || it.ipa; a.tr = a.tr || it.tr;
  }
  return [...by.values()];
}
function one(r, course) {
  const id = r.word;
  const targets = [1, 2, 3].map((i) => ({ w: r[`to${i}`] || '', ipa: r[`to${i}_ipa`] || '', lvl: lvlOf(r, i, r[`to${i}`], course), tr: tri(r, `to${i}`) }))
    .filter((x) => x.w || (x.tr && (x.tr.uk || x.tr.ru)));
  return {
    id, w: r.word, ipa: r.ipa || '', lvl: r.level || (course && course.byText && (course.byText.get(r.word.toLowerCase()) || {}).lvl) || '', link: r.link || '',
    tr: r.uk || r.ru ? { uk: r.uk || r.ru, ru: r.ru || r.uk } : null,
    literal: r.literal_uk || r.literal_ru ? { uk: nl(r.literal_uk || r.literal_ru), ru: nl(r.literal_ru || r.literal_uk) } : null,   // «Дослівно:¶«…»» — значение с новой строки (26.11.2026)
    hint: r.hint_uk || r.hint_ru ? { uk: r.hint_uk || r.hint_ru, ru: r.hint_ru || r.hint_uk } : null,
    targets, ex: rowSlots([1, 2, 3, 4].map((i) => tri(r, 'ex' + i)).filter((x) => x && x.en), targets, r.word),   // до 4 примеров: по одному на каждое слово экрана
    // пояснение: ¶ в таблице — новая строка (каждое слово, о котором рассказываем, — с новой строки; 20.11.2026)
    note: r.note_uk || r.note_ru ? { uk: nl(r.note_uk || r.note_ru), ru: nl(r.note_ru || r.note_uk) } : null,
  };
}

const state = (course, g) => progress(course.id).groups[g.id] || { seen: {} };

// Счёт по карточкам (экранам): одна карточка = слово со связанными словами. Так же считают «Кількість слів»,
// счётчик «1 / 194» в занятии и итог 3.11 (с 19.11.2026; раньше считались связанные слова — цифры расходились).
function stats(course, g) {
  const seen = state(course, g).seen;
  const total = g.items.length;
  const learned = g.items.filter((i) => seen[i.id]).length;
  const status = !learned ? 'fresh' : learned >= total ? 'done' : 'learning';
  const subtitle = status === 'fresh' ? pn(total, 'words') : status === 'done' ? t('groups.allLearned', { n: total }) : t('groups.learnedOf', { a: learned, b: total });
  return { total, learned, due: 0, status, subtitle };
}

// Очередь на заход: сначала непросмотренные; если всё просмотрено или «Повторити» — вся добірка
function queue(course, g, review) {
  const seen = state(course, g).seen;
  const unseen = g.items.filter((i) => !seen[i.id]);
  return review || !unseen.length ? g.items : unseen;
}
function markSeen(course, g, item) {
  update(() => { const p = progress(course.id); p.groups[g.id] = p.groups[g.id] || { seen: {} }; p.groups[g.id].seen[item.id] = Date.now(); });
}
// Для кольца на 3.11: сколько экранов добірки уже пройдено
function progressOf(course, g) { const seen = state(course, g).seen; return { seen: g.items.filter((i) => seen[i.id]).length, total: g.items.length }; }

// Экран добірки (3.1–3.10): исходное слово, плашка-связка, связанные слова, «Порівняй» / «Приклади», пояснение.
// Транскрипция — строкой под словом (у ідіом её нет).
// Примеры экрана добірки (решение дизайнера, 26.11.2026; как в занятии с PR #118): первым — предложение с самим словом,
// потом по одному на каждое связанное слово, в порядке карточек. Предложение для самого слова — своё из words.tsv без
// связанных слов (sit → «Please sit here.», а не «Please sit down.»), иначе — пример добірки, где выделено само слово.
// Раньше показывались только примеры строк таблицы: у фразовых, сталих виразів — без самого слова (sit — только «Please sit down.»).
// Ідіоми (group.meaning) — все примеры как есть: там «связанные» — это значение, а не слова.
export function screenExamples(course, group, item) {
  if (group.meaning) return item.ex.map((e) => ({ e, main: false }));
  const base = (item.w || '').toLowerCase();
  const tre = markRegExp(item.targets.map((x) => x.w).filter(Boolean));
  const hasTarget = (e) => { if (!tre) return false; tre.lastIndex = 0; const hit = tre.test(plain(e.en)); tre.lastIndex = 0; return hit; };
  const own = ((course.byText && course.byText.get(base)) || {}).ex || [];
  const out = [], seen = new Set();
  const add = (e, main) => { if (e && !seen.has(plain(e.en))) { seen.add(plain(e.en)); out.push({ e, main }); } };
  add(own.find((e) => !hasTarget(e)) || item.ex.find((e) => e.slot === -1) || own[0], true);
  item.targets.forEach((tg, i) => add(item.ex.find((x) => x.slot === i && !seen.has(plain(x.en))), false));
  return out;
}

function Item({ course, group, item }) {
  const lang = ttsLang(course);
  const hl = [item.w, ...item.targets.map((x) => x.w)];
  const chip = L(group.chip, { link: item.link });
  const exs = screenExamples(course, group, item);
  // Макет 3.1 «Синоніми» (дизайнер, 26.11.2026); с того же дня — у всех добірок 3.1–3.10: тег уровня слева от слова,
  // озвучка справа — всё по верху. Тег 20 px, Label/11 Medium, текст чёрный; на белой карточке — цвет уровня, на жёлтой — белый.
  // Слово Word/L со строкой 30, до транскрипции 8; транскрипция и перевод через 4 (белая) / 2 (жёлтая), перевод 14 / 15.
  // Нет уровня — нет тега. Ідіоми (group.meaning): в жёлтой карточке значение и подсказка — без тега и озвучки.
  const Row = ({ l, w, say, ipa, tr, kind }) => html`<div class=${cx('rel__lv', kind === 'white' && 'rel__lv--accent')}>
      ${l && html`<span class="rel__lvwrap"><span class="level-tag rel__lvl" data-level=${l}>${l}</span></span>`}
      <div class="rel__lvtext"><div class="t-word-l rel__lvword">${w}</div>
        ${(ipa || tr) && html`<div class="rel__lvsub">${ipa && html`<div class="t-label-15">/${ipa}/</div>`}${tr && html`<div class=${kind === 'white' ? 't-label-15' : 't-label-14'}>${tr}</div>`}</div>`}</div>
      ${say && html`<${SpeakButton} text=${say} lang=${lang} kind=${kind} />`}</div>`;
  return html`<div class="rel rel--lv">
      <div class="rel__pair">
        <div class="card rel__base"><${Row} l=${item.lvl} w=${item.w} say=${item.w} ipa=${!group.meaning && item.ipa} tr=${L(item.literal) || L(item.tr)} kind="grey" /></div>
        ${chip && html`<div class="rel__chip t-label-12-strong">${chip}</div>`}
        <div class="rel__targets">${item.targets.map((tg) => group.meaning
          ? html`<div class="card rel__target"><${Row} w=${L(tg.tr)} tr=${L(item.hint)} kind="white" /></div>`
          : html`<div class="card rel__target"><${Row} l=${tg.lvl} w=${tg.w} say=${tg.w} ipa=${tg.ipa} tr=${L(tg.tr)} kind="white" /></div>`)}</div>
      </div>
      ${exs.length > 0 && html`<div class="card card--pad"><${Overline}>${L(group.examples)}</${Overline}>
        <div class="examples">${exs.map(({ e, main }) => html`<${Example} ex=${e} hl=${main ? [item.w] : hl} />`)}</div></div>`}
      ${item.note && html`<div class="card card--pad"><${Overline}>${L(group.note, { link: item.link })}</${Overline}><${Note} text=${L(item.note)} /></div>`}
    </div>`;
}

// «Уже знаю» на экране добірки: основное слово и связанные — в «Вивчено» (те, что есть в словаре курса)
const knownWords = (item) => [item.w, ...item.targets.map((x) => x.w)].filter(Boolean);

export default { load, stats, queue, markSeen, progressOf, Item, knownWords };
