// Занятие «Вчити слова» (с 18.11.2026): очередь собирается по выбору на 2.2 «Що тренуємо».
// 2.3 — новое слово («Я знаю це» / «Вчити»), 2.4 — повторение («Важко» / «Легко» / «Вивчено»), в конце 2.5 итог.
import { html, useState, useEffect } from '../../lib/preact-htm.js';
import { t, L, plural } from '../i18n/index.js';
import { getState } from '../core/store.js';
import { startLesson, answer, finishLesson, practicePrefs } from '../core/session.js';
import { wordById, shown, ipaOf, ttsLang } from '../core/words.js';
import { tts } from '../core/tts.js';
import { Screen, TopBar, Title, Button, SpeakButton, LevelTag, Overline, Example, Mark, ConfirmSheet } from '../ui/kit.js';
import { Ring } from '../groups/done.js';

export function Lesson({ course, route, go, back }) {
  const [lesson] = useState(() => startLesson(course, route.prefs || practicePrefs(course)));
  const [, redraw] = useState(0);
  const [sheet, setSheet] = useState(null);
  const item = lesson.queue[0];

  useEffect(() => { if (!item && !lesson.finished && lesson.total) { lesson.finished = true; finishLesson(lesson); redraw((n) => n + 1); } }, [item]);
  if (!lesson.total) return html`<${Empty} go=${go} />`;
  if (!item) return html`<${Summary} lesson=${lesson} go=${go} />`;

  const w = wordById(course, item.id);
  if (!w) { lesson.queue.shift(); lesson.total--; redraw((n) => n + 1); return null; }
  const onAnswer = (st) => { answer(course, lesson, item, st); lesson.queue.shift(); redraw((n) => n + 1); scrollTo(0, 0); };
  const bar = { onClose: () => (lesson.done ? setSheet('exit') : back()), total: lesson.total, done: lesson.done };
  return html`<${WordCard} key=${item.id} course=${course} w=${w} lesson=${lesson} bar=${bar} item=${item} onAnswer=${onAnswer} />
    ${sheet === 'exit' && html`<${ConfirmSheet} title=${t('lesson.exitTitle')} text=${t('lesson.exitText')} yes=${t('lesson.exit')} no=${t('lesson.stay')}
      onYes=${() => { lesson.finished = true; finishLesson(lesson); go('today', {}, true); }} onNo=${() => setSheet(null)} />`}`;
}

// Под выбор на «Що тренуємо» слов не нашлось
const Empty = ({ go }) => html`<${Screen} bottom=${html`<div class="done-actions"><${Button} label=${t('practice.change')} onClick=${() => go('practice', {}, true)} />
    <button class="link-btn t-title-m" onClick=${() => go('today', {}, true)}>${t('practice.finish')}</button></div>`}>
  <div class="top-space"></div><${Title} main=${t('lesson.noWords')} /><p class="t-body-16 muted">${t('lesson.noWordsText')}</p></${Screen}>`;

