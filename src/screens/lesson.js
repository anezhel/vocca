// Занятие «Вчити слова» (с 18.11.2026): очередь собирается по выбору на 2.2 «Що тренуємо».
// 2.3 — новое слово («Пізніше» / «Знаю» / «Вчити» в один ряд), 2.4 — повторение («Важко» / «Легко» / «Вивчено»), в конце 2.5 итог.
// Свайп вправо — предыдущая карточка (и с итога 2.5 — последняя), влево — обратно вперёд. На пройденной карточке выбранный
// ответ ярче, остальные бледнее; другой ответ меняет статус слова (reanswer) и ведёт к следующей карточке.
import { html, useState, useEffect } from '../../lib/preact-htm.js';
import { t, L, plural } from '../i18n/index.js';
import { getState } from '../core/store.js';
import { startLesson, answer, reanswer, finishLesson, practicePrefs } from '../core/session.js';
import { wordById, shown, ipaOf, ttsLang } from '../core/words.js';
import { tts } from '../core/tts.js';
import { Screen, TopBar, Title, Button, SpeakButton, LevelTag, Overline, Example, Mark, ConfirmSheet, useSwipe, enterCls, cx, Icon } from '../ui/kit.js';
import { Ring } from '../groups/done.js';
import { VerbCard } from '../groups/irregular.js';

export function Lesson({ course, route, go, back }) {
  const [lesson] = useState(() => startLesson(course, route.prefs || practicePrefs(course)));
  const [, redraw] = useState(0);
  const [sheet, setSheet] = useState(null);
  const [view, setView] = useState(null);     // индекс в lesson.history — смотрим пройденную карточку; null — текущая
  const [enter, setEnter] = useState(null);   // откуда въезжает карточка после свайпа
  const item = lesson.queue[0];
  const hist = lesson.history;
  const show = (i, dir) => { setView(i); setEnter(dir); scrollTo(0, 0); };
  const at = view == null ? hist.length : view;
  useSwipe(at > 0 && !sheet ? () => show(at - 1, 'left') : null,
    view != null && !sheet ? () => show(view + 1 < hist.length ? view + 1 : null, 'right') : null);

  useEffect(() => { if (!item && !lesson.finished && lesson.total) { lesson.finished = true; finishLesson(lesson); redraw((n) => n + 1); } }, [item]);
  if (!lesson.total) return html`<${Empty} go=${go} />`;
  const bar = { onClose: () => (lesson.done ? setSheet('exit') : back()), total: lesson.total };
  const exit = sheet === 'exit' && html`<${ConfirmSheet} title=${t('lesson.exitTitle')} text=${t('lesson.exitText')} yes=${t('lesson.exit')} no=${t('lesson.stay')}
      onYes=${() => { lesson.finished = true; finishLesson(lesson); go('today', {}, true); }} onNo=${() => setSheet(null)} />`;

  // Пройденная карточка: тот же вид, выбранный ответ ярче; другой ответ меняет статус, дальше — следующая карточка
  if (view != null) {
    const e = hist[view];
    const w = wordById(course, e.item.id);
    const onAnswer = (st) => { reanswer(course, lesson, e, st); show(view + 1 < hist.length ? view + 1 : null, null); };
    return html`<${WordCard} key=${'h' + view} course=${course} w=${w} lesson=${lesson} bar=${{ ...bar, done: view, count: `${view + 1} / ${lesson.total}` }}
      item=${e.item} chosen=${e.st} enter=${enter} onAnswer=${onAnswer}
      onPrev=${view > 0 ? () => show(view - 1, 'left') : null} onNext=${() => show(view + 1 < hist.length ? view + 1 : null, 'right')} />${exit}`;
  }
  if (!item) return html`<${Summary} lesson=${lesson} go=${go} enter=${enter} />`;

  const w = wordById(course, item.id);
  if (!w) { lesson.queue.shift(); lesson.total--; redraw((n) => n + 1); return null; }
  const onAnswer = (st, dir = null) => { answer(course, lesson, item, st); lesson.queue.shift(); setEnter(dir); redraw((n) => n + 1); scrollTo(0, 0); };
  // › на новой карточке — дальше без ответа: слово остаётся новым («Пізніше»), ‹ — к предыдущей карточке
  return html`<${WordCard} key=${item.id} course=${course} w=${w} lesson=${lesson} bar=${{ ...bar, done: lesson.done }} item=${item} enter=${enter} onAnswer=${onAnswer}
    onPrev=${hist.length ? () => show(hist.length - 1, 'left') : null} onNext=${() => onAnswer('skip', 'right')} />
    ${exit}`;
}

