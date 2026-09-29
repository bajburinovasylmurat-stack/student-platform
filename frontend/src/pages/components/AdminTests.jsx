import React, { useState, useEffect } from 'react';
import '../styles/Features.css';
import { api, errorText } from '../../api';
import { LuArrowDown, LuArrowLeft, LuArrowUp, LuFileQuestion, LuPencil, LuPlus, LuRocket, LuSave, LuTrash2, LuX } from 'react-icons/lu';

const emptyQuestion = () => ({ question: '', options: ['', '', '', ''], correct_index: 0, points: 1 });

// Админ: тесттер тізімі және редактор
export default function AdminTests() {
  const [tests, setTests] = useState(null);
  const [editing, setEditing] = useState(null); // null | тест объектісі

  const load = () => api.get('/api/admin/tests').then(setTests).catch(() => setTests([]));
  useEffect(() => { load(); }, []);

  const openEditor = async (test) => {
    if (!test) {
      setEditing({ title: '', description: '', duration_min: 60, is_published: false, questions: [emptyQuestion()] });
      return;
    }
    try {
      setEditing(await api.get(`/api/admin/tests/${test.id}`));
    } catch (error) {
      alert(errorText(error, 'Тестті ашу сәтсіз'));
    }
  };

  const remove = async (test) => {
    if (!window.confirm(`«${test.title}» тестін өшіресіз бе? Оқушылардың нәтижелері де өшеді.`)) return;
    try {
      await api.delete(`/api/admin/tests/${test.id}`);
      load();
    } catch (error) {
      alert(errorText(error, 'Өшіру сәтсіз'));
    }
  };

  if (editing) {
    return <TestEditor initial={editing} onClose={() => { setEditing(null); load(); }} />;
  }

  return (
    <div className="admin-section">
      <div className="section-head">
        <h3><LuFileQuestion /> Онлайн тесттер</h3>
        <button className="primary-btn" onClick={() => openEditor(null)}><LuPlus /> Жаңа тест</button>
      </div>

      {!tests ? <p className="empty-state">Жүктелуде...</p> : tests.length === 0 ? (
        <p className="empty-state">Әзірге тест жоқ. «+ Жаңа тест» батырмасын басыңыз.</p>
      ) : (
        <div className="admin-list">
          {tests.map((t) => (
            <div key={t.id} className="admin-row">
              <div className="grow">
                <strong>{t.title}</strong>
                <span className="muted-text">{t.questions} сұрақ · {t.duration_min} мин · {t.attempts} рет тапсырылды</span>
              </div>
              <span className={`status-pill ${t.is_published ? 'on' : 'off'}`}>
                {t.is_published ? 'Жарияланған' : 'Жоба'}
              </span>
              <button className="secondary-btn" onClick={() => openEditor(t)}><LuPencil /> Өзгерту</button>
              <button className="danger-btn" onClick={() => remove(t)} title="Өшіру" aria-label="Өшіру"><LuTrash2 /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TestEditor({ initial, onClose }) {
  const [test, setTest] = useState(initial);
  const [saving, setSaving] = useState(false);

  const setField = (field, value) => setTest({ ...test, [field]: value });
  const setQuestion = (i, changes) =>
    setTest({ ...test, questions: test.questions.map((q, qi) => (qi === i ? { ...q, ...changes } : q)) });
  const setOption = (qi, oi, value) =>
    setQuestion(qi, { options: test.questions[qi].options.map((o, i) => (i === oi ? value : o)) });

  const addOption = (qi) => setQuestion(qi, { options: [...test.questions[qi].options, ''] });
  const removeOption = (qi, oi) => {
    const q = test.questions[qi];
    const options = q.options.filter((_, i) => i !== oi);
    const correct = q.correct_index === oi ? 0 : q.correct_index > oi ? q.correct_index - 1 : q.correct_index;
    setQuestion(qi, { options, correct_index: correct });
  };
  const moveQuestion = (i, delta) => {
    const qs = [...test.questions];
    [qs[i], qs[i + delta]] = [qs[i + delta], qs[i]];
    setTest({ ...test, questions: qs });
  };

  const incomplete = test.questions.filter((q) => !q.question.trim() || q.options.some((o) => !o.trim())).length;

  const save = async (publish) => {
    if (!test.title.trim()) {
      alert('Тест атауын жазыңыз');
      return;
    }
    if (incomplete && !window.confirm(`${incomplete} сұрақ толық толтырылмаған, олар сақталмайды. Жалғастырасыз ба?`)) return;

    setSaving(true);
    try {
      const body = { ...test, is_published: publish };
      if (test.id) await api.put(`/api/admin/tests/${test.id}`, body);
      else await api.post('/api/admin/tests', body);
      onClose();
    } catch (error) {
      alert(errorText(error, 'Сақтау сәтсіз'));
      setSaving(false);
    }
  };

  return (
    <div className="admin-section test-editor">
      <button className="link-back" onClick={() => window.confirm('Сақталмаған өзгерістер жоғалады. Шығасыз ба?') && onClose()}>
        <LuArrowLeft /> Тесттер тізімі
      </button>

      <div className="editor-grid">
        <label className="field-label grow">
          Тест атауы
          <input value={test.title} onChange={(e) => setField('title', e.target.value)} placeholder="мысалы: ҰБТ математика №5" />
        </label>
        <label className="field-label">
          Уақыты (минут)
          <input type="number" min="1" max="300" value={test.duration_min} onChange={(e) => setField('duration_min', e.target.value)} />
        </label>
      </div>
      <label className="field-label">
        Сипаттама (міндетті емес)
        <textarea value={test.description || ''} onChange={(e) => setField('description', e.target.value)} rows={2} />
      </label>

      <h4 className="questions-title">Сұрақтар ({test.questions.length})</h4>
      {test.questions.map((q, qi) => (
        <div key={qi} className="question-editor">
          <div className="qe-head">
            <b>{qi + 1}-сұрақ</b>
            <label className="points-input">
              Балл
              <input type="number" min="1" max="10" value={q.points} onChange={(e) => setQuestion(qi, { points: e.target.value })} />
            </label>
            <div className="qe-tools">
              <button disabled={qi === 0} onClick={() => moveQuestion(qi, -1)} title="Жоғары" aria-label="Жоғары"><LuArrowUp /></button>
              <button disabled={qi === test.questions.length - 1} onClick={() => moveQuestion(qi, 1)} title="Төмен" aria-label="Төмен"><LuArrowDown /></button>
              <button
                onClick={() => setTest({ ...test, questions: test.questions.filter((_, i) => i !== qi) })}
                title="Сұрақты өшіру"
                aria-label="Сұрақты өшіру"
              ><LuTrash2 /></button>
            </div>
          </div>
          <textarea
            value={q.question}
            onChange={(e) => setQuestion(qi, { question: e.target.value })}
            placeholder="Сұрақтың мәтіні"
            rows={2}
          />
          <p className="hint-text">Дұрыс жауаптың алдындағы шеңберді белгілеңіз</p>
          {q.options.map((option, oi) => (
            <div key={oi} className={`option-editor ${q.correct_index === oi ? 'correct' : ''}`}>
              <input
                type="radio"
                name={`correct-${qi}`}
                checked={q.correct_index === oi}
                onChange={() => setQuestion(qi, { correct_index: oi })}
                aria-label="Дұрыс жауап"
              />
              <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
              <input value={option} onChange={(e) => setOption(qi, oi, e.target.value)} placeholder={`${String.fromCharCode(65 + oi)} нұсқасы`} />
              {q.options.length > 2 && <button onClick={() => removeOption(qi, oi)} title="Нұсқаны өшіру" aria-label="Нұсқаны өшіру"><LuX /></button>}
            </div>
          ))}
          {q.options.length < 6 && <button className="link-back small" onClick={() => addOption(qi)}><LuPlus /> Нұсқа қосу</button>}
        </div>
      ))}
      <button className="secondary-btn wide" onClick={() => setTest({ ...test, questions: [...test.questions, emptyQuestion()] })}>
        <LuPlus /> Сұрақ қосу
      </button>

      <div className="editor-actions">
        <button className="secondary-btn" disabled={saving} onClick={() => save(false)}><LuSave /> Жоба ретінде сақтау</button>
        <button className="primary-btn" disabled={saving} onClick={() => save(true)}>
          {saving ? 'Сақталуда...' : <><LuRocket /> Сақтап, жариялау</>}
        </button>
      </div>
    </div>
  );
}