const counter = (lesson) => `${Math.min(lesson.done + 1, lesson.total)} / ${lesson.total}`;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// 2.3 · Нове слово / 2.4 · Повторення (макет 19.11.2026): серый фон с лавандовым и розовым пятнами. Белая карточка слова:
// вверху тег уровня и «НОВЕ СЛОВО» / «ПОВТОРЕННЯ», слово Word/XL, транскрипция, озвучка в обводке, перевод; часть речи не показываем.
// Если слово есть в добірках — их блоки (relatedOf ниже). Дальше «Приклади» и «Пояснення слова»; карточки через 16 px.
function WordCard({ course, w, lesson, bar, item, onAnswer }) {
  const lang = ttsLang(course);
  const word = shown(course, w);
  useEffect(() => { if (getState().autoplay) tts.speak(word, lang); }, [w.id]);
  const isNew = item.kind === 'new';
  const rel = relatedOf(course, w);
  const verb = irregularOf(course, w);
  // 2.3 новое слово: «Я знаю це» → Вивчено, «Вчити» → Важкі. 2.4 повторение: «Важко» · «Легко» · «Вивчено» (коралл · мята · чёрная)
  const bottom = isNew
    ? html`<div class="row-2"><${Button} variant="secondary" label=${t('common.iKnow')} onClick=${() => onAnswer('learned')} /><${Button} label=${t('common.learn')} onClick=${() => onAnswer('hard')} /></div>`
    : html`<div class="rate3">${[['hard', 'hard'], ['almost', 'easy'], ['learned', 'learned']].map(([st, k]) => html`<button class=${'rate3__btn rate3__btn--' + st + ' t-title-m'} onClick=${() => onAnswer(st)}>${t('lesson.mark.' + k)}</button>`)}</div>`;
  return html`<${Screen} cls="screen--lesson screen--grey" tone="today" bottom=${bottom}>
    <${TopBar} onClose=${bar.onClose} total=${bar.total} done=${bar.done + 1} count=${counter(lesson)} />
    <div class="word-pair">
      <div class="card word-main">
        <div class="word-main__top"><${LevelTag} lvl=${w.lvl} size="m" /><${Overline}>${t(isNew ? 'lesson.cardNew' : 'lesson.cardReview')}</${Overline}></div>
        <div class="new-head"><div class="new-head__text">
          <div class="t-word-xl">${word.charAt(0).toUpperCase() + word.slice(1)}</div>
          ${ipaOf(course, w) && html`<div class="t-label-16-regular muted">/${ipaOf(course, w)}/</div>`}</div>
          <${SpeakButton} text=${word} lang=${lang} kind="outline" size=${40} /></div>
        <div class="t-translation-l">${cap(L(w.tr))}</div>
      </div>
      ${verb && html`<span class="word-pair__link t-label-12-medium">${t('lesson.formsLink')}</span><${VerbForms} verb=${verb} lang=${lang} />`}
      ${rel[0] && html`<${RelCard} r=${rel[0]} lang=${lang} />`}
    </div>
    ${rel.map((r, i) => html`${i > 0 && html`<div class="word-pair word-pair--next"><${RelCard} r=${r} lang=${lang} /></div>`}<${RelMore} r=${r} />`)}
    ${w.ex.length > 0 && html`<div class="card card--lesson"><${Overline}>${t('lesson.examples')}</${Overline}>
      <div class="examples">${w.ex.map((ex) => html`<${Example} ex=${ex} hl=${[w.w]} />`)}</div></div>`}
    ${w.def && html`<div class="card card--lesson card--def"><${Overline}>${t('lesson.meaning')}</${Overline}>
      ${w.def.en && html`<p class="t-body-16-medium">${w.def.en}</p>`}<p class="t-label-14 muted">${L(w.def)}</p></div>`}
  </${Screen}>`;
}

// Слово занятия есть в добірках (19.11.2026): под карточкой слова — блок каждой добірки, как на 2.3 «≈ синоніми»:
// чёрная плашка добірки («≈ синоніми», «↔ антоніми», «≠ не плутай», «+ частка», «+ make»…) и белая карточка со словами —
// слово, транскрипция, перевод, озвучка. Сразу за ней — «Порівняй» (примеры с самим словом и связанными) и
// «У чому різниця» / «Як запам’ятати» … (пояснение из добірки). Добірки — все, кроме «Спільнокореневі» (решено так)
// и «3 форми дієслів» (у неё своя карточка выше). Несколько строк одной добірки для слова (look after, look for…) — в один блок.
const REL_ORDER = ['synonyms', 'antonyms', 'confusing', 'false-friends', 'similar', 'phrasal', 'collocations', 'pronouns', 'idioms'];
export function relatedOf(course, w) {
  const word = (w.w || '').toLowerCase();
  return REL_ORDER.map((id) => course.groupList.find((g) => g.id === id)).filter(Boolean).map((g) => {
    const items = (g.items || []).filter((i) => (i.w || '').toLowerCase() === word);
    if (!items.length) return null;
    const seen = new Set(), targets = [];
    for (const it of items) for (const tg of it.targets) {
      const key = (tg.w || (tg.tr && L(tg.tr)) || '').toLowerCase();
      if (key && !seen.has(key)) { seen.add(key); targets.push(tg); }
    }
    if (!targets.length) return null;
    return { g, link: items[0].link, targets, ex: items.flatMap((it) => it.ex).slice(0, 4), notes: items.map((it) => it.note).filter(Boolean),
      hl: [w.w, ...targets.map((x) => x.w).filter(Boolean)] };
  }).filter(Boolean);
}

