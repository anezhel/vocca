// Занятие «Вчити слова»: сначала повторение (07p, можно пропустить), потом 07t «Повторення готово» и новые слова (07).
// CONFIG.lessonStyle = 'cards': и новое слово, и повторение — одна карточка «Я знаю це / Вчити».
// 'recall' (прежний сценарий): 07 новое слово, 05 «Згадай англійською», 06 ответ и оценка, 06e «Що це означає?». В конце — 08 итог.
import { html, useState, useEffect, useRef } from '../../lib/preact-htm.js';
import { CONFIG, feature } from '../config.js';
import { t, L, pn, plural, interval } from '../i18n/index.js';
import { clock } from '../core/dates.js';
import { getState, progress } from '../core/store.js';
import { planToday, startLesson, learnNew, rate, finishLesson, keepLearning, extraPlan, learningIds, canSkipReviews, skipReviews, reviewBreak } from '../core/session.js';
import { ratingsFor, nextInterval, asRating } from '../core/srs.js';
import { streak, week } from '../core/stats.js';
import { wordById, shown, ipaOf, ttsLang } from '../core/words.js';
import { tts } from '../core/tts.js';
import { Screen, TopBar, Title, Button, Icon, IconButton, SpeakButton, LevelTag, Pill, Overline, Example, Mark, Sheet, ConfirmSheet, Stat, cx } from '../ui/kit.js';
import { LineChart } from './today.js';
import { ReviewDone } from '../groups/done.js';

export function Lesson({ course, route, go, back }) {
  const [lesson] = useState(() => startLesson(course, route.extra ? extraPlan(course) : planToday(course), !!route.practice));
  const [view, setView] = useState('next');
  const [, redraw] = useState(0);
  const [sheet, setSheet] = useState(null);
  const item = lesson.queue[0];
  const mode = progress(course.id).mode;

  useEffect(() => { if (!item && !lesson.finished) { lesson.finished = true; finishLesson(lesson); redraw((n) => n + 1); } }, [item]);
  if (!lesson.total) return html`<${Empty} back=${back} />`;
  if (!item) return html`<${Summary} course=${course} lesson=${lesson} go=${go} />`;

  // 07t: повторение закончено — короткая пауза перед новыми словами
  if (reviewBreak(lesson, item)) return html`<${ReviewDone} n=${lesson.stats.reviews} next=${lesson.queue.filter((x) => x.kind === 'new').length}
    onNext=${() => { lesson.breakSeen = true; redraw((n) => n + 1); scrollTo(0, 0); }} onHome=${() => { finishLesson(lesson); back(); }} />`;

  const w = wordById(course, item.id);
  if (!w) { lesson.queue.shift(); redraw((n) => n + 1); return null; }
  const show = view === 'next' ? (item.kind === 'new' ? 'new' : 'recall') : view;
  const advance = () => { lesson.queue.shift(); setView('next'); redraw((n) => n + 1); scrollTo(0, 0); };
  const exit = () => setSheet('exit');
  const bar = { onClose: exit, total: lesson.total, done: lesson.done };
  const props = { course, w, lesson, bar, item };

  let body;
  if (CONFIG.lessonStyle === 'cards') {
    // 07 и 07r: одна карточка для нового слова и для повторения
    const isNew = item.kind === 'new';
    const skip = canSkipReviews(lesson, item) ? () => { skipReviews(lesson); setView('next'); redraw((n) => n + 1); scrollTo(0, 0); } : null;
    body = html`<${NewWord} ...${props} cards=${isNew ? 'new' : 'review'} onSkip=${skip}
      onKnow=${() => { if (isNew) learnNew(course, lesson, item.id, true); else rate(course, lesson, item, 'known'); advance(); }}
      onLearn=${() => { keepLearning(course, lesson, item); advance(); }} />`;
  } else if (show === 'new') {
    body = html`<${NewWord} ...${props} count=${lesson.freshIds.length + 1} onKnow=${() => { learnNew(course, lesson, item.id, true); advance(); }}
      onLearn=${() => { learnNew(course, lesson, item.id, false); advance(); }} />`;
  } else if (show === 'recall') {
    body = html`<${Recall} ...${props} onShow=${() => setView('answer')} />`;
  } else {
    body = html`<${Answer} ...${props} mode=${mode} onExplain=${() => setSheet('explain')}
      onRate=${(r) => { rate(course, lesson, item, r); advance(); }} />`;
  }
  return html`${body}
    ${sheet === 'explain' && html`<${ExplainSheet} course=${course} w=${w} onClose=${() => setSheet(null)} />`}
    ${sheet === 'exit' && html`<${ConfirmSheet} title=${t('lesson.exitTitle')} text=${t('lesson.exitText')} yes=${t('lesson.exit')} no=${t('lesson.stay')}
      onYes=${() => { finishLesson(lesson); back(); }} onNo=${() => setSheet(null)} />`}`;
}

