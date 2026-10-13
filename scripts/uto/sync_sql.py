"""Базада бұрыннан бар ҰТО тесттерінің сұрақтарын seed/uto-nuska-N.json мазмұнымен ауыстыратын SQL шығарады.

seed файлдары бір рет қана жүктеледі, сондықтан кейінгі түзетулер осы арқылы жеткізіледі:
    python3 scripts/uto/sync_sql.py | psql "$DATABASE_URL"
Сұрақтар қайта құрылады: ескі әрекеттердегі жауаптар жаңа сұрақтарға байланбайды.
"""
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def lit(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"


def js(value):
    return lit(json.dumps(value, ensure_ascii=False)) + '::jsonb' if value else 'NULL'


print('BEGIN;')
for path in sorted(glob.glob(os.path.join(HERE, '..', '..', 'seed', 'uto-nuska-*.json'))):
    for test in json.load(open(path, encoding='utf-8'))['tests']:
        test_id = f"(SELECT id FROM tests WHERE title = {lit(test['title'])} AND topic = {lit(test['topic'])})"
        print(f'DELETE FROM test_questions WHERE test_id = {test_id};')
        for idx, q in enumerate(test['questions']):
            print(f"""INSERT INTO test_questions (test_id, idx, question, options, correct_index, correct_indexes, match_rows, points, image, solution_url)
SELECT id, {idx}, {lit(q['question'])}, {js(q['options'])}, {q['correct_index']}, {js(q.get('correct_indexes'))}, {js(q.get('match_rows'))},
  {q['points']}, {lit(q.get('image'))}, {lit(q.get('solution_url'))} FROM tests WHERE id = {test_id};""")
print('COMMIT;')
