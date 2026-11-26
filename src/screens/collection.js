// Занятие по добіркам (3.1–3.10) и итог 3.11. Открывается кнопкой «Вчити / Почати / Повторити» у добірки на «Практика».
// Экраны идут один за другим, внизу ‹ · «Уже знаю» · › — как в занятии (макет 3.8 дизайнера, 25.11.2026; раньше «Далі»,
// днём 25.11 — только стрелки): ‹ — предыдущий экран (на первом бледная), › — вперёд, как свайп влево; «Уже знаю» — слова
// экрана, что есть в словаре, в «Вивчено», и дальше; за заход — «Кількість слів» с «Що тренуємо» (по умолчанию 20).
// Свайп вправо — предыдущая карточка (и с итога 3.11 — последняя), влево — вперёд, но только до уже просмотренной.
import { html, useState, useEffect } from '../../lib/preact-htm.js';
import { getState } from '../core/store.js';
import { tts } from '../core/tts.js';
import { ttsLang } from '../core/words.js';
import { CONFIG } from '../config.js';
import { GROUP_TYPES } from '../groups/index.js';
import { t, L } from '../i18n/index.js';
import { Screen, TopBar, Button, useSwipe, enterCls, cx, Icon } from '../ui/kit.js';
import { knowWords } from '../core/session.js';
import { GroupDone } from '../groups/done.js';

const T = (g) => GROUP_TYPES[g.type];

// Адреса group / verbs: у добірки «3 форми дієслів» свои экраны — групи з «Тренажер» (3.12), картки дієслова (3.13)
// и тренажёр (3.14), их показывает src/groups/irregular.js. Остальные добірки — обычное занятие ниже.
export function GroupRoute(props) {
  const id = props.route.group || (props.route.groups || [])[0];
  const g = props.course.groupList.find((x) => x.id === id);
  const Own = g && T(g).Screen;
  return Own ? html`<${Own} ...${props} group=${g} />` : html`<${Collection} ...${props} />`;
}

export function Collection({ course, route, go, back }) {
  const ids = route.groups || (route.group ? [route.group] : []);
  const groups = ids.map((id) => course.groupList.find((g) => g.id === id)).filter(Boolean);
  const size = route.size === 'all' ? Infinity : route.size || CONFIG.groupSessionSize;
  const build = (review) => groups.flatMap((g) => T(g).queue(course, g, review).map((item) => ({ g, item })));
  // Правила (времена, условные; 3.15 / 3.16): внизу кнопок нет (решение дизайнера, 26.11.2026). Открыли одно правило
  // с «Практика» (route.from) — только оно, без счётчика, закрывается крестиком; с 2.2 — вся добірка, листать свайпом.
  const rules = groups.length > 0 && groups.every((g) => T(g).unit === 'rules');
  const one = rules && !!route.from;
  const [queue] = useState(() => { const q = build(!!route.review); return one ? q.filter((x) => x.item.id === route.from).slice(0, 1) : q; });
  // from — открыть сразу на этом экране (правило из списка «Часи» на «Практика»; 26.11.2026)
  const at0 = route.from ? Math.max(0, queue.findIndex((x) => x.item.id === route.from)) : 0;
  const [start, setStart] = useState(0);
  const [pos, setPos] = useState(at0);
  const [done, setDone] = useState(false);
  const [far, setFar] = useState(at0);      // дальше всего дошли в этой порции (листать вперёд свайпом — до сюда)
  const [enter, setEnter] = useState(null);
  const step = (p, dir) => { setPos(p); setEnter(dir); scrollTo(0, 0); };
  // у правил кнопки «дальше» нет — правило пройдено, как только открыли
  useEffect(() => { const x = !done && queue[start + pos]; if (rules && x) T(x.g).markSeen(course, x.g, x.item); }, [start, pos, done]);
  useSwipe(one ? null : done ? () => { setDone(false); setEnter('left'); scrollTo(0, 0); } : pos > 0 ? () => step(pos - 1, 'left') : null,
    one || done ? null : () => (pos < far ? step(pos + 1, 'right') : next('right')));   // вперёд — всегда, как «Далі» (25.11.2026)
  const speakOf = (x) => x && x.g.type === 'relation' ? x.item.w : '';   // что озвучить при перелистывании
  const preview = queue[start + pos];
  // Звук включён — слово экрана озвучивается само при перелистывании (26.11.2026); у правил слов нет
  useEffect(() => { const w = !done && speakOf(preview); if (w && getState().autoplay !== false) tts.speak(w, ttsLang(course)); }, [start, pos, done]);
  if (!groups.length) return null;
  const list = queue.slice(start, size === Infinity ? undefined : start + size);
  const left = Math.max(0, queue.length - start - list.length);
  const cur = list[pos];

  if (done || !cur) {
    const pr = groups.reduce((a, g) => { const x = T(g).progressOf(course, g); return { seen: a.seen + x.seen, total: a.total + x.total }; }, { seen: 0, total: 0 });
    return html`<${GroupDone} title=${groups.map((g) => L(g.title)).join('», «')} many=${groups.length > 1} seen=${pr.seen} total=${pr.total}
      left=${left} next=${Math.min(size, left)} unit=${groups.every((g) => g.type === 'irregular') ? 'verbs' : groups.every((g) => T(g).unit) ? T(groups[0]).unit : 'words'}
      onMore=${() => { setStart(start + list.length); setPos(0); setFar(0); setEnter(null); setDone(false); scrollTo(0, 0); }}
      onRepeat=${() => { setPos(0); setFar(0); setEnter(null); setDone(false); scrollTo(0, 0); }}
      onFinish=${() => go('today', {}, true)} />`;
  }
  function next(dir = null) {
    T(cur.g).markSeen(course, cur.g, cur.item);
    if (pos + 1 < list.length) { step(pos + 1, dir); setFar(Math.max(far, pos + 1)); } else { setFar(Math.max(far, pos)); setEnter(dir); setDone(true); }
  }
  const Item = T(cur.g).Item;
  // Заголовка добірки над карточками нет (решение дизайнера, 26.11.2026; было «Синоніми», «Антоніми»…)
  return html`<${Screen} key=${start + ':' + pos} cls=${cx('screen--grey', enterCls(enter))} tone="sky" bottom=${rules ? null : html`<div class="row-arrows row-arrows--compact">
      <button class="nav-arrow" disabled=${pos === 0} onClick=${() => step(pos - 1, 'left')} aria-label=${t('lesson.prevWord')}><${Icon} name="chevron-left" size=${22} /></button>
      <${Button} variant="secondary" label=${t('lesson.alreadyKnow')} onClick=${() => { knowWords(course, (T(cur.g).knownWords || (() => []))(cur.item)); pos < far ? step(pos + 1, 'right') : next('right'); }} />
      <button class="nav-arrow" onClick=${() => (pos < far ? step(pos + 1, 'right') : next('right'))} aria-label=${t('lesson.nextWord')}><${Icon} name="chevron-right" size=${22} /></button></div>`}>
    ${one ? html`<${TopBar} onClose=${back} />` : html`<${TopBar} onClose=${back} total=${list.length} done=${pos + 1} count=${`${pos + 1} / ${list.length}`} sound=${!!speakOf(cur)} />`}
    <${Item} key=${cur.g.id + ':' + cur.item.id} course=${course} group=${cur.g} item=${cur.item} />
  </${Screen}>`;
}
