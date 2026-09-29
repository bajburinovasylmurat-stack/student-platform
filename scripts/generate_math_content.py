"""
1-ай математика мазмұнын жасау: тесттер (көп нұсқа) және формула карточкалары.

    python3 scripts/generate_math_content.py

Нәтиже: seed/math-month1.json. Сервер іске қосылғанда оны бір рет базаға жазады.
Әр есептің жауабы осы жерде есептеледі және тексеріледі (assert), сондықтан
қате жауабы бар сұрақ файлға түспейді. Нұсқалар бірдей үлгімен, бірақ әр түрлі
сандармен жасалады — оқушы жауапты емес, тәсілді үйренеді.
"""
import json
import math
import os
import random
from fractions import Fraction

SUP = str.maketrans('0123456789-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁻')


def sup(n):
    return str(n).translate(SUP)


def num(x):
    """Санды қазақша жазу: үтірмен, артық нөлсіз."""
    if isinstance(x, Fraction):
        if x.denominator == 1:
            return num(x.numerator)
        sign = '−' if x < 0 else ''
        return f'{sign}{abs(x.numerator)}/{x.denominator}'
    if isinstance(x, float):
        if abs(x - round(x)) < 1e-9:
            x = int(round(x))
        else:
            s = f'{x:.4f}'.rstrip('0').rstrip('.')
            return s.replace('-', '−').replace('.', ',')
    return str(x).replace('-', '−')


def root_term(c, k):
    """c√k: 0, √k, −√k, 3√k түрінде."""
    if c == 0:
        return '0'
    if c == 1:
        return f'√{k}'
    if c == -1:
        return f'−√{k}'
    return f'{num(c)}√{k}'


def interval(a, b, left_closed=False, right_closed=False):
    l = '[' if left_closed else '('
    r = ']' if right_closed else ')'
    fa = '−∞' if a == -math.inf else num(a)
    fb = '+∞' if b == math.inf else num(b)
    return f'{l}{fa}; {fb}{r}'


def question(rng, text, correct, wrong, points=1):
    """Дұрыс жауап + 3 қате нұсқа, қайталанбайды, ретін араластырамыз."""
    correct = str(correct)
    options = [correct]
    for w in wrong:
        w = str(w)
        if w not in options:
            options.append(w)
    filler = 1
    while len(options) < 4:  # қате нұсқа жетпесе — тағы біреу
        options.append(f'{correct} + {filler}' if not correct.lstrip('−').replace(',', '').isdigit()
                       else num(int(correct.replace('−', '-').replace(',', '.').split('.')[0]) + filler * 7))
        options = list(dict.fromkeys(options))
        filler += 1
    options = options[:4]
    rng.shuffle(options)
    assert options.count(correct) == 1, (text, options)
    return {'question': text, 'options': options, 'correct_index': options.index(correct), 'points': points}


# ======================= 1.1 Сандар, пропорция, пайыз =======================

def t11_percent_of(rng):
    a = rng.choice([80, 120, 150, 240, 360, 450, 600, 750, 840, 1200])
    p = rng.choice([5, 10, 15, 20, 25, 30, 35, 40, 60, 75])
    ans = Fraction(a * p, 100)
    return question(rng, f'{a} санының {p}%-ын табыңыз.', num(ans),
                    [num(ans * 10), num(a - ans), num(Fraction(a * 100, p)) if a * 100 % p == 0 else num(ans + 5)])


def t11_number_from_percent(rng):
    p = rng.choice([5, 10, 20, 25, 40, 50, 75])
    x = rng.choice([40, 60, 80, 120, 160, 200, 240, 320, 400])
    b = x * p // 100
    assert b * 100 == x * p
    return question(rng, f'Белгісіз санның {p}%-ы {b}-ге тең. Сол санды табыңыз.', num(x),
                    [num(Fraction(b * p, 100)), num(x * 2), num(x + b)])


