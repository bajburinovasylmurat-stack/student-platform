"""2-ай 4-апта: логарифмдік теңдеулер, теңсіздіктер, жүйелер — тесттер мен карточкалар.

Әр сұрақтың дұрыс жауабы сандық түрде тексеріледі (теңдеуге қойып, аралықтарды нүктелермен
тексеріп); қате нұсқалар дұрыс жауаппен ешқашан сәйкес келмейді.

Іске қосу: python3 scripts/generate_log_week.py  →  seed/log-2-4.json
"""
import json
import math
import os
import random
from fractions import Fraction as F

rng = random.Random(2404)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'seed', 'log-2-4.json')
TOPIC = '2-ай 4-апта · Логарифм'
EPS = 1e-9


# ---------- көмекшілер ----------

def fr(x):
    """Бөлшекті LaTeX-ке: 3/2 → \\dfrac{3}{2}, бүтін → 3."""
    x = F(x)
    if x.denominator == 1:
        return str(x.numerator)
    sign = '-' if x < 0 else ''
    return f'{sign}\\dfrac{{{abs(x.numerator)}}}{{{x.denominator}}}'


def base(a):
    """Логарифм негізі: 1/2 → 0{,}5 емес, \\frac12 түрінде."""
    a = F(a)
    if a.denominator == 1:
        return str(a.numerator)
    if a == F(1, 10):
        return '0{,}1'
    if a == F(1, 5):
        return '0{,}2'
    if a == F(1, 2):
        return '0{,}5'
    return f'\\frac{{{a.numerator}}}{{{a.denominator}}}'


def num(x):
    """Сан: 0.001 → 0{,}001, 1/8 → \\dfrac18 т.б."""
    x = F(x)
    if x.denominator == 1:
        return str(x.numerator)
    if 10 ** round(math.log10(x.denominator)) == x.denominator and x.numerator == 1:
        digits = round(math.log10(x.denominator))
        return '0{,}' + '0' * (digits - 1) + '1'
    return fr(x)


def interval(a, b, left_closed=False, right_closed=False):
    def side(v):
        if v == -math.inf:
            return '-\\infty'
        if v == math.inf:
            return '+\\infty'
        return fr(v)
    return f'{"[" if left_closed else "("}{side(a)};\\ {side(b)}{"]" if right_closed else ")"}'


def make(question, correct, wrong, points=1):
    """Нұсқаларды араластыру; дұрыс жауап бірден-бір, қайталанбайды."""
    options = [correct]
    for w in wrong:
        if w not in options:
            options.append(w)
        if len(options) == 4:
            break
    assert len(options) == 4, (question, options)
    order = list(range(4))
    rng.shuffle(order)
    shuffled = [options[i] for i in order]
    return {'question': question, 'options': shuffled, 'correct_index': shuffled.index(correct), 'points': points}


def log(a, b):
    return math.log(b) / math.log(a)


def near(x, y):
    return abs(x - y) < 1e-7


# ---------- 1. Логарифм мәні ----------

def t_values():
    qs = []
    combos = [(2, k) for k in (3, 4, 5, 6, -1, -2, -3)] + [(3, k) for k in (2, 3, 4, -1, -2)] + [(5, k) for k in (2, 3, -1)]
    rng.shuffle(combos)
    for a, k in combos[:8]:
        b = F(a) ** k
        assert near(log(a, float(b)), k)
        qs.append(make(f'Есептеңіз: $\\log_{{{a}}} {num(b)}$', f'${k}$', [f'${-k}$', f'${k + 1}$', f'${k - 1}$', f'${fr(F(1, k))}$']))
    for a, k in [(2, 3), (3, 2), (5, 2), (2, -2)]:
        b = F(a) ** k
        assert near(log(1 / a, float(b)), -k)
        qs.append(make(f'Есептеңіз: $\\log_{{{base(F(1, a))}}} {num(b)}$', f'${-k}$', [f'${k}$', f'${-k + 1}$', f'${-k - 1}$', f'${2 * k}$']))
    for k in (3, -2, -3):
        b = F(10) ** k
        qs.append(make(f'Есептеңіз: $\\lg {num(b)}$', f'${k}$', [f'${-k}$', f'${k + 1}$', f'${k - 1}$']))
    for a, b in [(3, 7), (5, 2), (2, 9)]:
        qs.append(make(f'Есептеңіз: ${a}^{{\\log_{{{a}}} {b}}}$', f'${b}$', [f'${a}$', f'${a * b}$', f'${b - a if b != a else b + 1}$', '$1$']))
    for m, n in [(2, 3), (3, 2), (2, 5)]:
        val = F(n, m)
        assert near(log(2 ** m, 2 ** n), float(val))
        qs.append(make(f'Есептеңіз: $\\log_{{{2 ** m}}} {2 ** n}$', f'${fr(val)}$', [f'${fr(F(m, n))}$', f'${n}$', f'${n * m}$', f'${n - m}$']))
    return qs


