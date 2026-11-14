// Запуск: загрузить слова выбранного языка, показать приложение, включить работу без интернета.
import { html, render } from '../lib/preact-htm.js';
import { CONFIG } from './config.js';
import { getCourse, loadCourse } from './content/index.js';
import { GROUP_TYPES } from './groups/index.js';
import { getState } from './core/store.js';
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

// Работа без интернета: sw.js кладёт приложение в кэш телефона. Новая версия подхватывается при следующем запуске.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname))) {
  navigator.serviceWorker.register('./sw.js').catch((e) => console.warn('sw', e));
}
