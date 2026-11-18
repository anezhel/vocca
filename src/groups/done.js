// Экран 19c: итог порции в группе (одинаковый для всех групп и для неправильных глаголов).
// Кольцо — сколько пройдено во всей группе, ниже слова этой порции и кнопки
// «Продовжити вчити» (следующая порция), «Повторити» (эти же слова), «Повернутися» (к списку групп).
import { html } from '../../lib/preact-htm.js';
import { t, pn, plural } from '../i18n/index.js';
import { Screen, Button } from '../ui/kit.js';

// Кольцо прогресса: лаймовая дорожка, чёрная дуга от верха по часовой, точка на конце дуги
export function Ring({ value, total, caption, size = 240, stroke = 10, cls }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, mid = size / 2;
  const f = total ? Math.min(1, value / total) : 0;
  const a = -Math.PI / 2 + 2 * Math.PI * f;
  return html`<div class=${'ring' + (cls ? ' ' + cls : '')} style=${`--ring:${size}px`}>
    <svg viewBox=${`0 0 ${size} ${size}`} width=${size} height=${size} aria-hidden="true">
      <circle class="ring__track" cx=${mid} cy=${mid} r=${r} stroke-width=${stroke} fill="none" />
      <circle class="ring__bar" cx=${mid} cy=${mid} r=${r} stroke-width=${stroke} fill="none"
        stroke-dasharray=${`${c * f} ${c}`} transform=${`rotate(-90 ${mid} ${mid})`} />
      ${f > 0 && f < 1 && html`<circle class="ring__dot" cx=${mid + r * Math.cos(a)} cy=${mid + r * Math.sin(a)} r="11" />`}
    </svg>
    <div class="ring__mid"><div class="t-number-xl">${value}</div><div class="t-label-15 muted">${caption || t('groups.ofInGroup', { n: total })}</div></div>
  </div>`;
}

// 3.11: title — название добірки (или нескольких), seen / total — пройдено в выбранных добірках, left — сколько осталось,
// next — сколько слов в следующей порции. Кнопки: «Наступні N слів» (если осталось), «Повторити цю ж групу слів», «Закінчити».
export function GroupDone({ title, many, seen, total, left, next, onMore, onRepeat, onFinish, unit = 'words' }) {
  return html`<${Screen} cls="screen--done screen--center" tone="none" bottom=${html`<div class="done-actions">
      ${left > 0 && html`<${Button} label=${t('groups.nextN', { x: pn(next, unit) })} onClick=${onMore} />`}
      <${Button} variant="secondary" label=${t('groups.repeatSame')} onClick=${onRepeat} />
      <button class="link-btn t-title-m" onClick=${onFinish}>${t('practice.finish')}</button></div>`}>
    <div class="done">
      <${Ring} value=${seen} total=${total} />
      <div class="done__head"><h1 class="t-heading-h1">${t('groups.wellDone')}</h1>
        <p class="t-body-16 muted">${left > 0 ? t(many ? 'groups.portionLeftMany' : 'groups.portionLeft', { title, x: pn(left, unit) }) : t(many ? 'groups.allPassedMany' : 'groups.allPassed', { title })}</p></div>
    </div>
  </${Screen}>`;
}