// Под выбор на «Що тренуємо» слов не нашлось
const Empty = ({ go }) => html`<${Screen} bottom=${html`<div class="done-actions"><${Button} label=${t('practice.change')} onClick=${() => go('practice', {}, true)} />
    <button class="link-btn t-title-m" onClick=${() => go('today', {}, true)}>${t('practice.finish')}</button></div>`}>
  <div class="top-space"></div><${Title} main=${t('lesson.noWords')} /><p class="t-body-16 muted">${t('lesson.noWordsText')}</p></${Screen}>`;

const counter = (lesson) => `${Math.min(lesson.done + 1, lesson.total)} / ${lesson.total}`;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// 2.3 · Нове слово / 2.4 · Повторення (макет 19.11.2026): серый фон с лавандовым и розовым пятнами. Белая карточка слова:
// вверху тег уровня и «НОВЕ СЛОВО» / «ПОВТОРЕННЯ», слово Word/XL, транскрипция, озвучка в обводке, перевод; часть речи не показываем.
// Если слово есть в добірках — их карточки сразу под словом (relatedOf ниже). Дальше «Приклади» и «Пояснення слова»,
// в конце — «Порівняй» и «У чому різниця» из добірок; карточки через 16 px.
function WordCard({ course, w, lesson, bar, item, chosen, enter, onAnswer, onPrev, onNext }) {
  const lang = ttsLang(course);
  const word = shown(course, w);
  useEffect(() => { if (getState().autoplay) tts.speak(word, lang); }, [w.id]);
  const isNew = item.kind === 'new';
  const rel = relatedOf(course, w);
  const verb = irregularOf(course, w);
  // 2.3 новое слово (макет 20.11.2026): ‹ · «Знаю» · «Вчити» · › — стрелки листают слова назад и вперёд (› на новой карточке —
  // дальше без ответа, слово остаётся новым, как раньше «Пізніше»), «Знаю» → Вивчено, «Вчити» (чёрная) → Важкі.
  // 2.4 повторение: «Важко» · «Легко» · «Вивчено» (коралл · мята · чёрная)
  // chosen — карточка уже пройдена (вернулись свайпом): выбранный тогда ответ как обычно, остальные бледнее (is-other)
  const other = (st) => chosen && chosen !== st && 'is-other';
  const bottom = isNew
    ? html`<div class="row-arrows">
        <button class="nav-arrow" disabled=${!onPrev} onClick=${onPrev} aria-label=${t('lesson.prevWord')}><${Icon} name="chevron-left" size=${22} /></button>
        <${Button} variant="secondary" cls=${other('learned')} label=${t('common.iKnow')} onClick=${() => onAnswer('learned')} />
        <${Button} variant="dark" cls=${other('hard')} label=${t('common.learn')} onClick=${() => onAnswer('hard')} />
        <button class="nav-arrow" onClick=${onNext} aria-label=${t('lesson.nextWord')}><${Icon} name="chevron-right" size=${22} /></button></div>`
    : html`<div class="rate3">${[['hard', 'hard'], ['almost', 'easy'], ['learned', 'learned']].map(([st, k]) => html`<button class=${cx('rate3__btn rate3__btn--' + st + ' t-title-m', other(st))} onClick=${() => onAnswer(st)}>${t('lesson.mark.' + k)}</button>`)}</div>`;
  return html`<${Screen} cls=${cx('screen--lesson screen--grey', enterCls(enter))} tone="today" bottom=${bottom}>
    <${TopBar} onClose=${bar.onClose} total=${bar.total} done=${bar.done + 1} count=${bar.count || counter(lesson)} />
    <div class="word-pair">
      <div class="card word-main">
        <div class="word-main__top"><${LevelTag} lvl=${w.lvl} size="m" /><${Overline}>${t(isNew ? 'lesson.cardNew' : 'lesson.cardReview')}</${Overline}></div>
        <div class="new-head"><div class="new-head__text">
          <div class="t-word-xl">${word.charAt(0).toUpperCase() + word.slice(1)}</div>
          ${ipaOf(course, w) && html`<div class="t-label-16-regular muted">/${ipaOf(course, w)}/</div>`}</div>
          <${SpeakButton} text=${word} lang=${lang} kind="outline" size=${40} /></div>
        <div class="t-translation-l">${cap(L(w.tr))}</div>
      </div>
      ${verb && html`<span class="word-pair__link t-label-12-medium">${t('lesson.formsLink')}</span><${VerbCard} v=${verb} lang=${lang} noTr />`}
      ${rel.map((r) => html`<${RelCard} r=${r} lang=${lang} />`)}
    </div>
    ${!verb && w.ex.length > 0 && html`<div class="card card--lesson"><${Overline}>${t('lesson.examples')}</${Overline}>
      <div class="examples">${w.ex.map((ex) => html`<${Example} ex=${ex} hl=${[w.w]} />`)}</div></div>`}
    ${w.def && html`<div class="card card--lesson card--def"><${Overline}>${t('lesson.meaning')}</${Overline}>
      ${w.def.en && html`<p class="t-body-16-medium">${w.def.en}</p>`}<p class="t-label-14 muted">${L(w.def)}</p></div>`}
    ${rel.length > 0 && html`<${RelMore} rel=${rel} w=${w} />`}
  </${Screen}>`;
}

