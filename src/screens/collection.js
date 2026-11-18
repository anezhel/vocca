// Занятие по добіркам (3.1–3.10) и итог 3.11. Открывается с «Що тренуємо» (выбраны добірки — уровень и статус слов
// не учитываются) или кнопкой «Вчити / Почати / Повторити» у добірки на «Практика».
// Экраны идут один за другим, внизу «Далі»; за заход — «Кількість слів» с «Що тренуємо» (по умолчанию 20).
import { html, useState } from '../../lib/preact-htm.js';
import { CONFIG } from '../config.js';
import { GROUP_TYPES } from '../groups/index.js';
import { t, L } from '../i18n/index.js';
import { Screen, TopBar, Title, Button } from '../ui/kit.js';
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
  // с «Що тренуємо» приходят и уровни: берём слова добірки только этих уровней. Если непройденные такого уровня
  // кончились, а в добірці ещё есть непройденные других уровней — повторяем слова выбранных уровней.
  const lv = route.levels && route.levels.length ? route.levels : null;
  const ofLevel = (items) => (lv ? items.filter((item) => lv.includes(item.lvl)) : items);
  const build = (review) => groups.flatMap((g) => {
    let q = ofLevel(T(g).queue(course, g, review));
    if (!q.length && !review) q = ofLevel(T(g).queue(course, g, true));
    return q.map((item) => ({ g, item }));
  });
  const [queue] = useState(() => build(!!route.review));
  const [start, setStart] = useState(0);
  const [pos, setPos] = useState(0);
  const [done, setDone] = useState(false);
  if (!groups.length) return null;
  const list = queue.slice(start, size === Infinity ? undefined : start + size);
  const left = Math.max(0, queue.length - start - list.length);
  const cur = list[pos];

  if (done || !cur) {
    const pr = groups.reduce((a, g) => { const x = T(g).progressOf(course, g); return { seen: a.seen + x.seen, total: a.total + x.total }; }, { seen: 0, total: 0 });
    // с выбранными уровнями итог говорит о них: «Усі слова групи «Синоніми · A1» пройдено» (если выбраны не все уровни добірки)
    const lvPart = (g) => (lv && g.items.some((x) => !lv.includes(x.lvl)) ? ' · ' + lv.join(', ') : '');
    return html`<${GroupDone} title=${groups.map((g) => L(g.title) + lvPart(g)).join('», «')} many=${groups.length > 1} seen=${pr.seen} total=${pr.total}
      left=${left} next=${Math.min(size, left)} unit=${groups.every((g) => g.type === 'irregular') ? 'verbs' : 'words'}
      onMore=${() => { setStart(start + list.length); setPos(0); setDone(false); scrollTo(0, 0); }}
      onRepeat=${() => { setPos(0); setDone(false); scrollTo(0, 0); }}
      onFinish=${() => go('today', {}, true)} />`;
  }
  const next = () => {
    T(cur.g).markSeen(course, cur.g, cur.item);
    if (pos + 1 < list.length) { setPos(pos + 1); scrollTo(0, 0); } else setDone(true);
  };
  const Item = T(cur.g).Item;
  return html`<${Screen} cls="screen--grey" tone="sky" bottom=${html`<${Button} label=${t('common.next')} onClick=${next} />`}>
    <${TopBar} onClose=${back} total=${list.length} done=${pos + 1} count=${`${pos + 1} / ${list.length}`} />
    <${Title} main=${L(cur.g.title)} cls="title--group" />
    <${Item} key=${cur.g.id + ':' + cur.item.id} course=${course} group=${cur.g} item=${cur.item} />
  </${Screen}>`;
}