# ---------- 2. Қасиеттер ----------

def t_properties():
    qs = []
    for c, x, y in [(6, 4, 9), (10, 4, 25), (12, 3, 48), (15, 5, 45), (2, 4, 8)]:
        k = log(c, x * y)
        assert near(k, round(k))
        k = round(k)
        qs.append(make(f'Есептеңіз: $\\log_{{{c}}} {x} + \\log_{{{c}}} {y}$', f'${k}$', [f'${k + 1}$', f'${k - 1}$', f'${fr(F(x + y, c))}$', f'$\\log_{{{c}}} {x + y}$']))
    for c, x, y in [(3, 54, 2), (2, 48, 3), (5, 250, 2), (7, 98, 2)]:
        k = round(log(c, x / y))
        assert near(log(c, x / y), k)
        qs.append(make(f'Есептеңіз: $\\log_{{{c}}} {x} - \\log_{{{c}}} {y}$', f'${k}$', [f'${k + 1}$', f'${k - 1}$', f'$\\log_{{{c}}} {x - y}$', f'${fr(F(x, y))}$']))
    for a, b, c, kb in [(3, 6, 4, 2), (2, 6, 9, 2), (5, 10, 4, 2)]:
        val = kb * log(a, b) - log(a, c)
        assert near(val, round(val))
        val = round(val)
        qs.append(make(f'Есептеңіз: ${kb}\\log_{{{a}}} {b} - \\log_{{{a}}} {c}$', f'${val}$', [f'${val + 1}$', f'${val + 2}$', f'${val - 1}$']))
    for a, b, c in [(2, 3, 8), (3, 5, 27), (5, 7, 25)]:
        val = log(a, b) * log(b, c)
        assert near(val, round(val))
        val = round(val)
        qs.append(make(f'Есептеңіз: $\\log_{{{a}}} {b} \\cdot \\log_{{{b}}} {c}$', f'${val}$', [f'${val + 1}$', f'${val - 1}$', f'${b}$', f'${c}$']))
    qs.append(make('Егер $\\log_2 3 = m$ болса, $\\log_2 12$ неге тең?', '$m + 2$', ['$2m$', '$4m$', '$m + 4$', '$2m + 1$']))
    qs.append(make('Егер $\\lg 2 = a$ болса, $\\lg 5$ неге тең?', '$1 - a$', ['$5a$', '$a - 1$', '$\\dfrac{5}{2}a$', '$1 + a$']))
    qs.append(make('Қай теңдік ДҰРЫС?', '$\\log_a(bc) = \\log_a b + \\log_a c$',
                   ['$\\log_a(b + c) = \\log_a b + \\log_a c$', '$\\log_a(b - c) = \\dfrac{\\log_a b}{\\log_a c}$', '$\\log_a b^k = (\\log_a b)^k$']))
    qs.append(make('$\\log_a x^2$ қалай жазылады ($x \\ne 0$)?', '$2\\log_a |x|$', ['$2\\log_a x$', '$(\\log_a x)^2$', '$\\log_a 2x$']))
    return qs


# ---------- 3. Теңдеулер: анықтама, потенциалдау ----------