const RelCard = ({ r, lang }) => html`<span class="word-pair__link t-label-12-medium">${L(r.g.chip, { link: r.link })}</span>
  <div class="card syn-card">${r.targets.map((s) => html`<div class="syn-row"><div class="syn-row__text">
    <span class="syn-row__line"><span class="t-label-17">${s.w || L(s.tr)}</span>${s.w && s.ipa && html`<span class="t-label-14 muted">/${s.ipa}/</span>`}</span>
    ${s.w && s.tr && L(s.tr) && html`<span class="t-label-14 muted">${L(s.tr)}</span>`}</div>
    ${s.w && html`<${SpeakButton} text=${s.w} lang=${lang} kind="outline" />`}</div>`)}</div>`;

// подпись примеров добірки; если она такая же, как у примеров самого слова («Приклади»), — с названием добірки
const exLabel = (r) => { const x = L(r.g.examples, { link: r.link }); return x === t('lesson.examples') ? `${x} · ${L(r.g.title)}` : x; };
const RelMore = ({ r }) => html`
  ${r.ex.length > 0 && html`<div class="card card--lesson"><${Overline}>${exLabel(r)}</${Overline}>
    <div class="examples">${r.ex.map((ex) => html`<${Example} ex=${ex} hl=${r.hl} />`)}</div></div>`}
  ${r.notes.length > 0 && html`<div class="card card--lesson card--def"><${Overline}>${L(r.g.note, { link: r.link })}</${Overline}>
    ${r.notes.map((n) => html`<p class="t-body-15">${L(n)}</p>`)}</div>`}`;

// 07v · Неправильне дієслово: карточка «3 форми дієслова» — у каждой формы транскрипция, озвучка и пример с переводом.
// Глагол берётся из группы «3 форми дієслів» (groups/irregular.tsv), если слово занятия — глагол с тем же написанием.
export function irregularOf(course, w) {
  if (w.pos !== 'verb') return null;
  const word = w.w.toLowerCase();
  return (course.groupList.find((g) => g.id === 'irregular')?.items || []).find((v) => v.v1.toLowerCase() === word) || null;
}

function VerbForms({ verb, lang }) {
  const labels = [t('verbs.present'), t('verbs.past'), t('verbs.participle')];
  return html`<div class="card forms-card">
    ${[1, 2, 3].map((n) => {
      const form = verb['v' + n];
      const ex = verb.ex[n - 1];
      return html`<div class="forms-card__row">
        <div class="forms-card__head"><div class="forms-card__text"><${Overline}>${n} · ${labels[n - 1]}</${Overline}>
          <span class="syn-row__line"><span class="t-label-17">${form}</span>${verb.ipa[n - 1] && html`<span class="t-label-14 muted">/${verb.ipa[n - 1]}/</span>`}</span></div>
          <${SpeakButton} text=${form.replace(' / ', ', ')} lang=${lang} /></div>
        ${ex && html`<div class="forms-card__ex"><div class="t-body-16-medium"><${Mark} text=${ex.en} hl=${form.split(' / ')} /></div><div class="t-label-14 muted">${L(ex)}</div></div>`}
      </div>`;
    })}
    ${verb.note && html`<p class="forms-card__note t-label-14 muted">${L(verb.note)}</p>`}
  </div>`;
}

// 2.5 · Підсумок заняття: полное лаймовое кольцо — сколько слов пройдено. «Продовжити» — ещё заход с тем же выбором,
// «Змінити налаштування» — на 2.2, «Закінчити» — на «Практика».
function Summary({ lesson, go }) {
  const n = lesson.done;
  return html`<${Screen} cls="screen--done screen--center" tone="none" bottom=${html`<div class="done-actions">
      <${Button} label=${t('common.continue')} onClick=${() => go('lesson', { prefs: lesson.prefs, n: Date.now() }, true)} />
      <${Button} variant="secondary" label=${t('practice.change')} onClick=${() => go('practice', {}, true)} />
      <button class="link-btn t-title-m" onClick=${() => go('today', {}, true)}>${t('practice.finish')}</button></div>`}>
    <div class="done">
      <${Ring} value=${n} total=${n} caption=${plural(n, 'words')} cls="ring--lime" />
      <div class="done__head"><h1 class="t-heading-h1">${t('groups.wellDone')}</h1></div>
    </div>
  </${Screen}>`;
}
