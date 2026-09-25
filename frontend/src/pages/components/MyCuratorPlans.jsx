import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Curator.css';
import { toDateString, formatDay, formatRange, groupByDate, PLAN_TYPE_LABELS } from './planUtils';

const API = 'https://student-platform-backend-h9zs.onrender.com';

export default function MyCuratorPlans() {
  const [plans, setPlans] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };
  const today = toDateString(new Date());

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get(`${API}/api/my-curator-plans`, { headers });
      setPlans(response.data);
    } catch (error) {
      console.error('Куратор жоспарлары алу қатесі:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = async (planId, task) => {
    // Бірден көрсету, қате болса қайтару
    const setDone = (value) => setPlans(prev => prev.map(p => p.id !== planId ? p : {
      ...p,
      tasks: p.tasks.map(t => t.id === task.id ? { ...t, is_completed: value } : t)
    }));

    setDone(!task.is_completed);
    try {
      await axios.patch(`${API}/api/curator-plan-tasks/${task.id}`, { is_completed: !task.is_completed }, { headers });
    } catch (error) {
      console.error('Тапсырма белгілеу қатесі:', error);
      setDone(task.is_completed);
    }
  };

  if (loading) return <div className="loading">Жүктелуде...</div>;

  const visible = plans.filter(p => filter === 'all' || p.plan_type === filter);

  return (
    <div className="curator-panel">
      <h2>🎯 Куратор жоспары</h2>

      <div className="role-filter">
        <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Барлығы</button>
        <button className={filter === 'weekly' ? 'active' : ''} onClick={() => setFilter('weekly')}>{PLAN_TYPE_LABELS.weekly}</button>
        <button className={filter === 'monthly' ? 'active' : ''} onClick={() => setFilter('monthly')}>{PLAN_TYPE_LABELS.monthly}</button>
      </div>

      {visible.length === 0 && (
        <p className="empty-text">Куратор әлі жоспар құрмаған</p>
      )}

      {visible.map(plan => {
        const done = plan.tasks.filter(t => t.is_completed).length;
        const total = plan.tasks.length;
        const percent = total ? Math.round((done / total) * 100) : 0;
        const isCurrent = plan.start_date <= today && today <= plan.end_date;
        const grouped = groupByDate(plan.tasks);

        return (
          <div key={plan.id} className={`plan-card ${isCurrent ? 'current' : ''}`}>
            <div className="plan-card-header static">
              <div>
                <span className={`type-badge type-${plan.plan_type}`}>{PLAN_TYPE_LABELS[plan.plan_type]}</span>
                {isCurrent && <span className="type-badge now">Қазіргі</span>}
                <strong>{plan.title}</strong>
                <span className="muted">
                  {formatRange(plan.start_date, plan.end_date)} · Куратор: {plan.curator_name}
                </span>
              </div>
              <div className="plan-progress">
                <span>{percent}%</span>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
              </div>
            </div>

            <div className="plan-card-body">
              {plan.description && <p className="plan-description">{plan.description}</p>}
              {total === 0 && <p className="empty-text">Тапсырмалар әлі қосылмаған</p>}

              {Object.keys(grouped).map(date => (
                <div key={date} className="day-group">
                  <div className={`day-title ${date === today ? 'today' : ''}`}>
                    {formatDay(date)}{date === today && ' · Бүгін'}
                  </div>
                  {grouped[date].map(t => (
                    <label key={t.id} className={`plan-task clickable ${t.is_completed ? 'done' : ''}`}>
                      <input
                        type="checkbox"
                        checked={t.is_completed}
                        onChange={() => toggleTask(plan.id, t)}
                      />
                      <span className="grow">{t.task_title}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
