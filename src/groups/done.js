// Экран 19c: итог порции в группе (одинаковый для всех групп и для неправильных глаголов).
// Кольцо — сколько пройдено во всей группе, ниже слова этой порции и кнопки
// «Продовжити вчити» (следующая порция), «Повторити» (эти же слова), «Повернутися» (к списку групп).
import { html } from '../../lib/preact-htm.js';
import { t, pn } from '../i18n/index.js';
import { Screen, Button } from '../ui/kit.js';

// Кольцо прогресса: лаймовая дорожка, чёрная дуга от верха по часовой, точка на конце дуги
function Ring({ value, total, size = 240, stroke = 10 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, mid = size / 2;
  const f = total ? Math.min(1, value / total) : 0;
  const a = -Math.PI / 2 + 2 * Math.PI * f;
  return html`<div class="ring" style=${`--ring:${size}px`}>
    <svg viewBox=${`0 0 ${size} ${size}`} width=${size} height=${size} aria-hidden="true">
      <circle class="ring__track" cx=${mid} cy=${mid} r=${r} stroke-width=${stroke} fill="none" />
      <circle class="ring__bar" cx=${mid} cy=${mid} r=${r} stroke-width=${stroke} fill="none"
        stroke-dasharray=${`${c * f} ${c}`} transform=${`rotate(-90 ${mid} ${mid})`} />
      ${f > 0 && f < 1 && html`<circle class="ring__dot" cx=${mid + r * Math.cos(a)} cy=${mid + r * Math.sin(a)} r="11" />`}
    </svg>
    <div class="ring__mid"><div class="t-number-xl">${value}</div><div class="t-label-15 muted">${t('groups.ofInGroup', { n: total })}</div></div>
  </div>`;
}

// title — название группы, seen / total — пройдено в группе, words — слова этой порции, left — сколько осталось, unit — words или verbs
export function GroupDone({ title, seen, total, words, left, onMore, onRepeat, onBack, unit = 'words' }) {
  const shown = words.slice(0, 8), more = words.length - shown.length;
  return html`<${Screen} cls="screen--done" bottom=${html`<div class="done-actions">
      ${left > 0 && html`<${Button} label=${t('groups.continueLearning')} onClick=${onMore} />`}
      <${Button} variant="secondary" label=${t('groups.repeat')} onClick=${onRepeat} />
      <button class="link-btn t-title-m" onClick=${onBack}>${t('groups.back')}</button></div>`}>
    <div class="done">
      <${Ring} value=${seen} total=${total} />
      <div class="done__head"><h1 class="t-heading-h1">${t('groups.wellDone')}</h1>
        <p class="t-body-16 muted">${left > 0 ? t('groups.portionLeft', { title, x: pn(left, unit) }) : t('groups.allPassed', { title })}</p></div>
      <div class="done__words">${shown.map((w) => html`<span class="counter t-label-15">${w}</span>`)}
        ${more > 0 && html`<span class="counter counter--dark t-label-15">+${more}</span>`}</div>
    </div>
  </${Screen}>`;
}