const Empty = ({ back }) => html`<${Screen} bottom=${html`<${Button} label=${t('common.home')} onClick=${back} />`}>
  <div class="top-space"></div><${Title} main=${t('lesson.noWords')} /><p class="t-body-16 pad-x muted">${t('lesson.noWordsText')}</p></${Screen}>`;

const counter = (lesson) => `${Math.min(lesson.done + 1, lesson.total)} / ${lesson.total}`;
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const pos = (w) => (w.pos ? t('pos.' + w.pos) : '');

// 05 · Згадай слово
function Recall({ course, w, lesson, bar, onShow }) {
  const aloud = feature('speakAloud') && getState().aloud;
  const [left, setLeft] = useState(aloud ? CONFIG.answerPause : 0);
  const [hint, setHint] = useState(false);
  const timer = useRef(0);
  const run = () => { clearInterval(timer.current); setLeft(CONFIG.answerPause); timer.current = setInterval(() => setLeft((s) => s - 1), 1000); };
  useEffect(() => { if (aloud) run(); return () => clearInterval(timer.current); }, [w.id, lesson.done, lesson.queue.length]);
  useEffect(() => { if (aloud && left <= 0) { clearInterval(timer.current); } }, [left]);
  const word = shown(course, w);
  return html`<${Screen} bottom=${html`<div class="row-hint">${feature('hint') && html`<${IconButton} icon="sparkle" size=${52} label=${t('common.hint')} onClick=${() => setHint(true)} />`}
      <${Button} label=${t('lesson.show')} onClick=${onShow} /></div>`}>
    <${TopBar} ...${bar} label=${counter(lesson)} />
    <div class="word-card word-card--recall">
      <div class="word-card__top"><span class="pill pill--glass-dark t-label-13-medium">${t('lesson.recall', { lang: L(course.inLang) })}</span><${LevelTag} lvl=${w.lvl} size="m" /></div>
      <div class="word-card__center"><div class="t-word-xl">${cap(L(w.tr))}</div><div class="t-label-15 soft">${pos(w)}</div>
        ${hint && html`<div class="t-label-15 hint">${t('lesson.firstLetter', { x: word[0] + ' ' + '_ '.repeat(Math.max(0, word.length - 1)).trim() })}</div>`}</div>
      ${aloud && html`<div class="word-card__voice">
        <div class=${cx('wave', left > 0 && 'wave--on')}>${Array.from({ length: 23 }, (_, i) => html`<i style=${`--h:${6 + ((i * 7) % 13) * 2}px`}></i>`)}</div>
        <div class="t-label-13 soft">${left > 0 ? t('lesson.sayAloud', { n: left, lang: L(course.inLang) }) : t('lesson.sayAloudGo', { lang: L(course.inLang) })}</div>
        <${IconButton} icon="mic" kind="dark" size=${56} onClick=${run} label="mic" /></div>`}
    </div>
  </${Screen}>`;
}

