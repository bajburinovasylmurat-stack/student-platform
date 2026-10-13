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
    """Сәйкестендіру: бір сұрақ, әр жолға ортақ тізімнен жауап таңдалады (ҰБТ-дағыдай жол сайын 1 балл)."""
    item = q(stem, options, pairs[0][1], image, points=len(pairs), guessed=guessed)
    item['match_rows'] = [{'text': text, 'correct_index': correct} for text, correct in pairs]
    return [item]
