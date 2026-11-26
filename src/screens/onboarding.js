// Первый запуск (дизайн v2, 18.11.2026), 7 шагов:
// 1.1 мова інтерфейсу → 1.2 що вивчаємо → 1.3 рівні слів → 1.4 нових слів на день → 1.5 повторень на день →
// 1.6 нагадування (+ 1.6a свій час) → 1.7 підписка. Шаги 1.6 и 1.7 пока заглушки: время сохраняется,
// но уведомления не приходят (нужен сервер), оплаты нет — всё бесплатно.
import { html, useState, useEffect, useRef } from '../../lib/preact-htm.js';
import { CONFIG, feature } from '../config.js';
import { COURSES, PREVIEW, LEVELS } from '../content/index.js';
import { t, UI_NAMES, num, pn } from '../i18n/index.js';
import { getState, update, progress } from '../core/store.js';
import { Screen, Title, Button, Icon, IconButton, Counter, Sheet, SheetHead, ApplyButton, Toggle, cx } from '../ui/kit.js';

const STEPS = 7;
const Head = ({ n, onBack, onClose, brand }) => html`<div class="top-bar">
  ${brand ? html`<span class="t-brand-wordmark brand">Vocca</span>`
    : onClose ? html`<${IconButton} icon="close" size=${48} onClick=${onClose} label=${t('common.close')} />`
    : html`<${IconButton} icon="arrow-left" size=${48} onClick=${onBack} label=${t('common.back')} />`}
  <span class="top-bar__mid"></span><${Counter}>${n} / ${STEPS}</${Counter}></div>`;

// Круглая радиокнопка (один вариант) и квадратный чекбокс (несколько) — Aura/Checkbox
export const Radio = ({ on }) => html`<span class=${cx('radio', on && 'radio--on')}>${on && html`<${Icon} name="check" size=${16} />`}</span>`;
export const Check = ({ on }) => html`<span class=${cx('checkbox', on && 'checkbox--on')}>${on && html`<${Icon} name="check" size=${16} />`}</span>`;

// Строка выбора: крупное значение слева, название и подпись, кружок справа (1.1, 1.4, 1.5, 1.6)
const OptRow = ({ big, unit, title, sub, on, onClick, disabled }) => html`<button class=${cx('opt-row card', on && 'is-on')} onClick=${onClick} disabled=${disabled}>
  <span class="opt-row__big"><span class="t-number-m">${big}</span>${unit && html`<span class="t-label-12 muted">${unit}</span>`}</span>
  <span class="opt-row__text"><span class="t-title-l">${title}</span>${sub && html`<span class="t-label-13 muted">${sub}</span>`}</span>
  <${Radio} on=${on} /></button>`;

// 1.1 · Мова інтерфейсу
const UI_CODE = { uk: 'UA', ru: 'RU', en: 'EN' };
const UI_SUB = { uk: 'Інтерфейс українською', ru: 'Интерфейс на русском', en: 'Interface in English' };
export function Welcome({ go }) {
  const s = getState();
  const link = (key, label) => CONFIG.links[key] ? html`<a href=${CONFIG.links[key]} target="_blank" rel="noopener">${label}</a>` : html`<u>${label}</u>`;
  const terms = t('onboarding.terms', { terms: '\u0001', privacy: '\u0002' }).split(/([\u0001\u0002])/).map((p) =>
    p === '\u0001' ? link('terms', t('onboarding.termsLink')) : p === '\u0002' ? link('privacy', t('onboarding.privacyLink')) : p);
  return html`<${Screen} tone="cool" bottom=${html`<p class="t-label-12 muted terms">${terms}</p>
      <${Button} variant="dark" label=${t('common.continue')} onClick=${() => go('course')} />`}>
    <${Head} n=${1} brand />
    <${Title} main=${t('onboarding.hello')} accent=${t('onboarding.setup')} />
    <div class="t-overline overline">${t('onboarding.uiLang')}</div>
    <div class="opt-list">${CONFIG.uiLanguages.map((code) => html`<${OptRow} key=${code} big=${UI_CODE[code]} title=${UI_NAMES[code]} sub=${UI_SUB[code]}
      on=${s.ui === code} onClick=${() => update((st) => { st.ui = code; })} />`)}</div>
    <p class="t-label-13 muted ob-hint">${t('onboarding.uiHint')}</p>
  </${Screen}>`;
}