def t11_price_change(rng):
    while True:
        price = rng.choice([2000, 4000, 5000, 8000, 12000, 20000])
        p = rng.choice([10, 20, 25, 50])
        exact = Fraction(price * (100 + p) * (100 - p), 10000)
        if exact.denominator == 1:
            break
    up = price * (100 + p) // 100
    down = int(exact)
    assert Fraction(price * (100 + p), 100) == up
    return question(rng,
                    f'Тауардың бағасы {price} теңге. Алдымен {p}%-ға қымбаттап, кейін {p}%-ға арзандады. '
                    f'Соңғы бағасы қанша теңге?',
                    num(down), [num(price), num(up), num(price * (100 - p) // 100)])


def t11_what_percent(rng):
    while True:
        b = rng.choice([20, 25, 40, 50, 80, 200, 250, 400])
        p = rng.choice([5, 10, 15, 20, 30, 40, 60, 75, 120, 150])
        if (b * p) % 100 == 0 and b * p // 100 > 0:
            break
    a = b * p // 100
    wrong = [f'{x}%' for x in (100 - p, p + 10, p * 2, p // 2) if x > 0 and x != p]
    return question(rng, f'{a} саны {b} санының неше пайызын құрайды?', f'{p}%', wrong)


def t11_proportion(rng):
    while True:
        a, b, c = rng.randint(2, 12), rng.randint(2, 15), rng.randint(2, 10)
        if (a * b) % c == 0 and a * b // c not in (a, b, c):
            break
    x = a * b // c
    return question(rng, f'Пропорциядан x-ті табыңыз:  x : {a} = {b} : {c}', num(x),
                    [num(Fraction(a * c, b)), num(Fraction(b * c, a)), num(x + a)])


def t11_ratio_split(rng):
    m, n = rng.choice([(2, 3), (3, 5), (1, 4), (2, 5), (3, 4), (4, 5)])
    k = rng.choice([6, 8, 10, 12, 15, 20])
    total = (m + n) * k
    return question(rng, f'{total} санын {m} : {n} қатынасындай екі бөлікке бөліңіз. Үлкен бөлігі неге тең?',
                    num(n * k), [num(m * k), num(total // 2), num(total - m)])


def t11_workers(rng):
    k = rng.choice([4, 6, 8, 10, 12])
    t = rng.choice([6, 9, 12, 15, 18])
    m = rng.choice([d for d in (2, 3, 4, 5, 6, 9, 10, 12, 15, 18, 20, 24) if (k * t) % d == 0 and d != k])
    ans = k * t // m
    return question(rng, f'{k} жұмысшы бір жұмысты {t} күнде бітіреді. Осындай жылдамдықпен {m} жұмысшы бұл жұмысты неше күнде бітіреді?',
                    num(ans), [num(Fraction(m * t, k)), num(t + k - m), num(ans * 2)])


def t11_fractions(rng):
    while True:
        a, b = rng.randint(1, 7), rng.choice([2, 3, 4, 5, 6, 8])
        c, d = rng.randint(1, 7), rng.choice([3, 4, 5, 6, 9, 10])
        if b != d and Fraction(a, b).denominator == b and Fraction(c, d).denominator == d:
            break
    ans = Fraction(a, b) + Fraction(c, d)
    return question(rng, f'Есептеңіз:  {a}/{b} + {c}/{d}', num(ans),
                    [num(Fraction(a + c, b + d)), num(Fraction(a * c, b * d)), num(ans + Fraction(1, b * d))])


def t11_order_of_ops(rng):
    a, b, c = rng.randint(10, 40), rng.randint(2, 9), rng.randint(2, 9)
    e = rng.choice([2, 3, 4, 5, 6])
    d = e * rng.randint(2, 9)
    ans = a + b * c - d // e
    return question(rng, f'Есептеңіз:  {a} + {b}·{c} − {d} : {e}', num(ans),
                    [num((a + b) * c - d // e), num(Fraction((a + b * c - d), e)), num(a + b * c - d)])


def t11_gcd_lcm(rng):
    g = rng.choice([2, 3, 4, 5, 6])
    x, y = rng.sample([3, 4, 5, 7, 8, 9], 2)
    while math.gcd(x, y) != 1:
        x, y = rng.sample([3, 4, 5, 7, 8, 9], 2)
    a, b = g * x, g * y
    if rng.random() < 0.5:
        return question(rng, f'{a} және {b} сандарының ең үлкен ортақ бөлгішін (ЕҮОБ) табыңыз.', num(g),
                        [num(a * b // g), num(1), num(g * 2 if a % (g * 2) or b % (g * 2) else g + 1)])
    lcm = a * b // g
    return question(rng, f'{a} және {b} сандарының ең кіші ортақ еселігін (ЕКОЕ) табыңыз.', num(lcm),
                    [num(a * b), num(g), num(lcm // 2 if lcm % 2 == 0 and (lcm // 2) % a else lcm + a)])


# ======================= 1.2 Дәреже, арифметикалық түбір =======================

def t12_power_rules(rng):
    base = rng.choice([2, 3, 5])
    m, n = rng.randint(3, 7), rng.randint(2, 5)
    k = rng.randint(m + n - 3, m + n - 1)
    e = m + n - k
    ans = base ** e
    return question(rng, f'Есептеңіз:  {base}{sup(m)} · {base}{sup(n)} : {base}{sup(k)}', num(ans),
                    [num(base ** (m * n - k) if m * n - k < 8 else ans * base), num(base ** (e + 1)), num(base * e)])


def t12_negative_exp(rng):
    b = rng.choice([2, 3, 4, 5])
    n = rng.choice([2, 3])
    ans = b ** n
    return question(rng, f'Есептеңіз:  (1/{b}){sup(-n)}', num(ans),
                    [num(Fraction(1, b ** n)), num(-b * n), num(-(b ** n))])


def t12_zero_negative(rng):
    a = rng.randint(2, 9)
    b = rng.choice([2, 3, 4, 5])
    c = b * rng.randint(2, 6)
    ans = 1 + Fraction(c, b)
    return question(rng, f'Есептеңіз:  {a}⁰ + {b}⁻¹ · {c}', num(ans),
                    [num(Fraction(c, b)), num(a + Fraction(c, b)), num(Fraction(c * b + 1))])


def t12_variable_powers(rng):
    m, n, k = rng.randint(2, 5), rng.randint(2, 4), rng.randint(1, 6)
    e = m * n - k
    return question(rng, f'Өрнекті ықшамдаңыз:  (x{sup(m)}){sup(n)} · x{sup(-k)}', f'x{sup(e)}',
                    [f'x{sup(m + n - k)}', f'x{sup(m * n + k)}', f'x{sup(m ** n - k)}'])


def t12_simple_root(rng):
    r = rng.randint(4, 19)
    a = r * r
    if rng.random() < 0.5:
        return question(rng, f'√{a} неге тең?', num(r), [num(-r), num(a // 2), num(r + 1)])
    # ондық бөлшек: √0,49 = 0,7
    return question(rng, f'√{num(a / 100)} неге тең?', num(r / 10), [num(r / 100), num(r), num(r / 5)])


def t12_root_product(rng):
    a, b = rng.choice([(8, 2), (3, 12), (5, 20), (2, 18), (27, 3), (50, 2), (6, 24), (7, 28)])
    ans = int(math.isqrt(a * b))
    assert ans * ans == a * b
    return question(rng, f'Есептеңіз:  √{a} · √{b}', num(ans), [f'√{a + b}', num(a * b), num(ans * 2)])


def t12_abs_root(rng):
    a = rng.choice([2, 3, 5, 6, 7, 10, 11])
    n = math.isqrt(a) + 1  # n > √a
    ans = f'{n} − √{a}'
    return question(rng, f'Есептеңіз:  √(({n} − √{a})²)', ans,
                    [f'√{a} − {n}', f'{n} + √{a}', f'{n * n - a}'])


def t12_fractional_exp(rng):
    base, p, q = rng.choice([(8, 2, 3), (27, 2, 3), (16, 3, 4), (32, 3, 5), (64, 2, 3), (81, 3, 4), (125, 2, 3)])
    root = round(base ** (1 / q))
    assert root ** q == base
    ans = root ** p
    return question(rng, f'Есептеңіз:  {base}^({p}/{q})', num(ans),
                    [num(Fraction(base * p, q)), num(root), num(base ** p // q if base ** p % q == 0 else ans + root)])


def t12_root_sum(rng):
    k = rng.choice([2, 3, 5])
    a, b = rng.sample([2, 3, 4, 5], 2)
    c = a - b
    text = f'Есептеңіз:  √{a * a * k} − √{b * b * k}'
    ans = root_term(c, k)
    return question(rng, text, ans,
                    [f'√{abs(a * a - b * b) * k}', root_term(a + b, k), num(abs(c) * k)])


# ======================= 2.1 Стандарт түр, көпмүше, ҚКФ =======================

def t21_standard_small(rng):
    m = rng.choice([125, 345, 72, 907, 48, 5])
    e = rng.randint(3, 6)
    digits = len(str(m))
    value = f'0,{"0" * (e - 1)}{m}'
    mant = f'{str(m)[0]},{str(m)[1:]}' if digits > 1 else str(m)
    exp = -(e)
    return question(rng, f'{value} санын стандарт түрде жазыңыз.', f'{mant}·10{sup(exp)}',
                    [f'{mant}·10{sup(-exp)}', f'{mant}·10{sup(exp - 1)}', f'{m}·10{sup(exp)}'])


def t21_standard_big(rng):
    m = rng.choice([345, 72, 18, 905, 6])
    z = rng.randint(3, 7)
    value = f'{m}{"0" * z}'
    grouped = f'{int(value):,}'.replace(',', ' ')
    digits = len(str(m))
    mant = f'{str(m)[0]},{str(m)[1:]}' if digits > 1 else str(m)
    exp = digits - 1 + z
    return question(rng, f'{grouped} санын стандарт түрде жазыңыз.', f'{mant}·10{sup(exp)}',
                    [f'{mant}·10{sup(-exp)}', f'{mant}·10{sup(z)}', f'{m}·10{sup(exp)}'])


def t21_monomial_degree(rng):
    c = rng.choice([-3, 2, -5, 7, 4])
    a, b, d = rng.randint(1, 5), rng.randint(1, 5), rng.randint(1, 3)
    text = f'{num(c)}x{sup(a) if a > 1 else ""}y{sup(b) if b > 1 else ""}z{sup(d) if d > 1 else ""}'
    return question(rng, f'{text} бірмүшесінің дәрежесін табыңыз.', num(a + b + d),
                    [num(a * b * d), num(abs(c)), num(a + b + d + abs(c))])


def t21_monomial_power(rng):
    c = rng.choice([-2, 3, -3, 2])
    a, b = rng.randint(2, 4), rng.randint(1, 3)
    n = 3 if abs(c) == 2 else 2
    coef = c ** n
    bexp = f'b{sup(b * n)}'
    return question(rng, f'Ықшамдаңыз:  ({num(c)}a{sup(a)}b{sup(b) if b > 1 else ""}){sup(n)}',
                    f'{num(coef)}a{sup(a * n)}{bexp}',
                    [f'{num(c * n)}a{sup(a * n)}{bexp}', f'{num(coef)}a{sup(a + n)}b{sup(b + n)}', f'{num(-coef)}a{sup(a * n)}{bexp}'])


def t21_square_sum(rng):
    k = rng.randint(2, 9)
    sign = rng.choice(['+', '−'])
    mid = f'{sign} {2 * k}x'
    return question(rng, f'Көпмүше түрінде жазыңыз:  (x {sign} {k})²', f'x² {mid} + {k * k}',
                    [f'x² + {k * k}', f'x² {mid} {"−" if True else "+"} {k * k}', f'x² {sign} {k}x + {k * k}'])


def t21_diff_squares(rng):
    a, b = rng.randint(2, 7), rng.randint(1, 9)
    return question(rng, f'Көбейтіңіз:  ({a}x − {b})({a}x + {b})', f'{a * a}x² − {b * b}',
                    [f'{a * a}x² + {b * b}', f'{a}x² − {b}', f'{a * a}x² − {2 * a * b}x − {b * b}'])


def t21_numeric_trick(rng):
    n = rng.choice([50, 60, 70, 80, 100])
    d = rng.randint(1, 3)
    a, b = n + d, n - d
    ans = a * a - b * b
    return question(rng, f'Ыңғайлы тәсілмен есептеңіз:  {a}² − {b}²', num(ans),
                    [num((a - b) ** 2), num(ans // 2), num(ans + 2 * d * d)])


def t21_factor(rng):
    kind = rng.choice(['sq', 'cube'])
    if kind == 'sq':
        k = rng.randint(2, 11)
        return question(rng, f'Көбейткіштерге жіктеңіз:  x² − {k * k}', f'(x − {k})(x + {k})',
                        [f'(x − {k})²', f'(x + {k})²', f'(x − {k * k})(x + 1)'])
    k = rng.choice([2, 3, 4, 5])
    return question(rng, f'Көбейткіштерге жіктеңіз:  a³ − {k ** 3}', f'(a − {k})(a² + {k}a + {k * k})',
                    [f'(a − {k})(a² − {k}a + {k * k})', f'(a + {k})(a² − {k}a + {k * k})', f'(a − {k})³'])


def t21_symmetric(rng):
    s, p = rng.randint(3, 9), rng.randint(1, 8)
    ans = s * s - 2 * p
    return question(rng, f'a + b = {s}, ab = {p} болса, a² + b² өрнегінің мәнін табыңыз.', num(ans),
                    [num(s * s), num(s * s + 2 * p), num(s * s - p)])


def t21_cube_coef(rng):
    k = rng.randint(2, 5)
    return question(rng, f'(x + {k})³ өрнегін көпмүше түріне келтіргенде x-тің алдындағы коэффициент неге тең?',
                    num(3 * k * k), [num(k ** 3), num(3 * k), num(k * k)])


# ======================= 2.2 Күрделі радикал, иррационалдықтан арылту =======================

def t22_nested(rng):
    m, n = rng.choice([(3, 2), (5, 3), (5, 2), (7, 3), (6, 5), (7, 2), (7, 5), (11, 2)])
    sign = rng.choice(['+', '−'])
    opp = '−' if sign == '+' else '+'
    a, b = m + n, m * n
    ans = f'√{m} {sign} √{n}'
    assert abs(math.sqrt(a + (2 if sign == '+' else -2) * math.sqrt(b)) -
               (math.sqrt(m) + (1 if sign == '+' else -1) * math.sqrt(n))) < 1e-9
    return question(rng, f'Ықшамдаңыз:  √({a} {sign} 2√{b})', ans,
                    [f'√{a} {sign} √{b}' if math.isqrt(a) ** 2 != a else f'√{m + 1} {sign} √{n}',
                     f'√{m} {opp} √{n}', f'{m} {sign} {n}'])


def t22_nested_square(rng):
    k = rng.choice([2, 3, 4])
    c = rng.choice([2, 3, 5, 6, 7])
    if k * k <= c:
        k = math.isqrt(c) + 1
    a, b = k * k + c, 2 * k
    ans = f'{k} − √{c}' if rng.random() < 0.5 else f'{k} + √{c}'
    sign = '−' if '−' in ans else '+'
    val = math.sqrt(a + (1 if sign == '+' else -1) * b * math.sqrt(c))
    assert abs(val - (k + (1 if sign == '+' else -1) * math.sqrt(c))) < 1e-9
    opp = '+' if sign == '−' else '−'
    return question(rng, f'Ықшамдаңыз:  √({a} {sign} {b}√{c})', ans,
                    [f'{k} {opp} √{c}', f'{k * k} {sign} √{c}', f'{2 * k} {sign} √{c}'])


def t22_rationalize_simple(rng):
    a = rng.choice([2, 3, 5, 6, 7])
    k = a * rng.randint(1, 3)
    q = k // a
    ans = f'{q}√{a}' if q > 1 else f'√{a}'
    return question(rng, f'Бөлімін иррационалдықтан арылтыңыз:  {k}/√{a}', ans,
                    [f'{k}√{a}', f'√{a}/{k}', f'{k}/{a}'])


def t22_conjugate(rng):
    a, b = rng.choice([(3, 2), (5, 3), (6, 5), (7, 6), (7, 5), (11, 10), (10, 7)])
    k = a - b
    ans = f'√{a} − √{b}' if k == 1 else f'(√{a} − √{b})/{k}'
    val = 1 / (math.sqrt(a) + math.sqrt(b))
    assert abs(val - (math.sqrt(a) - math.sqrt(b)) / k) < 1e-9
    return question(rng, f'Бөлімін иррационалдықтан арылтыңыз:  1/(√{a} + √{b})', ans,
                    [f'√{a} + √{b}', f'(√{a} − √{b})/{a + b}', f'√{a + b}'])


def t22_conjugate_k(rng):
    a, b = rng.choice([(7, 3), (5, 1), (11, 7), (6, 2), (13, 5), (10, 6), (3, 1)])
    k = (a - b) * rng.randint(1, 3)
    q = k // (a - b)
    wb = '1' if b == 1 else f'√{b}'  # √1 = 1
    inner = f'√{a} + {wb}'
    ans = f'{q}({inner})' if q > 1 else inner
    val = k / (math.sqrt(a) - math.sqrt(b))
    assert abs(val - q * (math.sqrt(a) + math.sqrt(b))) < 1e-9
    minus = f'√{a} − {wb}'
    return question(rng, f'Бөлімін иррационалдықтан арылтыңыз:  {k}/({minus})', ans,
                    [f'{q}({minus})' if q > 1 else minus, f'{k}({inner})' if k != q else f'{k + 1}({inner})', f'{k}/{a - b}'])


def t22_similar(rng):
    k = rng.choice([2, 3])
    while True:
        x, y, z = rng.randint(1, 4), rng.randint(2, 5), rng.randint(1, 4)
        if x != z:
            break
    c = x + y - z
    text = f'Ықшамдаңыз:  √{x * x * k} + √{y * y * k} − √{z * z * k}'
    ans = root_term(c, k)
    return question(rng, text, ans, [f'√{(x * x + y * y - z * z) * k}' if (x * x + y * y - z * z) > 0 else root_term(c + 1, k),
                                     num(c * k), root_term(x + y + z, k)])


def t22_product(rng):
    a, b = rng.randint(2, 6), rng.choice([2, 3, 5, 7])
    ans = a * a - b
    return question(rng, f'Есептеңіз:  ({a} − √{b})({a} + √{b})', num(ans),
                    [num(a * a + b), num(a - b), num(a * a - b * b)])


def t22_square(rng):
    a, b = rng.randint(2, 5), rng.choice([2, 3, 5, 6])
    first = a * a + b
    ans = f'{first} − {2 * a}√{b}'
    return question(rng, f'Есептеңіз:  ({a} − √{b})²', ans,
                    [f'{a * a - b}', f'{first} + {2 * a}√{b}', f'{first} − {a}√{b}'])


# ======================= 3.1 Сызықтық теңдеу, теңсіздік, жүйе =======================

def t31_linear(rng):
    x = rng.randint(-8, 9)
    a = rng.choice([2, 3, 4, 5, -2, -3])
    b = rng.randint(-10, 10)
    c = a * x + b
    return question(rng, f'Теңдеуді шешіңіз:  {num(a)}x {"+" if b >= 0 else "−"} {abs(b)} = {num(c)}', num(x),
                    [num(Fraction(c + b, a)) if Fraction(c + b, a) != x else num(x + 1), num(-x) if x else num(2), num(c - b)])


def t31_linear_both(rng):
    x = rng.randint(-6, 8)
    a, c = rng.sample([2, 3, 4, 5, 6, 7], 2)
    b = rng.randint(1, 6)
    d = a * (x - b) - c * x
    rhs = f'{c}x {"+" if d >= 0 else "−"} {abs(d)}'
    return question(rng, f'Теңдеуді шешіңіз:  {a}(x − {b}) = {rhs}', num(x),
                    [num(x + b), num(-x) if x else num(3), num(Fraction(d + b, a - c)) if Fraction(d + b, a - c) != x else num(x - 1)])


def t31_inequality(rng):
    a = rng.choice([2, 3, 4, -2, -3, -4])
    k = rng.randint(-5, 6)
    b = rng.choice([x for x in range(-8, 9) if x])
    c = a * k + b
    text = f'Теңсіздікті шешіңіз:  {num(a)}x {"+" if b >= 0 else "−"} {abs(b)} > {num(c)}'
    right = interval(k, math.inf) if a > 0 else interval(-math.inf, k)
    wrong_flip = interval(-math.inf, k) if a > 0 else interval(k, math.inf)
    return question(rng, text, right, [wrong_flip, interval(k, math.inf, True) if a > 0 else interval(-math.inf, k, False, True),
                                        interval(-k, math.inf) if k else interval(1, math.inf)])


def t31_double(rng):
    lo, hi = sorted(rng.sample(range(-5, 8), 2))
    # m < 2x − 1 ≤ n, мұнда x ∈ (lo; hi]
    m, n = 2 * lo - 1, 2 * hi - 1
    count = hi - lo
    if rng.random() < 0.5:
        return question(rng, f'Қос теңсіздікті шешіңіз:  {num(m)} < 2x − 1 ≤ {num(n)}', interval(lo, hi, False, True),
                        [interval(lo, hi, True, False), interval(m, n, False, True), interval(lo - 1, hi - 1, False, True)])
    return question(rng, f'{num(m)} < 2x − 1 ≤ {num(n)} қос теңсіздігінің бүтін шешімдерінің санын табыңыз.', num(count),
                    [num(count + 1), num(n - m), num(count - 1) if count > 1 else num(count + 2)])


def t31_system_sum(rng):
    x, y = rng.randint(-5, 9), rng.randint(-5, 9)
    return question(rng, f'Жүйені шешіңіз:  x + y = {num(x + y)},  x − y = {num(x - y)}', f'({num(x)}; {num(y)})',
                    [f'({num(y)}; {num(x)})', f'({num(x + y)}; {num(x - y)})', f'({num(-x)}; {num(-y)})'])


def t31_system_general(rng):
    while True:
        x, y = rng.randint(-4, 6), rng.randint(-4, 6)
        a, b, d, e = rng.randint(1, 5), rng.randint(1, 5), rng.randint(1, 5), rng.randint(-4, -1)
        if a * e - b * d != 0:
            break
    c, f = a * x + b * y, d * x + e * y
    return question(rng,
                    f'Жүйенің шешімі (x; y) болса, x + y қосындысын табыңыз:  {a}x + {b}y = {num(c)},  {d}x − {abs(e)}y = {num(f)}',
                    num(x + y), [num(x - y), num(x * y), num(x + y + 1)])


def t31_word(rng):
    s = rng.randint(20, 80)
    d = rng.randint(2, 20)
    if (s + d) % 2:
        s += 1
    big = (s + d) // 2
    return question(rng, f'Екі санның қосындысы {s}-ке, ал айырмасы {d}-ге тең. Үлкен санды табыңыз.', num(big),
                    [num(s - d), num(big - d), num(s // 2)])


def t31_system_ineq(rng):
    a, b = sorted(rng.sample(range(-6, 9), 2))
    count = b - a  # x > a, x ≤ b
    return question(rng, f'Теңсіздіктер жүйесінің бүтін шешімдерінің санын табыңыз:  x > {num(a)},  x ≤ {num(b)}', num(count),
                    [num(count + 1), num(count - 1) if count > 1 else num(count + 2), num(b + a) if b + a != count else num(count + 3)])


# ======================= 3.2 Квадрат теңдеу, Виет теоремасы =======================

def quad_text(p, q):
    ps = '' if p == 0 else (f' + {p}x' if p > 0 else f' − {abs(p)}x')
    ps = ps.replace(' 1x', ' x')
    qs = '' if q == 0 else (f' + {q}' if q > 0 else f' − {abs(q)}')
    return f'x²{ps}{qs} = 0'


def t32_roots(rng):
    r1, r2 = rng.sample([x for x in range(-7, 8) if x], 2)
    p, q = -(r1 + r2), r1 * r2
    big = max(r1, r2)
    return question(rng, f'{quad_text(p, q)} теңдеуінің үлкен түбірін табыңыз.', num(big),
                    [num(min(r1, r2)), num(-big), num(-min(r1, r2)) if -min(r1, r2) != big else num(big + 1)])


def t32_discriminant(rng):
    a = rng.choice([1, 2, 3])
    b = rng.choice([x for x in range(-8, 9) if x])
    c = rng.choice([x for x in range(-6, 7) if x])
    d = b * b - 4 * a * c
    lhs = f'{a if a > 1 else ""}x²{" + " if b >= 0 else " − "}{abs(b)}x{" + " if c >= 0 else " − "}{abs(c)} = 0'
    return question(rng, f'{lhs} теңдеуінің дискриминантын табыңыз.', num(d),
                    [num(b * b + 4 * a * c), num(b - 4 * a * c), num(b * b - 2 * a * c)])


def t32_vieta(rng):
    r1, r2 = rng.sample([x for x in range(-7, 8) if x], 2)
    p, q = -(r1 + r2), r1 * r2
    kind = rng.choice(['sum', 'prod', 'sq', 'inv'])
    if kind == 'sum':
        return question(rng, f'{quad_text(p, q)} теңдеуінің түбірлерінің қосындысын табыңыз.', num(r1 + r2),
                        [num(p), num(q), num(-q)])
    if kind == 'prod':
        return question(rng, f'{quad_text(p, q)} теңдеуінің түбірлерінің көбейтіндісін табыңыз.', num(q),
                        [num(-q), num(p), num(r1 + r2) if r1 + r2 != q else num(q + 1)])
    if kind == 'sq':
        ans = r1 * r1 + r2 * r2
        return question(rng, f'x₁ және x₂ — {quad_text(p, q)} теңдеуінің түбірлері. x₁² + x₂² мәнін табыңыз.', num(ans),
                        [num((r1 + r2) ** 2), num((r1 + r2) ** 2 + 2 * q), num(ans + 2)])
    ans = Fraction(r1 + r2, q)
    return question(rng, f'x₁ және x₂ — {quad_text(p, q)} теңдеуінің түбірлері. 1/x₁ + 1/x₂ мәнін табыңыз.', num(ans),
                    [num(Fraction(q, r1 + r2)) if r1 + r2 else num(1), num(-ans) if ans else num(2), num(Fraction(1, q))])


def t32_factor(rng):
    r1, r2 = rng.sample([x for x in range(-6, 7) if x], 2)
    p, q = -(r1 + r2), r1 * r2
    f = lambda r: f'(x − {r})' if r > 0 else f'(x + {-r})'
    return question(rng, f'Көбейткішке жіктеңіз:  {quad_text(p, q)[:-4]}', f'{f(r1)}{f(r2)}',
                    [f'{f(-r1)}{f(-r2)}', f'{f(r1)}{f(-r2)}', f'{f(-r1)}{f(r2)}'])


def t32_build(rng):
    r1, r2 = rng.sample([x for x in range(-6, 7) if x], 2)
    p, q = -(r1 + r2), r1 * r2
    return question(rng, f'Түбірлері {num(r1)} және {num(r2)} болатын келтірілген квадрат теңдеуді көрсетіңіз.', quad_text(p, q),
                    [quad_text(-p, q), quad_text(p, -q), quad_text(-p, -q)])


def t32_param(rng):
    k = rng.randint(2, 8)
    b = 2 * k
    return question(rng, f'x² − {b}x + c = 0 теңдеуінің бір ғана түбірі болатындай c мәнін табыңыз.', num(k * k),
                    [num(b * b), num(b), num(-k * k)])


def t32_incomplete(rng):
    a = rng.choice([1, 2, 3])
    r = rng.choice([x for x in range(-8, 9) if x])
    b = -a * r
    lhs = f'{a if a > 1 else ""}x² {"+" if b > 0 else "−"} {abs(b)}x = 0'
    return question(rng, f'{lhs} теңдеуінің түбірлерін табыңыз.', f'0; {num(r)}',
                    [f'0; {num(-r)}', num(r), f'{num(a)}; {num(r)}'])


def t32_count(rng):
    a = 1
    b = rng.choice([x for x in range(-6, 7) if x])
    c = rng.choice([x for x in range(-5, 13) if x])
    d = b * b - 4 * a * c
    ans = 2 if d > 0 else (1 if d == 0 else 0)
    lhs = quad_text(b, c)
    return question(rng, f'{lhs} теңдеуінің неше нақты түбірі бар?', f'{ans}',
                    [str(x) for x in (0, 1, 2, 4) if x != ans][:3])


# ======================= 4.1 Жоғары дәрежелі теңдеулер, бөлу =======================

def t41_biquadratic(rng):
    a, b = rng.sample([1, 2, 3, 4], 2)
    s, p = a * a + b * b, a * a * b * b
    kind = rng.choice(['count', 'sum', 'max'])
    text = f'x⁴ − {s}x² + {p} = 0'
    if kind == 'count':
        return question(rng, f'{text} теңдеуінің неше түбірі бар?', '4', ['2', '3', '1'])
    if kind == 'sum':
        return question(rng, f'{text} теңдеуінің оң түбірлерінің қосындысын табыңыз.', num(a + b),
                        [num(s), num(0), num(a * a + b * b - 1) if a * a + b * b - 1 != a + b else num(a + b + 1)])
    return question(rng, f'{text} теңдеуінің ең үлкен түбірін табыңыз.', num(max(a, b)),
                    [num(max(a, b) ** 2), num(-max(a, b)), num(min(a, b))])


def t41_cubic_factor(rng):
    k = rng.randint(2, 6)
    return question(rng, f'x³ − {k * k}x = 0 теңдеуінің түбірлерін табыңыз.', f'0; ±{k}',
                    [f'±{k}', f'0; {k}', f'0; ±{k * k}'])


def t41_grouping(rng):
    while True:
        a = rng.choice([1, 2, 3, -1, -2])
        k = rng.randint(2, 4)
        if abs(a) != k:  # a = ±k болса, түбір қайталанады
            break
    # (x − a)(x² − k²) = x³ − a x² − k² x + a k²
    b2 = -a
    c1 = -k * k
    d0 = a * k * k
    def term(v, s):
        if v == 0:
            return ''
        sign = ' + ' if v > 0 else ' − '
        mag = '' if abs(v) == 1 and s else str(abs(v))
        return f'{sign}{mag}{s}'
    text = f'x³{term(b2, "x²")}{term(c1, "x")}{term(d0, "")} = 0'
    roots = sorted({a, k, -k})
    ans = sum(roots)
    return question(rng, f'{text} теңдеуінің түбірлерінің қосындысын табыңыз.', num(ans),
                    [num(-ans) if ans else num(k), num(a + k), num(a * k)])


def t41_division(rng):
    r1, r2, r3 = rng.sample([1, 2, 3, -1, -2, 4], 3)
    # P(x) = (x−r1)(x−r2)(x−r3)
    b = -(r1 + r2 + r3)
    c = r1 * r2 + r1 * r3 + r2 * r3
    d = -r1 * r2 * r3
    def coef(v, s, first=False):
        if v == 0:
            return ''
        sign = ('− ' if v < 0 else '') if first else (' + ' if v > 0 else ' − ')
        mag = '' if abs(v) == 1 and s else str(abs(v))
        return f'{sign}{mag}{s}'
    P = f'x³{coef(b, "x²")}{coef(c, "x")}{coef(d, "")}'
    qb, qc = -(r2 + r3), r2 * r3
    quad = lambda u, v: f'x²{coef(u, "x")}{coef(v, "")}'
    Q = quad(qb, qc)
    candidates = [quad(-qb, qc), quad(qb, -qc), quad(-qb, -qc), quad(b, c), quad(qb + 1, qc), quad(qb, qc + 2)]
    wrong = [w for w in dict.fromkeys(candidates) if w != Q][:3]
    divisor = f'(x − {r1})' if r1 > 0 else f'(x + {-r1})'
    return question(rng, f'Бұрыштап бөліңіз:  ({P}) : {divisor}', Q, wrong)


def t41_remainder(rng):
    a2, a1, a0 = rng.randint(-3, 3), rng.randint(-5, 5), rng.randint(-6, 6)
    x0 = rng.choice([1, 2, -1, -2, 3])
    rem = x0 ** 3 + a2 * x0 * x0 + a1 * x0 + a0
    def term(v, s):
        if v == 0:
            return ''
        sign = ' + ' if v > 0 else ' − '
        mag = '' if abs(v) == 1 and s else str(abs(v))
        return f'{sign}{mag}{s}'
    P = f'x³{term(a2, "x²")}{term(a1, "x")}{term(a0, "")}'
    div = f'x − {x0}' if x0 > 0 else f'x + {-x0}'
    wrong_x = -x0
    wrong = (-x0) ** 3 + a2 * x0 * x0 + a1 * (-x0) + a0
    return question(rng, f'{P} көпмүшесін ({div}) екімүшесіне бөлгендегі қалдықты табыңыз.', num(rem),
                    [num(wrong) if wrong != rem else num(rem + 2), num(a0), num(rem - 1)])


def t41_param_divisible(rng):
    x0 = rng.choice([1, 2, -1, -2])
    a2, a1 = rng.randint(-3, 3), rng.randint(-4, 4)
    # x0³ + a2 x0² + a1 x0 + m = 0
    m = -(x0 ** 3 + a2 * x0 * x0 + a1 * x0)
    def term(v, s):
        if v == 0:
            return ''
        sign = ' + ' if v > 0 else ' − '
        mag = '' if abs(v) == 1 and s else str(abs(v))
        return f'{sign}{mag}{s}'
    P = f'x³{term(a2, "x²")}{term(a1, "x")} + m'
    div = f'x − {x0}' if x0 > 0 else f'x + {-x0}'
    return question(rng, f'm-нің қандай мәнінде {P} көпмүшесі ({div}) екімүшесіне қалдықсыз бөлінеді?', num(m),
                    [num(-m) if m else num(1), num(x0), num(m + x0)])


def t41_integer_root(rng):
    r = rng.choice([1, 2, 3, -1, -2, -3])
    p, q = rng.randint(1, 3), rng.randint(1, 5)
    # (x − r)(x² + p x + q), x² + px + q нақты түбірсіз (p² < 4q)
    while p * p >= 4 * q:
        q += 1
    b, c, d = p - r, q - r * p, -r * q
    def term(v, s):
        if v == 0:
            return ''
        sign = ' + ' if v > 0 else ' − '
        mag = '' if abs(v) == 1 and s else str(abs(v))
        return f'{sign}{mag}{s}'
    P = f'x³{term(b, "x²")}{term(c, "x")}{term(d, "")} = 0'
    others = [x for x in (1, -1, 2, -2, 3, -3) if x != r]
    rng.shuffle(others)
    return question(rng, f'{P} теңдеуінің бүтін түбірін табыңыз.', num(r), [num(x) for x in others[:3]])


# ======================= 4.2 Квадрат және жоғары дәрежелі теңсіздік =======================

def t42_quadratic(rng):
    r1, r2 = sorted(rng.sample(range(-6, 8), 2))
    p, q = -(r1 + r2), r1 * r2
    lhs = quad_text(p, q)[:-4]
    if rng.random() < 0.5:
        return question(rng, f'Теңсіздікті шешіңіз:  {lhs} < 0', interval(r1, r2),
                        [f'{interval(-math.inf, r1)} ∪ {interval(r2, math.inf)}', interval(r1, r2, True, True), interval(-r2, -r1)])
    return question(rng, f'Теңсіздікті шешіңіз:  {lhs} ≥ 0',
                    f'{interval(-math.inf, r1, False, True)} ∪ {interval(r2, math.inf, True)}',
                    [interval(r1, r2, True, True), f'{interval(-math.inf, r1)} ∪ {interval(r2, math.inf)}',
                     f'{interval(-math.inf, -r2, False, True)} ∪ {interval(-r1, math.inf, True)}'])


def t42_square_minus(rng):
    k = rng.randint(2, 9)
    return question(rng, f'Теңсіздікті шешіңіз:  x² − {k * k} ≤ 0', interval(-k, k, True, True),
                    [f'{interval(-math.inf, -k, False, True)} ∪ {interval(k, math.inf, True)}', interval(-math.inf, k, False, True),
                     interval(-k * k, k * k, True, True)])


def t42_integer_count(rng):
    r1, r2 = sorted(rng.sample(range(-6, 8), 2))
    p, q = -(r1 + r2), r1 * r2
    count = r2 - r1 + 1
    return question(rng, f'{quad_text(p, q)[:-4]} ≤ 0 теңсіздігінің бүтін шешімдерінің санын табыңыз.', num(count),
                    [num(count - 1), num(count - 2) if count > 2 else num(count + 2), num(r2 - r1 + 2)])


def t42_always(rng):
    k = rng.randint(1, 9)
    if rng.random() < 0.5:
        return question(rng, f'Теңсіздікті шешіңіз:  x² + {k} > 0', 'x — кез келген сан',
                        ['Шешімі жоқ', interval(-k, k), interval(k, math.inf)])
    return question(rng, f'Теңсіздікті шешіңіз:  x² + {k} < 0', 'Шешімі жоқ',
                    ['x — кез келген сан', interval(-k, k), interval(-math.inf, -k)])


def t42_interval_method(rng):
    a, b, c = sorted(rng.sample(range(-5, 7), 3))
    f = lambda r: f'(x − {r})' if r > 0 else (f'(x + {-r})' if r < 0 else 'x')
    ans = f'{interval(a, b)} ∪ {interval(c, math.inf)}'
    return question(rng, f'Аралықтар әдісімен шешіңіз:  {f(a)}{f(b)}{f(c)} > 0', ans,
                    [f'{interval(-math.inf, a)} ∪ {interval(b, c)}', interval(c, math.inf),
                     f'{interval(a, b, True, True)} ∪ {interval(c, math.inf, True)}'])


def t42_double_root(rng):
    a, b = sorted(rng.sample(range(-4, 6), 2))
    f = lambda r: f'(x − {r})' if r > 0 else (f'(x + {-r})' if r < 0 else 'x')
    # (x − a)²(x − b) ≤ 0  →  (−∞; b], a < b болғандықтан a да осы аралықта
    ans = interval(-math.inf, b, False, True)
    return question(rng, f'Теңсіздікті шешіңіз:  {f(a)}²·{f(b)} ≤ 0', ans,
                    [f'{interval(-math.inf, a, False, True)} ∪ {{{num(b)}}}', interval(a, b, True, True), interval(b, math.inf, True)])


def t42_rational(rng):
    a, b = rng.sample(range(-5, 7), 2)
    lo, hi = min(a, -b), max(a, -b)
    if lo == hi:
        b += 1
        lo, hi = min(a, -b), max(a, -b)
    num_s = f'x − {a}' if a > 0 else (f'x + {-a}' if a < 0 else 'x')
    den_s = f'x + {b}' if b > 0 else (f'x − {-b}' if b < 0 else 'x')
    zero, pole = a, -b
    left = interval(-math.inf, min(zero, pole), False, zero < pole)
    right = interval(max(zero, pole), math.inf, zero > pole)
    ans = f'{left} ∪ {right}'
    wrong_closed = f'{interval(-math.inf, min(zero, pole), False, True)} ∪ {interval(max(zero, pole), math.inf, True)}'
    den_txt = den_s if den_s == 'x' else f'({den_s})'
    return question(rng, f'Теңсіздікті шешіңіз:  ({num_s}) / {den_txt} ≥ 0', ans,
                    [wrong_closed, interval(min(zero, pole), max(zero, pole), zero < pole, zero > pole),
                     f'{interval(-math.inf, min(zero, pole))} ∪ {interval(max(zero, pole), math.inf)}'])


def t42_smallest_integer(rng):
    r1, r2 = sorted(rng.sample(range(-6, 8), 2))
    p, q = -(r1 + r2), r1 * r2
    return question(rng, f'{quad_text(p, q)[:-4]} < 0 теңсіздігінің ең кіші бүтін шешімін табыңыз.', num(r1 + 1),
                    [num(r1), num(r2 - 1) if r2 - 1 != r1 + 1 else num(r2), num(r1 - 1)])


# ======================= Тақырыптар =======================

TOPICS = [
    ('1-ай · 1-апта', '1.1', 'Сандар ұғымы. Амалдар. Қатынас, пропорция, пайыз',
     [t11_percent_of, t11_number_from_percent, t11_price_change, t11_what_percent, t11_proportion,
      t11_ratio_split, t11_workers, t11_fractions, t11_order_of_ops, t11_gcd_lcm]),
    ('1-ай · 1-апта', '1.2', 'Дәреже. Арифметикалық түбір',
     [t12_power_rules, t12_negative_exp, t12_zero_negative, t12_variable_powers, t12_simple_root,
      t12_root_product, t12_abs_root, t12_fractional_exp, t12_root_sum, t12_power_rules]),
    ('1-ай · 2-апта', '2.1', 'Стандарт түр. Бірмүше, көпмүше. Қысқаша көбейту формулалары',
     [t21_standard_small, t21_standard_big, t21_monomial_degree, t21_monomial_power, t21_square_sum,
      t21_diff_squares, t21_numeric_trick, t21_factor, t21_symmetric, t21_cube_coef]),
    ('1-ай · 2-апта', '2.2', 'Күрделі радикал. Бөлімді иррационалдықтан арылту',
     [t22_nested, t22_nested_square, t22_rationalize_simple, t22_conjugate, t22_conjugate_k,
      t22_similar, t22_product, t22_square, t22_nested, t22_conjugate]),
    ('1-ай · 3-апта', '3.1', 'Сызықтық теңдеу, теңсіздік, қос теңсіздік және жүйелер',
     [t31_linear, t31_linear_both, t31_inequality, t31_double, t31_system_sum,
      t31_system_general, t31_word, t31_system_ineq, t31_inequality, t31_double]),
    ('1-ай · 3-апта', '3.2', 'Квадрат теңдеу. Көбейткішке жіктеу. Виет теоремасы',
     [t32_roots, t32_discriminant, t32_vieta, t32_factor, t32_build,
      t32_param, t32_incomplete, t32_count, t32_vieta, t32_vieta]),
    ('1-ай · 4-апта', '4.1', 'Жоғары дәрежелі теңдеулер. Көпмүшені бұрыштап бөлу',
     [t41_biquadratic, t41_cubic_factor, t41_grouping, t41_division, t41_remainder,
      t41_param_divisible, t41_integer_root, t41_biquadratic, t41_division, t41_remainder]),
    ('1-ай · 4-апта', '4.2', 'Квадрат теңсіздік. Жоғары дәрежелі теңсіздік',
     [t42_quadratic, t42_square_minus, t42_integer_count, t42_always, t42_interval_method,
      t42_double_root, t42_rational, t42_smallest_integer, t42_quadratic, t42_interval_method]),
]

VARIANTS = 3          # әр тақырыпқа нұсқа саны
WEEK_VARIANTS = 2     # апталық аралас тест нұсқалары
MONTH_VARIANTS = 2    # айлық қорытынды тест нұсқалары


def build_tests():
    tests = []
    for week, code, name, templates in TOPICS:
        for v in range(1, VARIANTS + 1):
            rng = random.Random(f'{code}-v{v}')
            tests.append({
                'topic': f'{week} · {code} {name}',
                'title': f'{code} {name} — {v}-нұсқа',
                'description': f'{len(templates)} есеп. Қате жауаптарды талдап, келесі нұсқаны тапсырыңыз.',
                'duration_min': 20,
                'questions': [t(rng) for t in templates]
            })

    weeks = {}
    for week, code, name, templates in TOPICS:
        weeks.setdefault(week, []).append((code, templates))
    for week, parts in weeks.items():
        for v in range(1, WEEK_VARIANTS + 1):
            rng = random.Random(f'{week}-week-v{v}')
            qs = []
            for _, templates in parts:
                picked = rng.sample(templates, 7)
                qs += [t(rng) for t in picked]
            rng.shuffle(qs)
            tests.append({
                'topic': f'{week} · Апталық қорытынды',
                'title': f'{week}: аралас тест — {v}-нұсқа',
                'description': 'Аптаның екі тақырыбы бойынша аралас есептер.',
                'duration_min': 30,
                'questions': qs
            })

    for v in range(1, MONTH_VARIANTS + 1):
        rng = random.Random(f'month1-v{v}')
        qs = []
        for _, _, _, templates in TOPICS:
            qs += [t(rng) for t in rng.sample(templates, 3)]
        rng.shuffle(qs)
        tests.append({
            'topic': '1-ай · Айлық қорытынды',
            'title': f'1-ай қорытынды сынақ — {v}-нұсқа',
            'description': 'Айдың барлық 8 тақырыбы бойынша ҰБТ форматындағы сынақ.',
            'duration_min': 50,
            'questions': qs
        })
    return tests


# ======================= Формула карточкалары =======================

CARDS = {
    '1.1 Пайыз, пропорция': [
        ('a санының p%-ы', 'a · p / 100'),
        ('p%-ы b-ға тең сан', 'b · 100 / p'),
        ('a саны b-ның неше пайызы?', '(a / b) · 100%'),
        ('Бағаны p%-ға арттыру', 'a · (1 + p/100)'),
        ('Бағаны p%-ға кеміту', 'a · (1 − p/100)'),
        ('Пропорцияның негізгі қасиеті', 'a : b = c : d  ⇔  a·d = b·c'),
        ('Кері пропорционал шамалар', 'x₁ · y₁ = x₂ · y₂\n(бірі өссе, екіншісі сонша есе кемиді)'),
        ('N-ді m : n қатынасында бөлу', 'Бөліктер: N·m/(m+n) және N·n/(m+n)'),
        ('ЕҮОБ пен ЕКОЕ байланысы', 'ЕҮОБ(a,b) · ЕКОЕ(a,b) = a · b'),
        ('Амалдар реті', '1) жақша  2) дәреже  3) көбейту, бөлу  4) қосу, азайту'),
    ],
    '1.2 Дәреже, түбір': [
        ('aᵐ · aⁿ', 'aᵐ⁺ⁿ'),
        ('aᵐ : aⁿ', 'aᵐ⁻ⁿ'),
        ('(aᵐ)ⁿ', 'aᵐⁿ'),
        ('(ab)ⁿ', 'aⁿ · bⁿ'),
        ('a⁰ (a ≠ 0)', '1'),
        ('a⁻ⁿ', '1 / aⁿ'),
        ('a^(m/n)', 'ⁿ√(aᵐ)'),
        ('√(a²)', '|a|'),
        ('√a · √b', '√(ab)   (a ≥ 0, b ≥ 0)'),
        ('√(a/b)', '√a / √b   (a ≥ 0, b > 0)'),
        ('(√a)²', 'a   (a ≥ 0)'),
    ],
    '2.1 Көпмүше, ҚКФ': [
        ('Санның стандарт түрі', 'a · 10ⁿ,  мұнда 1 ≤ a < 10'),
        ('Бірмүшенің дәрежесі', 'Барлық айнымалылар дәрежелерінің қосындысы'),
        ('(a + b)²', 'a² + 2ab + b²'),
        ('(a − b)²', 'a² − 2ab + b²'),
        ('a² − b²', '(a − b)(a + b)'),
        ('(a + b)³', 'a³ + 3a²b + 3ab² + b³'),
        ('(a − b)³', 'a³ − 3a²b + 3ab² − b³'),
        ('a³ + b³', '(a + b)(a² − ab + b²)'),
        ('a³ − b³', '(a − b)(a² + ab + b²)'),
        ('a² + b² (a + b және ab арқылы)', '(a + b)² − 2ab'),
    ],
    '2.2 Радикалдар': [
        ('√(a ± 2√b), егер m + n = a, mn = b', '√m ± √n   (m > n)'),
        ('1 / √a', '√a / a'),
        ('1 / (√a + √b)', '(√a − √b) / (a − b)'),
        ('1 / (√a − √b)', '(√a + √b) / (a − b)'),
        ('(√a − √b)(√a + √b)', 'a − b'),
        ('(√a ± √b)²', 'a + b ± 2√(ab)'),
        ('√(a²b)', '|a|·√b'),
        ('Түйіндес өрнек', '√a + √b және √a − √b — бір-біріне түйіндес'),
    ],
    '3.1 Сызықтық теңдеу, теңсіздік': [
        ('ax + b = 0 (a ≠ 0)', 'x = −b / a'),
        ('ax = b, a = 0 болса', 'b = 0: шексіз көп шешім\nb ≠ 0: шешімі жоқ'),
        ('Теңсіздікті теріс санға көбейту', 'Таңбасы қарама-қарсыға ауысады ( > ↔ < )'),
        ('a < x < b аралығы', '(a; b)'),
        ('a ≤ x ≤ b аралығы', '[a; b]'),
        ('Қос теңсіздікті шешу', 'Үш бөлікке де бірдей амал қолданылады'),
        ('Жүйені қосу тәсілімен шешу', 'Бір айнымалының коэффициенттерін қарама-қарсы етіп, теңдеулерді қосамыз'),
        ('Теңсіздіктер жүйесінің шешімі', 'Әр теңсіздік шешімдерінің қиылысуы (∩)'),
    ],
    '3.2 Квадрат теңдеу': [
        ('Дискриминант', 'D = b² − 4ac'),
        ('Түбірлер формуласы', 'x = (−b ± √D) / 2a'),
        ('D > 0,  D = 0,  D < 0', '2 түбір,  1 түбір,  нақты түбір жоқ'),
        ('Виет: x₁ + x₂', '−b / a'),
        ('Виет: x₁ · x₂', 'c / a'),
        ('ax² + bx + c көбейткішке', 'a(x − x₁)(x − x₂)'),
        ('Түбірлері x₁, x₂ болатын теңдеу', 'x² − (x₁ + x₂)x + x₁x₂ = 0'),
        ('x₁² + x₂²', '(x₁ + x₂)² − 2x₁x₂'),
        ('1/x₁ + 1/x₂', '(x₁ + x₂) / (x₁x₂)'),
        ('b жұп болса (b = 2k)', 'x = (−k ± √(k² − ac)) / a'),
    ],
    '4.1 Жоғары дәрежелі теңдеу': [
        ('Биквадрат теңдеу ax⁴ + bx² + c = 0', 'x² = t (t ≥ 0) алмастыруымен квадрат теңдеуге келтіріледі'),
        ('Безу теоремасы', 'P(x)-ті (x − a)-ға бөлгендегі қалдық = P(a)'),
        ('P(x) (x − a)-ға қалдықсыз бөлінеді', 'P(a) = 0, яғни a — түбір'),
        ('Бүтін түбірді іздеу', 'Бүтін түбір бос мүшенің бөлгіштерінің арасынан ізделеді'),
        ('Топтау тәсілі', 'x³ + ax² + bx + ab = x²(x + a) + b(x + a) = (x + a)(x² + b)'),
        ('Бұрыштап бөлу қадамы', 'Бөлінгіштің бас мүшесін бөлгіштің бас мүшесіне бөліп, көбейтіп, азайтамыз'),
        ('Көбейтінді нөлге тең', 'Көбейткіштердің кемінде біреуі нөлге тең'),
    ],
    '4.2 Теңсіздіктер': [
        ('ax² + bx + c < 0, a > 0, D > 0', 'Шешімі: (x₁; x₂) — түбірлердің арасы'),
        ('ax² + bx + c > 0, a > 0, D > 0', 'Шешімі: (−∞; x₁) ∪ (x₂; +∞)'),
        ('x² + k > 0 (k > 0)', 'x — кез келген сан'),
        ('x² + k < 0 (k > 0)', 'Шешімі жоқ'),
        ('Аралықтар әдісі', 'Түбірлерді түзуге белгілеп, әр аралықтағы таңбаны оңнан бастап анықтаймыз'),
        ('Жұп еселі түбір (x − a)²', 'Осы нүктеден өткенде таңба өзгермейді'),
        ('f(x)/g(x) ≥ 0', 'Бөлімнің нөлдері әрқашан ашық нүкте (бөлімге нөл жоқ)'),
        ('≤ немесе ≥ таңбасы', 'Алымның түбірлері шешімге кіреді — жақша [ ]'),
    ],
}


def build_cards():
    return [{'topic': topic, 'front': front, 'back': back} for topic, pairs in CARDS.items() for front, back in pairs]


if __name__ == '__main__':
    tests = build_tests()
    cards = build_cards()
    # Тексеріс: әр сұрақта 4 әр түрлі нұсқа, дұрыс жауап біреу ғана
    for t in tests:
        for q in t['questions']:
            assert len(q['options']) == 4 and len(set(q['options'])) == 4, (t['title'], q)
            assert 0 <= q['correct_index'] < 4
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.makedirs(os.path.join(root, 'seed'), exist_ok=True)
    out = os.path.join(root, 'seed', 'math-month1.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'tests': tests, 'flashcards': cards}, f, ensure_ascii=False, indent=1)
    total_q = sum(len(t['questions']) for t in tests)
    print(f'{len(tests)} тест, {total_q} сұрақ, {len(cards)} карточка → {out}')
