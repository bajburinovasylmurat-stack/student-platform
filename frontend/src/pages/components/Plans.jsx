import React, { useState, useEffect, useCallback } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../styles/Plans.css';
import { formatKkDate, calendarFormatters } from '../../utils/kkDate';
import { toDateString } from './planUtils';
import PlanTaskItem from './PlanTaskItem';
import {
  fetchPlansForDate, fetchPlansForMonth, createPlan, updatePlan, deletePlan, sortPlans
} from './planApi';

export default function Plans() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMonth, setViewMonth] = useState(new Date());
  const [plans, setPlans] = useState([]);
  const [plannedDays, setPlannedDays] = useState(new Set());
  const [newTask, setNewTask] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  // toISOString() UTC-ке ауыстырады: Қазақстанда 26-сын таңдасаң, 25-ке сақталатын
  const dateString = toDateString(selectedDate);

  const loadDay = useCallback(async () => {
    try {
      setPlans(await fetchPlansForDate(dateString));
    } catch (error) {
      console.error('Жоспарлар алу қатесі:', error);
    }
  }, [dateString]);

  // Күнтізбеде жоспары бар күндерді белгілеу
  const loadMonth = useCallback(async () => {
    try {
      const monthPlans = await fetchPlansForMonth(viewMonth.getFullYear(), viewMonth.getMonth() + 1);
      setPlannedDays(new Set(monthPlans.map((p) => p.plan_date)));
    } catch (error) {
      console.error('Ай жоспарлары алу қатесі:', error);
    }
  }, [viewMonth]);

  useEffect(() => { loadDay(); }, [loadDay]);
  useEffect(() => { loadMonth(); }, [loadMonth]);

  const handleAddPlan = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    setLoading(true);
    try {
      const plan = await createPlan({ plan_date: dateString, task_title: newTask, task_time: newTime });
      setPlans(sortPlans([...plans, plan]));
      setPlannedDays(new Set([...plannedDays, dateString]));
      setNewTask('');
    } catch (error) {
      console.error('Жоспар қосу қатесі:', error);
      alert('Жоспар қосу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (task) => {
    try {
      const updated = await updatePlan(task.id, { is_completed: !task.is_completed });
      setPlans(plans.map((p) => (p.id === task.id ? updated : p)));
    } catch (error) {
      console.error('Жоспар өндеу қатесі:', error);
    }
  };

  const handleSave = async (task, changes) => {
    try {
      const updated = await updatePlan(task.id, changes);
      // Басқа күнге ауыстырылса, бұл күннің тізімінен кетеді
      setPlans(updated.plan_date === dateString
        ? sortPlans(plans.map((p) => (p.id === task.id ? updated : p)))
        : plans.filter((p) => p.id !== task.id));
      loadMonth();
      return true;
    } catch (error) {
      alert(error.response?.data?.error || 'Жоспарды сақтау сәтсіз');
      return false;
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`«${task.task_title}» жоспарын өшіресіз бе?`)) return;
    try {
      await deletePlan(task.id);
      setPlans(plans.filter((p) => p.id !== task.id));
      loadMonth();
    } catch (error) {
      alert(error.response?.data?.error || 'Жоспарды өшіру сәтсіз');
    }
  };

  const isToday = dateString === toDateString(new Date());

  return (
    <div className="plans-section">
      <h2>📅 Жоспарлау</h2>

      <div className="plans-container">
        <div className="calendar-section">
          <Calendar
            value={selectedDate}
            onChange={setSelectedDate}
            onActiveStartDateChange={({ activeStartDate }) => setViewMonth(activeStartDate)}
            locale="kk"
            {...calendarFormatters}
            tileClassName={({ date, view }) =>
              view === 'month' && plannedDays.has(toDateString(date)) ? 'has-plan' : null}
          />
        </div>

        <div className="plans-detail">
          <h3>📍 {formatKkDate(selectedDate, { weekday: 'long', year: true })}</h3>
          {isToday && <p className="today-hint">Бүгінгі жоспарлар «Бүгінгі тапсырмалар» бөлімінде де көрінеді</p>}

          <form onSubmit={handleAddPlan} className="add-plan-form">
            <input
              type="text"
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              placeholder="Тапсырманы енгізіңіз"
              required
            />
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Қосылуда...' : '+ Қосу'}
            </button>
          </form>

          <div className="plans-list">
            {plans.length === 0 ? (
              <p className="no-plans">Бұл күннің жоспары жоқ</p>
            ) : (
              plans.map((plan) => (
                <PlanTaskItem
                  key={plan.id}
                  task={plan}
                  onToggle={handleToggle}
                  onSave={handleSave}
                  onDelete={handleDelete}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
