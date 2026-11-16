// Запуск: загрузить слова выбранного языка, показать приложение, включить работу без интернета.
import { html, render } from '../lib/preact-htm.js';
import { CONFIG } from './config.js';
import { getCourse, loadCourse } from './content/index.js';
import { GROUP_TYPES } from './groups/index.js';
import { getState, flush } from './core/store.js';
import { setUiLang } from './i18n/index.js';
import { App, applyTheme, errorText } from './app.js';

const s = getState();
setUiLang(s.ui);
applyTheme();
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

loadCourse(getCourse(s.course || CONFIG.defaultCourse), GROUP_TYPES).then(() => {
  render(html`<${App} />`, document.getElementById('app'));
}).catch((e) => {
  console.error(e);
  document.getElementById('app').innerHTML = `<p class="fatal">${errorText()}</p>`;
});

// Работа без интернета: sw.js кладёт приложение в кэш телефона.
// Обновление: при запуске и при каждом возвращении в приложение проверяем, нет ли новой версии на сайте.
// Новая версия скачивается в фоне и сразу берёт управление — тогда страница один раз перезагружается сама,
// и на телефоне сразу новая версия (раньше она появлялась только после полного перезапуска приложения).
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  const hadOld = !!navigator.serviceWorker.controller;   // первый запуск — перезагружать не нужно
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadOld || reloading) return;
    reloading = true;
    flush();
    location.reload();
  });
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const check = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') check(); });
    addEventListener('focus', check);
  }).catch((e) => console.warn('sw', e));
}
