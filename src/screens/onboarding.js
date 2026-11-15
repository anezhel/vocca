// Первый запуск: 01 язык интерфейса и что учим → 02 уровни → 03 режим повторения.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG, feature } from '../config.js';
import { COURSES, LEVELS } from '../content/index.js';
import { t, L, UI_NAMES, dur, num } from '../i18n/index.js';
import { getState, update, progress } from '../core/store.js';
import { Screen, Title, Button, Icon, IconButton, Counter, Segmented, cx } from '../ui/kit.js';

const Head = ({ n, onBack, brand }) => html`<div class="top-bar">
  ${brand ? html`<span class="t-brand-wordmark brand">Vocca</span>` : html`<${IconButton} icon="arrow-left" size=${48} onClick=${onBack} />`}
  <span class="top-bar__mid"></span><${Counter}>${t('onboarding.step', { n })}</${Counter}></div>`;

export function Welcome({ go }) {
  const s = getState();
  const [open, setOpen] = useState(false);
  const [course, setCourse] = useState(s.course || CONFIG.defaultCourse);
  const pickUi = (code) => { update((st) => { st.ui = code; }); setOpen(false); };
  const link = (key, label) => CONFIG.links[key] ? html`<a href=${CONFIG.links[key]} target="_blank" rel="noopener">${label}</a>` : html`<u>${label}</u>`;
  const terms = t('onboarding.terms', { terms: '\u0001', privacy: '\u0002' }).split(/([\u0001\u0002])/).map((p) =>
    p === '\u0001' ? link('terms', t('onboarding.termsLink')) : p === '\u0002' ? link('privacy', t('onboarding.privacyLink')) : p);
  return html`<${Screen} tone="cool" bottom=${html`<p class="t-label-12 muted terms">${terms}</p>
      <${Button} label=${t('common.continue')} onClick=${() => { update((st) => { st.course = course; }); go('levels'); }} />`}>
    <${Head} n=${1} brand />
    <${Title} main=${t('onboarding.hello')} accent=${t('onboarding.setup')} />
    <div class="t-overline overline">${t('onboarding.uiLang')}</div>
    <div class="dropdown">
      <button class="card dropdown__btn" onClick=${() => setOpen(!open)} aria-expanded=${open}>
        <${Icon} name="globe" size=${20} /><span class="t-label-16 grow">${UI_NAMES[s.ui]}</span><${Icon} name="chevron-down" size=${20} /></button>
      ${open && html`<div class="card dropdown__list">${CONFIG.uiLanguages.map((code) => html`<button class=${cx('dropdown__item', code === s.ui && 'is-on')} onClick=${() => pickUi(code)}>
        <span class="t-label-16 grow">${UI_NAMES[code]}</span>${code === s.ui && html`<${Icon} name="check" size=${18} />`}</button>`)}</div>`}
    </div>
    <div class="t-overline overline">${t('onboarding.course')}</div>
    <div class="course-cards">${COURSES.map((c) => html`<button class=${cx('course-card', 'card', c.id === course && 'course-card--on')} onClick=${() => setCourse(c.id)}>
      <span class=${cx('radio', c.id === course && 'radio--on')}>${c.id === course && html`<${Icon} name="check" size=${16} />`}</span>
      <span class="t-number-l">${c.code}</span><span class="t-label-16-strong">${c.name}</span>
      ${c.words && html`<span class="t-label-13">${num(Math.floor(c.words.length / 100) * 100)}+ ${t('pl.words.2')}</span>`}</button>`)}</div>
  </${Screen}>`;
}