// 1.2 · Яку мову будемо вчити? Латышский пока не включён — после выбора всё равно учим английский.
export function Course({ go, back }) {
  const s = getState();
  const [course, setCourse] = useState(s.course || CONFIG.defaultCourse);
  const cards = [...COURSES, ...PREVIEW.filter((x) => !COURSES.some((c) => c.id === x.id))];
  const real = (id) => (COURSES.some((c) => c.id === id) ? id : CONFIG.defaultCourse);
  return html`<${Screen} tone="cool" bottom=${html`<${Button} label=${t('common.continue')} onClick=${() => { update((st) => { st.course = real(course); }); go('levels'); }} />`}>
    <${Head} n=${2} onBack=${back} />
    <${Title} main=${t('onboarding.courseTitle')} accent=${t('onboarding.courseTitle2')} />
    <div class="course-cards">${cards.map((c) => html`<button class=${cx('course-card', 'card', c.id === course && 'course-card--on')} onClick=${() => setCourse(c.id)}>
      <${Radio} on=${c.id === course} />
      <span class="t-number-l">${c.code}</span><span class="t-label-16-strong">${c.name}</span>
      ${(c.words || c.count) && html`<span class="t-label-13">${num(Math.floor((c.words ? c.words.length : c.count) / 100) * 100)}+ ${t('pl.words.2')}</span>`}</button>`)}</div>
  </${Screen}>`;
}

// Карточки уровней с чекбоксами (1.3 и лист «Обери рівні»)
// counts — число слов на уровне отдельной строкой под пояснением (лист «Обери рівні», 20.11.2026)
export function LevelCards({ value, onChange, testLevel, counts }) {
  // В листе «Обери рівні» (counts) — компактнее, по макету 4.2b (26.11.2026): поля 12 / 16 / 12 / 20, уровень Number/XS (26 Thin),
  // пояснение и число слов — Label/12 и Label/12 Medium, чекбокс 26. На шаге 1.3 — как было.
  const sm = !!counts;
  return html`<div class=${cx('level-cards', sm && 'level-cards--sheet')}>${LEVELS.map((l) => {
    const on = value.includes(l);
    return html`<button class=${cx('level-card', 'card', on && 'level-card--on')} onClick=${() => onChange(on ? value.filter((x) => x !== l) : [...value, l])}>
      <span class=${sm ? 't-number-xs' : 't-number-m'}>${l}</span>
      <span class="level-card__text"><span class="t-title-l">${t('levels.' + l)}</span>
        <span class=${cx(sm ? 't-label-12' : 't-label-13', 'muted')}>${testLevel === l ? t('onboarding.byTest') : t('levels.desc.' + l)}</span>
        ${counts && html`<span class="t-label-12-medium muted">${pn(counts[l] || 0, 'words')}</span>`}</span>
      <${Check} on=${on} /></button>`;
  })}</div>`;
}

// 1.3 · Слова з яких рівнів будемо вчити?
export function Levels({ go, back }) {
  const p = progress();
  const [levels, setLevels] = useState(p.levels.length ? p.levels : ['A1']);
  const save = () => update(() => { progress().levels = LEVELS.filter((l) => levels.includes(l)); });
  return html`<${Screen} tone="cool" bottom=${html`<${Button} label=${t('common.next')} disabled=${!levels.length} onClick=${() => { save(); go('goal-new'); }} />`}>
    <${Head} n=${3} onBack=${back} />
    <${Title} main=${t('onboarding.levelTitle')} accent=${t('onboarding.levelTitle2')} />
    <${LevelCards} value=${levels} onChange=${setLevels} testLevel=${p.testLevel} />
    <p class="t-label-13 muted ob-hint">${t('onboarding.levelHint')}</p>
  </${Screen}>`;
}

// 1.4 / 1.5 · Цель на день: «Скільки нових слів на день?» и «Скільки повторень на день?»
export const GoalRows = ({ kind, value, onPick }) => html`<div class="opt-list">${CONFIG[kind + 'GoalOptions'].map(([n, name, min]) => html`<${OptRow} key=${n}
  big=${n} unit=${t('onboarding.wordsPerDay')} title=${t('goal.' + name)} sub=${t('goal.min', { n: min })} on=${value === n} onClick=${() => onPick(n)} />`)}</div>`;
