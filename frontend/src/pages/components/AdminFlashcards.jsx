import React, { useState, useEffect } from 'react';
import '../styles/Features.css';
import { api, errorText } from '../../api';
import { LuArrowRight, LuBrain, LuCheck, LuPencil, LuPlus, LuTrash2 } from 'react-icons/lu';

const EMPTY = { id: null, topic: '', front: '', back: '' };

// Админ: формула карточкаларын қосу, өзгерту, өшіру
export default function AdminFlashcards() {
  const [cards, setCards] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/api/flashcards').then(setCards).catch(() => {});
  useEffect(() => { load(); }, []);

  const topics = [...new Set(cards.map((c) => c.topic).filter(Boolean))];

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (form.id) await api.put(`/api/flashcards/${form.id}`, form);
      else await api.post('/api/flashcards', form);
      // Келесі карточканы сол тақырыпқа тез қосу үшін тақырып қалады
      setForm({ ...EMPTY, topic: form.topic });
      load();
    } catch (error) {
      alert(errorText(error, 'Сақтау сәтсіз'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (card) => {
    if (!window.confirm('Карточканы өшіресіз бе?')) return;
    try {
      await api.delete(`/api/flashcards/${card.id}`);
      load();
    } catch (error) {
      alert(errorText(error, 'Өшіру сәтсіз'));
    }
  };

  return (
    <div className="admin-section">
      <h3><LuBrain /> Формула карточкалары</h3>

      <form className="card-form" onSubmit={save}>
        <label className="field-label">
          Тақырып
          <input
            list="card-topics"
            value={form.topic}
            onChange={(e) => setForm({ ...form, topic: e.target.value })}
            placeholder="мысалы: Тригонометрия"
          />
          <datalist id="card-topics">{topics.map((t) => <option key={t} value={t} />)}</datalist>
        </label>
        <div className="editor-grid">
          <label className="field-label grow">
            Алдыңғы беті (сұрақ)
            <textarea value={form.front} onChange={(e) => setForm({ ...form, front: e.target.value })} rows={2} placeholder="sin²α + cos²α" required />
          </label>
          <label className="field-label grow">
            Артқы беті (жауап)
            <textarea value={form.back} onChange={(e) => setForm({ ...form, back: e.target.value })} rows={2} placeholder="= 1" required />
          </label>
        </div>
        <div className="editor-actions">
          {form.id && <button type="button" className="secondary-btn" onClick={() => setForm(EMPTY)}>Болдырмау</button>}
          <button className="primary-btn" disabled={saving}>{form.id ? <><LuCheck /> Сақтау</> : <><LuPlus /> Карточка қосу</>}</button>
        </div>
      </form>

      <div className="admin-list">
        {cards.length === 0 && <p className="empty-state">Әзірге карточка жоқ</p>}
        {cards.map((c) => (
          <div key={c.id} className="admin-row">
            <div className="grow">
              {c.topic && <span className="card-topic inline">{c.topic}</span>}
              <strong className="pre">{c.front}</strong>
              <span className="muted-text pre"><LuArrowRight /> {c.back}</span>
            </div>
            <button className="secondary-btn" onClick={() => setForm({ ...c, topic: c.topic || '' })} title="Өзгерту" aria-label="Өзгерту"><LuPencil /></button>
            <button className="danger-btn" onClick={() => remove(c)} title="Өшіру" aria-label="Өшіру"><LuTrash2 /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