// Слово занятия есть в добірках (19.11.2026, порядок — по макету 2.3a): сразу под карточкой слова — карточки всех его добірок,
// как на 2.3 «≈ синоніми»: чёрная плашка («≈ синоніми», «↔ антоніми», «≠ не плутай», «+ частка», «+ make»…) и белая карточка
// со словами — слово, транскрипция, перевод, озвучка. Потом «Приклади» и «Пояснення слова» самого слова, а в самом низу —
// общие «Порівняй» (примеры из добірок) и «У чому різниця» (пояснения из добірок), см. RelMore. Добірки — все, кроме «Спільнокореневі» (решено так)
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

// «Порівняй» и «У чому різниця» — по одной карточке на все добірки слова, в самом низу (макет 2.3a, 19.11.2026).
// Примеры всех добірок подряд; пример только с самим словом («They live in a big house», «This is a big box») — один раз.
// Подписи: одна добірка — её собственные («Як запам’ятати», «Чому саме make»…; «Приклади» — с названием добірки,
// чтобы не путать с примерами слова), несколько добірок — общие «Порівняй» и «У чому різниця».
const marked = (en) => { const m = /\[([^\]]+)\]/.exec(en || ''); return m ? m[1].toLowerCase() : ''; };
function RelMore({ rel, w }) {
  const base = (w.w || '').toLowerCase();
  let baseShown = false;
  const ex = [];
  for (const r of rel) for (const e of r.ex) {
    if (marked(e.en) === base) { if (baseShown) continue; baseShown = true; }
    ex.push(e);
  }
  const hl = [w.w, ...rel.flatMap((r) => r.targets.map((x) => x.w).filter(Boolean))];
  const notes = rel.flatMap((r) => r.notes);
  const one = rel.length === 1 ? rel[0] : null;
  const exTitle = one ? (() => { const x = L(one.g.examples, { link: one.link }); return x === t('lesson.examples') ? `${x} · ${L(one.g.title)}` : x; })() : t('lesson.compare');
  const noteTitle = one ? L(one.g.note, { link: one.link }) : t('lesson.difference');
  return html`
    ${ex.length > 0 && html`<div class="card card--lesson"><${Overline}>${exTitle}</${Overline}>
      <div class="examples">${ex.map((e) => html`<${Example} ex=${e} hl=${hl} />`)}</div></div>`}
    ${notes.length > 0 && html`<div class="card card--lesson card--def"><${Overline}>${noteTitle}</${Overline}>
      ${notes.map((n) => html`<p class="t-body-15">${L(n)}</p>`)}</div>`}`;
}

// 2.3b · Новое слово — неправильный глагол (макет 20.11.2026): под карточкой слова чип «3 форми дієслова» и три карточки V1–V3,
// как на 3.13 (VerbCard из groups/irregular.js), но без перевода у V1 — он в карточке слова. «Приклади» самого слова не показываем:
// примеры есть у каждой формы. Карточки других добірок слова, «Пояснення слова», «Порівняй» / «У чому різниця» — как обычно.
// Глагол берётся из группы «3 форми дієслів» (groups/irregular.tsv), если слово занятия — глагол с тем же написанием.
export function irregularOf(course, w) {
  if (w.pos !== 'verb') return null;
  const word = w.w.toLowerCase();
  return (course.groupList.find((g) => g.id === 'irregular')?.items || []).find((v) => v.v1.toLowerCase() === word) || null;
}

// 2.5 · Підсумок заняття: полное лаймовое кольцо — сколько слов пройдено. «Продовжити» — ещё заход с тем же выбором,
// «Змінити налаштування» — на 2.2, «Закінчити» — на «Практика».
function Summary({ lesson, go, enter }) {
  const n = lesson.done - lesson.stats.skipped;   // пропущенные слова в итог не идут
  return html`<${Screen} cls=${cx('screen--done screen--center', enterCls(enter))} tone="none" bottom=${html`<div class="done-actions">
      <${Button} label=${t('common.continue')} onClick=${() => go('lesson', { prefs: lesson.prefs, n: Date.now() }, true)} />
      <${Button} variant="secondary" label=${t('practice.change')} onClick=${() => go('practice', {}, true)} />
      <button class="link-btn t-title-m" onClick=${() => go('today', {}, true)}>${t('practice.finish')}</button></div>`}>
    <div class="done">
      <${Ring} value=${n} total=${n} caption=${plural(n, 'words')} cls="ring--lime" />
      <div class="done__head"><h1 class="t-heading-h1">${t('groups.wellDone')}</h1></div>
    </div>
  </${Screen}>`;
}
