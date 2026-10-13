import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/Features.css';
import { api, errorText } from '../../api';
import { formatKkDate } from '../../utils/kkDate';
import MathText from '../../components/MathText';
import { LuArrowLeft, LuArrowRight, LuCheck, LuCheckCircle2, LuChevronDown, LuCircle, LuFileQuestion, LuHelpCircle, LuPartyPopper, LuPlay, LuRotateCcw, LuTarget, LuTimer, LuTrendingUp, LuXCircle } from 'react-icons/lu';

// Оқушыға арналған онлайн тесттер: тізім, тапсыру, нәтиже
export default function Tests() {
  const [view, setView] = useState({ name: 'list' });

  if (view.name === 'take') {
    return <TakeTest session={view.session} onFinish={(result) => setView({ name: 'result', result })} />;
  }
  if (view.name === 'result') {
    return (
      <TestResult
        result={view.result}
        onBack={() => setView({ name: 'list' })}
        onMistakes={() => setView({ name: 'mistakes', result: view.result })}
      />
    );
  }
  if (view.name === 'mistakes') {
    return <MistakeWork result={view.result} onDone={(result) => setView({ name: 'result', result })} />;
  }
  return (
    <TestList
      onStart={(session) => setView({ name: 'take', session })}
      onOpenResult={(result) => setView({ name: 'result', result })}
    />
  );
}

