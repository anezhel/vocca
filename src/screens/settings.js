// Экран 10 «Налаштування». Пункты описаны списком SECTIONS: добавить, убрать или переставить пункт — одна строка.
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG, feature } from '../config.js';
import { COURSES, LEVELS } from '../content/index.js';
import { t, L, UI_NAMES } from '../i18n/index.js';
import { getState, update, progress, resetCourse } from '../core/store.js';
import { tts } from '../core/tts.js';
import { ttsLang, variantOf } from '../core/words.js';
import { Screen, Title, SettingsRow, PickSheet, Sheet, ConfirmSheet, Button } from '../ui/kit.js';
import { LevelCards, ModeCards } from './onboarding.js';

const set = (fn) => update((s) => fn(s, progress()));

// Каждый пункт: id, иконка, показывать ли (show), текст, значение и что происходит по нажатию.
const SECTIONS = [
  ['learning', [
    { id: 'uiLang', icon: 'globe', value: (s) => UI_NAMES[s.ui], pick: () => CONFIG.uiLanguages.map((c) => ({ value: c, label: UI_NAMES[c] })), get: (s) => s.ui, put: (v) => set((s) => { s.ui = v; }) },
    { id: 'course', icon: 'cards', value: (s, c) => c.name, pick: () => COURSES.map((c) => ({ value: c.id, label: c.name })), get: (s) => s.course, put: (v) => set((s) => { s.course = v; }) },
    { id: 'variant', icon: 'chat', sub: true, show: (c) => feature('englishVariant') && (c.variants || []).length > 1, value: (s, c) => L(variantOf(c).name),
      pick: (c) => c.variants.map((v) => ({ value: v.id, label: L(v.name) })), get: (s, p) => p.variant, put: (v) => set((s, p) => { p.variant = v; }) },
    { id: 'levels', icon: 'layers', value: (s, c, p) => p.levels.join(', ') || '—', sheet: 'levels' },
    { id: 'perDay', icon: 'grid', sub: true, value: (s, c, p) => p.perDay, pick: () => CONFIG.perDayOptions.map((n) => ({ value: n, label: String(n) })), get: (s, p) => p.perDay, put: (v) => set((s, p) => { p.perDay = v; }) },
    { id: 'newPerDay', icon: 'plus', sub: true, value: (s, c, p) => p.newPerDay, pick: () => CONFIG.newPerDayOptions.map((n) => ({ value: n, label: String(n) })), get: (s, p) => p.newPerDay, put: (v) => set((s, p) => { p.newPerDay = v; }) },
    { id: 'mode', icon: 'refresh', value: (s, c, p) => t('modes.' + p.mode), sheet: 'mode' },
  ]],
  ['sound', [
    { id: 'autoplay', icon: 'speaker', toggle: (s) => s.autoplay, put: (v) => set((s) => { s.autoplay = v; }) },
    { id: 'aloud', icon: 'mic', sub: true, show: () => feature('speakAloud'), toggle: (s) => s.aloud, put: (v) => set((s) => { s.aloud = v; }) },
    { id: 'reminders', icon: 'bell', show: () => feature('reminders'), soon: true },
  ]],
  ['look', [
    { id: 'theme', icon: 'sparkle', show: () => feature('themePicker') && CONFIG.themes.length > 1, value: (s) => t('settings.themes.' + s.theme),
      pick: () => CONFIG.themes.map((th) => ({ value: th, label: t('settings.themes.' + th) })), get: (s) => s.theme, put: (v) => set((s) => { s.theme = v; }) },
  ]],
  ['account', [
    { id: 'accountRow', icon: 'user', sub: 'accountSub', show: () => feature('account'), soon: true },
  ]],
  ['data', [
    { id: 'howItWorks', icon: 'info', sheet: 'how' },
  ]],
  ['about', [
    { id: 'terms', icon: 'doc', show: () => !!CONFIG.links.terms, link: 'terms' },
    { id: 'privacy', icon: 'shield', show: () => !!CONFIG.links.privacy, link: 'privacy' },
    { id: 'support', icon: 'chat', show: () => !!CONFIG.links.support, link: 'support' },
  ]],
];

