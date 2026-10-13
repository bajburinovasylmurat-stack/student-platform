"""Базада бұрыннан бар ҰТО тесттерін seed/uto-nuska-N.json мазмұнымен теңестіретін SQL шығарады.

seed файлдары бір рет қана жүктеледі, сондықтан кейінгі түзетулер осы арқылы жеткізіледі:
    python3 scripts/uto/sync_sql.py | psql "$DATABASE_URL"
"""
import glob
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))


def lit(value):
    return 'NULL' if value is None else "'" + str(value).replace("'", "''") + "'"


print('BEGIN;')
for path in sorted(glob.glob(os.path.join(HERE, '..', '..', 'seed', 'uto-nuska-*.json'))):
    for test in json.load(open(path, encoding='utf-8'))['tests']:
        for idx, q in enumerate(test['questions']):
            multi = q.get('correct_indexes')
            print(f"""UPDATE test_questions SET question = {lit(q['question'])}, options = {lit(json.dumps(q['options'], ensure_ascii=False))}::jsonb,
  correct_index = {q['correct_index']}, correct_indexes = {lit(json.dumps(multi)) + '::jsonb' if multi else 'NULL'},
  points = {q['points']}, image = {lit(q.get('image'))}, solution_url = {lit(q.get('solution_url'))}
WHERE idx = {idx} AND test_id = (SELECT id FROM tests WHERE title = {lit(test['title'])} AND topic = {lit(test['topic'])});""")
print('COMMIT;')
