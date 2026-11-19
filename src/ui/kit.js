// Компоненты Aura — по одному на компонент Figma («Aura · компоненты»). Вид задаёт CSS (src/theme/components.css), здесь только разметка.
import { html, useEffect, useLayoutEffect, useState, useRef } from '../../lib/preact-htm.js';
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

// Свайп по карточкам (с 19.11.2026, плавнее — 19.11.2026): вправо — предыдущая карточка, влево — следующая (только уже
// просмотренная). Карточки (всё, кроме верхней строки) идут за пальцем 1 : 1; если листать некуда — тянутся с сопротивлением.
// Отпустили дальше 20 % ширины экрана или быстрым движением — карточка уезжает за край, а новая въезжает с другой стороны
// (enterCls ниже); иначе — мягко возвращается. Пока свайп горизонтальный, страница не прокручивается по вертикали.
// В браузере свайп от самого края не ловим — там жест «назад» Safari; в приложении на экране «Домой» — ловим и от края.
// На компьютере — стрелки ← / →. onPrev / onNext = null — в эту сторону листать нельзя.
export function useSwipe(onPrev, onNext) {
  const cb = useRef({});
  cb.current = { onPrev, onNext };
  useEffect(() => {
    const app = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const edge = app ? 0 : 16;
    let s = null, raf = 0, busy = false;
    const content = () => document.querySelector('.screen__content');
    // сдвиг карточек: --swipe (px) и --swipe-o (прозрачность); mode: '' — за пальцем, 'back' — вернуться, 'out' — уехать
    const set = (x, mode = '') => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const c = content(); if (!c) return;
        c.classList.toggle('is-dragging', mode === '');
        c.classList.toggle('is-settling', mode === 'back');
        c.classList.toggle('is-leaving', mode === 'out');
        c.style.setProperty('--swipe', x + 'px');
        c.style.setProperty('--swipe-o', String(1 - Math.min(0.5, Math.abs(x) / innerWidth / 1.6)));
      });
    };
    const clear = () => { const c = content(); if (c) { c.classList.remove('is-dragging', 'is-settling', 'is-leaving'); c.style.removeProperty('--swipe'); c.style.removeProperty('--swipe-o'); } };
    const start = (e) => {
      s = null;
      if (busy || e.touches.length !== 1) return;
      const p = e.touches[0];
      if (p.clientX < edge || p.clientX > innerWidth - edge || e.target.closest('.bottom-bar, .sheet, input, textarea, [data-noswipe]')) return;
      s = { x: p.clientX, y: p.clientY, dir: null, dx: 0, pts: [[p.clientX, e.timeStamp]] };
    };
    const move = (e) => {
      if (!s) return;
      const p = e.touches[0], dx = p.clientX - s.x, dy = p.clientY - s.y;
      if (!s.dir) { if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return; s.dir = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v'; }
      if (s.dir !== 'h') return;
      if (e.cancelable) e.preventDefault();          // горизонтальный свайп — страницу не прокручиваем
      s.dx = dx;
      s.pts.push([p.clientX, e.timeStamp]); if (s.pts.length > 5) s.pts.shift();
      const can = dx > 0 ? cb.current.onPrev : cb.current.onNext;
      set(can ? dx : dx / (3 + Math.abs(dx) / 40));   // некуда листать — резинка
    };
    const end = (e) => {
      if (!s) return;
      const { dx, dir, pts } = s; s = null;
      if (dir !== 'h') return;
      const [x0, t0] = pts[0], [x1, t1] = pts[pts.length - 1];
      const v = t1 > t0 ? (x1 - x0) / (t1 - t0) : 0;  // px/мс за последние движения
      const go = dx > 0 ? cb.current.onPrev : cb.current.onNext;
      const far = Math.abs(dx) > innerWidth * 0.2, flick = Math.abs(dx) > 24 && Math.abs(v) > 0.3 && Math.sign(v) === Math.sign(dx);
      if (go && (far || flick)) {
        busy = true;
        set(Math.sign(dx) * innerWidth, 'out');
        setTimeout(() => { busy = false; go(); clear(); }, 170);
      } else {
        set(0, 'back');
        setTimeout(() => { if (!s && !busy) clear(); }, 260);
      }
    };
    const key = (e) => {
      if (busy || (e.target.closest && e.target.closest('input, textarea'))) return;
      const go = e.key === 'ArrowLeft' ? cb.current.onPrev : e.key === 'ArrowRight' ? cb.current.onNext : null;
      if (go) { e.preventDefault(); go(); }
    };
    const opts = { passive: false };
    addEventListener('touchstart', start, { passive: true });
    addEventListener('touchmove', move, opts);
    addEventListener('touchend', end);
    addEventListener('touchcancel', end);
    addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(raf); clear();
      removeEventListener('touchstart', start); removeEventListener('touchmove', move, opts);
      removeEventListener('touchend', end); removeEventListener('touchcancel', end); removeEventListener('keydown', key);
    };
  }, []);
}
// Класс экрана для въезда карточки после свайпа: 'left' — предыдущая (въезжает слева), 'right' — следующая
export const enterCls = (dir) => dir && 'screen--from-' + dir;