export function Settings({ course, route, go }) {
  const s = getState(), p = progress(course.id);
  const [open, setOpen] = useState(route.pick || null);
  const row = (r) => {
    if (r.show && !r.show(course)) return null;
    const sub = r.sub === true ? t(`settings.${r.id}Sub`) : r.sub ? t('settings.' + r.sub) : null;
    const title = r.id === 'variant' && course.variantTitle ? L(course.variantTitle) : t('settings.' + r.id);
    if (r.toggle) return html`<${SettingsRow} icon=${r.icon} title=${title} sub=${sub} trailing="toggle" on=${r.toggle(s)} onToggle=${r.put} />`;
    if (r.soon) return html`<${SettingsRow} icon=${r.icon} title=${title} sub=${sub} trailing="soon" dim />`;
    if (r.link) return html`<${SettingsRow} icon=${r.icon} title=${title} trailing="external" onClick=${() => window.open(CONFIG.links[r.link], '_blank')} />`;
    return html`<${SettingsRow} icon=${r.icon} title=${title} sub=${sub} value=${r.value ? r.value(s, course, p) : null} onClick=${() => setOpen(r.sheet || r.id)} />`;
  };
  const picker = SECTIONS.flatMap(([, rows]) => rows).find((r) => r.id === open && r.pick);
  const close = () => setOpen(null);
  return html`<${Screen} cls="screen--tab">
    <div class="top-space"></div>
    <${Title} main=${t('settings.title')} />
    ${!tts.has(ttsLang(course)) && html`<p class="t-label-13 muted pad-x">${t('settings.noVoice', { lang: L(course.ofLang) })}</p>`}
    ${SECTIONS.map(([name, rows]) => {
      const items = rows.map(row).filter(Boolean);
      return items.length ? html`<div class="t-overline overline">${t('settings.' + name)}</div><div class="card settings-card">${items}</div>` : null;
    })}
    <button class="card danger-btn t-label-16-strong" onClick=${() => setOpen('reset')}>${t('settings.reset')}</button>
    <p class="t-label-12 muted center version">${t('settings.version', { v: CONFIG.version })}</p>

    ${picker && html`<${PickSheet} title=${t('settings.' + picker.id)} options=${picker.pick(course)} value=${picker.get(s, p)} onPick=${picker.put} onClose=${close} />`}
    ${open === 'levels' && html`<${Sheet} onClose=${close}>
      <div class="sheet__head"><div class="t-heading-h2">${t('onboarding.pickLevels')}</div><div class="t-label-14 muted">${t('onboarding.many')}</div></div>
      <${LevelCards} value=${p.levels} testLevel=${p.testLevel} onChange=${(v) => set((st, c) => { c.levels = LEVELS.filter((l) => v.includes(l)); })} />
      <${Button} label=${t('common.done')} onClick=${close} /></${Sheet}>`}
    ${open === 'mode' && html`<${Sheet} onClose=${close}>
      <div class="sheet__head"><div class="t-heading-h2">${t('settings.mode')}</div></div>
      <${ModeCards} value=${p.mode} onChange=${(m) => set((st, c) => { c.mode = m; })} />
      <${Button} label=${t('common.done')} onClick=${close} /></${Sheet}>`}
    ${open === 'how' && html`<${Sheet} onClose=${close}><div class="sheet__head"><div class="t-heading-h2">${t('settings.howTitle')}</div></div>
      <p class="t-body-16">${t(CONFIG.answerButtons === 'simple' ? 'settings.howTextSimple' : 'settings.howText')}</p><${Button} label=${t('common.gotIt')} onClick=${close} /></${Sheet}>`}
    ${open === 'reset' && html`<${ConfirmSheet} title=${t('settings.resetTitle')} text=${t('settings.resetText')} yes=${t('settings.resetYes')} no=${t('common.cancel')} danger
      onYes=${() => { resetCourse(course.id); update((st) => { st.onboarded = false; }); close(); go('welcome', {}, true); }} onNo=${close} />`}
  </${Screen}>`;
}