def t_equations_basic():
    qs = []
    for a, p, q, k in [(3, 2, 1, 2), (2, 1, 3, 3), (5, 3, -1, 1), (2, 2, -3, 4), (3, 1, -5, 3), (4, 2, 1, 2), (10, 1, 2, 2)]:
        x = F(a ** k - q, p)
        assert near(log(a, float(p * x + q)), k)
        sign = '+' if q > 0 else '-'
        arg = f'{p if p != 1 else ""}x {sign} {abs(q)}'
        name = '\\lg' if a == 10 else f'\\log_{{{a}}}'
        qs.append(make(f'Теңдеуді шешіңіз: ${name}({arg}) = {k}$', f'${fr(x)}$',
                       [f'${fr(F(a * k - q, p))}$', f'${fr(F(a ** k + q, p))}$', f'${fr(x + 1)}$', f'${fr(x - 1)}$']))
    for a, (p1, q1), (p2, q2) in [(3, (2, -1), (1, 4)), (2, (3, -2), (1, 6)), (5, (4, 1), (2, 7))]:
        x = F(q2 - q1, p1 - p2)
        assert p1 * x + q1 > 0 and p2 * x + q2 > 0
        lhs = f'{p1}x {"+" if q1 > 0 else "-"} {abs(q1)}'
        rhs = f'{p2 if p2 != 1 else ""}x {"+" if q2 > 0 else "-"} {abs(q2)}'
        qs.append(make(f'Теңдеуді шешіңіз: $\\log_{{{a}}}({lhs}) = \\log_{{{a}}}({rhs})$', f'${fr(x)}$',
                       [f'${fr(-x)}$', f'${fr(x + 2)}$', '$\\varnothing$', f'${fr(x - 1)}$']))
    # x² − c² = a^k түріндегі тұзақ: теріс түбір ММЖ-ға кірмейді
    for a, c, k in [(2, 1, 3), (2, 2, 5), (3, 1, 1), (2, 3, 4)]:
        x = math.isqrt(a ** k + c * c)
        assert x * x == a ** k + c * c
        assert near(log(a, x - c) + log(a, x + c), k)
        qs.append(make(f'Теңдеуді шешіңіз: $\\log_{{{a}}}(x - {c}) + \\log_{{{a}}}(x + {c}) = {k}$', f'${x}$',
                       [f'$\\pm {x}$', f'$-{x}$', '$\\varnothing$', f'${x + 1}$']))
    qs.append(make('Теңдеуді шешіңіз: $\\log_5(x^2 - 3x) = \\log_5(2x - 6)$', 'шешімі жоқ', ['$2;\\ 3$', '$3$', '$2$']))
    qs.append(make('$\\log_x 16 = 2$ теңдеуінің түбірі', '$4$', ['$\\pm 4$', '$-4$', '$8$']))
    qs.append(make('$\\log_x 27 = 3$ теңдеуінің түбірі', '$3$', ['$9$', '$\\pm 3$', '$\\sqrt[3]{3}$']))
    return qs


# ---------- 4. Теңдеулер: жаңа айнымалы, логарифмдеу ----------

def t_equations_sub():
    qs = []
    for a, m, n in [(3, 2, -1), (10, 1, 2), (2, 1, 3), (2, -1, 2), (3, 1, 2), (5, 1, -1)]:
        name = '\\lg' if a == 10 else f'\\log_{{{a}}}'
        s, p = m + n, m * n
        x1, x2 = sorted([F(a) ** m, F(a) ** n])
        for x in (x1, x2):
            t = log(a, float(x))
            assert near(t * t - s * t + p, 0)
        mid = f'- {s}' if s > 0 else f'+ {-s}'
        if s == 1:
            mid = '-'
        if s == -1:
            mid = '+'
        tail = f'+ {p}' if p > 0 else f'- {-p}'
        q = f'Теңдеуді шешіңіз: ${name}^2 x {mid} {name} x {tail} = 0$'
        right = f'${num(x1)};\\ {num(x2)}$'
        wrong = [f'${m};\\ {n}$', f'${num(F(a) ** -m)};\\ {num(F(a) ** -n)}$', f'${num(x2)}$', f'${num(x1)}$']
        qs.append(make(q, right, wrong))
    for a, k in [(2, 2), (3, 1), (2, 3), (10, 1)]:
        # x^{log_a x} = a^{k²}: log_a x = ±k
        name = '\\lg' if a == 10 else f'\\log_{{{a}}}'
        rhs = F(a) ** (k * k)
        x1, x2 = F(a) ** -k, F(a) ** k
        for x in (x1, x2):
            assert near(log(a, float(x)) ** 2, k * k)
        qs.append(make(f'Теңдеуді шешіңіз: $x^{{{name} x}} = {num(rhs)}$', f'${num(x1)};\\ {num(x2)}$',
                       [f'${num(x2)}$', f'$\\pm {num(x2)}$', f'${k};\\ {-k}$']))
    qs.append(make('$\\log_2^2 x - \\log_2 x - 2 = 0$ теңдеуінде $t = \\log_2 x$ деп белгілегенде шығатын теңдеу',
                   '$t^2 - t - 2 = 0$', ['$t^2 - 2t - 1 = 0$', '$2t - t - 2 = 0$', '$t^2 - t = 0$']))
    qs.append(make('$\\lg^2 x - 3\\lg x + 2 = 0$ теңдеуінің түбірлерінің көбейтіндісі', '$1000$', ['$2$', '$110$', '$100$']))
    return qs