// Aura/CTA — чёрная кнопка с лаймовым кругом-стрелкой. secondary — белая. outline — контурная.
// variant: cta — чёрная со стрелкой в кружке (шаг вперёд); dark — чёрная без стрелки (Aura/Button primary: «Застосувати», «Зрозуміло» в листах); accent — лаймовая с иконкой в белом кружке (04: «Повторити слова, які вчу»)
// spring — пружинка при нажатии, как у пузырька меню (useSpringPress ниже); переход — после отскока
export function Button({ label, onClick, variant = 'cta', disabled, icon = 'arrow-right', cls, small, spring }) {
  const arrow = variant === 'cta' || variant === 'accent';
  const [ref, click] = useSpringPress(spring, onClick);
  return html`<button ref=${ref} class=${cx('btn', 'btn--' + variant, small && 'btn--small', spring && 'btn--spring', cls)} onClick=${click} disabled=${disabled}>
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
// у самого h1 тот же стиль, что у строк: иначе высота строки браузера по умолчанию раздвигает их (Figma: 34 / 34)
export const Title = ({ main, accent, cls }) => html`<h1 class=${cx('title t-heading-h1', cls)}><span class="t-heading-h1">${main}</span>${accent && html`<br /><span class="t-heading-h1-accent">${accent}</span>`}</h1>`;

// Переключатель-сегменты
// Пружинка как у пузырька нижнего меню: жёсткость 420, затухание 0,62 — переезжает с лёгким перелётом.
export const SPRING = { k: 420, zeta: 0.62 };

// Пружинка при нажатии на кнопку — в духе пузырька меню: палец вниз — кнопка быстро чуть сжимается (до 0,95),
// отпустил — возвращается на той же пружине (420 / 0,62) с лёгким перелётом (~1,02). Действие кнопки выполняется через
// PRESS_DELAY мс — в момент отскока, иначе экран сменится раньше, чем пружинку видно. С клавиатуры — тот же отскок.
// Если в системе «Уменьшить движение» — без анимации и без задержки.
const PRESS_DELAY = 180;
function useSpringPress(on, onClick) {
  const ref = useRef(null), st = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!on || !el) return undefined;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const s = (st.current = { x: 1, v: 0, target: 1, pressed: false, raf: 0, last: 0, reduce, busy: false });
    const draw = () => { el.style.transform = Math.abs(s.x - 1) < 0.0005 ? '' : `scale(${s.x.toFixed(4)})`; };
    const step = (time) => {
      const dt = Math.min(0.032, (time - (s.last || time)) / 1000); s.last = time;
      const k = s.pressed ? 900 : SPRING.k, c = 2 * Math.sqrt(k) * (s.pressed ? 0.95 : SPRING.zeta);
      s.v += (k * (s.target - s.x) - c * s.v) * dt; s.x += s.v * dt; draw();
      if (s.pressed || Math.abs(s.v) > 0.002 || Math.abs(s.target - s.x) > 0.0005) s.raf = requestAnimationFrame(step);
      else { s.x = s.target; s.v = 0; s.raf = 0; s.last = 0; draw(); }
    };
    s.kick = () => { if (!s.raf) { s.last = 0; s.raf = requestAnimationFrame(step); } };
    const down = (e) => { if (reduce || e.button > 0 || el.disabled) return; s.pressed = true; s.target = 0.95; s.kick(); };
    // отпустил — толчок наружу: кнопка на миг чуть больше обычной (~1,02) и пружинит обратно
    const up = () => { if (!s.pressed) return; s.pressed = false; s.target = 1; s.v += 2.2; s.kick(); };
    el.addEventListener('pointerdown', down);
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(t, up);
    return () => {
      cancelAnimationFrame(s.raf); el.style.transform = '';
      el.removeEventListener('pointerdown', down);
      for (const t of ['pointerup', 'pointercancel', 'pointerleave']) el.removeEventListener(t, up);
    };
  }, [on]);
  const click = !on || !onClick ? onClick : (e) => {
    const s = st.current;
    if (!s || s.reduce) { onClick(e); return; }
    if (s.busy) return;   // второе нажатие во время отскока не повторяет действие
    s.busy = true;
    if (!s.pressed && s.x > 0.99) { s.v = -2.2; s.kick(); }   // нажатие с клавиатуры — короткий толчок
    setTimeout(() => { s.busy = false; onClick(e); }, PRESS_DELAY);
  };
  return [ref, click];
}

// Переключатель «Усі / Вчу / Вивчено / Нові». Чёрная «таблетка» переезжает к выбранному пункту с пружинкой,
// как пузырёк в меню; внутри неё — копия подписей белым, поэтому цвет текста меняется ровно там, где таблетка.
export function Segmented({ options, value, onChange, cls }) {
  const ref = useRef(null), pillRef = useRef(null), lensRef = useRef(null), st = useRef(null);
  const idx = Math.max(0, options.findIndex((o) => o.value === value));
  const latest = useRef(idx); latest.current = idx;
  useLayoutEffect(() => {
    const el = ref.current, pill = pillRef.current, lens = lensRef.current, PADS = 4;
    const s = (st.current = { x: 0, v: 0, target: 0, raf: 0, last: 0 });
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const measure = () => { s.W = el.clientWidth; s.H = el.clientHeight; s.tw = (s.W - 2 * PADS) / options.length; lens.style.width = s.W + 'px'; lens.style.height = s.H + 'px'; };
    const center = (i) => PADS + s.tw * (i + 0.5);
    const draw = () => {
      const w = s.tw, h = s.H - 2 * PADS;
      pill.style.width = w + 'px'; pill.style.height = h + 'px';
      pill.style.transform = `translate(${s.x - w / 2}px, ${PADS}px)`;
      lens.style.transform = `translate(${w / 2 - s.x}px, ${-PADS}px)`;
    };
    const step = (time) => {
      const dt = Math.min(0.032, (time - (s.last || time)) / 1000); s.last = time;
      const c = 2 * Math.sqrt(SPRING.k) * (reduce ? 1 : SPRING.zeta);
      s.v += (SPRING.k * (s.target - s.x) - c * s.v) * dt; s.x += s.v * dt;
      draw();
      if (Math.abs(s.v) > 2 || Math.abs(s.target - s.x) > 0.3) s.raf = requestAnimationFrame(step);
      else { s.x = s.target; s.v = 0; s.raf = 0; s.last = 0; draw(); }
    };
    s.goTo = (i) => { s.target = center(i); if (!s.raf) { s.last = 0; s.raf = requestAnimationFrame(step); } };
    const ro = new ResizeObserver(() => { measure(); cancelAnimationFrame(s.raf); s.raf = 0; s.x = s.target = center(latest.current); s.v = 0; draw(); });
    ro.observe(el); measure(); s.x = s.target = center(latest.current); draw();
    return () => { ro.disconnect(); cancelAnimationFrame(s.raf); };
  }, [options.length]);
  useEffect(() => { const s = st.current; if (s && s.goTo) s.goTo(idx); }, [idx]);
  return html`<div class=${cx('seg', cls)} ref=${ref} role="tablist">${options.map((o) => html`<button key=${o.value} role="tab" aria-selected=${o.value === value}
    class=${cx('seg__item', o.value === value && 'seg__item--on')} onClick=${() => onChange(o.value)}>${o.label}</button>`)}
    <div class="seg__pill" ref=${pillRef} aria-hidden="true"><div class="seg__lens" ref=${lensRef}>${options.map((o) => html`<span key=${o.value} class="seg__item">${o.label}</span>`)}</div></div>
  </div>`;
}

// Поле поиска (Aura/Search field): иконка лупы, текст, круглая кнопка очистки, когда что-то введено
export function SearchField({ value, onInput, placeholder, clearLabel }) {
  const ref = useRef(null);
  return html`<label class="search">
    <${Icon} name="search" size=${20} />
    <input ref=${ref} class="search__input" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" autocorrect="off"
      autocapitalize="off" spellcheck="false" placeholder=${placeholder} aria-label=${placeholder} value=${value}
      onInput=${(e) => onInput(e.currentTarget.value)}
      onKeyDown=${(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') onInput(''); }} />
    ${value && html`<button type="button" class="search__clear" aria-label=${clearLabel} onClick=${(e) => { e.preventDefault(); onInput(''); ref.current && ref.current.focus(); }}>
      <${Icon} name="close" size=${16} /></button>`}
  </label>`;
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

// Шапка листа выбора: заголовок (+ подпись) и крестик — закрыть без изменений
export const SheetHead = ({ title, sub, onClose }) => html`<div class="sheet__head sheet__head--row">
  <div class="sheet__titles"><div class="t-heading-h2">${title}</div>${sub && html`<div class="t-label-14 muted">${sub}</div>`}</div>
  <${IconButton} icon="close" onClick=${onClose} label=${t('common.close')} /></div>`;

// Лист выбора (настройки, уровни, режим): выбор применяется только кнопкой «Застосувати» —
// чёрная, без стрелки (Aura/Button primary). Крестик или тап мимо листа — закрыть без изменений.
export function PickSheet({ title, sub, options, value, onPick, onClose, multi, confirm }) {
  const [sel, setSel] = useState(multi ? [...value] : value);
  const toggle = (v) => (multi ? setSel(sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v]) : setSel(v));
  return html`<${Sheet} onClose=${onClose}>
    <${SheetHead} title=${title} sub=${sub} onClose=${onClose} />
    <div class="pick-list">${options.map((o) => {
      const on = multi ? sel.includes(o.value) : sel === o.value;
      return html`<button key=${o.value} class=${cx('pick', on && 'pick--on')} onClick=${() => toggle(o.value)}>
        ${o.lead}<span class="pick__text"><span class="t-title-m">${o.label}</span>${o.sub && html`<span class="t-label-13 muted">${o.sub}</span>`}</span>
        <span class=${cx('radio', multi && 'radio--box', on && 'radio--on')}>${on && html`<${Icon} name="check" size=${16} />`}</span></button>`;
    })}</div>
    <${ApplyButton} label=${confirm} disabled=${multi && !sel.length} onClick=${() => { onPick(sel); onClose(); }} />
  </${Sheet}>`;
}

// Кнопка «Застосувати» внизу листа выбора — одна на все листы
export const ApplyButton = ({ label, disabled, onClick }) => html`<${Button} variant="dark" label=${label || t('common.apply')} disabled=${disabled} onClick=${onClick} />`;

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

// Aura/Tab bar — стеклянная капсула. За активной вкладкой — светло-розовый пузырёк (nav/active-bg),
// иконка и подпись в нём красно-розовые. При смене вкладки пузырёк переезжает с лёгкой пружинкой, не увеличиваясь;
// его можно тянуть пальцем — вкладка выбирается, когда палец отпущен. Нажатие на вкладку — обычный click.
// Движение — пружина в requestAnimationFrame; стили пишутся прямо в DOM, без перерисовки на каждом кадре.
// «Групи» в меню нет с 16.11.2026. С 18.11.2026 (Aura/Tab bar v2): в капсуле «Практика · Слова» (до 18.11.2026 — «Сьогодні») (и «Прогрес», когда
// появится страница). С 19.11.2026 «Налаштування» — внутри капсулы, справа: иконка без подписи в сером круге 56 px. Пузырёк к нему
// не едет (ездит только между вкладками): когда открыты настройки, пузырька нет, а круг становится розовым, цвета пузырька.
const TABS = [['today', 'bolt'], ['words', 'cards'], ['progress', 'chart']];
const PAD = 4, SET = 56 + 4;   // круг настроек 56 px + 4 px до вкладок
const NavItems = ({ items, cls, set }) => [...items.map(([name, icon]) => html`<span key=${name} class=${cls}><${Icon} name=${icon} size=${24} />
  <span class="nav__label">${t('nav.' + name)}</span></span>`), set && html`<span key="set" class="nav__set-slot"></span>`];

export function Nav({ active, onNav, tabs }) {
  const items = TABS.filter(([n]) => tabs.includes(n));
  const hasSet = tabs.includes('settings');
  const idx = items.findIndex(([n]) => n === active);   // -1 — открыты «Налаштування»: пузырька в капсуле нет
  const barRef = useRef(null), bubRef = useRef(null), lensRef = useRef(null), st = useRef(null);
  const latest = useRef(null); latest.current = { items, idx, active, onNav, hasSet };

  useEffect(() => {
    const bar = barRef.current, bub = bubRef.current, lens = lensRef.current;
    const s = (st.current = { x: 0, v: 0, target: 0, pressed: false, raf: 0, last: 0 });
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const n = () => latest.current.items.length;
    const measure = () => { s.W = bar.clientWidth; s.H = bar.clientHeight; s.tw = (s.W - 2 * PAD - (latest.current.hasSet ? SET : 0)) / n(); lens.style.width = s.W + 'px'; lens.style.height = s.H + 'px'; };
    const center = (i) => PAD + s.tw * (i + 0.5);
    const clampX = (x) => Math.min(Math.max(x, PAD + s.tw / 2), PAD + s.tw * (n() - 0.5));   // круг настроек пузырёк не заезжает
    // пузырёк всегда размером с вкладку; внутри — копия иконок и подписей в цвете nav/active, сдвинутая под пузырёк
    const draw = () => {
      const w = s.tw, h = s.H - 2 * PAD;
      bub.style.width = w + 'px'; bub.style.height = h + 'px';
      bub.style.transform = `translate(${s.x - w / 2}px, ${PAD}px)`;
      lens.style.transform = `translate(${w / 2 - s.x}px, ${-PAD}px)`;
    };
    const step = (time) => {
      const dt = Math.min(0.032, (time - (s.last || time)) / 1000); s.last = time;
      const k = s.pressed ? 900 : SPRING.k, c = 2 * Math.sqrt(k) * (reduce ? 1 : s.pressed ? 0.95 : SPRING.zeta);
      s.v += (k * (s.target - s.x) - c * s.v) * dt; s.x += s.v * dt;
      draw();
      if (s.pressed || Math.abs(s.v) > 2 || Math.abs(s.target - s.x) > 0.3) s.raf = requestAnimationFrame(step);
      else { s.x = s.target; s.v = 0; s.raf = 0; s.last = 0; draw(); }
    };
    const kick = () => { if (!s.raf) { s.last = 0; s.raf = requestAnimationFrame(step); } };
    s.goTo = (i) => { s.target = center(i); kick(); };
    const at = (e) => e.clientX - bar.getBoundingClientRect().left;
    // Обычное нажатие — стандартный click кнопки (надёжно на iPhone). Свои обработчики — только для
    // перетаскивания пузырька: оно начинается, когда палец сдвинулся больше чем на 8 px.
    const down = (e) => { if (e.button > 0 || e.target.closest('.nav__set')) return; s.pressed = true; s.dragging = false; s.startX = e.clientX; s.pid = e.pointerId; };
    const move = (e) => {
      if (!s.pressed) return;
      if (!s.dragging && Math.abs(e.clientX - s.startX) > 8) { s.dragging = true; try { bar.setPointerCapture(s.pid); } catch (_) { /* касание уже закончилось */ } }
      if (s.dragging) { s.target = clampX(at(e)); kick(); }
    };
    const up = () => {
      if (!s.pressed) return; s.pressed = false;
      if (!s.dragging) return;   // это было нажатие — вкладку переключит click
      s.dragging = false; s.skipClick = Date.now();
      const { items: list, active: cur, onNav: nav } = latest.current;
      const i = Math.max(0, Math.min(list.length - 1, Math.round((s.target - PAD) / s.tw - 0.5)));
      s.goTo(i); if (list[i][0] !== cur) nav(list[i][0]);
    };
    const cancel = () => { if (!s.pressed) return; s.pressed = false; if (s.dragging) { s.dragging = false; s.goTo(Math.max(0, latest.current.idx)); } };
    bar.addEventListener('pointerdown', down); bar.addEventListener('pointermove', move);
    bar.addEventListener('pointerup', up); bar.addEventListener('pointercancel', cancel);
    const home = () => center(Math.max(0, latest.current.idx));
    const ro = new ResizeObserver(() => { measure(); s.x = s.target = home(); draw(); });
    ro.observe(bar); measure(); s.x = s.target = home(); draw();
    return () => { ro.disconnect(); cancelAnimationFrame(s.raf); bar.removeEventListener('pointerdown', down); bar.removeEventListener('pointermove', move);
      bar.removeEventListener('pointerup', up); bar.removeEventListener('pointercancel', cancel); };
  }, [items.length]);
  // нажатие на вкладку (и Enter / пробел с клавиатуры); сразу после перетаскивания click игнорируем
  const tap = (name) => { const s = st.current; if (s && Date.now() - (s.skipClick || 0) < 400) return; if (name !== active) onNav(name); };
  // вкладку сменили не через меню (например, «На головну» на итоге) — пузырёк переезжает сам
  useEffect(() => { const s = st.current; if (s && s.goTo && !s.pressed && idx >= 0) s.goTo(idx); }, [idx]);

  return html`<div class="nav-dock">
    <nav class=${cx('nav', idx < 0 && 'nav--none', hasSet && 'nav--set')} ref=${barRef} aria-label="menu" style=${`--tabs:${items.length}`}>
      <div class="nav__row">${items.map(([name, icon]) => html`<button key=${name} class="nav__tab" aria-current=${active === name ? 'page' : null}
        onClick=${() => tap(name)}><${Icon} name=${icon} size=${24} /><span class="nav__label">${t('nav.' + name)}</span></button>`)}
        ${hasSet && html`<button class=${cx('nav__set', active === 'settings' && 'is-active')} aria-label=${t('nav.settings')}
          aria-current=${active === 'settings' ? 'page' : null} onClick=${() => active !== 'settings' && onNav('settings')}><${Icon} name="settings" size=${24} /></button>`}</div>
      <div class="nav__bubble" ref=${bubRef} aria-hidden="true"><div class="nav__lens" ref=${lensRef}><${NavItems} items=${items} cls="nav__tab" set=${hasSet} /></div></div>
    </nav>
  </div>`;
}

// Aura/Settings row
export const SettingsRow = ({ icon, title, sub, value, trailing = 'chevron', on, onToggle, onClick, dim }) => html`<button
  class=${cx('srow', dim && 'srow--dim')} onClick=${trailing === 'toggle' ? () => onToggle(!on) : onClick} disabled=${dim}>
  <span class="ib ib--grey srow__icon" style="--ib:40px"><${Icon} name=${icon} size=${20} /></span>
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