// 06 · Відповідь і оцінка (06f, 06d — в фиксированном режиме и раз в день)
function Answer({ course, w, lesson, bar, item, mode, onRate, onExplain }) {
  const lang = ttsLang(course);
  const word = shown(course, w);
  useEffect(() => { if (getState().autoplay) tts.speak(word, lang); }, [w.id]);
  const card = progress(course.id).cards[w.id];
  const ratings = ratingsFor(mode);
  const simple = CONFIG.answerButtons === 'simple';
  const ex = w.ex[0];
  const when = (r) => {
    if (r === 'known') return t('lesson.rate.knownSub');
    r = asRating(r);
    const sec = nextInterval(card, r, mode);
    if (mode === 'smart') return r === 'again' ? t('when.today') : interval(sec, true);
    return r === 'again' && mode === 'fixed' ? t('when.again15', { x: interval(sec).replace(/^\S+\s/, '') }) : interval(sec);
  };
  const tile = (r) => html`<button class="rate card" data-r=${r} onClick=${() => onRate(r)}>
        <span class="t-title-m">${t('lesson.rate.' + (r === 'again' && mode === 'smart' ? 'againShort' : r))}</span><span class="t-label-12 muted">${when(r)}</span></button>`;
  // 'simple': Не знаю · Забуто в ряд, «Знаю це слово» — такой же плиткой во всю ширину под ними
  const buttons = simple
    ? html`<div class="rates rates--2">${ratings.map(tile)}</div>`
    : html`${mode !== 'smart' && html`<div class="t-label-14 muted center">${t('lesson.rememberQ')}</div>`}
      <div class=${cx('rates', 'rates--' + ratings.length)}>${ratings.map(tile)}</div>`;
  return html`<${Screen} cls="screen--answer" bottom=${buttons}>
    <${TopBar} ...${bar} label=${counter(lesson)} />
    <div class="word-card">
      <div class="word-card__head"><div><div class="t-word-xl">${word.charAt(0).toUpperCase() + word.slice(1)}</div>
        ${ipaOf(course, w) && html`<div class="t-label-16 soft">/${ipaOf(course, w)}/</div>`}</div>
        <${SpeakButton} text=${word} lang=${lang} kind="dark" size=${52} /></div>
      <div class="tags"><${LevelTag} lvl=${w.lvl} size="m" />${w.pos && html`<span class="pill pill--glass-dark t-label-13">${pos(w)}</span>`}</div>
      <hr />
      <div class="t-translation-l">${cap(L(w.tr))}</div>
      ${ex && html`<div class="word-card__box"><div class="t-body-16-medium"><${Mark} text=${ex.en} hl=${[w.w]} /></div><div class="t-label-14 soft">${L(ex)}</div></div>`}
      ${feature('explanation') && html`<button class="word-card__box word-card__link" onClick=${onExplain}><${Icon} name="info" size=${20} />
        <span class="t-label-16 grow">${t('lesson.whatMeans')}</span><${Icon} name="chevron-right" size=${18} /></button>`}
    </div>
  </${Screen}>`;
}

