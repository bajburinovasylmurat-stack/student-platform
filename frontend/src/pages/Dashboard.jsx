import React, { useState } from 'react';
import './Dashboard.css';
import Materials from './components/Materials';
import Examinations from './components/Examinations';
import Plans from './components/Plans';
import DailyTasks from './components/DailyTasks';
import AdminPanel from './components/AdminPanel';

export default function Dashboard({ student, onLogout }) {
  const [activeTab, setActiveTab] = useState('materials');
  const isAdmin = student.student_number === 'admin';

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>👤 {student.name}</h1>
        <div className="header-info">
          <span>Студент №: {student.student_number}</span>
          {isAdmin && <span className="admin-badge">👨‍💼 Админ</span>}
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
        {activeTab === 'admin' && isAdmin && <AdminPanel />}
      </main>
    </div>
  );
}