export function Goal({ go, back, route }) {
  const kind = route.name === 'goal-repeat' ? 'repeat' : 'new';
  const key = kind + 'Goal';
  const [value, setValue] = useState(progress()[key]);
  const nextStep = () => { update(() => { progress()[key] = value; }); if (kind === 'new') go('goal-repeat'); else if (feature('reminders')) go('reminder'); else paywallOrFinish(go); };
  return html`<${Screen} tone="cool" bottom=${html`<${Button} label=${t('common.continue')} onClick=${nextStep} />`}>
    <${Head} n=${kind === 'new' ? 4 : 5} onBack=${back} />
    <${Title} main=${t('onboarding.' + kind + 'GoalTitle')} accent=${t('onboarding.perDay')} />
    <${GoalRows} kind=${kind} value=${value} onPick=${setValue} />
    <p class="t-label-13 muted ob-hint">${t('onboarding.goalHint')}</p>
  </${Screen}>`;
}

// 1.6 · Коли нагадати про слова? Переключатель, три готовых времени и «Свій час» (лист 1.6a с колесом)
export function ReminderRows({ value, onChange }) {
  const [sheet, setSheet] = useState(false);
  const presets = CONFIG.reminderTimes.map(([time]) => time);
  const own = !presets.includes(value.time);
  const ownTime = own ? value.time : value.custom || '21:30';   // «Свій час» показывает последнее своё время
  const pick = (time) => onChange({ ...value, time });
  return html`<div class="card opt-toggle"><span class="opt-row__text"><span class="t-title-l">${t('reminder.on')}</span><span class="t-label-13 muted">${t('reminder.onSub')}</span></span>
      <${Toggle} on=${value.on} onChange=${(on) => onChange({ ...value, on })} label=${t('reminder.on')} /></div>
    <div class=${cx('opt-list', !value.on && 'is-dim')}>
      ${CONFIG.reminderTimes.map(([time, name]) => html`<${OptRow} key=${time} big=${time.replace(/^0/, '')} title=${t('reminder.' + name)} sub=${t('reminder.' + name + 'Sub')}
        on=${value.time === time} disabled=${!value.on} onClick=${() => pick(time)} />`)}
      <${OptRow} big=${ownTime.replace(/^0/, '')} title=${t('reminder.own')} sub=${t('reminder.ownSub')} on=${own} disabled=${!value.on} onClick=${() => setSheet(true)} />
    </div>
    ${sheet && html`<${TimeSheet} value=${ownTime} onApply=${(time) => onChange({ ...value, time, custom: time })} onClose=${() => setSheet(false)} />`}`;
}
export function Reminder({ go, back }) {
  const [value, setValue] = useState(() => ({ ...getState().reminder }));
  return html`<${Screen} tone="cool" bottom=${html`<${Button} label=${t('common.continue')} onClick=${() => { update((s) => { s.reminder = value; }); paywallOrFinish(go); }} />`}>
    <${Head} n=${6} onBack=${back} />
    <${Title} main=${t('reminder.title')} accent=${t('reminder.title2')} />
    <${ReminderRows} value=${value} onChange=${setValue} />
    <div class="card notif"><span class="notif__icon">V</span><span class="notif__text"><span class="notif__top"><span class="t-label-12-medium muted">VOCCA</span><span class="t-label-12 muted">${t('reminder.now')}</span></span>
      <span class="t-label-15-medium">${t('reminder.push')}</span><span class="t-label-14 muted">${t('reminder.pushSub')}</span></span></div>
  </${Screen}>`;
}

// 1.6a · Свій час: колесо часов и минут (шаг 5 минут), «Застосувати»
function Wheel({ values, value, onChange }) {
  const ref = useRef(null);
  const H = 40;
  useEffect(() => { const i = Math.max(0, values.indexOf(value)); if (ref.current) ref.current.scrollTop = i * H; }, []);
  const onScroll = (e) => { const i = Math.round(e.currentTarget.scrollTop / H); if (values[i] != null && values[i] !== value) onChange(values[i]); };
  return html`<div class="wheel__col" ref=${ref} onScroll=${onScroll}>${values.map((v) => html`<div class=${cx('wheel__item', v === value && 'is-on')}
    onClick=${(e) => e.currentTarget.parentNode.scrollTo({ top: values.indexOf(v) * H, behavior: 'smooth' })}>${v}</div>`)}</div>`;
}
const pad = (n) => String(n).padStart(2, '0');
function TimeSheet({ value, onApply, onClose }) {
  const [h, m] = value.split(':');
  const [hh, setH] = useState(h), [mm, setM] = useState(pad(Math.round(+m / 5) * 5 % 60));
  return html`<${Sheet} onClose=${onClose}>
    <${SheetHead} title=${t('reminder.own')} onClose=${onClose} />
    <div class="wheel"><div class="wheel__band"></div>
      <${Wheel} values=${Array.from({ length: 24 }, (_, i) => pad(i))} value=${hh} onChange=${setH} />
      <span class="wheel__colon t-title-l">:</span>
      <${Wheel} values=${Array.from({ length: 12 }, (_, i) => pad(i * 5))} value=${mm} onChange=${setM} /></div>
    <${ApplyButton} onClick=${() => { onApply(`${hh}:${mm}`); onClose(); }} />
  </${Sheet}>`;
}

