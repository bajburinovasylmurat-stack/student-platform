import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/DailyTasks.css';

export default function DailyTasks() {
  const [tasks, setTasks] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [loading, setLoading] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());

  const token = localStorage.getItem('token');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get(
        'https://student-platform-backend-h9zs.onrender.com/api/daily-tasks',
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Сортировка по времени
      const sorted = response.data.sort((a, b) => {
        return a.task_time.localeCompare(b.task_time);
      });
      setTasks(sorted);
    } catch (error) {
      console.error('Тапсырмалар алу қатесі:', error);
    }
  };

  const handleAddTask = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    setLoading(true);
    try {
      await axios.post(
        'https://student-platform-backend-h9zs.onrender.com/api/daily-tasks',
        {
          task_title: newTask,
          task_time: newTime
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTasks();
      setNewTask('');
      setNewTime('09:00');
    } catch (error) {
      console.error('Тапсырма қосу қатесі:', error);
      alert('Тапсырма қосу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (id, isCompleted) => {
    try {
      await axios.patch(
        `https://student-platform-backend-h9zs.onrender.com/api/daily-tasks/${id}`,
        { is_completed: !isCompleted },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchTasks();
    } catch (error) {
      console.error('Тапсырма өндеу қатесі:', error);
    }
  };

  const completedCount = tasks.filter(t => t.is_completed).length;

  return (
    <div className="daily-tasks-section">
      <h2>✅ Бүгінгі Тапсырмалар</h2>

      <div className="today-info">
        <h3>📅 {currentDate.toLocaleDateString('kk-KZ', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</h3>
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
          <p className="no-tasks">Бүгінгі тапсырмалар жоқ. Ынамдарыңызды немесе мұғалімінің тапсырмасын қоссаңыз!</p>
        ) : (
          tasks.map(task => (
            <div 
              key={task.id} 
              className={`task-item ${task.is_completed ? 'completed' : ''}`}
            >
              <input
                type="checkbox"
                checked={task.is_completed}
                onChange={() => handleToggleComplete(task.id, task.is_completed)}
                className="task-checkbox"
              />
              <div className="task-content">
                <span className="task-time">🕐 {task.task_time}</span>
                <span className="task-title">{task.task_title}</span>
              </div>
              <span className={`task-status ${task.is_completed ? 'done' : 'pending'}`}>
                {task.is_completed ? '✓ Орындалды' : '⏳ Орындалу керек'}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
