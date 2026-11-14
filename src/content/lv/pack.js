// Языковой пакет: латышский. Пока выключен (Latvian отложен). Чтобы включить — одна строка в src/content/index.js.
// Слова — words.tsv (208 слов, черновик: переводы и примеры стоит проверить с носителем языка).
// Группы добавляются так же, как в английском: таблица в папке groups/ + строка в списке groups (см. src/content/en/pack.js).
export default {
  id: 'lv',
  code: 'LV',
  name: 'Latviešu',
  tts: 'lv-LV',                                         // голос телефона для озвучки
  inLang: { uk: 'латиською', ru: 'по-латышски' },        // «Згадай латиською»
  ofLang: { uk: 'латиської', ru: 'латышского' },         // «твій рівень латиської»
  files: { words: 'words.tsv' },
  groups: [
    // { id: 'synonyms', type: 'relation', file: 'groups/synonyms.tsv', title: { uk: 'Синоніми', ru: 'Синонимы' },
    //   chip: { uk: '≈ синоніми', ru: '≈ синонимы' }, examples: { uk: 'Порівняй', ru: 'Сравни' }, note: { uk: 'У чому різниця', ru: 'В чём разница' } },
  ],
};