// 1.7 · Підписка — заглушка: выбор плана есть, оплаты нет; «Спробувати безкоштовно» и «Продовжити без підписки» ведут на «Практика»
const paywallOrFinish = (go) => (feature('paywall') ? go('paywall') : finishOnboarding(go));
export function Paywall({ go, toast }) {
  const [plan, setPlan] = useState('year');
  const finish = () => finishOnboarding(go);
  return html`<${Screen} tone="paywall" bottom=${html`<${Button} label=${t('paywall.try')} onClick=${() => { if (toast) toast(t('paywall.soon')); finish(); }} />
      <button class="link-btn paywall__free" onClick=${finish}><span class="t-title-m">${t('paywall.free')}</span><span class="t-label-13 muted">${t('paywall.freeSub')}</span></button>
      <p class="t-label-12 muted center">${t('paywall.footer')}</p>`}>
    <${Head} n=${7} onClose=${finish} />
    <${Title} main=${t('paywall.title')} accent=${t('paywall.title2')} />
    <div class="t-overline overline">${t('paywall.with')}</div>
    <ul class="benefits">${['b1', 'b2', 'b3'].map((k) => html`<li class="t-label-15-medium"><span class="benefits__check"><${Icon} name="check" size=${14} /></span>${t('paywall.' + k)}</li>`)}</ul>
    <div class="t-overline overline">${t('paywall.plan')}</div>
    <div class="plans">
      <button class=${cx('plan plan--year', plan === 'year' && 'is-on')} onClick=${() => setPlan('year')}><span class="plan__tag t-label-12-strong">−50%</span><${Radio} on=${plan === 'year'} />
        <span class="t-number-l">12</span><span class="t-title-m">${t('paywall.months')}</span><span class="t-label-13">$29.99 · $2.50/${t('paywall.mo')}</span></button>
      <button class=${cx('plan card', plan === 'month' && 'is-on')} onClick=${() => setPlan('month')}><${Radio} on=${plan === 'month'} />
        <span class="t-number-l">1</span><span class="t-title-m">${t('paywall.month')}</span><span class="t-label-13">$4.99</span></button>
    </div>
    <p class="t-label-13 muted">${t(plan === 'year' ? 'paywall.noteYear' : 'paywall.noteMonth')}</p>
  </${Screen}>`;
}

// Последний шаг: сохранить и открыть «Практика»
export const finishOnboarding = (go) => { update((s) => { s.onboarded = true; }); go('today', {}, true); };

// Лист «Обери рівні» (настройки, «Практика») — выбор применяется кнопкой «Застосувати».
// У каждого уровня — сколько в нём слов курса (свои слова не считаем).
export function LevelsSheet({ course, value, testLevel, onApply, onClose, children }) {
  const [draft, setDraft] = useState(value);
  const counts = course && course.words ? course.words.reduce((o, w) => { if (!w.custom) o[w.lvl] = (o[w.lvl] || 0) + 1; return o; }, {}) : null;
  return html`<${Sheet} onClose=${onClose}>
    <${SheetHead} title=${t('onboarding.pickLevels')} sub=${t('onboarding.many')} onClose=${onClose} />
    <div class="sheet__scroll"><${LevelCards} value=${draft} testLevel=${testLevel} counts=${counts} onChange=${setDraft} />
    ${children && children(draft)}</div>
    <${ApplyButton} disabled=${!draft.length} onClick=${() => { onApply(draft); onClose(); }} />
  </${Sheet}>`;
}
