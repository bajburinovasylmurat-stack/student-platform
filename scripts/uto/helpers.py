# ҰТО нұсқаларын seed/*.json форматына айналдыратын көмекшілер
GUESSED = []  # жауап тізімі видеода толық көрінбеген сәйкестендіру есептері


def q(text, options, correct, image=None, points=1, guessed=False):
    if guessed:
        GUESSED.append(text[-70:])
    item = {'question': text, 'options': options, 'correct_index': correct, 'points': points}
    if image:
        item['image'] = f'/uto/{image}'
    return item


def multi(text, options, correct, image=None, guessed=False):
    """Бір немесе бірнеше дұрыс жауап (ҰБТ: 2 балл, бір қате — 1 балл)."""
    item = q(text, options, correct[0], image, points=2, guessed=guessed)
    item['correct_indexes'] = correct
    return item


def match(stem, pairs, options, image=None, guessed=False):
    """Сәйкестендіру: әр жол бөлек сұрақ болып енеді (ҰБТ-дағыдай әрқайсысы 1 балл)."""
    if guessed:
        GUESSED.append(stem[:60])
    return [q(f'{stem}\n\n{"АӘ"[i]}) {sub}', options, correct, image) for i, (sub, correct) in enumerate(pairs)]