// 07 · Нове слово / 07p · Повторення: белая карточка слова; синонимы — отдельной карточкой под ней,
// связаны чёрной плашкой «≈ синоніми». При повторении — лаймовая «Перейти до нових слів». Дальше «Приклади» и «Пояснення слова».
function NewWord({ course, w, lesson, bar, count, onKnow, onLearn, cards, onSkip }) {
  const lang = ttsLang(course);
  const word = shown(course, w);
  useEffect(() => { if (getState().autoplay) tts.speak(word, lang); }, [w.id]);
  const total = lesson.queue.filter((x) => x.kind === 'new').length + lesson.freshIds.length;
  const syn = (course.groupList.find((g) => g.id === 'synonyms')?.items || []).find((i) => i.w.toLowerCase() === w.w.toLowerCase());
  const targets = syn ? syn.targets.filter((s) => s.w) : [];
  const verb = irregularOf(course, w);
  return html`<${Screen} cls="screen--lesson" tone="lesson" bottom=${html`<div class="row-2"><${Button} variant="secondary" label=${t('common.iKnow')} onClick=${onKnow} /><${Button} label=${t('common.learn')} onClick=${onLearn} /></div>`}>
    ${cards ? html`<${TopBar} onClose=${bar.onClose} total=${bar.total} done=${bar.done + 1} count=${counter(lesson)} />`
      : html`<${TopBar} ...${bar} label=${t('lesson.newWord', { n: count, total })} />`}
    <div class="word-pair">
      <div class="card word-main">
        <div class="new-head"><div class="new-head__text">${cards && html`<${Overline}>${t(cards === 'new' ? 'lesson.cardNew' : 'lesson.cardReview')}</${Overline}>`}
          <div class="t-word-xl">${word.charAt(0).toUpperCase() + word.slice(1)}</div>
          ${ipaOf(course, w) && html`<div class="t-label-16 muted">/${ipaOf(course, w)}/</div>`}</div>
          <${SpeakButton} text=${word} lang=${lang} kind="dark" size=${40} /></div>
        <div class="tags tags--word"><${LevelTag} lvl=${w.lvl} size="m" />${w.pos && html`<span class="pill pill--tag">${pos(w)}</span>`}</div>
        <div class="t-translation-l">${cap(L(w.tr))}</div>
      </div>
      ${verb && html`<span class="word-pair__link t-label-12-medium">${t('lesson.formsLink')}</span><${VerbForms} verb=${verb} lang=${lang} />`}
      ${targets.length > 0 && html`<span class="word-pair__link t-label-12-medium">≈ ${t('lesson.synonymsLink')}</span>
        <div class="card syn-card">${targets.map((s) => html`<div class="syn-row"><div class="syn-row__text"><span class="syn-row__line"><span class="t-label-17">${s.w}</span>
          ${s.ipa && html`<span class="t-label-14 muted">/${s.ipa}/</span>`}</span>
          ${s.tr && L(s.tr) && html`<span class="t-label-14 muted">${L(s.tr)}</span>`}</div><${SpeakButton} text=${s.w} lang=${lang} /></div>`)}</div>`}
    </div>
    ${onSkip && html`<${Button} variant="accent" label=${t('lesson.skipToNew')} onClick=${onSkip} />`}
    ${w.ex.length > 0 && html`<div class="card card--lesson"><${Overline}>${t('lesson.examples')}</${Overline}>
      <div class="examples">${w.ex.map((ex) => html`<${Example} ex=${ex} hl=${[w.w]} />`)}</div></div>`}
    ${w.def && html`<div class="card card--lesson card--def"><${Overline}>${t('lesson.meaning')}</${Overline}>
      ${w.def.en && html`<p class="t-body-16-medium">${w.def.en}</p>`}<p class="t-label-14 muted">${L(w.def)}</p></div>`}
  </${Screen}>`;
}

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

