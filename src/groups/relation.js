// Тип группы «relation»: слово и связанные слова (синонимы, антонимы, ложные друзья, идиомы, фразовые глаголы…).
// Экраны 3.1–3.10 (раньше 11, 19–27). Одна строка таблицы = один экран. Колонки описаны в начале каждой таблицы.
import { html } from '../../lib/preact-htm.js';
import { tri } from '../content/index.js';
import { t, L, pn } from '../i18n/index.js';
import { update, progress } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { SpeakButton, Overline, Example, Note } from '../ui/kit.js';

const nl = (s) => s.replace(/¶/g, '\n');

// Уровень связанного слова (A1–C2) — для серой плашки в занятии (24.11.2026): колонка toN_level, иначе — из words.tsv
const lvlOf = (r, i, w, course) => r[`to${i}_level`] || (w && course && course.byText && (course.byText.get(w.toLowerCase()) || {}).lvl) || '';

function load(rows, g, course) {
  const ids = new Set();
  return rows.filter((r) => r.word).map((r) => {
    let id = r.word; while (ids.has(id)) id += '+'; ids.add(id);
    const targets = [1, 2, 3].map((i) => ({ w: r[`to${i}`] || '', ipa: r[`to${i}_ipa`] || '', lvl: lvlOf(r, i, r[`to${i}`], course), tr: tri(r, `to${i}`) }))
      .filter((x) => x.w || (x.tr && (x.tr.uk || x.tr.ru)));
    return {
      id, w: r.word, ipa: r.ipa || '', lvl: r.level || '', link: r.link || '',
      tr: r.uk || r.ru ? { uk: r.uk || r.ru, ru: r.ru || r.uk } : null,
      literal: r.literal_uk || r.literal_ru ? { uk: r.literal_uk || r.literal_ru, ru: r.literal_ru || r.literal_uk } : null,
      hint: r.hint_uk || r.hint_ru ? { uk: r.hint_uk || r.hint_ru, ru: r.hint_ru || r.hint_uk } : null,
      targets, ex: [1, 2, 3, 4].map((i) => tri(r, 'ex' + i)).filter((x) => x && x.en),   // до 4 примеров: по одному на каждое слово экрана
      // пояснение: ¶ в таблице — новая строка (каждое слово, о котором рассказываем, — с новой строки; 20.11.2026)
      note: r.note_uk || r.note_ru ? { uk: nl(r.note_uk || r.note_ru), ru: nl(r.note_ru || r.note_uk) } : null,
    };
  });
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
function Item({ course, group, item }) {
  const lang = ttsLang(course);
  const hl = [item.w, ...item.targets.map((x) => x.w)];
  const chip = L(group.chip, { link: item.link });
  // Чип уровня над словом — пока только у синонимов (group.levels, 26.11.2026)
  const Lvl = ({ l }) => group.levels && l && html`<span class="level-tag rel__lvl" data-level=${l}>${l}</span>`;
  return html`<div class="rel">
      <div class="rel__pair">
      <div class="card rel__base">
        <div class="rel__text"><${Lvl} l=${item.lvl} /><div class="t-word-l">${item.w}</div>
          ${!group.meaning && item.ipa && html`<div class="t-label-15 muted">/${item.ipa}/</div>`}
          <div class="t-label-14 muted">${L(item.literal) || L(item.tr)}</div></div>
        ${item.w && html`<${SpeakButton} text=${item.w} lang=${lang} />`}
      </div>
      ${chip && html`<div class="rel__chip t-label-12-strong">${chip}</div>`}
      <div class="rel__targets">${item.targets.map((tg) => html`<div class="card rel__target">
          <div class="rel__row"><div class="rel__text"><${Lvl} l=${tg.lvl} />
            <div class="t-word-l">${group.meaning ? L(tg.tr) : tg.w}</div>
            ${!group.meaning && tg.ipa && html`<div class="t-label-15 rel__sub">/${tg.ipa}/</div>`}
            <div class="t-label-14 rel__sub">${group.meaning ? L(item.hint) : L(tg.tr)}</div></div>
            ${!group.meaning && html`<${SpeakButton} text=${tg.w} lang=${lang} kind="white" />`}</div>
        </div>`)}</div>
      </div>
      ${item.ex.length > 0 && html`<div class="card card--pad"><${Overline}>${L(group.examples)}</${Overline}>
        <div class="examples">${item.ex.map((ex) => html`<${Example} ex=${ex} hl=${hl} />`)}</div></div>`}
      ${item.note && html`<div class="card card--pad"><${Overline}>${L(group.note, { link: item.link })}</${Overline}><${Note} text=${L(item.note)} /></div>`}
    </div>`;
}

// «Уже знаю» на экране добірки: основное слово и связанные — в «Вивчено» (те, что есть в словаре курса)
const knownWords = (item) => [item.w, ...item.targets.map((x) => x.w)].filter(Boolean);

export default { load, stats, queue, markSeen, progressOf, Item, knownWords };