# ---------- 5. Жүйелер ----------

def t_systems():
    qs = []
    for x, y in [(20, 5), (25, 4), (50, 2)]:
        assert x * y == 100
        qs.append(make(f'Жүйені шешіңіз: $\\begin{{cases}}\\lg x + \\lg y = 2\\\\ x - y = {x - y}\\end{{cases}}$', f'$({x};\\ {y})$',
                       [f'$({y};\\ {x})$', f'$({x};\\ {y}),\\ ({-y};\\ {-x})$', f'$({x + 1};\\ {y + 1})$']))
    for a, b in [(1, 2), (1, 3), (2, 3), (0, 2)]:
        s, t = 2 ** a + 2 ** b, a + b
        qs.append(make(f'Жүйені шешіңіз: $\\begin{{cases}}2^x + 2^y = {s}\\\\ x + y = {t}\\end{{cases}}$', f'$({a};\\ {b}),\\ ({b};\\ {a})$',
                       [f'$({a};\\ {b})$', f'$({2 ** a};\\ {2 ** b})$', f'$({a + 1};\\ {b - 1}),\\ ({b - 1};\\ {a + 1})$']))
    for k in (3, 4, 5):
        x, y = 2 * k, k
        assert near(math.log2(x) - math.log2(y), 1)
        qs.append(make(f'Жүйені шешіңіз: $\\begin{{cases}}\\log_2 x - \\log_2 y = 1\\\\ x + y = {3 * k}\\end{{cases}}$', f'$({x};\\ {y})$',
                       [f'$({y};\\ {x})$', f'$({x + 1};\\ {y - 1})$', f'$({3 * k - 1};\\ 1)$']))
    for c in (3, 5, 7):
        y = F(c - 1, 2)
        x = y + 1
        qs.append(make(f'Жүйені шешіңіз: $\\begin{{cases}}3^x \\cdot 3^y = {3 ** c}\\\\ 2^x = 2^{{y + 1}}\\end{{cases}}$', f'$({fr(x)};\\ {fr(y)})$',
                       [f'$({fr(y)};\\ {fr(x)})$', f'$({c};\\ {c - 1})$', f'$({fr(x + 1)};\\ {fr(y)})$']))
    return qs


# ---------- 6. Логарифмдік теңсіздіктер ----------

