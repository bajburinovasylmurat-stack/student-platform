import React, { useState, useEffect, useRef, useCallback } from 'react';
import '../styles/Features.css';
import { api, errorText } from '../../api';
import { formatKkDate } from '../../utils/kkDate';
import { LuArrowLeft, LuArrowRight, LuCheck, LuCheckCircle2, LuCircle, LuFileQuestion, LuHelpCircle, LuPartyPopper, LuPlay, LuRotateCcw, LuTarget, LuTimer, LuTrendingUp, LuXCircle } from 'react-icons/lu';

// Оқушыға арналған онлайн тесттер: тізім, тапсыру, нәтиже
export default function Tests() {
  const [view, setView] = useState({ name: 'list' });

  if (view.name === 'take') {
    return <TakeTest session={view.session} onFinish={(result) => setView({ name: 'result', result })} />;
  }
  if (view.name === 'result') {
    return <TestResult result={view.result} onBack={() => setView({ name: 'list' })} />;
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

  return (
    <div className="feature-page">
      <h2><LuFileQuestion /> Онлайн тесттер</h2>

      {tests.length === 0 ? (
        <p className="empty-state">Әзірге жарияланған тест жоқ</p>
      ) : (
        <div className="test-grid">
          {tests.map((test) => (
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
  const choose = (questionId, optionIndex) => {
    const next = { ...answersRef.current, [questionId]: optionIndex };
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
        <p className="question-text">{q.question}</p>
        <div className="options">
          {q.options.map((option, i) => (
            <label key={i} className={`option ${answers[q.id] === i ? 'chosen' : ''}`}>
              <input
                type="radio"
                name={`q${q.id}`}
                checked={answers[q.id] === i}
                onChange={() => choose(q.id, i)}
              />
              <span className="option-letter">{String.fromCharCode(65 + i)}</span>
              <span>{option}</span>
            </label>
          ))}
        </div>
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

function TestResult({ result, onBack }) {
  const percent = result.max_score ? Math.round((result.score / result.max_score) * 100) : 0;

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

      <div className="review-list">
        {result.questions.map((q, i) => (
          <div key={q.id} className={`review-item ${q.is_correct ? 'correct' : 'wrong'}`}>
            <div className="question-num">
              {i + 1}-сұрақ {q.is_correct ? <LuCheckCircle2 className="ok-icon" /> : q.chosen === null ? <><LuCircle /> Жауап жоқ</> : <LuXCircle className="bad-icon" />}
            </div>
            <p className="question-text">{q.question}</p>
            <div className="options">
              {q.options.map((option, oi) => (
                <div
                  key={oi}
                  className={`option static ${oi === q.correct_index ? 'right' : ''} ${oi === q.chosen && !q.is_correct ? 'chosen-wrong' : ''}`}
                >
                  <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
                  <span>{option}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
