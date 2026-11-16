// Экран 09 «Групи слів». Порядок: в процессе и к повторению — сверху, не начатые — дальше, выученные — внизу.
import { html } from '../../lib/preact-htm.js';
import { GROUP_TYPES } from '../groups/index.js';
import { t, L } from '../i18n/index.js';
import { Screen, Title, Icon, cx } from '../ui/kit.js';

const ORDER = { due: 0, learning: 1, fresh: 2, done: 3 };

export function Groups({ course, go }) {
  const list = course.groupList.map((g) => ({ g, s: GROUP_TYPES[g.type].stats(course, g) }))
    .sort((a, b) => ORDER[a.s.status] - ORDER[b.s.status]);
  return html`<${Screen} cls="screen--tab">
    <div class="top-space"></div>
    <${Title} main=${t('groups.title')} />
    <div class="group-list">${list.map(({ g, s }) => html`<${GroupCard} key=${g.id} title=${L(g.title)} s=${s}
      onOpen=${() => go('group', { group: g.id })} onRepeat=${() => go(s.repeatRoute || 'group', { group: g.id, review: true })} />`)}</div>
  </${Screen}>`;
}

// Aura/Group card: Not started · Learning · Review due · Done
export function GroupCard({ title, s, onOpen, onRepeat }) {
  const repeat = s.status === 'due' || s.status === 'done';
  return html`<div class=${cx('card group-card', 'group-card--' + s.status)} onClick=${onOpen} role="button" tabindex="0">
    <div class="group-card__head">
      <div class="group-card__text"><div class="t-title-l">${title}</div><div class="t-label-12-medium muted">${s.subtitle}</div></div>
      ${repeat ? html`<button class="repeat-btn t-label-14-strong" onClick=${(e) => { e.stopPropagation(); onRepeat(); }}><${Icon} name="refresh" size=${16} />${t('groups.repeat')}</button>`
        : html`<span class="ib ib--lime" style="--ib:36px"><${Icon} name="chevron-right" size=${16} /></span>`}
    </div>
    ${(s.status === 'learning' || s.status === 'due') && html`<div class="meter"><i style=${`width:${Math.round((s.learned / s.total) * 100)}%`}></i></div>`}
  </div>`;
}

// Экран конкретной группы: какой именно — решает её тип (src/groups)
export function GroupRoute(props) {
  const g = props.course.groupList.find((x) => x.id === props.route.group);
  if (!g) return null;
  const Screen = GROUP_TYPES[g.type].Screen;
  return html`<${Screen} ...${props} group=${g} />`;
}