// Карточки уровней (экран 02 и лист «Обери рівні»)
export function LevelCards({ value, onChange, testLevel }) {
  return html`<div class="level-cards">${LEVELS.map((l) => {
    const on = value.includes(l);
    return html`<button class=${cx('level-card', 'card', on && 'level-card--on')} onClick=${() => onChange(on ? value.filter((x) => x !== l) : [...value, l])}>
      <span class="t-number-m">${l}</span>
      <span class="level-card__text"><span class="t-title-l">${t('levels.' + l)}</span>
        <span class="t-label-13 muted">${testLevel === l ? t('onboarding.byTest') : t('levels.desc.' + l)}</span></span>
      <span class=${cx('radio', on && 'radio--on')}>${on && html`<${Icon} name="check" size=${16} />`}</span></button>`;
  })}</div>`;
}

export function Levels({ go, back }) {
  const p = progress();
  const [levels, setLevels] = useState(p.levels.length ? p.levels : ['A1']);
  const save = () => update(() => { progress().levels = LEVELS.filter((l) => levels.includes(l)); });
  return html`<${Screen} tone="cool" bottom=${html`<${Button} label=${t('common.continue')} disabled=${!levels.length} onClick=${() => { save(); go('mode'); }} />`}>
    <${Head} n=${2} onBack=${back} />
    <${Title} main=${t('onboarding.levelTitle')} accent=${t('onboarding.levelTitle2')} />
    <${LevelCards} value=${levels} onChange=${setLevels} testLevel=${p.testLevel} />
    ${feature('levelTest') && html`<button class="card test-card" onClick=${() => { save(); go('test-intro'); }}>
      <${Icon} name="sparkle" size=${22} /><span class="grow"><span class="t-label-16-strong">${t('onboarding.test')}</span><br />
      <span class="t-label-13 muted">${t('onboarding.testSub')}</span></span>
      <span class="ib ib--dark" style="--ib:44px"><${Icon} name="arrow-up-right" size=${20} /></span></button>`}
  </${Screen}>`;
}

export function ModeCards({ value, onChange }) {
  const fixed = CONFIG.modes.fixed.ladder.map((x) => dur(parseFloat(x) * { m: 60, h: 3600, d: 86400 }[x.slice(-1)])).join(' → ');
  const simple = CONFIG.answerButtons === 'simple';
  const first = fixed.split(' → ')[0];
  const items = [['smart', t(simple ? 'modes.smartDescSimple' : 'modes.smartDesc')], ['fixed', simple ? t('modes.fixedDescSimple', { x: first }) : fixed], ['daily', t('modes.dailyDesc')]];
  return html`<div class="mode-cards">${items.map(([m, desc]) => html`<button class=${cx('mode-card', 'card', value === m && 'mode-card--on')} onClick=${() => onChange(m)}>
    <span class="mode-card__text"><span class="t-title-m">${t('modes.' + m)} ${m === 'smart' && html`<span class="badge t-label-12-medium">${t('onboarding.recommended')}</span>`}</span>
    <span class="t-label-13 muted">${desc}</span></span>
    <span class=${cx('radio', value === m && 'radio--on')}>${value === m && html`<${Icon} name="check" size=${16} />`}</span></button>`)}</div>`;
}

export function Mode({ go, back }) {
  const p = progress();
  const [mode, setMode] = useState(p.mode);
  const [perDay, setPerDay] = useState(p.perDay);
  const start = () => { update((s) => { const c = progress(); c.mode = mode; c.perDay = perDay; s.onboarded = true; }); go('today', {}, true); };
  return html`<${Screen} tone="cool" bottom=${html`<${Button} label=${t('common.start')} onClick=${start} />`}>
    <${Head} n=${3} onBack=${back} />
    <${Title} main=${t('onboarding.modeTitle')} accent=${t('onboarding.modeTitle2')} />
    <${ModeCards} value=${mode} onChange=${setMode} />
    <div class="row-between"><span class="t-title-m">${t('onboarding.perDay')}</span><span class="t-label-12 muted">${t('onboarding.newOf', { n: p.newPerDay })}</span></div>
    <${Segmented} cls="seg--wide" value=${perDay} onChange=${setPerDay} options=${CONFIG.perDayOptions.map((n) => ({ value: n, label: n }))} />
  </${Screen}>`;
}