def t_log_ineq():
    qs = []
    for a, q, k in [(2, 3, 2), (3, 1, 2), (2, -1, 3), (5, 2, 1)]:
        hi = q + a ** k
        for xs, ok in ((q + 0.5, True), (hi - 0.5, True), (hi + 0.5, False), (q - 0.5, False)):
            inside = xs - q > 0 and log(a, xs - q) < k
            assert inside == ok
        arg = f'x {"-" if q > 0 else "+"} {abs(q)}'
        qs.append(make(f'Теңсіздікті шешіңіз: $\\log_{{{a}}}({arg}) < {k}$', f'${interval(q, hi)}$',
                       [f'${interval(-math.inf, hi)}$', f'${interval(hi, math.inf)}$', f'${interval(q, hi, right_closed=True)}$']))
    for a, p, q, k in [(F(1, 2), 2, 1, 1), (F(1, 3), 1, 2, 2), (F(1, 2), 1, 3, 2), (F(1, 5), 1, 1, 1)]:
        lo = F(q, p)
        hi = F(int(F(1) / a) ** k + q, p)
        # log_a(px − q) ≥ −k, негіз < 1: 0 < px − q ≤ a^{−k}
        for xs, ok in ((float(lo) + 0.01, True), (float(hi), True), (float(hi) + 0.1, False), (float(lo) - 0.1, False)):
            val = p * xs - q
            inside = val > 0 and log(float(a), val) >= -k - EPS
            assert inside == ok, (a, p, q, k, xs)
        arg = f'{p if p != 1 else ""}x - {q}'
        qs.append(make(f'Теңсіздікті шешіңіз: $\\log_{{{base(a)}}}({arg}) \\ge -{k}$', f'${interval(lo, hi, right_closed=True)}$',
                       [f'${interval(hi, math.inf, left_closed=True)}$', f'${interval(-math.inf, hi, right_closed=True)}$', f'${interval(lo, hi)}$']))
    qs.append(make('Теңсіздікті шешіңіз: $\\log_5(x^2 - 4x) \\le 1$', '$[-1;\\ 0) \\cup (4;\\ 5]$',
                   ['$[-1;\\ 5]$', '$(-\\infty;\\ 0) \\cup (4;\\ +\\infty)$', '$(-1;\\ 0) \\cup (4;\\ 5)$']))
    qs.append(make('Теңсіздікті шешіңіз: $\\log_{0{,}2}(x - 2) > \\log_{0{,}2} 4$', '$(2;\\ 6)$', ['$(6;\\ +\\infty)$', '$(-\\infty;\\ 6)$', '$(2;\\ 6]$']))
    qs.append(make('Теңсіздікті шешіңіз: $\\log_{\\frac12}(x - 1) > -2$', '$(1;\\ 5)$', ['$(5;\\ +\\infty)$', '$(-\\infty;\\ 5)$', '$(1;\\ 5]$']))
    qs.append(make('$\\log_a f(x) > \\log_a g(x)$, $0 < a < 1$ болса, ол неге пара-пар?', '$0 < f(x) < g(x)$',
                   ['$f(x) > g(x) > 0$', '$f(x) < g(x)$', '$f(x) > g(x)$']))
    qs.append(make('$\\log_a b > 0$ болуының шарты', '$(a - 1)(b - 1) > 0$', ['$a > b$', '$(a - 1)(b - 1) < 0$', '$b > 1$']))
    return qs


# ---------- 7. Көрсеткіштік теңсіздіктер ----------

def t_exp_ineq():
    qs = []
    qs.append(make('Теңсіздікті шешіңіз: $\\left(\\dfrac13\\right)^{x-2} > 9$', '$(-\\infty;\\ 0)$', ['$(0;\\ +\\infty)$', '$(-\\infty;\\ 4)$', '$(4;\\ +\\infty)$']))
    for a, p, k in [(2, 1, 3), (3, 2, 2), (5, -1, 1)]:
        # a^{x − p} > a^k ⇒ x > p + k
        bnd = p + k
        assert a ** (bnd + 0.5 - p) > a ** k and not a ** (bnd - 0.5 - p) > a ** k
        sign = f'- {p}' if p > 0 else f'+ {-p}'
        qs.append(make(f'Теңсіздікті шешіңіз: ${a}^{{x {sign}}} > {a ** k}$', f'${interval(bnd, math.inf)}$',
                       [f'${interval(-math.inf, bnd)}$', f'${interval(bnd, math.inf, left_closed=True)}$', f'${interval(k, math.inf)}$']))
    for a, k in [(F(1, 2), 3), (F(1, 3), 2), (F(1, 5), 1)]:
        # a^x ≥ a^k, негіз < 1 ⇒ x ≤ k
        rhs = a ** k
        assert float(a) ** (k - 0.5) >= float(rhs) and not float(a) ** (k + 0.5) >= float(rhs)
        qs.append(make(f'Теңсіздікті шешіңіз: $\\left({fr(a)}\\right)^{{x}} \\ge {num(rhs)}$', f'${interval(-math.inf, k, right_closed=True)}$',
                       [f'${interval(k, math.inf, left_closed=True)}$', f'${interval(-math.inf, k)}$', f'${interval(-math.inf, -k, right_closed=True)}$']))
    for a, c in [(2, 12), (3, 36)]:
        # a^{x+1} + a^x > c ⇒ a^x (a + 1) > c
        k = round(math.log(c / (a + 1), a))
        assert a ** k * (a + 1) == c
        qs.append(make(f'Теңсіздікті шешіңіз: ${a}^{{x+1}} + {a}^x > {c}$', f'${interval(k, math.inf)}$',
                       [f'${interval(-math.inf, k)}$', f'${interval(k + 1, math.inf)}$', f'${interval(k, math.inf, left_closed=True)}$']))
    qs.append(make('Теңсіздікті шешіңіз: $3^{x+1} - 3^x \\ge 54$', '$[3;\\ +\\infty)$', ['$(3;\\ +\\infty)$', '$(-\\infty;\\ 3]$', '$[2;\\ +\\infty)$']))
    qs.append(make('Теңсіздікті шешіңіз: $4^x - 3 \\cdot 2^x - 4 \\le 0$', '$(-\\infty;\\ 2]$', ['$[-1;\\ 4]$', '$[0;\\ 2]$', '$[2;\\ +\\infty)$']))
    qs.append(make('Теңсіздікті шешіңіз: $9^x - 4 \\cdot 3^x + 3 \\ge 0$', '$(-\\infty;\\ 0] \\cup [1;\\ +\\infty)$', ['$[0;\\ 1]$', '$(-\\infty;\\ 1] \\cup [3;\\ +\\infty)$', '$[1;\\ +\\infty)$']))
    qs.append(make('Теңсіздікті шешіңіз: $2^{x^2 - 3x} < \\dfrac14$', '$(1;\\ 2)$', ['$(-\\infty;\\ 1) \\cup (2;\\ +\\infty)$', '$[1;\\ 2]$', '$(0;\\ 3)$']))
    qs.append(make('Теңсіздіктер жүйесін шешіңіз: $\\begin{cases}2^x > 4\\\\ \\log_3(x + 1) < 2\\end{cases}$', '$(2;\\ 8)$', ['$(-1;\\ 8)$', '$(2;\\ +\\infty)$', '$(2;\\ 8]$']))
    qs.append(make('$t = a^x$ алмастыруында міндетті шарт', '$t > 0$', ['$t \\ge 0$', '$t \\ne 1$', '$t > 1$']))
    return qs


