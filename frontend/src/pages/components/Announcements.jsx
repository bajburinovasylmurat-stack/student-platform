import React, { useState, useEffect } from 'react';
import '../styles/Features.css';
import { api, errorText, currentUserId } from '../../api';
import { formatKkDate } from '../../utils/kkDate';
import { LuMegaphone, LuTrash2, LuX } from 'react-icons/lu';

// Басты беттегі хабарландырулар: жабылғандары осы құрылғыда есте сақталады
export function AnnouncementsBar() {
  const [items, setItems] = useState([]);
  const storageKey = `announcements-dismissed-${currentUserId()}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey)) || []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    api.get('/api/announcements').then(setItems).catch(() => {});
  }, []);

  const dismiss = (id) => {
    const next = new Set(dismissed).add(id);
    setDismissed(next);
    try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* жеке терезе */ }
  };

  const visible = items.filter((a) => !dismissed.has(a.id)).slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="announcements">
      {visible.map((a) => (
        <div key={a.id} className="announcement">
          <LuMegaphone className="announcement-icon" />
          <div className="grow">
            <strong>{a.title}</strong>
            {a.body && <p>{a.body}</p>}
            <span className="muted-text small">{formatKkDate(new Date(a.created_at))}</span>
          </div>
          <button className="icon-close" onClick={() => dismiss(a.id)} aria-label="Жабу"><LuX /></button>
        </div>
      ))}
    </div>
  );
}

// Админ: хабарландыру жариялау
export default function AdminAnnouncements() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [telegram, setTelegram] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => api.get('/api/announcements').then(setItems).catch(() => {});
  useEffect(() => { load(); }, []);

  const publish = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await api.post('/api/announcements', { title, body, notify_telegram: telegram });
      alert(telegram
        ? `Жарияланды! Telegram-ға ${result.telegram_recipients} адамға жіберілуде.`
        : 'Жарияланды!');
      setTitle('');
      setBody('');
      load();
    } catch (error) {
      alert(errorText(error, 'Жариялау сәтсіз'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`«${a.title}» хабарландыруын өшіресіз бе?`)) return;
    try {
      await api.delete(`/api/announcements/${a.id}`);
      load();
    } catch (error) {
      alert(errorText(error, 'Өшіру сәтсіз'));
    }
  };

  return (
    <div className="admin-section">
      <h3><LuMegaphone /> Хабарландырулар</h3>
      <form className="card-form" onSubmit={publish}>
        <label className="field-label">
          Тақырып
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="мысалы: Ертең сынақ ҰБТ" required />
        </label>
        <label className="field-label">
          Мәтін (міндетті емес)
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Сағат 10:00-де, онлайн" />
        </label>
        <label className="toggle-label">
          <input type="checkbox" checked={telegram} onChange={(e) => setTelegram(e.target.checked)} />
          Telegram-ға да жіберу (ескертуді қосқан барлық оқушы мен кураторға)
        </label>
        <div className="editor-actions">
          <button className="primary-btn" disabled={saving}>{saving ? '...' : <><LuMegaphone /> Жариялау</>}</button>
        </div>
      </form>

      <div className="admin-list">
        {items.length === 0 && <p className="empty-state">Әзірге хабарландыру жоқ</p>}
        {items.map((a) => (
          <div key={a.id} className="admin-row">
            <div className="grow">
              <strong>{a.title}</strong>
              {a.body && <span className="muted-text pre">{a.body}</span>}
              <span className="muted-text small">{formatKkDate(new Date(a.created_at), { year: true })}</span>
            </div>
            <button className="danger-btn" onClick={() => remove(a)} title="Өшіру" aria-label="Өшіру"><LuTrash2 /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
