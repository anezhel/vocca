// Компоненты Aura — по одному на компонент Figma («Aura · компоненты»). Вид задаёт CSS (src/theme/components.css), здесь только разметка.
import { html, useEffect, useState } from '../../lib/preact-htm.js';
import { ICONS } from './icons.js';
import { t, L } from '../i18n/index.js';
import { tts } from '../core/tts.js';

export { html };
export const cx = (...a) => a.filter(Boolean).join(' ');

export const Icon = ({ name, size = 20 }) =>
  html`<svg width=${size} height=${size} viewBox="0 0 24 24" fill="none" aria-hidden="true" dangerouslySetInnerHTML=${{ __html: ICONS[name] || '' }}></svg>`;

// Цветные пятна фона вверху экрана
export const Backdrop = ({ tone = 'warm' }) => html`<div class=${cx('backdrop', 'backdrop--' + tone)} aria-hidden="true"><i></i><i></i><i></i></div>`;

// Экран: прокручиваемая часть + закреплённая внизу панель с кнопкой (Bottom bar)
export const Screen = ({ children, bottom, cls, tone }) => html`<main class=${cx('screen', bottom && 'screen--bar', cls)}>
  <${Backdrop} tone=${tone} />
  <div class="screen__content">${children}</div>
  ${bottom && html`<div class="bottom-bar">${bottom}</div>`}
</main>`;

// Aura/CTA — чёрная кнопка с лаймовым кругом-стрелкой. secondary — белая. outline — контурная.
// variant: cta — чёрная со стрелкой в кружке; accent — лаймовая с иконкой в белом кружке (04: «Повторити слова, які вчу»)
export function Button({ label, onClick, variant = 'cta', disabled, icon = 'arrow-right', cls, small }) {
  const arrow = variant === 'cta' || variant === 'accent';
  return html`<button class=${cx('btn', 'btn--' + variant, small && 'btn--small', cls)} onClick=${onClick} disabled=${disabled}>
    <span class="btn__label">${label}</span>
    ${arrow && html`<span class="btn__circle"><${Icon} name=${icon} size=${22} /></span>`}
  </button>`;
}

// Aura/Icon button — Style × Size
const ICON_SIZE = { 30: 16, 32: 16, 36: 16, 40: 20, 44: 20, 48: 22, 52: 22, 56: 24 };
export const IconButton = ({ icon, kind = 'glass', size = 44, onClick, label, disabled, cls }) => html`<button
  class=${cx('ib', 'ib--' + kind, cls)} style=${`--ib:${size}px`} onClick=${onClick} aria-label=${label || icon} disabled=${disabled}>
  <${Icon} name=${icon} size=${ICON_SIZE[size] || 20} /></button>`;

export function SpeakButton({ text, lang, kind = 'grey', size = 40 }) {
  return html`<${IconButton} icon="speaker" kind=${kind} size=${size} label=${t('common.listen')}
    onClick=${(e) => { e.stopPropagation(); tts.speak(text, lang); }} />`;
}

// Aura/Level tag
export const LevelTag = ({ lvl, size }) => lvl ? html`<span class=${cx('level-tag', size && 'level-tag--' + size)} data-level=${lvl}>${lvl}</span>` : null;

// Aura/Status tag
export const StatusTag = ({ status, label }) => html`<span class=${cx('status-tag', 'status-tag--' + status)}>${label || t('words.status.' + status)}</span>`;

// Простая «таблетка» (часть речи, теги)
export const Pill = ({ children, cls, onClick }) => onClick
  ? html`<button class=${cx('pill', cls)} onClick=${onClick}>${children}</button>`
  : html`<span class=${cx('pill', cls)}>${children}</span>`;

export const Overline = ({ children }) => html`<div class="t-overline overline">${children}</div>`;

// Aura/Toggle
export const Toggle = ({ on, onChange, label }) => html`<button class=${cx('toggle', on && 'toggle--on')} role="switch" aria-checked=${on}
  aria-label=${label} onClick=${(e) => { e.stopPropagation(); onChange(!on); }}><i></i></button>`;

// Aura/Stat
export const Stat = ({ value, label }) => html`<div class="stat card"><div class="t-stat-m">${value}</div><div class="t-label-12 muted">${label}</div></div>`;