# ---------- 8. BOSS FIGHT (PDF-тегі 10 есеп) ----------

def t_boss():
    # Жауаптар PDF-те берілген және қолмен тексерілді
    assert near(log(3, 2 * 4 + 1), 2) and near(math.log2(8) + math.log2(4), 5) and 4 ** 2 == 16
    return [
        make('$\\log_3(2x + 1) = 2$', '$4$', ['$\\dfrac72$', '$5$', '$\\dfrac52$']),
        make('$\\log_2(x + 2) + \\log_2(x - 2) = 5$', '$6$', ['$\\pm 6$', '$-6$', '$34$']),
        make('$\\lg^2 x - 3\\lg x + 2 = 0$', '$10;\\ 100$', ['$1;\\ 2$', '$100$', '$0{,}1;\\ 0{,}01$']),
        make('$\\log_x 16 = 2$', '$4$', ['$\\pm 4$', '$8$', '$-4$']),
        make('$\\begin{cases}\\log_2 x - \\log_2 y = 1\\\\ x + y = 9\\end{cases}$', '$(6;\\ 3)$', ['$(3;\\ 6)$', '$(8;\\ 1)$', '$(5;\\ 4)$']),
        make('$\\begin{cases}3^x \\cdot 3^y = 27\\\\ 2^x = 2^{y+1}\\end{cases}$', '$(2;\\ 1)$', ['$(1;\\ 2)$', '$(3;\\ 2)$', '$(2;\\ 3)$']),
        make('$\\log_{\\frac12}(x - 1) > -2$', '$(1;\\ 5)$', ['$(5;\\ +\\infty)$', '$(-\\infty;\\ 5)$', '$[1;\\ 5)$']),
        make('$\\log_5(x^2 - 4x) \\le 1$', '$[-1;\\ 0) \\cup (4;\\ 5]$', ['$[-1;\\ 5]$', '$(0;\\ 4)$', '$[-1;\\ 0] \\cup [4;\\ 5]$']),
        make('$2^{x^2 - 3x} < \\dfrac14$', '$(1;\\ 2)$', ['$(-\\infty;\\ 1) \\cup (2;\\ +\\infty)$', '$[1;\\ 2]$', '$(-2;\\ -1)$']),
        make('$9^x - 4 \\cdot 3^x + 3 \\ge 0$', '$(-\\infty;\\ 0] \\cup [1;\\ +\\infty)$', ['$[0;\\ 1]$', '$(-\\infty;\\ 1] \\cup [3;\\ +\\infty)$', '$(0;\\ 1)$']),
        make('BUG: оқушы $\\log_{0{,}2}(x - 2) > \\log_{0{,}2} 4$ теңсіздігін $x - 2 > 4 \\Rightarrow x > 6$ деп шешті. Дұрыс жауабы:',
             '$(2;\\ 6)$', ['$(6;\\ +\\infty)$', '$(-\\infty;\\ 6)$', '$(2;\\ +\\infty)$']),
    ]