// 06e · «Що це означає?»
function ExplainSheet({ course, w, onClose }) {
  const word = shown(course, w);
  return html`<${Sheet} onClose=${onClose} cls="sheet--tall">
    <div class="explain-head"><div><div class="t-word-xl">${word.charAt(0).toUpperCase() + word.slice(1)}</div>
      <div class="tags">${ipaOf(course, w) && html`<span class="t-label-15 muted">/${ipaOf(course, w)}/</span>`}<${LevelTag} lvl=${w.lvl} />${w.pos && html`<${Pill}>${pos(w)}</${Pill}>`}</div></div>
      <${SpeakButton} text=${word} lang=${ttsLang(course)} kind="dark" size=${44} /><${IconButton} icon="close" onClick=${onClose} /></div>
    ${w.def && w.def.en && html`<div class="card card--pad card--soft"><${Overline}>${t('lesson.english')}</${Overline}><p class="t-body-16">${w.def.en}</p></div>`}
    <div class="card card--pad card--soft"><${Overline}>${t('lesson.native')}</${Overline}><p class="t-body-16">${w.def ? L(w.def) : L(w.tr)}</p></div>
    ${w.ex.length > 0 && html`<div class="card card--pad card--soft"><${Overline}>${t('lesson.examples')}</${Overline}>
      <div class="examples">${w.ex.map((ex) => html`<${Example} ex=${ex} hl=${[w.w]} />`)}</div></div>`}
    ${w.note && html`<div class="note-box"><${Icon} name="info" size=${20} /><span class="t-body-14"><${Mark} text=${L(w.note)} hl=${[]} /></span></div>`}
    <${Button} variant="dark" label=${t('common.gotIt')} onClick=${onClose} />
  </${Sheet}>`;
}

// 08 · Підсумок заняття (08f, 08d — свой блок для режима)
function Summary({ course, lesson, go }) {
  const canRepeat = learningIds(course).length > 0;
  const mode = progress(course.id).mode;
  const st = streak();
  const wk = week();
  const plan = planToday(course);
  const min = Math.max(1, Math.round((lesson.sec || 60) / 60));
  const total = lesson.stats.reviews + lesson.stats.fresh;
  const today = wk.findIndex((d) => d.today);
  // 08: «На головну», под ней лаймовая «Повторити слова, які вчу» (если есть слова со статусом «Вчу»)
  return html`<${Screen} tone="lesson" bottom=${html`<div class="done-actions"><${Button} label=${t('common.home')} onClick=${() => go('today', {}, true)} />
      ${canRepeat && html`<${Button} variant="accent" icon="refresh" label=${t('today.repeatLearning')} onClick=${() => go('lesson', { practice: true }, true)} />`}</div>`}>
    <div class="top-space"></div>
    <${Title} main=${t('summary.done')} accent=${t('summary.great')} />
    <div class="hero"><div class="t-number-xl">+${total}</div><div class="t-label-16">${t('summary.reviewed', { w: plural(total, 'words') })}</div></div>
    <div class="stats"><${Stat} value=${lesson.stats.reviews} label=${t('summary.repeated')} /><${Stat} value=${lesson.stats.fresh} label=${t('summary.fresh')} />
      <${Stat} value=${`${min} ${t('common.min')}`} label=${t('summary.time')} /></div>
    ${mode === 'fixed' && plan.nextAt && html`<div class="card info-card"><span class="ib ib--accent" style="--ib:48px"><${Icon} name="clock" size=${22} /></span>
      <div><div class="t-label-16-strong">${t('summary.fixedBack', { time: clock(plan.nextAt) })}</div><div class="t-label-13 muted">${t('summary.fixedSub')}</div></div></div>`}
    ${feature('streak') && html`<div class="card streak-card"><span class="ib ib--white" style="--ib:48px"><${Icon} name="flame" size=${22} /></span>
      <div class="grow"><div class="t-label-16-strong">${t('summary.streak', { x: pn(st.days, 'days') })}</div>
      <div class="t-label-13">${t('summary.freeze', { x: pn(st.freezes, 'freezes') })}</div></div>
      <span class="pill pill--white"><${Icon} name="snow" size=${16} /> ${st.freezes}</span></div>
    <div class="card card--pad"><div class="row-between"><span class="t-title-m">${t('summary.week')}</span>
      <span class="t-label-13 muted">${t('summary.weekDays', { n: wk.filter((d) => d.count > 0).length })}</span></div>
      <${LineChart} values=${wk.map((d) => d.count)} labels=${t('week')} sel=${today} hollowFrom=${today + 1} height=${110} /></div>`}
  </${Screen}>`;
}
