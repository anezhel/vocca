// Типы групп. Новый тип экрана группы = файл в этой папке + одна строка ниже. Сами группы перечислены в src/content/<язык>/pack.js.
import relation from './relation.js';
import irregular from './irregular.js';
import rule from './rule.js';

export const GROUP_TYPES = { relation, irregular, rule };
