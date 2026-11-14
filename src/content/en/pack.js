// Языковой пакет: английский. Слова — words.tsv, группы — папка groups/ (все таблицы открываются в Excel, Numbers, Google Таблицах).
//
// Как добавить группу: положите таблицу в groups/ и добавьте строку в список groups ниже.
// Как убрать группу: удалите или закомментируйте её строку (// в начале). Таблицу можно оставить.
// Порядок строк = порядок карточек на экране «Групи» (группы в процессе всё равно поднимаются наверх).
//
// type — как выглядит экран группы:
//   'relation'  — слово и связанные с ним слова (синонимы, антонимы, ложные друзья…) — src/groups/relation.js
//   'irregular' — неправильные глаголы с тренажёром трёх форм — src/groups/irregular.js
// chip — подпись-связка между карточками, examples / note — заголовки блоков «Порівняй» и пояснения.

export default {
  id: 'en',
  code: 'EN',
  name: 'English',
  inLang: { uk: 'англійською', ru: 'по-английски' },   // «Згадай англійською»
  ofLang: { uk: 'англійської', ru: 'английского' },    // «твій рівень англійської»
  variantTitle: { uk: 'Англійська', ru: 'Английский' }, // строка в настройках
  files: { words: 'words.tsv' },

  // Вариант английского (Настройки → «Англійська · вимова й слова»). tts — голос телефона для озвучки.
  variants: [
    { id: 'us', name: { uk: 'США', ru: 'США' }, tts: 'en-US' },
    { id: 'uk', name: { uk: 'Британія', ru: 'Британия' }, tts: 'en-GB' },
  ],

  groups: [
    { id: 'irregular', type: 'irregular', file: 'groups/irregular.tsv',
      title: { uk: 'Неправильні дієслова', ru: 'Неправильные глаголы' } },
    { id: 'false-friends', type: 'relation', file: 'groups/false-friends.tsv',
      title: { uk: 'Хибні друзі', ru: 'Ложные друзья' }, chip: { uk: '≠ не плутай', ru: '≠ не путай' },
      examples: { uk: 'Порівняй', ru: 'Сравни' }, note: { uk: 'Чому плутають', ru: 'Почему путают' } },
    { id: 'confusing', type: 'relation', file: 'groups/confusing.tsv',
      title: { uk: 'Слова, які плутають', ru: 'Слова, которые путают' }, chip: { uk: '⇄ не плутай', ru: '⇄ не путай' },
      examples: { uk: 'Порівняй', ru: 'Сравни' }, note: { uk: 'Як запам’ятати', ru: 'Как запомнить' } },
    { id: 'idioms', type: 'relation', file: 'groups/idioms.tsv', meaning: true,
      title: { uk: 'Ідіоми', ru: 'Идиомы' }, chip: { uk: '= насправді', ru: '= на самом деле' },
      examples: { uk: 'Приклади', ru: 'Примеры' }, note: { uk: 'Де так кажуть', ru: 'Где так говорят' } },
    { id: 'phrasal', type: 'relation', file: 'groups/phrasal.tsv',
      title: { uk: 'Фразові дієслова', ru: 'Фразовые глаголы' }, chip: { uk: '+ частка', ru: '+ частица' },
      examples: { uk: 'Приклади', ru: 'Примеры' }, note: { uk: 'Як це працює', ru: 'Как это работает' } },
    { id: 'word-family', type: 'relation', file: 'groups/word-family.tsv',
      title: { uk: 'Спільнокореневі', ru: 'Однокоренные' }, chip: { uk: '≈ одна родина', ru: '≈ одна семья' },
      examples: { uk: 'Приклади', ru: 'Примеры' }, note: { uk: 'Як утворюються', ru: 'Как образуются' } },
    { id: 'similar', type: 'relation', file: 'groups/similar.tsv',
      title: { uk: 'Схожі слова', ru: 'Похожие слова' }, chip: { uk: '≈ звучить схоже', ru: '≈ звучит похоже' },
      examples: { uk: 'Порівняй', ru: 'Сравни' }, note: { uk: 'Як розрізнити', ru: 'Как различить' } },
    { id: 'collocations', type: 'relation', file: 'groups/collocations.tsv',
      title: { uk: 'Сталі вирази', ru: 'Устойчивые выражения' }, chip: { uk: '+ {link}', ru: '+ {link}' },
      examples: { uk: 'Приклади', ru: 'Примеры' }, note: { uk: 'Чому саме {link}', ru: 'Почему именно {link}' } },
    { id: 'synonyms', type: 'relation', file: 'groups/synonyms.tsv',
      title: { uk: 'Синоніми', ru: 'Синонимы' }, chip: { uk: '≈ синоніми', ru: '≈ синонимы' },
      examples: { uk: 'Порівняй', ru: 'Сравни' }, note: { uk: 'У чому різниця', ru: 'В чём разница' } },
    { id: 'antonyms', type: 'relation', file: 'groups/antonyms.tsv',
      title: { uk: 'Антоніми', ru: 'Антонимы' }, chip: { uk: '↔ антоніми', ru: '↔ антонимы' },
      examples: { uk: 'Порівняй', ru: 'Сравни' }, note: { uk: 'У чому різниця', ru: 'В чём разница' } },
    { id: 'pronouns', type: 'relation', file: 'groups/pronouns.tsv',
      title: { uk: 'Займенники', ru: 'Местоимения' }, chip: { uk: '→ інші форми', ru: '→ другие формы' },
      examples: { uk: 'Приклади', ru: 'Примеры' }, note: { uk: 'Коли яка форма', ru: 'Когда какая форма' } },
  ],

  // Подсказки тренажёра неправильных глаголов (колонка hint в groups/irregular.tsv)
  verbHints: {
    iau: { ru: 'i → a → u, как sing — sang — sung и swim — swam — swum.', uk: 'i → a → u, як sing — sang — sung і swim — swam — swum.' },
    same: { ru: 'Все три формы одинаковые, как cut — cut — cut и put — put — put.', uk: 'Усі три форми однакові, як cut — cut — cut і put — put — put.' },
    ought: { ru: 'Вторая и третья формы на -ought / -aught, как buy — bought — bought и teach — taught — taught.', uk: 'Друга й третя форми на -ought / -aught, як buy — bought — bought і teach — taught — taught.' },
    twin: { ru: 'Вторая и третья формы совпадают, как send — sent — sent и keep — kept — kept.', uk: 'Друга й третя форми збігаються, як send — sent — sent і keep — kept — kept.' },
    aba: { ru: 'Третья форма совпадает с первой, как come — came — come и run — ran — run.', uk: 'Третя форма збігається з першою, як come — came — come і run — ran — run.' },
    en: { ru: 'Третья форма на -en или -n, как take — took — taken и give — gave — given.', uk: 'Третя форма на -en або -n, як take — took — taken і give — gave — given.' },
    own: { ru: '-ew во второй форме и -own / -awn в третьей, как know — knew — known и draw — drew — drawn.', uk: '-ew у другій формі та -own / -awn у третій, як know — knew — known і draw — drew — drawn.' },
    oken: { ru: '-o- во второй форме и -o-…-en в третьей, как speak — spoke — spoken и choose — chose — chosen.', uk: '-o- у другій формі та -o-…-en у третій, як speak — spoke — spoken і choose — chose — chosen.' },
    itten: { ru: '-o- во второй форме и -i-…-en в третьей, как write — wrote — written и drive — drove — driven.', uk: '-o- у другій формі та -i-…-en у третій, як write — wrote — written і drive — drove — driven.' },
    ore: { ru: '-ore во второй форме и -orn в третьей, как wear — wore — worn и tear — tore — torn.', uk: '-ore у другій формі та -orn у третій, як wear — wore — worn і tear — tore — torn.' },
    us: { ru: 'Американский вариант: get — got — gotten, prove — proved — proven.', uk: 'Американський варіант: get — got — gotten, prove — proved — proven.' },
    unique: { ru: 'Особый глагол — формы стоит запомнить целиком.', uk: 'Особливе дієслово — форми варто запам’ятати повністю.' },
  },
};
