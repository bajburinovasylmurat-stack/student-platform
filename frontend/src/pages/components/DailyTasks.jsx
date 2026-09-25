import React, { useState, useEffect, useCallback } from 'react';
import '../styles/DailyTasks.css';
import { formatKkDate } from '../../utils/kkDate';
import { toDateString, parseDate } from './planUtils';
import PlanTaskItem from './PlanTaskItem';
import { fetchPlansForDate, createPlan, updatePlan, deletePlan, sortPlans } from './planApi';

// «Жоспар» бетінде бүгінгі күнге қосылғандардың бәрі осында көрінеді
export default function DailyTasks() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [today, setToday] = useState(toDateString(new Date()));

  const fetchTasks = useCallback(async () => {
    try {
      setTasks(sortPlans(await fetchPlansForDate(today)));
    } catch (error) {
      console.error('Тапсырмалар алу қатесі:', error);
    }
  }, [today]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Бет түн ортасынан кейін ашық тұрса, келесі күнге ауысады
  useEffect(() => {
    const timer = setInterval(() => {
      const now = toDateString(new Date());
      if (now !== today) setToday(now);
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [today]);

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    setLoading(true);
    try {
      const task = await createPlan({ plan_date: today, task_title: newTask, task_time: newTime });
      setTasks(sortPlans([...tasks, task]));
      setNewTask('');
    } catch (error) {
      console.error('Тапсырма қосу қатесі:', error);
      alert('Тапсырма қосу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (task) => {
    try {
      const updated = await updatePlan(task.id, { is_completed: !task.is_completed });
      setTasks(tasks.map((t) => (t.id === task.id ? updated : t)));
    } catch (error) {
      console.error('Тапсырма өндеу қатесі:', error);
    }
  };

  const handleSave = async (task, changes) => {
    try {
      const updated = await updatePlan(task.id, changes);
      setTasks(updated.plan_date === today
        ? sortPlans(tasks.map((t) => (t.id === task.id ? updated : t)))
        : tasks.filter((t) => t.id !== task.id));
      return true;
    } catch (error) {
      alert(error.response?.data?.error || 'Тапсырманы сақтау сәтсіз');
      return false;
    }
  };

  const handleDelete = async (task) => {
    if (!window.confirm(`«${task.task_title}» тапсырмасын өшіресіз бе?`)) return;
    try {
      await deletePlan(task.id);
      setTasks(tasks.filter((t) => t.id !== task.id));
    } catch (error) {
      alert(error.response?.data?.error || 'Тапсырманы өшіру сәтсіз');
    }
  };

  const completedCount = tasks.filter((t) => t.is_completed).length;

  return (
    <div className="daily-tasks-section">
      <h2>✅ Бүгінгі Тапсырмалар</h2>

      <div className="today-info">
        <h3>📅 {formatKkDate(parseDate(today), { weekday: 'long', year: true })}</h3>
        <div className="progress">
          <span>{completedCount} / {tasks.length} орындалды</span>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: tasks.length ? `${(completedCount / tasks.length) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      <form onSubmit={handleAddTask} className="add-task-form">
        <input
          type="text"
          value={newTask}
          onChange={(e) => setNewTask(e.target.value)}
          placeholder="Бүгінгі тапсырманы енгізіңіз"
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

      <div className="tasks-list">
        {tasks.length === 0 ? (
          <p className="no-tasks">Бүгінге тапсырма жоқ. «Жоспар» бөлімінде алдын ала жоспарлауға да болады.</p>
        ) : (
          tasks.map((task) => (
            <PlanTaskItem
              key={task.id}
              task={task}
              onToggle={handleToggle}
              onSave={handleSave}
              onDelete={handleDelete}
              showStatus
            />
          ))
        )}
      </div>
    </div>
  );
}
