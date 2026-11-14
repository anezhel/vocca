#!/usr/bin/env python3
"""Проверка таблиц слов и групп после правок.  Запуск:  python3 tools/check-content.py
Находит: пустые обязательные колонки, неверный уровень, повторы слов, незакрытые [скобки] в примерах, сдвинутые колонки."""
import os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT = os.path.join(ROOT, 'src', 'content')
LEVELS = {'A1', 'A2', 'B1', 'B2'}
problems = 0


def warn(file, line, text):
    global problems
    problems += 1
    print(f'  {os.path.relpath(file, ROOT)}:{line}  {text}')


def table(path):
    lines = open(path, encoding='utf-8').read().replace('\r', '').split('\n')
    head = lines[0].split('\t')
    rows = []
    for n, l in enumerate(lines[1:], 2):
        if not l.strip() or l.startswith('#'):
            continue
        cells = l.split('\t')
        if len(cells) > len(head):
            warn(path, n, f'лишние колонки ({len(cells)} вместо {len(head)}) — возможно, табуляция внутри текста')
        rows.append((n, {h: (cells[i].strip() if i < len(cells) else '') for i, h in enumerate(head)}))
    return head, rows


def brackets(path, n, r):
    for k, v in r.items():
        if v.count('[') != v.count(']'):
            warn(path, n, f'в колонке {k} не закрыта [скобка]: {v[:60]}')


for lang in sorted(os.listdir(CONTENT)):
    folder = os.path.join(CONTENT, lang)
    if not os.path.isdir(folder):
        continue
    print(f'Язык {lang}')
    words = os.path.join(folder, 'words.tsv')
    if os.path.exists(words):
        head, rows = table(words)
        seen = {}
        for n, r in rows:
            if not r.get('word'):
                warn(words, n, 'пустое слово (колонка word)')
            if r.get('level') not in LEVELS:
                warn(words, n, f'уровень «{r.get("level")}» — нужен A1, A2, B1 или B2')
            if not (r.get('uk') or r.get('ru')):
                warn(words, n, f'нет перевода: {r.get("word")}')
            key = r.get('word', '').lower()
            if key in seen:
                warn(words, n, f'слово «{r.get("word")}» уже есть в строке {seen[key]} (прогресс у них общий не будет)')
            seen.setdefault(key, n)
            brackets(words, n, r)
        print(f'  words.tsv: {len(rows)} слов')
    gdir = os.path.join(folder, 'groups')
    for f in sorted(os.listdir(gdir)) if os.path.isdir(gdir) else []:
        if not f.endswith('.tsv'):
            continue
        path = os.path.join(gdir, f)
        head, rows = table(path)
        for n, r in rows:
            brackets(path, n, r)
            if 'v1' in head:
                if not (r.get('v1') and r.get('v2') and r.get('v3')):
                    warn(path, n, 'нужны все три формы: v1, v2, v3')
            elif not r.get('word'):
                warn(path, n, 'пустая колонка word')
            elif not (r.get('to1') or r.get('to1_uk') or r.get('to1_ru')):
                warn(path, n, f'у «{r.get("word")}» нет связанного слова (to1)')
        print(f'  groups/{f}: {len(rows)} строк')

print('Всё в порядке' if not problems else f'Найдено замечаний: {problems}')
sys.exit(1 if problems else 0)
