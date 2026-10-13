"""ҰТО нұсқаларын seed/uto-nuska-N.json файлдарына жинайды (сервер қосылғанда бір рет жүктеледі).

Іске қосу: python3 scripts/uto/build.py
"""
import importlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import helpers  # noqa: E402

SEED = os.path.join(HERE, '..', '..', 'seed')
SOURCES = {
    1: 'ҰТО нұсқа талдау (Ерсұлтан ағай, 18.06.2025)',
    2: 'ҰТО жаңа нұсқа талдау (Ерсұлтан ағай, 20.06.2025)',
    3: 'Қаңтар ҰБТ-ға дайындық, ҰТО нұсқасы (Ерс ағай, 17.01.2025)',
    4: 'ҰТО нұсқа талдауы (Ерс ағай, 26.11.2025)',
}

for n, source in SOURCES.items():
    helpers.GUESSED.clear()
    questions = importlib.import_module(f'n{n}').QUESTIONS
    for item in questions:
        correct = item.get('correct_indexes', [item['correct_index']])
        assert len(set(item['options'])) == len(item['options']), (n, item['question'][:40], 'қайталанған нұсқа')
        assert all(0 <= c < len(item['options']) for c in correct), (n, item['question'][:40])
        assert item['question'].count('$') % 2 == 0 and all(o.count('$') % 2 == 0 for o in item['options']), (n, item['question'][:40])
        if item.get('image'):
            assert os.path.exists(os.path.join(HERE, '..', '..', 'frontend', 'public', item['image'].lstrip('/'))), item['image']
    test = {
        'title': f'ҰТО {n}-нұсқа',
        'description': f'Математика · {source}. Видеодағы есептер жауап нұсқаларымен.',
        'duration_min': 100,
        'topic': 'ҰТО есептері',
        'questions': questions,
    }
    path = os.path.join(SEED, f'uto-nuska-{n}.json')
    with open(path, 'w', encoding='utf-8') as f:
        json.dump({'tests': [test]}, f, ensure_ascii=False, indent=1)
    print(f'{n}-нұсқа: {len(questions)} сұрақ, {sum(q["points"] for q in questions)} балл, '
          f'толықтырылған нұсқалары бар: {len(helpers.GUESSED)}')
