// Тип группы «rule»: правило грамматики — времена и условные предложения (макеты 3.15, 3.16; 25.11.2026).
// Одна строка таблицы = один экран: карточка правила (уровень, «ЧАС» / «УМОВНЕ РЕЧЕННЯ», название, перевод),
// «Коли вживаємо», «Як утворюється» (+ / − / ?), «Слова-підказки», «Приклади», «Не плутай з …».
// Колонки описаны в начале таблиц groups/tenses-*.tsv и groups/conditionals.tsv.
// Подсчёт «вивчено», очередь и итог 3.11 — как у добірок (relation.js).
import { html } from '../../lib/preact-htm.js';
import { tri } from '../content/index.js';
import { t, L, pn } from '../i18n/index.js';
import { Overline, Example, Note, LevelTag } from '../ui/kit.js';
import relation from './relation.js';

const nl = (s) => s.replace(/¶/g, '\n');
const two = (r, base) => (r[base + '_uk'] || r[base + '_ru'] ? { uk: nl(r[base + '_uk'] || r[base + '_ru']), ru: nl(r[base + '_ru'] || r[base + '_uk']) } : null);

function load(rows) {
  const ids = new Set();
  return rows.filter((r) => r.name).map((r) => {
    let id = r.name; while (ids.has(id)) id += '+'; ids.add(id);
    return {
      id, name: r.name, lvl: r.level || '', kind: two(r, 'kind'), tr: r.uk || r.ru ? { uk: r.uk || r.ru, ru: r.ru || r.uk } : null,
      use: two(r, 'use'),
      forms: [1, 2, 3].map((i) => ({ tag: r[`f${i}_tag`] || '', f: r[`f${i}`] || '', ex: r[`f${i}_ex`] || '' })).filter((x) => x.f),
      markers: (r.markers || '').split('|').map((s) => s.trim()).filter(Boolean),
      ex: [1, 2, 3, 4].map((i) => tri(r, 'ex' + i)).filter((x) => x && x.en),
      vs: r.vs || '', note: two(r, 'note'),
    };
  });
}

// «4 правила» вместо «4 слова»
function stats(course, g) {
  const s = relation.stats(course, g);
  return s.status === 'fresh' ? { ...s, subtitle: pn(s.total, 'rules') } : s;
}

function Item({ group, item }) {
  return html`<div class="verb-stack rule">
    <div class="card word-main">
      <div class="word-main__top"><${LevelTag} lvl=${item.lvl} size="m" /><${Overline}>${L(item.kind || group.kind)}</${Overline}></div>
      <div class="t-word-xl">${item.name}</div>
      ${item.tr && html`<div class="t-translation-m">${L(item.tr)}</div>`}
    </div>
    ${item.use && html`<div class="card card--pad"><${Overline}>${t('grammar.use')}</${Overline}><${Note} text=${L(item.use)} /></div>`}
    ${item.forms.length > 0 && html`<div class="card card--pad rule-forms"><${Overline}>${t('grammar.forms')}</${Overline}>
      <div class="verb-forms verb-forms--compact rule-forms__list">${item.forms.map((x) => html`<div class="verb-form"><div class="verb-form__head">
        <span class="verb-form__tag t-label-11">${x.tag}</span>
        <div class="verb-form__text"><div class="t-word-m">${x.f}</div>${x.ex && html`<div class="t-label-14 muted">${x.ex}</div>`}</div>
      </div></div>`)}</div></div>`}
    ${item.markers.length > 0 && html`<div class="card card--pad"><${Overline}>${t('grammar.markers')}</${Overline}>
      <div class="rule-chips">${item.markers.map((m) => html`<span class="rule-chip t-label-15-medium">${m}</span>`)}</div></div>`}
    ${item.ex.length > 0 && html`<div class="card card--pad"><${Overline}>${t('grammar.examples')}</${Overline}>
      <div class="examples">${item.ex.map((ex) => html`<${Example} ex=${ex} hl=${[]} />`)}</div></div>`}
    ${item.note && html`<div class="card card--pad"><${Overline}>${item.vs ? t('grammar.vs', { x: item.vs }) : t('lesson.difference')}</${Overline}><${Note} text=${L(item.note)} /></div>`}
  </div>`;
}

export default { ...relation, load, stats, Item, unit: 'rules', knownWords: () => [] };   // у правила слов нет — «Уже знаю» просто дальше
