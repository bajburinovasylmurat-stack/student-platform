import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';
import Materials from './components/Materials';
import Examinations from './components/Examinations';
import Plans from './components/Plans';
import DailyTasks from './components/DailyTasks';
import AdminPanel from './components/AdminPanel';
import CuratorPanel from './components/CuratorPanel';
import MyCuratorPlans from './components/MyCuratorPlans';

export default function Dashboard({ student, onLogout }) {
  const [activeTab, setActiveTab] = useState('materials');
  const [role, setRole] = useState(student.role || (student.student_number === 'admin' ? 'admin' : 'student'));
  const isAdmin = role === 'admin';
  const isCurator = role === 'curator';

  // Админ рөлді кез келген уақытта өзгерте алады, сондықтан профильден жаңартамыз
  useEffect(() => {
    const token = localStorage.getItem('token');
    axios.get('https://student-platform-backend-h9zs.onrender.com/api/profile', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(({ data }) => {
        const freshRole = data.student_number === 'admin' ? 'admin' : (data.role || 'student');
        setRole(freshRole);
        localStorage.setItem('student', JSON.stringify({ ...student, role: freshRole }));
      })
      .catch((error) => console.error('Профиль алу қатесі:', error));
  }, []);

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>👤 {student.name}</h1>
        <div className="header-info">
          <span>Студент №: {student.student_number}</span>
          {isAdmin && <span className="admin-badge">👨‍💼 Админ</span>}
          {isCurator && <span className="admin-badge">🧑‍🏫 Куратор</span>}
          <button onClick={onLogout} className="logout-btn">Шығу</button>
        </div>
      </header>

      <nav className="dashboard-nav">
        <button 
          className={activeTab === 'materials' ? 'active' : ''} 
          onClick={() => setActiveTab('materials')}
        >
          📚 Материалдар
        </button>
        <button 
          className={activeTab === 'examinations' ? 'active' : ''} 
          onClick={() => setActiveTab('examinations')}
        >
          🎬 Нұсқа талдаулар
        </button>
        <button 
          className={activeTab === 'plans' ? 'active' : ''} 
          onClick={() => setActiveTab('plans')}
        >
          📅 Жоспар
        </button>
        <button 
          className={activeTab === 'daily' ? 'active' : ''} 
          onClick={() => setActiveTab('daily')}
        >
          ✅ Бүгінгі тапсырмалар
        </button>
        {role === 'student' && (
          <button 
            className={activeTab === 'curator-plans' ? 'active' : ''} 
            onClick={() => setActiveTab('curator-plans')}
          >
            🎯 Куратор жоспары
          </button>
        )}
        {(isCurator || isAdmin) && (
          <button 
            className={activeTab === 'curator' ? 'active' : ''} 
            onClick={() => setActiveTab('curator')}
          >
            🧑‍🏫 Менің оқушыларым
          </button>
        )}
        {isAdmin && (
          <button 
            className={activeTab === 'admin' ? 'active' : ''} 
            onClick={() => setActiveTab('admin')}
          >
            🛠️ Админ панелі
          </button>
        )}
      </nav>

      <main className="dashboard-content">
        {activeTab === 'materials' && <Materials />}
        {activeTab === 'examinations' && <Examinations isAdmin={isAdmin} />}
        {activeTab === 'plans' && <Plans />}
        {activeTab === 'daily' && <DailyTasks />}
        {activeTab === 'curator-plans' && <MyCuratorPlans />}
        {activeTab === 'curator' && (isCurator || isAdmin) && <CuratorPanel />}
        {activeTab === 'admin' && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
}
