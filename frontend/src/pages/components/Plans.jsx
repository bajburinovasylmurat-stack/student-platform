import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import '../styles/Plans.css';

export default function Plans() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [plans, setPlans] = useState([]);
  const [newTask, setNewTask] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');
  const dateString = selectedDate.toISOString().split('T')[0];

  useEffect(() => {
    fetchPlans(dateString);
  }, [selectedDate]);

  const fetchPlans = async (date) => {
    try {
      const response = await axios.get(
        `https://student-platform-backend-h9zs.onrender.com/api/plans/${date}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPlans(response.data);
    } catch (error) {
      console.error('Жоспарлар алу қатесі:', error);
    }
  };

  const handleAddPlan = async (e) => {
    e.preventDefault();
    if (!newTask.trim()) return;

    setLoading(true);
    try {
      await axios.post(
        'https://student-platform-backend-h9zs.onrender.com/api/plans',
        {
          plan_date: dateString,
          task_title: newTask,
          task_time: newTime
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPlans(dateString);
      setNewTask('');
      setNewTime('09:00');
    } catch (error) {
      console.error('Жоспар қосу қатесі:', error);
      alert('Жоспар қосу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleComplete = async (id, isCompleted) => {
    try {
      await axios.patch(
        `https://student-platform-backend-h9zs.onrender.com/api/plans/${id}`,
        { is_completed: !isCompleted },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchPlans(dateString);
    } catch (error) {
      console.error('Жоспар өндеу қатесі:', error);
    }
  };

  return (
    <div className="plans-section">
      <h2>📅 Жоспарлау</h2>

      <div className="plans-container">
        <div className="calendar-section">
          <Calendar
            value={selectedDate}
            onChange={setSelectedDate}
            locale="kk"
          />
        </div>

        <div className="plans-detail">
          <h3>📍 {selectedDate.toLocaleDateString('kk-KZ', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}</h3>

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
              <p className="no-plans">Бұл күндің жоспары жоқ</p>
            ) : (
              plans.map(plan => (
                <div 
                  key={plan.id} 
                  className={`plan-item ${plan.is_completed ? 'completed' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={plan.is_completed}
                    onChange={() => handleToggleComplete(plan.id, plan.is_completed)}
                    className="plan-checkbox"
                  />
                  <div className="plan-content">
                    <span className="plan-time">🕐 {plan.task_time}</span>
                    <span className="plan-title">{plan.task_title}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
