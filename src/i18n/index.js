// Тексты интерфейса. Новый язык интерфейса: файл src/i18n/<код>.js с теми же ключами + строка в UI ниже + код в CONFIG.uiLanguages.
import uk from './uk.js';
import ru from './ru.js';

export const UI = { uk, ru };
export const UI_NAMES = { uk: 'Українська', ru: 'Русский', en: 'English', lv: 'Latviešu' };

let code = 'uk';
let current = uk;
export const setUiLang = (c) => { code = UI[c] ? c : 'uk'; current = UI[code]; document.documentElement.lang = code; };
export const uiLang = () => code;

const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

// t('today.review', { n: 7 }) — {name} заполняются из vars.
export function t(path, vars) {
  let s = get(current, path);
  if (s == null) s = get(uk, path);
  if (s == null) return path;
  if (typeof s !== 'string' || !vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
}

// Текст из объекта { uk, ru } на языке интерфейса
export const L = (obj, vars) => {
  if (!obj) return '';
  let s = typeof obj === 'string' ? obj : obj[code] || obj.uk || obj.ru || obj.en || '';
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : ''));
  return s;
};

// Русский и украинский: 1 слово, 2 слова, 5 слов
export function plural(n, key) {
  const forms = get(current, 'pl.' + key) || get(uk, 'pl.' + key);
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b === 1) return forms[0];
  if (b >= 2 && b <= 4) return forms[1];
  return forms[2];
}
export const pn = (n, key) => `${num(n)}\u00a0${plural(n, key)}`;

// 1240 → «1 240»
export const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

// Интервал до следующего повтора: «через 15 хв», «завтра», «через 3 дні», «~тиждень»
export function interval(sec, short = false) {
  const m = Math.round(sec / 60), h = Math.round(sec / 3600), d = Math.round(sec / 86400);
  if (sec < 60) return t('when.now');
  if (m < 60) return t('when.min', { n: m });
  if (h < 20) return t('when.hours', { n: h, u: plural(h, 'hours') });
  if (d <= 1) return short ? pn(1, 'days') : t('when.tomorrow');
  if (d === 7) return t('when.week');
  if (d > 7 && d % 7 === 0 && d < 30) return short ? pn(d / 7, 'weeks') : t('when.in', { x: pn(d / 7, 'weeks') });
  if (d >= 28 && d <= 31) return t('when.month');
  return short ? pn(d, 'days') : t('when.in', { x: pn(d, 'days') });
}

// Длительность без «через»: «15 хв», «2 год», «3 дні», «1 тиждень», «1 місяць»
export function dur(sec) {
  const m = Math.round(sec / 60), h = Math.round(sec / 3600), d = Math.round(sec / 86400);
  const nb = (x) => x.replace(' ', '\u00a0');
  if (m < 60) return nb(t('when.minShort', { n: m }));
  if (h < 24) return nb(t('when.hoursShort', { n: h }));
  if (d >= 28 && d <= 31) return nb(t('when.monthShort'));
  if (d % 7 === 0) return pn(d / 7, 'weeks');
  return pn(d, 'days');
}
