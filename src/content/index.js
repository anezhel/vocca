// Языки, которые можно учить. Новый язык = папка src/content/<код>/ (pack.js + words.tsv) и ОДНА строка в COURSES.
import en from './en/pack.js';
import lv from './lv/pack.js';   // латышский: пока только карточка на экране 01 (см. PREVIEW)

export const COURSES = [en];       // ← и дописать сюда: [en, lv]
// Языки, которые видны на экране 01, но ещё не включены: выбрать можно, учиться пока будем английскому.
// Когда латышский будет готов — перенести lv в COURSES и убрать отсюда. count — для подписи «200+ слів».
export const PREVIEW = [{ ...lv, count: 200 }];
export const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']; // C1 и C2 добавлены 16.11.2026

export const getCourse = (id) => COURSES.find((c) => c.id === id) || COURSES[0];

// Таблица с табуляцией: первая строка — названия колонок, строки с # — комментарии.
export function parseTSV(text) {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.trim() && !l.startsWith('#'));
  const head = lines.shift().split('\t').map((s) => s.trim());
  return lines.map((l) => {
    const cells = l.split('\t');
    const row = {};
    head.forEach((h, i) => { row[h] = (cells[i] || '').trim(); });
    return row;
  });
}

export async function fetchTable(course, file) {
  const res = await fetch(new URL(`./${course.id}/${file}`, import.meta.url));
  if (!res.ok) throw new Error(`${course.id}/${file}: ${res.status}`);
  return parseTSV(await res.text());
}

// Текст на трёх языках из колонок «x», «x_uk», «x_ru» (пустые → null)
export const tri = (r, base, en = r[base]) => {
  const uk = r[base + '_uk'] || '', ru = r[base + '_ru'] || '';
  return en || uk || ru ? { en: en || '', uk: uk || ru, ru: ru || uk } : null;
};

function wordFromRow(r, seen) {
  let id = r.id || r.word;
  while (seen.has(id)) id += '+';
  seen.add(id);
  const ex = [tri(r, 'example'), tri(r, 'example2')].filter((x) => x && x.en);
  return {
    id, w: r.word, wUk: r.word_uk || '', ipa: r.ipa || '', ipaUk: r.ipa_uk || '', pos: r.pos || '', lvl: r.level, topic: r.topic || '',
    tr: { uk: r.uk || r.ru, ru: r.ru || r.uk }, ex,
    def: r.def || r.def_uk || r.def_ru ? { en: r.def || '', uk: r.def_uk || r.def_ru || '', ru: r.def_ru || r.def_uk || '' } : null,
    note: r.note_uk || r.note_ru ? { uk: r.note_uk || r.note_ru, ru: r.note_ru || r.note_uk } : null,
  };
}

// Загружает слова и группы выбранного языка. Группа без своей таблицы просто не показывается.
export async function loadCourse(course, groupTypes) {
  if (course.loaded) return course;
  const seen = new Set();
  course.words = (await fetchTable(course, course.files.words)).filter((r) => r.word && LEVELS.includes(r.level)).map((r) => wordFromRow(r, seen));
  course.byId = new Map(course.words.map((w) => [w.id, w]));
  course.byText = new Map();
  for (const w of course.words) if (!course.byText.has(w.w.toLowerCase())) course.byText.set(w.w.toLowerCase(), w);
  course.groupList = [];
  await Promise.all((course.groups || []).map(async (g) => {
    const type = groupTypes[g.type];
    if (!type || !g.file) return;
    try {
      const rows = await fetchTable(course, g.file);
      g.items = type.load(rows, g, course);
      if (g.items.length) course.groupList.push(g);
    } catch (e) { console.warn('vocca: group', g.id, e); }
  }));
  course.groupList.sort((a, b) => course.groups.indexOf(a) - course.groups.indexOf(b));
  course.loaded = true;
  return course;
}