// Шаги вверху занятия: штрих на каждое слово. Больше 16 — сплошная полоса.
// solid — одна сплошная линия (экраны групп), иначе отрезки; больше 16 шагов — всегда линия
export function Steps({ total, done, solid }) {
  if (solid || total > 16) return html`<div class=${cx('steps-bar', solid && 'steps-bar--full')}><i style=${`width:${Math.round((done / Math.max(1, total)) * 100)}%`}></i></div>`;
  return html`<div class="steps">${Array.from({ length: Math.max(1, total) }, (_, i) => html`<i class=${i <= done ? 'on' : ''}></i>`)}</div>`;
}

// Верхняя панель: крестик или «назад», шаги с подписью, справа — место под иконку
// count — счётчик «4 / 8» справа; с ним прогресс рисуется сплошной линией (экраны групп 11, 19–27)
export const TopBar = ({ onClose, onBack, label, total, done, right, count }) => html`<div class="top-bar">
  ${onClose && html`<${IconButton} icon="close" onClick=${onClose} label=${t('common.close')} />`}
  ${onBack && html`<${IconButton} icon="arrow-left" size=${48} onClick=${onBack} label=${t('common.back')} />`}
  <div class="top-bar__mid">${label && html`<div class="t-label-13 muted">${label}</div>`}${total != null && html`<${Steps} total=${total} done=${done} solid=${!!count} />`}</div>
  <div class=${cx('top-bar__right', count && 'top-bar__right--auto')}>${count ? html`<${Counter}>${count}</${Counter}>` : right || ''}</div>
</div>`;

export const Counter = ({ children }) => html`<span class="counter t-label-13-medium">${children}</span>`;

// Заголовок экрана: строка + курсивная вторая строка (Heading H1 + H1 Accent)
export const Title = ({ main, accent, cls }) => html`<h1 class=${cx('title', cls)}><span class="t-heading-h1">${main}</span>${accent && html`<br /><span class="t-heading-h1-accent">${accent}</span>`}</h1>`;

// Переключатель-сегменты
export function Segmented({ options, value, onChange, cls }) {
  return html`<div class=${cx('seg', cls)} role="tablist">${options.map((o) => html`<button key=${o.value} role="tab" aria-selected=${o.value === value}
    class=${cx('seg__item', o.value === value && 'seg__item--on')} onClick=${() => onChange(o.value)}>${o.label}</button>`)}</div>`;
}

// Нижний лист (bottom sheet)
export function Sheet({ onClose, children, cls }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  return html`<div class="sheet-wrap" onClick=${onClose}>
    <div class=${cx('sheet', cls)} role="dialog" aria-modal="true" onClick=${(e) => e.stopPropagation()}><div class="sheet__grab"></div>${children}</div>
  </div>`;
}

// Модальное окно по центру экрана (например, «20 слів пройдено» в группах)
export function Modal({ onClose, children, cls }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, []);
  return html`<div class="modal-wrap" onClick=${onClose}>
    <div class=${cx('modal', cls)} role="dialog" aria-modal="true" onClick=${(e) => e.stopPropagation()}>${children}</div>
  </div>`;
}

// Лист с выбором одного варианта (настройки). confirm — подпись кнопки внизу (04p: «Показати»):
// тогда выбор применяется по кнопке, а не сразу по нажатию на строку; в шапке — крестик.
export function PickSheet({ title, sub, options, value, onPick, onClose, multi, confirm }) {
  const [sel, setSel] = useState(multi ? [...value] : value);
  const toggle = (v) => multi ? setSel(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]) : confirm ? setSel(v) : (setSel(v), onPick(v), onClose());
  return html`<${Sheet} onClose=${onClose}>
    ${confirm ? html`<div class="sheet__head sheet__head--row"><div class="t-heading-h2">${title}</div><${IconButton} icon="close" onClick=${onClose} label=${t('common.close')} /></div>`
      : html`<div class="sheet__head"><div class="t-heading-h2">${title}</div>${sub && html`<div class="t-label-14 muted">${sub}</div>`}</div>`}
    <div class="pick-list">${options.map((o) => {
      const on = multi ? sel.includes(o.value) : sel === o.value;
      return html`<button key=${o.value} class=${cx('pick', on && 'pick--on')} onClick=${() => toggle(o.value)}>
        ${o.lead}<span class="pick__text"><span class="t-title-m">${o.label}</span>${o.sub && html`<span class="t-label-13 muted">${o.sub}</span>`}</span>
        <span class=${cx('radio', multi && 'radio--box', on && 'radio--on')}>${on && html`<${Icon} name="check" size=${16} />`}</span></button>`;
    })}</div>
    ${multi && html`<${Button} label=${t('common.done')} disabled=${!sel.length} onClick=${() => { onPick(sel); onClose(); }} />`}
    ${!multi && confirm && html`<${Button} variant="dark" label=${confirm} onClick=${() => { onPick(sel); onClose(); }} />`}
  </${Sheet}>`;
}

