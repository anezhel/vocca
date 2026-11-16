// Тест уровня: 02a (как это работает) → 02b (вопросы) → 02c (результат, лист 02d «Обери рівні»).
import { html, useState, useMemo } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { t, L } from '../i18n/index.js';
import { update, progress } from '../core/store.js';
import { ttsLang } from '../core/words.js';
import { newTest, question, answer, isOver, result } from '../core/level-test.js';
import { Screen, Title, Button, IconButton, Counter, Overline, SpeakButton, Pill, cx } from '../ui/kit.js';
import { LevelsSheet } from './onboarding.js';

export function TestIntro({ course, go, back }) {
  return html`<${Screen} tone="cool" bottom=${html`<${Button} label=${t('test.start')} onClick=${() => go('test')} />`}>
    <div class="top-bar"><${IconButton} icon="arrow-left" size=${48} onClick=${back} /><span class="top-bar__mid"></span><${Counter}>${t('onboarding.step', { n: 2 })}</${Counter}></div>
    <${Title} main=${t('test.title')} accent=${t('test.title2', { lang: L(course.ofLang) })} />
    <div class="stats">
      <div class="stat card"><div class="t-stat-m">3</div><div class="t-label-12 muted">${t('test.minutes')}</div></div>
      <div class="stat card"><div class="t-stat-m">${CONFIG.testSize}</div><div class="t-label-12 muted">${t('test.words')}</div></div>
      <div class="stat card"><div class="t-stat-m">A1–B2</div><div class="t-label-12 muted">${t('test.levels')}</div></div>
    </div>
    <div class="card card--pad"><${Overline}>${t('test.how')}</${Overline}>
      <ol class="how">${['s1', 's2', 's3'].map((k, i) => html`<li><span class="how__n t-label-13-strong">${i + 1}</span><span class="t-body-15">${t('test.' + k)}</span></li>`)}</ol></div>
    <p class="t-label-13 muted pad-x">${t('test.note')}</p>
  </${Screen}>`;
}

export function TestRun({ course, go, back }) {
  const [test] = useState(newTest);
  const [n, setN] = useState(0);
  const [picked, setPicked] = useState(null);
  const q = useMemo(() => question(course, test), [n]);
  const next = (choice) => {
    answer(test, q, choice);
    if (isOver(test)) {
      const r = result(test);
      update(() => { const p = progress(); p.testLevel = r.level; p.testScore = [r.correct, r.total]; p.levels = LEVELS.slice(0, LEVELS.indexOf(r.level) + 1); });
      go('test-result', {}, true);
    } else { setPicked(null); setN(n + 1); }
  };
  return html`<${Screen} tone="cool" bottom=${html`<div class="row-2"><${Button} variant="secondary" label=${t('common.dontKnow')} onClick=${() => next(null)} />
      <${Button} label=${t('common.next')} disabled=${picked == null} onClick=${() => next(picked)} /></div>`}>
    <div class="top-bar"><${IconButton} icon="close" onClick=${back} /><span class="top-bar__mid"><span class="t-label-13 muted">${n + 1} / ${test.size}</span>
      <div class="steps-bar"><i style=${`width:${(n / test.size) * 100}%`}></i></div></span><span class="top-bar__right"></span></div>
    <div class="card card--pad test-q">
      <${Overline}>${t('test.question')}</${Overline}>
      <div class="test-q__word"><div><div class="t-word-xl">${q.word.w}</div>${q.word.ipa && html`<div class="t-label-16 muted">/${q.word.ipa}/</div>`}</div>
        <${SpeakButton} text=${q.word.w} lang=${ttsLang(course)} /></div>
    </div>
    <div class="answers">${q.options.map((o) => html`<button class=${cx('answer card', picked === o && 'answer--on')} onClick=${() => setPicked(o)}>
      <span class="t-label-17">${o}</span></button>`)}</div>
  </${Screen}>`;
}

export function TestResult({ go, back }) {
  const p = progress();
  const lvl = p.testLevel || 'A1';
  const i = LEVELS.indexOf(lvl);
  const [sheet, setSheet] = useState(false);
  const [levels, setLevels] = useState(p.levels);
  const saveLevels = (v) => { setLevels(v); update(() => { progress().levels = LEVELS.filter((l) => v.includes(l)); }); };
  return html`<${Screen} tone="cool" bottom=${html`<div class="row-2"><${Button} variant="secondary" label=${t('common.again')} onClick=${() => go('test', {}, true)} />
      <${Button} label=${t('common.next')} disabled=${!levels.length} onClick=${() => go('mode')} /></div>`}>
    <div class="top-bar"><${IconButton} icon="arrow-left" size=${48} onClick=${back} /><span class="top-bar__mid"></span><${Counter}>${t('onboarding.step', { n: 2 })}</${Counter}></div>
    <${Title} main=${t('test.result')} accent=${t('test.byResult')} />
    <div class="hero"><div class="t-number-hero">${lvl}</div><div><div class="t-title-l">${t('levels.' + lvl)}</div>
      ${p.testScore && html`<div class="t-label-14 muted">${t('test.correct', { n: p.testScore[0], total: p.testScore[1] })}</div>`}</div></div>
    <div class="level-scale">${LEVELS.map((l, k) => html`<div class=${cx('level-scale__cell', k < i && 'is-known', k === i && 'is-yours')} data-level=${l}>
      <span class="t-label-14-strong">${l}</span><span class="t-label-11">${k < i ? t('test.know') : k === i ? t('test.yours') : ''}</span></div>`)}</div>
    <p class="t-body-15 pad-x">${i > 0 ? t('test.startFrom', { lvl, prev: LEVELS.slice(0, i).join(', ') }) : t('test.startA1')}</p>
    <div class="card chosen"><span class="t-label-14 muted">${t('test.chosen')}</span>${levels.map((l) => html`<${Pill} cls="pill--level" key=${l}>${l}</${Pill}>`)}
      <button class="link t-label-14-strong" onClick=${() => setSheet(true)}>${t('common.change')}</button></div>
    ${sheet && html`<${LevelsSheet} value=${levels} testLevel=${lvl} onApply=${saveLevels} onClose=${() => setSheet(false)}>${(draft) => {
      const hi = draft.find((l) => LEVELS.indexOf(l) > i);
      return hi && html`<p class="t-label-13 muted">${t('onboarding.above', { lvl: hi })}</p>`;
    }}</${LevelsSheet}>`}
  </${Screen}>`;
}
