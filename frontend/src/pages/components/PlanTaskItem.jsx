import React, { useState } from 'react';
import '../styles/PlanTaskItem.css';

// Жоспардың бір тапсырмасы: белгілеу, өзгерту, өшіру (Жоспар және Бүгінгі тапсырмалар беттерінде)
export default function PlanTaskItem({ task, onToggle, onSave, onDelete, showStatus }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.task_title);
  const [time, setTime] = useState(task.task_time || '');
  const [date, setDate] = useState(task.plan_date);
  const [saving, setSaving] = useState(false);

  const startEdit = () => {
    setTitle(task.task_title);
    setTime(task.task_time || '');
    setDate(task.plan_date);
    setEditing(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const ok = await onSave(task, { task_title: title.trim(), task_time: time || null, plan_date: date });
    setSaving(false);
    if (ok) setEditing(false);
  };

  if (editing) {
    return (
      <form className="task-item plan-edit" onSubmit={handleSave}>
        <input
          type="text"
          className="edit-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          autoFocus
          required
        />
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        <div className="edit-actions">
          <button type="button" className="edit-cancel" onClick={() => setEditing(false)}>Болдырмау</button>
          <button type="submit" className="edit-save" disabled={saving}>
            {saving ? '...' : '✓ Сақтау'}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className={`task-item ${task.is_completed ? 'completed' : ''}`}>
      <input
        type="checkbox"
        checked={task.is_completed}
        onChange={() => onToggle(task)}
        className="task-checkbox"
      />
      <div className="task-content">
        {task.task_time && <span className="task-time">🕐 {task.task_time}</span>}
        <span className="task-title">{task.task_title}</span>
      </div>
      {showStatus && (
        <span className={`task-status ${task.is_completed ? 'done' : 'pending'}`}>
          {task.is_completed ? '✓ Орындалды' : '⏳ Орындалу керек'}
        </span>
      )}
      <div className="task-tools">
        <button type="button" onClick={startEdit} title="Өзгерту" aria-label="Өзгерту">✏️</button>
        <button type="button" onClick={() => onDelete(task)} title="Өшіру" aria-label="Өшіру">🗑</button>
      </div>
    </div>
  );
}