// Подтверждение (выйти из занятия, сбросить прогресс)
export const ConfirmSheet = ({ title, text, yes, no, danger, onYes, onNo }) => html`<${Sheet} onClose=${onNo}>
  <div class="sheet__head"><div class="t-heading-h2">${title}</div>${text && html`<p class="t-body-15 muted">${text}</p>`}</div>
  <div class="row-2"><${Button} variant="secondary" label=${no} onClick=${onNo} /><${Button} variant=${danger ? 'danger' : 'dark'} label=${yes} onClick=${onYes} /></div>
</${Sheet}>`;

// Пример с выделением: «Can I [borrow] your pen?» → borrow подчёркнуто. Без скобок выделяются слова из hl.
export function Mark({ text, hl = [] }) {
  if (!text) return null;
  let parts;
  if (text.includes('[')) parts = text.split(/(\[[^\]]+\])/).map((p) => (p.startsWith('[') ? { b: p.slice(1, -1) } : p));
  else {
    const words = hl.filter(Boolean).sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!words.length) return text;
    const re = new RegExp(`\\b(${words.join('|')})\\b`, 'gi');
    parts = text.split(re).map((p, i) => (i % 2 ? { b: p } : p));
  }
  return parts.map((p) => (typeof p === 'string' ? p : html`<b class="mark">${p.b}</b>`));
}

// Пример: строка по-английски + перевод
export const Example = ({ ex, hl }) => html`<div class="example"><div class="t-body-16-medium"><${Mark} text=${ex.en} hl=${hl} /></div>
  <div class="t-label-14 muted">${L(ex)}</div></div>`;

// Aura/Nav — стеклянное нижнее меню, только иконки
const TABS = [['today', 'home'], ['words', 'cards'], ['groups', 'grid'], ['settings', 'settings']];
export const Nav = ({ active, onNav, tabs }) => html`<nav class="nav" aria-label="menu">${TABS.filter(([n]) => tabs.includes(n)).map(([name, icon]) => html`
  <button key=${name} class=${cx('nav__tab', active === name && 'nav__tab--on')} aria-label=${t('nav.' + name)} aria-current=${active === name ? 'page' : null}
    onClick=${() => active !== name && onNav(name)}><${Icon} name=${icon} size=${22} /></button>`)}</nav>`;

// Aura/Settings row
export const SettingsRow = ({ icon, title, sub, value, trailing = 'chevron', on, onToggle, onClick, dim }) => html`<button
  class=${cx('srow', dim && 'srow--dim')} onClick=${trailing === 'toggle' ? () => onToggle(!on) : onClick} disabled=${dim}>
  <span class="ib ib--glass srow__icon" style="--ib:40px"><${Icon} name=${icon} size=${20} /></span>
  <span class="srow__text"><span class="t-label-16-strong">${title}</span>${sub && html`<span class="t-label-12 muted">${sub}</span>`}</span>
  ${value != null && html`<span class="t-label-14 muted srow__value">${value}</span>`}
  ${trailing === 'chevron' && html`<span class="srow__chev"><${Icon} name="chevron-right" size=${18} /></span>`}
  ${trailing === 'external' && html`<span class="srow__chev"><${Icon} name="arrow-up-right" size=${18} /></span>`}
  ${trailing === 'toggle' && html`<${Toggle} on=${on} onChange=${onToggle} label=${title} />`}
  ${trailing === 'soon' && html`<span class="status-tag status-tag--soon">${t('common.soon')}</span>`}
</button>`;

// Aura/Word row
export const WordRow = ({ word, lvl, tr, status, statusLabel, speak, onClick }) => html`<div class="word-row card" onClick=${onClick}>
  <div class="word-row__text"><div class="word-row__head"><span class="t-label-17">${word}</span><${LevelTag} lvl=${lvl} /></div>
  <div class="t-label-14 muted">${tr}</div></div>
  ${status && html`<${StatusTag} status=${status} label=${statusLabel} />`}
  ${speak && html`<${SpeakButton} text=${speak.text} lang=${speak.lang} />`}
</div>`;

// Тост — короткое сообщение внизу
export const Toast = ({ text }) => html`<div class="toast" role="status">${text}</div>`;
