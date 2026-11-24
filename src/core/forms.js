// Формы слова для выделения в примерах (25.11.2026): «smile» выделяется и в «She always smiles», «decide» — в «We decided…».
// Правила английского: -s / -es / -ed / -ing / -er / -est / -ly, smile → smiling, try → tries / tried, stop → stopped,
// knife → knives; неправильные глаголы — из таблицы «3 форми дієслів» (go → went, gone), несколько неправильных множественных.
// Во фразах («give up», «video game») меняется первое или последнее слово: gave up, video games.

const IRR = new Map();   // v1 → [формы]; заполняет groups/irregular.js при загрузке таблицы
export const addIrregular = (v1, forms) => IRR.set(v1.toLowerCase(), forms.map((f) => f.toLowerCase()));
const PLURAL = { child: 'children', man: 'men', woman: 'women', person: 'people', foot: 'feet', tooth: 'teeth', mouse: 'mice', goose: 'geese' };
const V = 'aeiou';

export function wordForms(word) {
  const w = word.toLowerCase(), out = new Set([w]);
  const irr = IRR.get(w);
  if (irr) irr.forEach((f) => out.add(f));
  if (PLURAL[w]) out.add(PLURAL[w]);
  if (w.length <= 2) return out;                         // be, go, do, us — только сами и неправильные формы
  const add = (...xs) => xs.forEach((x) => out.add(x));
  add(w + 's', w + 'es', w + 'ing', w + 'er', w + 'est', w + 'ly', w + "'s");
  if (!irr) add(w + 'ed');
  if (w.endsWith('e')) { add(w.slice(0, -1) + 'ing', w.slice(0, -1) + 'er', w.slice(0, -1) + 'est'); if (!irr) add(w + 'd'); }
  if (w.endsWith('ie')) add(w.slice(0, -2) + 'ying');
  if (w.endsWith('le')) add(w.slice(0, -1) + 'y');
  if (w.endsWith('ic')) add(w + 'ally');
  if (w.endsWith('f')) add(w.slice(0, -1) + 'ves');
  if (w.endsWith('fe')) add(w.slice(0, -2) + 'ves');
  const [a, b, c] = [w.at(-3), w.at(-2), w.at(-1)];
  if (c === 'y' && !V.includes(b)) { const s = w.slice(0, -1); add(s + 'ies', s + 'ier', s + 'iest', s + 'ily'); if (!irr) add(s + 'ied'); }
  if (!(V + 'wxy').includes(c) && V.includes(b) && !V.includes(a)) { const d = w + c; add(d + 'ing', d + 'er', d + 'est'); if (!irr) add(d + 'ed'); }
  return out;
}

// Все формы слова или фразы — для регулярного выражения в Mark
export function phraseForms(p) {
  const t = p.trim().split(/\s+/);
  if (t.length === 1) return wordForms(t[0]);
  const out = new Set();
  for (const f of wordForms(t[0])) out.add([f, ...t.slice(1)].join(' '));
  for (const f of wordForms(t[t.length - 1])) out.add([...t.slice(0, -1), f].join(' '));
  return out;
}
