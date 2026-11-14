// Тест уровня (экраны 02a–02c): слово → четыре перевода. Верно два раза подряд — уровень выше, ошибка — ниже.
import { CONFIG } from '../config.js';
import { LEVELS } from '../content/index.js';
import { L } from '../i18n/index.js';

const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export function newTest() {
  return { lvl: 0, streak: 0, asked: [], answers: [], size: CONFIG.testSize };
}

export function question(course, test) {
  const level = LEVELS[test.lvl];
  const pool = course.words.filter((w) => w.lvl === level && w.pos !== 'phr' && !test.asked.includes(w.id) && w.tr.uk);
  const w = rnd(pool);
  const sameKind = course.words.filter((x) => x.lvl === level && x.pos === w.pos && x.id !== w.id && L(x.tr) !== L(w.tr));
  const wrong = [];
  while (wrong.length < 3 && sameKind.length) { const x = rnd(sameKind); if (!wrong.includes(L(x.tr))) wrong.push(L(x.tr)); }
  const short = (s) => s.split(/[,;(]/)[0].trim();
  return { word: w, level, options: shuffle([short(L(w.tr)), ...wrong.map(short)]), answer: short(L(w.tr)) };
}

export function answer(test, q, picked) {
  const ok = picked === q.answer;
  test.asked.push(q.word.id);
  test.answers.push({ level: q.level, ok });
  if (ok) { test.streak++; if (test.streak >= 2 && test.lvl < LEVELS.length - 1) { test.lvl++; test.streak = 0; } }
  else { test.streak = 0; test.lvl = Math.max(0, test.lvl - 1); }
  return ok;
}

export const isOver = (test) => test.answers.length >= test.size;

// Уровень: самый высокий, где верно хотя бы 60 % (и спросили минимум дважды)
export function result(test) {
  let best = 'A1';
  for (const lvl of LEVELS) {
    const a = test.answers.filter((x) => x.level === lvl);
    if (a.length >= 2 && a.filter((x) => x.ok).length / a.length >= 0.6) best = lvl;
  }
  return { level: best, correct: test.answers.filter((x) => x.ok).length, total: test.answers.length };
}
