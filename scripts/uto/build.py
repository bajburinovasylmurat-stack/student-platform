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

VIDEOS = {1: 'jzG4_u5LPis', 2: 'm1ASzrjfPGI', 3: 'x0eDUj7ldjI', 4: 'ag2M8IyLcHE'}
# Әр есептің видеода талдана бастайтын секунды (файлдағы есептер ретімен; сәйкестендірудің екі жолына бір уақыт)
STARTS = {
    1: [665, 770, 975, 1125, 1325, 1395, 1445, 1520, 1635, 1840, 1965, 2075, 2240, 2305, 2470, 2570, 2635, 2795, 3045, 3140,
        3330, 3655, 3835, 3980, 4185, 4615, 4700, 4765, 4870, 5022, 5100, 5160, 5295, 5355, 5460, 5925, 6000, 6150, 6510, 6745],
    2: [650, 810, 900, 1000, 1045, 1160, 1200, 1240, 1335, 1400, 1495, 1615, 1680, 1875, 1935, 2085, 2295, 2500, 2625, 2860,
        3095, 3400, 3620, 4005, 4240, 4510, 4670, 4748, 4805, 4820, 4895, 5060, 5285, 5380, 5570, 5665, 5775, 5990, 6165],
    3: [275, 365, 450, 520, 580, 665, 795, 925, 1055, 1110, 1245, 1300, 1345, 1515, 1620, 1940, 2145, 2870, 2940, 3095,
        3240, 3355, 3450, 3595, 3980, 4460, 4760, 4940, 5105, 5145, 5235, 5395, 5510, 5715, 5890, 5975, 6090, 6265, 6435],
    4: [525, 600, 770, 835, 885, 940, 1035, 1255, 1500, 1580, 1745, 1870, 1935, 2085, 2335, 2560, 2690, 2760, 3325, 3710,
        3835, 4300, 4485, 4680, 4825, 5145, 5280, 5425, 5445, 5510, 5605, 5930, 6220, 6290, 6420, 6715, 6850, 6930, 7160, 7345],
}

for n, source in SOURCES.items():
    helpers.GUESSED.clear()
    questions = importlib.import_module(f'n{n}').QUESTIONS
    starts = iter(STARTS[n])
    seconds = None
    for item in questions:
        if '\n\nӘ) ' not in item['question']:  # сәйкестендірудің екінші жолы алдыңғысымен бір видеода
            seconds = next(starts)
        item['solution_url'] = f'https://www.youtube.com/watch?v={VIDEOS[n]}&t={seconds}s'
        correct = item.get('correct_indexes', [item['correct_index']])
        assert len(set(item['options'])) == len(item['options']), (n, item['question'][:40], 'қайталанған нұсқа')
        assert all(0 <= c < len(item['options']) for c in correct), (n, item['question'][:40])
        assert item['question'].count('$') % 2 == 0 and all(o.count('$') % 2 == 0 for o in item['options']), (n, item['question'][:40])
        if item.get('image'):
            assert os.path.exists(os.path.join(HERE, '..', '..', 'frontend', 'public', item['image'].lstrip('/'))), item['image']
    assert next(starts, None) is None, (n, 'уақыттар саны есептер санына сәйкес емес')
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
