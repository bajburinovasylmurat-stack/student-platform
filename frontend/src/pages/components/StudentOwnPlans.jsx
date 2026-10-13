import React, { useState, useEffect } from 'react';
import '../styles/Curator.css';
import { toDateString, formatDay } from './planUtils';
import { LuCheckCircle2, LuCircle } from 'react-icons/lu';
import { api, errorText } from '../../api';

// Оқушының күнтізбеде өзі құрған жоспары (тек көру үшін): соңғы 30 күн және алдағы күндер
export default function StudentOwnPlans({ studentId }) {
  const [plans, setPlans] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPlans(null);
    setError('');
    api.get(`/api/curator/students/${studentId}/own-plans`)
      .then((data) => { if (!cancelled) setPlans(data); })
      .catch((err) => { if (!cancelled) setError(errorText(err, 'Жоспарды жүктеу сәтсіз')); });
    return () => { cancelled = true; };
  }, [studentId]);

  if (error) return <p className="empty-text">{error}</p>;
  if (plans === null) return <p className="empty-text">Жүктелуде...</p>;
  if (plans.length === 0) {
    return <p className="empty-text">Оқушы соңғы 30 күнде өзіне жоспар құрмаған</p>;
  }

  const today = toDateString(new Date());
  const done = plans.filter((p) => p.is_completed).length;
  const percent = Math.round((done / plans.length) * 100);
  const byDate = plans.reduce((acc, p) => {
    (acc[p.plan_date] = acc[p.plan_date] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="plan-card">
      <div className="plan-card-header static">
        <div>
          <strong>Оқушының өз жоспары</strong>
          <span className="muted">Соңғы 30 күн және алдағы күндер</span>
        </div>
        <div className="plan-progress">
          <span>{done}/{plans.length}</span>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
        </div>
      </div>
      <div className="plan-card-body">
        {Object.keys(byDate).map((date) => (
          <div key={date} className="day-group">
            <div className={`day-title ${date === today ? 'today' : ''}`}>
              {formatDay(date)}{date === today && ' · бүгін'}
            </div>
            {byDate[date].map((p) => (
              <div key={p.id} className={`plan-task ${p.is_completed ? 'done' : ''}`}>
                {p.is_completed ? <LuCheckCircle2 className="task-done-icon" /> : <LuCircle className="task-open-icon" />}
                <span className="grow">{p.task_title}</span>
                {p.task_time && <span className="muted">{p.task_time}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