function TestList({ onStart, onOpenResult }) {
  const [tests, setTests] = useState(null);
  const [history, setHistory] = useState([]);
  const [starting, setStarting] = useState(null);
  const [tab, setTab] = useState('topics');

  useEffect(() => {
    Promise.all([api.get('/api/tests'), api.get('/api/my-test-history')])
      .then(([t, h]) => { setTests(t); setHistory(h); })
      .catch(() => setTests([]));
  }, []);

  const start = async (test) => {
    const resuming = Boolean(test.active_attempt);
    if (!resuming && !window.confirm(
      `«${test.title}» тестін бастайсыз ба?\n${test.questions} сұрақ · ${test.duration_min} минут. Таймер бірден басталады.`
    )) return;

    setStarting(test.id);
    try {
      onStart(await api.post(`/api/tests/${test.id}/start`));
    } catch (error) {
      alert(errorText(error, 'Тестті бастау сәтсіз'));
      setStarting(null);
    }
  };

  const openResult = async (attemptId) => {
    try {
      onOpenResult(await api.get(`/api/attempts/${attemptId}`));
    } catch (error) {
      alert(errorText(error, 'Нәтижені ашу сәтсіз'));
    }
  };

  if (!tests) return <div className="loading">Жүктелуде...</div>;

  // ҰТО нұсқалары бөлек қойындыда: толық форматтағы сынақ тесттер
  const utoTests = tests.filter(isUto);
  const topicTests = tests.filter((t) => !isUto(t));
  const hasTabs = utoTests.length > 0 && topicTests.length > 0;
  const shown = !hasTabs ? tests : tab === 'uto' ? utoTests : topicTests;

  return (
    <div className="feature-page">
      <h2><LuFileQuestion /> Онлайн тесттер</h2>

      {hasTabs && (
        <div className="test-tabs" role="tablist">
          <button role="tab" aria-selected={tab === 'topics'} className={tab === 'topics' ? 'active' : ''} onClick={() => setTab('topics')}>
            Тақырыптық тесттер <span>{topicTests.length}</span>
          </button>
          <button role="tab" aria-selected={tab === 'uto'} className={tab === 'uto' ? 'active' : ''} onClick={() => setTab('uto')}>
            ҰТО <span>{utoTests.length}</span>
          </button>
        </div>
      )}

      {tests.length === 0 ? (
        <p className="empty-state">Әзірге жарияланған тест жоқ</p>
      ) : (
        <div className="test-groups">
          {groupByTopic(shown).map(([topic, items], gi) => {
            const done = items.filter((t) => t.attempts > 0).length;
            const hasActive = items.some((t) => t.active_attempt);
            return (
              <details key={topic} className="test-group" open={gi === 0 || hasActive}>
                <summary>
                  <span className="grow">{topic}</span>
                  <span className={`group-count ${done === items.length ? 'complete' : ''}`}>
                    {done === items.length && <LuCheck />} {done}/{items.length}
                  </span>
                  <LuChevronDown className="group-chevron" />
                </summary>
                <div className="test-grid">
                  {items.map((test) => (
                <div key={test.id} className="test-card">
                  <h3>{test.title}</h3>
                  {test.description && <p className="test-desc">{test.description}</p>}
                  <div className="test-meta">
                    <span><LuHelpCircle /> {test.questions} сұрақ</span>
                    <span><LuTimer /> {test.duration_min} мин</span>
                    <span><LuTarget /> {test.max_score} балл</span>
                  </div>
                  {test.attempts > 0 && (
                    <p className="test-best">
                      Ең жақсы нәтиже: <b>{test.best_score}/{test.max_score}</b> · {test.attempts} рет тапсырдыңыз
                    </p>
                  )}
                  <button className="primary-btn" disabled={starting === test.id} onClick={() => start(test)}>
                    {starting === test.id ? '...' : test.active_attempt ? <><LuPlay /> Жалғастыру</> : test.attempts ? <><LuRotateCcw /> Қайта тапсыру</> : <><LuPlay /> Бастау</>}
                  </button>
                </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}

      {history.length > 0 && (
        <section className="history-section">
          <h3><LuTrendingUp /> Менің нәтижелерім</h3>
          <ScoreChart history={history} />
          <div className="history-list">
            {[...history].reverse().slice(0, 15).map((h) => (
              <button key={h.id} className="history-row" onClick={() => openResult(h.id)}>
                <span className="grow">{h.title}</span>
                <span className="muted-text">{formatKkDate(new Date(h.finished_at))}</span>
                <b className={scoreClass(h.score, h.max_score)}>{h.score}/{h.max_score}</b>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

const isUto = (test) => (test.topic || '').startsWith('ҰТО');

// Тесттерді тақырып бойынша топтау (реті серверден келгендей сақталады)
const groupByTopic = (tests) => {
  const groups = new Map();
  for (const t of tests) {
    const key = t.topic || 'Басқа тесттер';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }
  return [...groups];
};

const scoreClass = (score, max) => {
  const p = max ? score / max : 0;
  return p >= 0.8 ? 'score-good' : p >= 0.5 ? 'score-mid' : 'score-low';
};

// Нәтижелер графигі (пайызбен), сыртқы кітапханасыз SVG
function ScoreChart({ history }) {
  const points = history.slice(-20).map((h) => (h.max_score ? Math.round((h.score / h.max_score) * 100) : 0));
  if (points.length < 2) return null;
  const w = 600;
  const h = 160;
  const pad = 24;
  const x = (i) => pad + (i * (w - pad * 2)) / (points.length - 1);
  const y = (v) => h - pad - (v / 100) * (h - pad * 2);
  const line = points.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' ');

  return (
    <svg className="score-chart" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Тест нәтижелерінің графигі">
      {[0, 50, 100].map((v) => (
        <g key={v}>
          <line x1={pad} x2={w - pad} y1={y(v)} y2={y(v)} className="grid-line" />
          <text x={4} y={y(v) + 4} className="axis-label">{v}%</text>
        </g>
      ))}
      <path d={`${line} L${x(points.length - 1)},${h - pad} L${x(0)},${h - pad} Z`} className="chart-area" />
      <path d={line} className="chart-line" />
      {points.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="4" className="chart-dot">
          <title>{v}%</title>
        </circle>
      ))}
    </svg>
  );
}

function TakeTest({ session, onFinish }) {
  const [answers, setAnswers] = useState(session.answers || {});
  const [index, setIndex] = useState(0);
  const [left, setLeft] = useState(() => Math.max(0, new Date(session.deadline) - Date.now()));
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef(answers);
  const submittedRef = useRef(false);
  const saveTimer = useRef(null);

  const submit = useCallback(async (auto = false) => {
    if (submittedRef.current) return;
    if (!auto) {
      const empty = session.questions.length - Object.keys(answersRef.current).length;
      if (!window.confirm(empty ? `${empty} сұраққа жауап берілмеді. Аяқтайсыз ба?` : 'Тестті аяқтайсыз ба?')) return;
    }
    submittedRef.current = true;
    setSubmitting(true);
    try {
      onFinish(await api.post(`/api/attempts/${session.attempt_id}/submit`, { answers: answersRef.current }));
    } catch (error) {
      submittedRef.current = false;
      setSubmitting(false);
      alert(errorText(error, 'Тапсыру сәтсіз. Қайта басыңыз'));
    }
  }, [session, onFinish]);

  // Таймер: уақыт біткенде өзі тапсырады
  useEffect(() => {
    const timer = setInterval(() => {
      const ms = Math.max(0, new Date(session.deadline) - Date.now());
      setLeft(ms);
      if (ms === 0) {
        clearInterval(timer);
        submit(true);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session.deadline, submit]);

  // Бетті жаңартса немесе жабылса, жауаптар серверде сақталған
  const choose = (question, optionIndex) => {
    const questionId = question.id;
    const next = { ...answersRef.current };
    if (question.multi) {
      // Бірнеше жауап: басқанда қосылады/алынады, ең көбі үшеу (ҰБТ ережесі)
      const current = Array.isArray(next[questionId]) ? next[questionId] : [];
      const toggled = current.includes(optionIndex)
        ? current.filter((i) => i !== optionIndex)
        : [...current, optionIndex].sort((a, b) => a - b);
      if (toggled.length > 3) return;
      if (toggled.length) next[questionId] = toggled; else delete next[questionId];
    } else {
      next[questionId] = optionIndex;
    }
    answersRef.current = next;
    setAnswers(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put(`/api/attempts/${session.attempt_id}/answers`, { answers: answersRef.current }).catch(() => {});
    }, 600);
  };

  // Сәйкестендіру есебі: әр жолға ортақ тізімнен бір жауап
  const chooseMatch = (question, rowIndex, value) => {
    const current = Array.isArray(answersRef.current[question.id]) ? answersRef.current[question.id] : [];
    const picked = question.match_rows.map((_, i) => (i === rowIndex ? value : current[i] ?? null));
    const next = { ...answersRef.current };
    if (picked.some((v) => v !== null)) next[question.id] = picked; else delete next[question.id];
    answersRef.current = next;
    setAnswers(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      api.put(`/api/attempts/${session.attempt_id}/answers`, { answers: answersRef.current }).catch(() => {});
    }, 600);
  };

  const q = session.questions[index];
  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);
  const answered = Object.keys(answers).length;

  return (
    <div className="feature-page take-test">
      <div className="take-header">
        <div>
          <h2>{session.test.title}</h2>
          <span className="muted-text">{answered}/{session.questions.length} жауап берілді</span>
        </div>
        <div className={`timer ${left < 60000 ? 'urgent' : ''}`}>
          <LuTimer /> {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
      </div>

      <div className="question-dots">
        {session.questions.map((item, i) => (
          <button
            key={item.id}
            className={`${i === index ? 'current' : ''} ${answers[item.id] !== undefined ? 'answered' : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`${i + 1}-сұрақ`}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="question-card" key={q.id}>
        <div className="question-num">{index + 1}-сұрақ · {q.points} балл</div>
        {q.multi && <p className="multi-hint">Бір немесе бірнеше дұрыс жауап (үшеуден артық емес)</p>}
        <p className="question-text"><MathText text={q.question} /></p>
        {q.image && <img className="question-image" src={q.image} alt="Есептің суреті" />}
        {q.match_rows ? (
          <div className="match-table">
            {q.match_rows.map((row, ri) => {
              const value = (answers[q.id] || [])[ri] ?? null;
              return (
                <div key={ri} className="match-row">
                  <div className="match-text">
                    <span className="option-letter">{String.fromCharCode(65 + ri)}</span>
                    <span><MathText text={row} /></span>
                  </div>
                  <MatchSelect options={q.options} value={value} onChange={(v) => chooseMatch(q, ri, v)} />
                </div>
              );
            })}
          </div>
        ) : (
        <div className="options">
          {q.options.map((option, i) => {
            const chosen = q.multi ? (answers[q.id] || []).includes(i) : answers[q.id] === i;
            return (
              <label key={i} className={`option ${chosen ? 'chosen' : ''}`}>
                <input
                  type={q.multi ? 'checkbox' : 'radio'}
                  name={`q${q.id}`}
                  checked={chosen}
                  onChange={() => choose(q, i)}
                />
                <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                <span><MathText text={option} /></span>
              </label>
            );
          })}
        </div>
        )}
      </div>

      <div className="take-nav">
        <button className="secondary-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}><LuArrowLeft /> Алдыңғы</button>
        {index < session.questions.length - 1 ? (
          <button className="secondary-btn" onClick={() => setIndex(index + 1)}>Келесі <LuArrowRight /></button>
        ) : (
          <span />
        )}
        <button className="primary-btn" disabled={submitting} onClick={() => submit(false)}>
          {submitting ? 'Тексерілуде...' : <><LuCheck /> Аяқтау</>}
        </button>
      </div>
    </div>
  );
}

function TestResult({ result, onBack, onMistakes }) {
  const percent = result.max_score ? Math.round((result.score / result.max_score) * 100) : 0;
  const wrong = result.questions.filter((q) => !q.is_correct).length;

  return (
    <div className="feature-page">
      <button className="link-back" onClick={onBack}><LuArrowLeft /> Тесттерге оралу</button>
      <div className={`result-hero ${scoreClass(result.score, result.max_score)}`}>
        <div className="result-circle" style={{ '--p': percent }}>
          <span>{percent}%</span>
        </div>
        <div>
          <h2>{result.title}</h2>
          <p><b>{result.score}</b> / {result.max_score} балл</p>
          <p className="muted-text">
            {percent >= 80 ? <><LuPartyPopper /> Керемет нәтиже!</> : percent >= 50 ? 'Жақсы! Қателерді талдап шық' : 'Қателерді қарап, қайта тапсырып көр'}
          </p>
        </div>
      </div>

      {wrong > 0 && (
        <div className={`mistake-banner ${result.mistakes_done_at ? 'done' : ''}`}>
          <div>
            <strong><LuTarget /> Қатемен жұмыс</strong>
            <p>
              {result.mistakes_done_at
                ? `Орындалды: ${result.mistakes_fixed}/${wrong} есеп түзетілді. Қайта жасауға болады.`
                : `${wrong} есептен қате кетті. Соларды қайта шығарып, талдауын қара.`}
            </p>
          </div>
          <button className="primary-btn" onClick={onMistakes}>
            {result.mistakes_done_at ? <><LuRotateCcw /> Қайта жасау</> : <><LuPlay /> Бастау</>}
          </button>
        </div>
      )}

      <div className="review-list">
        {result.questions.map((q, i) => (
          <div key={q.id} className={`review-item ${q.is_correct ? 'correct' : 'wrong'}`}>
            <div className="question-num">
              {i + 1}-сұрақ {q.is_correct ? <LuCheckCircle2 className="ok-icon" /> : q.chosen === null ? <><LuCircle /> Жауап жоқ</> : <LuXCircle className="bad-icon" />}
              {(q.correct_indexes || q.match_rows) && <span className="muted-text"> · {q.earned}/{q.points} балл</span>}
            </div>
            <ReviewBody q={q} chosen={q.chosen} solved={q.is_correct} />
          </div>
        ))}
      </div>
    </div>
  );
}

// Жауаптың толық дұрыстығы (қатемен жұмыста бет ішінде тексеріледі)
const isRight = (q, chosen) => {
  if (q.match_rows) return Array.isArray(chosen) && q.match_rows.every((row, i) => chosen[i] === row.correct_index);
  if (q.correct_indexes) {
    return Array.isArray(chosen) && chosen.length === q.correct_indexes.length && q.correct_indexes.every((i) => chosen.includes(i));
  }
  return chosen === q.correct_index;
};

// Қатемен жұмыс: тестте қате кеткен есептерді уақытсыз қайта шығару, әр жауап бірден тексеріледі
function MistakeWork({ result, onDone }) {
  const [questions] = useState(() => result.questions
    .map((q, i) => ({ ...q, number: i + 1 }))
    .filter((q) => !q.is_correct));
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [checked, setChecked] = useState({});
  const [finished, setFinished] = useState(null);
  const [saving, setSaving] = useState(false);

  const q = questions[index];
  const chosen = answers[q.id];
  const fixed = questions.filter((item) => checked[item.id] && isRight(item, answers[item.id])).length;
  const allChecked = questions.every((item) => checked[item.id]);

  const setAnswer = (value) => setAnswers({ ...answers, [q.id]: value });
  const toggle = (i) => {
    if (!q.correct_indexes) return setAnswer(i);
    const current = Array.isArray(chosen) ? chosen : [];
    const next = current.includes(i) ? current.filter((v) => v !== i) : [...current, i].sort((a, b) => a - b);
    if (next.length <= 3) setAnswer(next.length ? next : undefined);
    return undefined;
  };
  const setRow = (ri, value) => {
    const current = Array.isArray(chosen) ? chosen : [];
    const picked = q.match_rows.map((_, i) => (i === ri ? value : current[i] ?? null));
    setAnswer(picked.some((v) => v !== null) ? picked : undefined);
  };

  const finish = async () => {
    setSaving(true);
    try {
      const saved = await api.post(`/api/attempts/${result.attempt_id}/mistakes`, { fixed, total: questions.length });
      setFinished({ ...result, ...saved });
    } catch (error) {
      alert(errorText(error, 'Сақтау сәтсіз. Қайта басыңыз'));
    } finally {
      setSaving(false);
    }
  };

  if (finished) {
    return (
      <div className="feature-page">
        <div className={`result-hero ${scoreClass(fixed, questions.length)}`}>
          <div className="result-circle" style={{ '--p': Math.round((fixed / questions.length) * 100) }}>
            <span>{fixed}/{questions.length}</span>
          </div>
          <div>
            <h2>Қатемен жұмыс аяқталды</h2>
            <p>{fixed === questions.length ? 'Барлық қате түзетілді!' : `${questions.length - fixed} есеп әлі де қате. Талдауын қарап, қайта жасап көр.`}</p>
          </div>
        </div>
        <button className="primary-btn" onClick={() => onDone(finished)}><LuArrowLeft /> Нәтижеге оралу</button>
      </div>
    );
  }

  const isChecked = Boolean(checked[q.id]);
  const right = isChecked && isRight(q, chosen);

  return (
    <div className="feature-page take-test">
      <div className="take-header">
        <div>
          <h2>Қатемен жұмыс</h2>
          <span className="muted-text">{result.title} · {fixed}/{questions.length} түзетілді</span>
        </div>
        <button className="secondary-btn" onClick={() => onDone(result)}><LuArrowLeft /> Нәтижеге</button>
      </div>

      <div className="question-dots">
        {questions.map((item, i) => (
          <button
            key={item.id}
            className={`${i === index ? 'current' : ''} ${checked[item.id] ? (isRight(item, answers[item.id]) ? 'fixed' : 'still-wrong') : ''}`}
            onClick={() => setIndex(i)}
            aria-label={`${item.number}-сұрақ`}
          >
            {item.number}
          </button>
        ))}
      </div>

      <div className={`question-card ${isChecked ? (right ? 'review-item correct' : 'review-item wrong') : ''}`} key={q.id}>
        <div className="question-num">
          {q.number}-сұрақ {isChecked && (right ? <><LuCheckCircle2 className="ok-icon" /> Дұрыс!</> : <><LuXCircle className="bad-icon" /> Әлі қате</>)}
        </div>
        {isChecked ? (
          <ReviewBody q={q} chosen={chosen ?? null} solved={right} />
        ) : (
          <>
            {q.correct_indexes && <p className="multi-hint">Бір немесе бірнеше дұрыс жауап (үшеуден артық емес)</p>}
            <p className="question-text"><MathText text={q.question} /></p>
            {q.image && <img className="question-image" src={q.image} alt="Есептің суреті" />}
            {q.match_rows ? (
              <div className="match-table">
                {q.match_rows.map((row, ri) => (
                  <div key={ri} className="match-row">
                    <div className="match-text">
                      <span className="option-letter">{String.fromCharCode(65 + ri)}</span>
                      <span><MathText text={row.text} /></span>
                    </div>
                    <MatchSelect options={q.options} value={(chosen || [])[ri] ?? null} onChange={(v) => setRow(ri, v)} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="options">
                {q.options.map((option, i) => {
                  const picked = q.correct_indexes ? (chosen || []).includes(i) : chosen === i;
                  return (
                    <label key={i} className={`option ${picked ? 'chosen' : ''}`}>
                      <input type={q.correct_indexes ? 'checkbox' : 'radio'} name={`m${q.id}`} checked={picked} onChange={() => toggle(i)} />
                      <span className="option-letter">{String.fromCharCode(65 + i)}</span>
                      <span><MathText text={option} /></span>
                    </label>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="take-nav">
        <button className="secondary-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}><LuArrowLeft /> Алдыңғы</button>
        {!isChecked ? (
          <button className="primary-btn" disabled={chosen === undefined} onClick={() => setChecked({ ...checked, [q.id]: true })}>
            <LuCheck /> Тексеру
          </button>
        ) : !right ? (
          <button className="secondary-btn" onClick={() => { setChecked({ ...checked, [q.id]: false }); setAnswer(undefined); }}>
            <LuRotateCcw /> Қайта шығару
          </button>
        ) : <span />}
        {index < questions.length - 1 ? (
          <button className="secondary-btn" onClick={() => setIndex(index + 1)}>Келесі <LuArrowRight /></button>
        ) : (
          <button className="primary-btn" disabled={!allChecked || saving} onClick={finish} title={allChecked ? '' : 'Алдымен барлық есепті тексеріңіз'}>
            {saving ? '...' : <><LuCheck /> Аяқтау</>}
          </button>
        )}
      </div>
    </div>
  );
}

// Сұрақтың талдауы: шарты, дұрыс жауап, оқушының таңдағаны және шығарылу жолы
function ReviewBody({ q, chosen, solved }) {
  return (
    <>
    <p className="question-text"><MathText text={q.question} /></p>
    {q.image && <img className="question-image" src={q.image} alt="Есептің суреті" />}
    {q.match_rows ? (
      <div className="match-table">
        {q.match_rows.map((row, ri) => {
          const picked = Array.isArray(chosen) ? chosen[ri] ?? null : null;
          const ok = picked === row.correct_index;
          return (
            <div key={ri} className={`match-row static ${ok ? 'right' : 'wrong'}`}>
              <div className="match-text">
                <span className="option-letter">{String.fromCharCode(65 + ri)}</span>
                <span><MathText text={row.text} /></span>
              </div>
              <div className="match-answer">
                {!ok && (
                  <span className="match-picked">
                    {picked === null ? 'Жауап жоқ' : <MathText text={q.options[picked]} />}
                  </span>
                )}
                <span className="match-correct"><LuCheck /> <MathText text={q.options[row.correct_index]} /></span>
              </div>
            </div>
          );
        })}
      </div>
    ) : (
    <div className="options">
      {q.options.map((option, oi) => {
        const right = q.correct_indexes ? q.correct_indexes.includes(oi) : oi === q.correct_index;
        const picked = Array.isArray(chosen) ? chosen.includes(oi) : oi === chosen;
        return (
          <div key={oi} className={`option static ${right ? 'right' : ''} ${picked && !right ? 'chosen-wrong' : ''}`}>
            <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
            <span><MathText text={option} /></span>
            {picked && <span className="picked-mark">сіздің жауабыңыз</span>}
          </div>
        );
      })}
    </div>
    )}
    {q.solution_url && (
      <a className={`solution-link ${solved ? '' : 'needed'}`} href={q.solution_url} target="_blank" rel="noopener noreferrer">
        <LuPlay /> Шығарылу жолын көру (YouTube)
      </a>
    )}
    </>
  );
}

// Сәйкестендірудегі ашылмалы тізім: <select> формуланы көрсете алмайды, сондықтан өз тізіміміз
function MatchSelect({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className={`match-select ${open ? 'open' : ''}`} ref={boxRef}>
      <button type="button" className={value === null ? 'empty' : ''} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span>{value === null ? 'Жауапты таңдаңыз' : <MathText text={options[value]} />}</span>
        <LuChevronDown />
      </button>
      {open && (
        <ul role="listbox">
          {options.map((option, i) => (
            <li key={i} role="option" aria-selected={value === i}>
              <button type="button" className={value === i ? 'chosen' : ''} onClick={() => { onChange(value === i ? null : i); setOpen(false); }}>
                <MathText text={option} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