TESTS = [
    ('Логарифм мәнін есепте ⚡', 'Жылдам раунд: анықтама бойынша логарифм мәні', 10, t_values),
    ('Логарифм қасиеттері ⚡', 'Қосынды, айырым, дәреже, жаңа негізге өту', 12, t_properties),
    ('Логарифмдік теңдеулер I', 'Анықтама бойынша және потенциалдау, ММЖ тұзақтары', 15, t_equations_basic),
    ('Логарифмдік теңдеулер II', 'Жаңа айнымалы және логарифмдеу', 12, t_equations_sub),
    ('Теңдеулер жүйесі', 'Логарифмдік және көрсеткіштік жүйелер', 15, t_systems),
    ('Логарифмдік теңсіздіктер', 'Негіз > 1 және 0 < негіз < 1, ММЖ-мен қиылыстыру', 15, t_log_ineq),
    ('Көрсеткіштік теңсіздіктер', 'Бір негізге келтіру, ортақ көбейткіш, жаңа айнымалы', 12, t_exp_ineq),
    ('BOSS FIGHT: 2-ай 4-апта', 'Базадағы 10 есеп + BUG', 15, t_boss),
]

CARDS = [
    ('Логарифмнің анықтамасы', 'log_a b = c ⇔ a^c = b\na > 0, a ≠ 1, b > 0'),
    ('Негізгі логарифмдік тепе-теңдік', 'a^(log_a b) = b'),
    ('log_a 1 = ?   log_a a = ?', 'log_a 1 = 0\nlog_a a = 1'),
    ('lg b және ln b деген не?', 'lg b = log₁₀ b\nln b = logₑ b'),
    ('log_a (bc) = ?', 'log_a b + log_a c'),
    ('log_a (b/c) = ?', 'log_a b − log_a c'),
    ('log_a b^k = ?', 'k · log_a b'),
    ('log_(a^m) b = ?', '(1/m) · log_a b'),
    ('Жаңа негізге өту формуласы', 'log_a b = log_c b / log_c a\nlog_a b = 1 / log_b a'),
    ('Санды логарифммен жазу', 'c = log_a a^c\nмысалы: 3 = log₂ 8, −1 = log₀,₅ 2'),
    ('log_a b қашан оң?', 'a мен b 1-дің бір жағында болса — оң, екі жағында — теріс\nlog_a b > 0 ⇔ (a − 1)(b − 1) > 0'),
    ('y = log_a x монотондығы', 'a > 1 — өспелі\n0 < a < 1 — кемімелі\nСондықтан 0 < a < 1 болса, теңсіздік таңбасы ауысады'),
    ('log_a f(x) = c үшін ММЖ', 'f(x) > 0'),
    ('log_g(x) f(x) = c үшін ММЖ', 'f(x) > 0, g(x) > 0, g(x) ≠ 1'),
    ('Логарифмдік теңдеуді шешудің 4 әдісі', '1) Анықтама бойынша: f(x) = a^c\n2) Потенциалдау: f(x) = g(x)\n3) Жаңа айнымалы: log_a x = t\n4) Логарифмдеу (x дәрежеде де, негізде де болса)'),
    ('Логарифмдік теңдеуді шешу алгоритмі', '1) ММЖ жазу\n2) Бір негізге, бір логарифмге келтіру\n3) Әдісті таңдау\n4) Алгебралық теңдеуді шешу\n5) Түбірлерді ММЖ-мен тексеру'),
    ('log₂(x − 1) + log₂(x + 1) = 3', 'ММЖ: x > 1\nx² − 1 = 8 ⇒ x = ±3\n−3 ММЖ-ға кірмейді ⇒ x = 3'),
    ('log₅(x² − 3x) = log₅(2x − 6) — тұзақ', 'x² − 5x + 6 = 0 ⇒ x = 2; 3\nММЖ: x > 3 — екеуі де кірмейді\nЖауабы: шешімі жоқ'),
    ('Көрсеткіштік теңдеу: a^f(x) = a^g(x)', 'f(x) = g(x)\n(a > 0, a ≠ 1; әрқашан a^x > 0)'),
    ('Жүйені шешу алгоритмі', '1) Әр теңдеудің ММЖ-сы\n2) Алгебралық түрге келтіру\n3) Алмастыру / қосу / жаңа айнымалы (u = 2^x, v = 2^y)\n4) Жұптарды ММЖ-мен тексеру'),
    ('lg x + lg y = 2, x − y = 15', 'xy = 100, x = y + 15\ny² + 15y − 100 = 0 ⇒ y = 5\nЖауабы: (20; 5)'),
    ('log_a f > log_a g, a > 1', 'f(x) > g(x) > 0 (таңба сақталады)'),
    ('log_a f > log_a g, 0 < a < 1', '0 < f(x) < g(x) (таңба ауысады)'),
    ('Айнымалы негіз: рационализация', 'log_h f ∨ log_h g ⇔ (h − 1)(f − g) ∨ 0\n+ ММЖ: f > 0, g > 0, h > 0, h ≠ 1'),
    ('Логарифмдік теңсіздік алгоритмі', '1) ММЖ\n2) Бір негізді логарифмге келтіру\n3) Негізге қарау (a > 1 / 0 < a < 1)\n4) Алгебралық теңсіздікті шешу\n5) ММЖ-мен қиылыстыру'),
    ('Көрсеткіштік теңсіздік, a > 1 және 0 < a < 1', 'a > 1: a^f > a^g ⇔ f > g\n0 < a < 1: a^f > a^g ⇔ f < g'),
    ('4^x − 3·2^x − 4 ≤ 0', 't = 2^x > 0: t² − 3t − 4 ≤ 0 ⇒ −1 ≤ t ≤ 4\nt > 0 ⇒ 0 < t ≤ 4 ⇒ x ≤ 2'),
    ('2^(x+1) + 2^x > 12', '2^x(2 + 1) > 12 ⇒ 2^x > 4 ⇒ x > 2'),
    ('Жиі қате: log_a (b + c) = log_a b + log_a c', 'Мұндай қасиет ЖОҚ!\nДұрысы: log_a (bc) = log_a b + log_a c'),
    ('Жиі қате: log_a x² = 2 log_a x', 'ММЖ тарылады! Дұрысы: log_a x² = 2 log_a |x|'),
    ('Жиі қате: t = a^x алмастыруы', 't > 0 шартын ұмытпа'),
    ('BUG: log₀,₂(x − 2) > log₀,₂ 4', 'Негіз 0,2 < 1 — таңба ауысады + ММЖ\n0 < x − 2 < 4 ⇒ (2; 6)'),
]


