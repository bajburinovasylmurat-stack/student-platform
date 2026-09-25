import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Curator.css';
import {
  toDateString, parseDate, getEndDate, defaultStartDate,
  formatDay, formatRange, groupByDate, PLAN_TYPE_LABELS
} from './planUtils';

const API = 'https://student-platform-backend-h9zs.onrender.com';

// Жоспар аралығындағы барлық күндер
const daysInRange = (start, end) => {
  const days = [];
  const last = parseDate(end);
  for (let d = parseDate(start); d <= last; d.setDate(d.getDate() + 1)) {
    days.push(toDateString(d));
  }
  return days;
};

export default function CuratorPanel() {
  const [students, setStudents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [plans, setPlans] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [available, setAvailable] = useState([]);
  const [search, setSearch] = useState('');
  const [showPlanForm, setShowPlanForm] = useState(false);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchStudents();
  }, []);

  useEffect(() => {
    if (selected) fetchPlans(selected.id);
  }, [selected]);

  useEffect(() => {
    if (!showAdd) return;
    const timer = setTimeout(() => fetchAvailable(search), 300);
    return () => clearTimeout(timer);
  }, [showAdd, search]);

  const fetchStudents = async () => {
    try {
      const response = await axios.get(`${API}/api/curator/students`, { headers });
      setStudents(response.data);
    } catch (error) {
      console.error('Оқушылар алу қатесі:', error);
    }
  };

  const fetchAvailable = async (q) => {
    try {
      const response = await axios.get(`${API}/api/curator/available-students`, {
        headers,
        params: { q }
      });
      setAvailable(response.data);
    } catch (error) {
      console.error('Бос оқушылар алу қатесі:', error);
    }
  };

  const fetchPlans = async (studentId) => {
    try {
      const response = await axios.get(`${API}/api/curator/students/${studentId}/plans`, { headers });
      setPlans(response.data);
    } catch (error) {
      console.error('Жоспарлар алу қатесі:', error);
    }
  };

  const addStudent = async (student) => {
    try {
      const response = await axios.post(`${API}/api/curator/students`, { student_id: student.id }, { headers });
      setStudents([...students, response.data].sort((a, b) => a.name.localeCompare(b.name)));
      setAvailable(available.filter(s => s.id !== student.id));
    } catch (error) {
      alert(error.response?.data?.error || 'Оқушы қосу сәтсіз');
    }
  };

  const removeStudent = async (student) => {
    if (!window.confirm(`${student.name} оқушысын тізімнен шығарасыз ба?`)) return;
    try {
      await axios.delete(`${API}/api/curator/students/${student.id}`, { headers });
      setStudents(students.filter(s => s.id !== student.id));
      if (selected?.id === student.id) {
        setSelected(null);
        setPlans([]);
      }
    } catch (error) {
      alert(error.response?.data?.error || 'Оқушыны шығару сәтсіз');
    }
  };

  const deletePlan = async (plan) => {
    if (!window.confirm(`«${plan.title}» жоспарын өшіресіз бе?`)) return;
    try {
      await axios.delete(`${API}/api/curator/plans/${plan.id}`, { headers });
      setPlans(plans.filter(p => p.id !== plan.id));
      updateCount(-1);
    } catch (error) {
      alert(error.response?.data?.error || 'Жоспар өшіру сәтсіз');
    }
  };

  const addTask = async (plan, task_date, task_title) => {
    try {
      const response = await axios.post(
        `${API}/api/curator/plans/${plan.id}/tasks`,
        { task_date, task_title },
        { headers }
      );
      setPlans(plans.map(p => p.id === plan.id ? { ...p, tasks: [...p.tasks, response.data] } : p));
      return true;
    } catch (error) {
      alert(error.response?.data?.error || 'Тапсырма қосу сәтсіз');
      return false;
    }
  };

  const deleteTask = async (plan, taskId) => {
    try {
      await axios.delete(`${API}/api/curator/plan-tasks/${taskId}`, { headers });
      setPlans(plans.map(p => p.id === plan.id ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) } : p));
    } catch (error) {
      alert(error.response?.data?.error || 'Тапсырма өшіру сәтсіз');
    }
  };

  const updateCount = (delta) => {
    setStudents(students.map(s => s.id === selected.id ? { ...s, plans_count: s.plans_count + delta } : s));
  };

  const handlePlanCreated = (plan) => {
    setPlans([plan, ...plans]);
    updateCount(1);
    setShowPlanForm(false);
  };

  return (
    <div className="curator-panel">
      <h2>🧑‍🏫 Куратор панелі</h2>

      <div className="curator-layout">
        <aside className="curator-sidebar">
          <div className="sidebar-header">
            <h3>Менің оқушыларым ({students.length})</h3>
            <button className="small-btn primary" onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? '✕' : '+ Қосу'}
            </button>
          </div>

          {showAdd && (
            <div className="add-student-box">
              <input
                type="text"
                className="search-input"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="🔍 Аты немесе нөмірі"
                autoFocus
              />
              <div className="available-list">
                {available.length === 0 && <p className="empty-text">Кураторы жоқ оқушы табылмады</p>}
                {available.map(s => (
                  <div key={s.id} className="available-item">
                    <span>{s.name} <span className="muted">№ {s.student_number}</span></span>
                    <button className="small-btn" onClick={() => addStudent(s)}>+</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="student-list">
            {students.length === 0 && !showAdd && (
              <p className="empty-text">Әзірге оқушы жоқ. «+ Қосу» батырмасын басыңыз.</p>
            )}
            {students.map(s => (
              <div
                key={s.id}
                className={`student-item ${selected?.id === s.id ? 'active' : ''}`}
                onClick={() => { setSelected(s); setShowPlanForm(false); }}
              >
                <div>
                  <strong>{s.name}</strong>
                  <span className="muted">№ {s.student_number} · {s.plans_count} жоспар</span>
                </div>
                <button
                  className="icon-btn"
                  title="Тізімнен шығару"
                  onClick={(e) => { e.stopPropagation(); removeStudent(s); }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>

        <section className="curator-main">
          {!selected ? (
            <p className="empty-text center">← Жоспарын көру үшін оқушыны таңдаңыз</p>
          ) : (
            <>
              <div className="main-header">
                <h3>{selected.name} — жоспарлары</h3>
                {!showPlanForm && (
                  <button className="small-btn primary" onClick={() => setShowPlanForm(true)}>
                    + Жаңа жоспар
                  </button>
                )}
              </div>

              {showPlanForm && (
                <PlanForm
                  studentId={selected.id}
                  headers={headers}
                  onCreated={handlePlanCreated}
                  onCancel={() => setShowPlanForm(false)}
                />
              )}

              {plans.length === 0 && !showPlanForm && (
                <p className="empty-text">Бұл оқушыға әлі жоспар құрылмаған</p>
              )}

              {plans.map(plan => (
                <PlanCard
                  key={plan.id}
                  plan={plan}
                  onDelete={() => deletePlan(plan)}
                  onAddTask={(date, title) => addTask(plan, date, title)}
                  onDeleteTask={(taskId) => deleteTask(plan, taskId)}
                />
              ))}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function PlanForm({ studentId, headers, onCreated, onCancel }) {
  const [planType, setPlanType] = useState('weekly');
  const [startDate, setStartDate] = useState(defaultStartDate('weekly'));
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tasks, setTasks] = useState([]);
  const [taskDate, setTaskDate] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [saving, setSaving] = useState(false);

  const endDate = getEndDate(startDate, planType);
  const days = daysInRange(startDate, endDate);
  const selectedDay = days.includes(taskDate) ? taskDate : days[0];

  const changeType = (type) => {
    setPlanType(type);
    setStartDate(defaultStartDate(type));
    setTasks([]);
  };

  const changeStart = (value) => {
    if (!value) return;
    setStartDate(value);
    // Аралықтан тыс қалған тапсырмаларды алып тастау
    const end = getEndDate(value, planType);
    setTasks(tasks.filter(t => t.task_date >= value && t.task_date <= end));
  };

  const addDraftTask = () => {
    if (!taskTitle.trim()) return;
    setTasks([...tasks, { task_date: selectedDay, task_title: taskTitle.trim() }]
      .sort((a, b) => a.task_date.localeCompare(b.task_date)));
    setTaskTitle('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const response = await axios.post(`${API}/api/curator/plans`, {
        student_id: studentId,
        plan_type: planType,
        start_date: startDate,
        title: title.trim(),
        description,
        tasks
      }, { headers });
      onCreated(response.data);
    } catch (error) {
      alert(error.response?.data?.error || 'Жоспар құру сәтсіз');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="plan-form" onSubmit={handleSubmit}>
      <div className="plan-type-toggle">
        <button type="button" className={planType === 'weekly' ? 'active' : ''} onClick={() => changeType('weekly')}>
          {PLAN_TYPE_LABELS.weekly}
        </button>
        <button type="button" className={planType === 'monthly' ? 'active' : ''} onClick={() => changeType('monthly')}>
          {PLAN_TYPE_LABELS.monthly}
        </button>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Басталу күні:</label>
          <input type="date" value={startDate} onChange={(e) => changeStart(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Аралық:</label>
          <div className="range-text">{formatRange(startDate, endDate)}</div>
        </div>
      </div>

      <div className="form-group">
        <label>Жоспар атауы:</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={planType === 'weekly' ? 'мысалы: 1-апта: Тригонометрия' : 'мысалы: Қазан айының жоспары'}
          required
        />
      </div>

      <div className="form-group">
        <label>Мақсат / түсініктеме (міндетті емес):</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Осы кезеңнің мақсаты" />
      </div>

      <div className="form-group">
        <label>Тапсырмалар:</label>
        <div className="task-adder">
          <select value={selectedDay} onChange={(e) => setTaskDate(e.target.value)}>
            {days.map(d => <option key={d} value={d}>{formatDay(d)}</option>)}
          </select>
          <input
            type="text"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraftTask(); } }}
            placeholder="мысалы: 20 есеп шығару"
          />
          <button type="button" className="small-btn" onClick={addDraftTask}>+</button>
        </div>

        {tasks.length > 0 && (
          <ul className="draft-tasks">
            {tasks.map((t, i) => (
              <li key={i}>
                <span className="task-date-chip">{formatDay(t.task_date)}</span>
                <span className="grow">{t.task_title}</span>
                <button type="button" className="icon-btn" onClick={() => setTasks(tasks.filter((_, j) => j !== i))}>✕</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="form-actions">
        <button type="button" className="small-btn" onClick={onCancel}>Болдырмау</button>
        <button type="submit" className="small-btn primary" disabled={saving}>
          {saving ? 'Сақталуда...' : `✓ Жоспарды сақтау (${tasks.length} тапсырма)`}
        </button>
      </div>
    </form>
  );
}

function PlanCard({ plan, onDelete, onAddTask, onDeleteTask }) {
  const [open, setOpen] = useState(false);
  const [taskDate, setTaskDate] = useState(plan.start_date);
  const [taskTitle, setTaskTitle] = useState('');

  const done = plan.tasks.filter(t => t.is_completed).length;
  const total = plan.tasks.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const grouped = groupByDate(plan.tasks);

  const submitTask = async () => {
    if (!taskTitle.trim()) return;
    if (await onAddTask(taskDate, taskTitle.trim())) setTaskTitle('');
  };

  return (
    <div className="plan-card">
      <div className="plan-card-header" onClick={() => setOpen(!open)}>
        <div>
          <span className={`type-badge type-${plan.plan_type}`}>{PLAN_TYPE_LABELS[plan.plan_type]}</span>
          <strong>{plan.title}</strong>
          <span className="muted">{formatRange(plan.start_date, plan.end_date)}</span>
        </div>
        <div className="plan-progress">
          <span>{done}/{total}</span>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
          <span className="chevron">{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div className="plan-card-body">
          {plan.description && <p className="plan-description">{plan.description}</p>}

          {Object.keys(grouped).map(date => (
            <div key={date} className="day-group">
              <div className="day-title">{formatDay(date)}</div>
              {grouped[date].map(t => (
                <div key={t.id} className={`plan-task ${t.is_completed ? 'done' : ''}`}>
                  <span>{t.is_completed ? '✅' : '⬜'}</span>
                  <span className="grow">{t.task_title}</span>
                  <button className="icon-btn" onClick={() => onDeleteTask(t.id)}>✕</button>
                </div>
              ))}
            </div>
          ))}

          <div className="task-adder">
            <select value={taskDate} onChange={(e) => setTaskDate(e.target.value)}>
              {daysInRange(plan.start_date, plan.end_date).map(d => (
                <option key={d} value={d}>{formatDay(d)}</option>
              ))}
            </select>
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') submitTask(); }}
              placeholder="Жаңа тапсырма"
            />
            <button className="small-btn" onClick={submitTask}>+</button>
          </div>

          <button className="small-btn danger" onClick={onDelete}>🗑 Жоспарды өшіру</button>
        </div>
      )}
    </div>
  );
}