def main():
    tests = []
    total = 0
    for order, (title, desc, minutes, gen) in enumerate(TESTS):
        questions = gen()
        for q in questions:
            assert q['question'].count('$') % 2 == 0 and all(o.count('$') % 2 == 0 for o in q['options']), q
            assert len(set(q['options'])) == 4
        total += len(questions)
        tests.append({'title': title, 'description': f'{desc} · {len(questions)} сұрақ', 'duration_min': minutes,
                      'topic': TOPIC, 'sort_order': order, 'questions': questions})
    seed = {
        'materials': [{
            'title': '2-ай 4-апта база: Логарифм (LVL UP)',
            'description': 'Логарифмдік теңдеулер, теңсіздіктер, жүйелер: теория, мысалдар, жиі қателер, BOSS FIGHT',
            'url': 'https://juzup.onrender.com/files/2-ai-4-apta-baza.pdf',
            'category': 'formula',
        }],
        'tests': tests,
        'flashcards': [{'topic': TOPIC, 'front': f, 'back': b} for f, b in CARDS],
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(seed, f, ensure_ascii=False, indent=1)
    print(f'{len(tests)} тест, {total} сұрақ, {len(CARDS)} карточка')
    for t in tests:
        print(f'  {t["title"]}: {len(t["questions"])}')


if __name__ == '__main__':
    main()
