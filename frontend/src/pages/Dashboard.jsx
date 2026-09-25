import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import axios from 'axios';
import './Dashboard.css';
import logo from '../assets/logo.png';
import Materials from './components/Materials';
import Examinations from './components/Examinations';
import Plans from './components/Plans';
import DailyTasks from './components/DailyTasks';
import AdminPanel from './components/AdminPanel';
import CuratorPanel from './components/CuratorPanel';
import MyCuratorPlans from './components/MyCuratorPlans';
import { formatKkDate, capitalize } from '../utils/kkDate';
import { prettyPhone } from '../utils/phone';

const ROLE_LABELS = {
  admin: 'Админ',
  curator: 'Куратор',
  student: 'Оқушы'
};

const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Қайырлы таң';
  if (hour < 18) return 'Қайырлы күн';
  return 'Қайырлы кеш';
};

export default function Dashboard({ student, onLogout }) {
  const [activeTab, setActiveTab] = useState('materials');
  const [role, setRole] = useState(student.role || (student.student_number === 'admin' ? 'admin' : 'student'));
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const tabRefs = useRef({});
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

  const tabs = [
    { id: 'materials', icon: '📚', label: 'Материалдар' },
    { id: 'examinations', icon: '🎬', label: 'Нұсқа талдаулар' },
    { id: 'plans', icon: '📅', label: 'Жоспар' },
    { id: 'daily', icon: '✅', label: 'Бүгінгі тапсырмалар' },
    role === 'student' && { id: 'curator-plans', icon: '🎯', label: 'Куратор жоспары' },
    (isCurator || isAdmin) && { id: 'curator', icon: '🧑‍🏫', label: 'Менің оқушыларым' },
    isAdmin && { id: 'admin', icon: '🛠️', label: 'Админ панелі' }
  ].filter(Boolean);

  // Белсенді таб астындағы сырғымалы сызық
  useLayoutEffect(() => {
    const updateIndicator = () => {
      const el = tabRefs.current[activeTab];
      if (el) setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
    };
    updateIndicator();
    window.addEventListener('resize', updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [activeTab, role]);

  const selectTab = (id) => {
    setActiveTab(id);
    tabRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };

  const firstName = student.name?.split(' ')[0] || '';
  const today = capitalize(formatKkDate(new Date(), { weekday: 'long' }));

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-inner">
          <img src={logo} alt="JUZ40" className="header-logo" />

          <div className="user-chip">
            <div className="avatar">{initials(student.name)}</div>
            <div className="user-meta">
              <strong>{student.name}</strong>
              <span>
                <span className={`role-dot role-${role}`} />
                {ROLE_LABELS[role]} · {prettyPhone(student.phone || student.student_number)}
              </span>
            </div>
            <button onClick={onLogout} className="logout-btn" title="Шығу">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Шығу</span>
            </button>
          </div>
        </div>

        <nav className="dashboard-nav">
          <div className="nav-track">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[tab.id] = el; }}
                className={activeTab === tab.id ? 'active' : ''}
                onClick={() => selectTab(tab.id)}
              >
                <span className="tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
            <span className="nav-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
          </div>
        </nav>
      </header>

      <section className="welcome">
        <div className="welcome-inner">
          <div>
            <p className="welcome-date">{today}</p>
            <h1>{greeting()}, {firstName}! 👋</h1>
            <p className="welcome-sub">Бүгін де бір қадам алға. Жоспарыңды орында, нәтижеңді көр.</p>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <span>∑</span><span>π</span><span>√</span>
          </div>
        </div>
      </section>

      <main className="dashboard-content" key={activeTab}>
        {activeTab === 'materials' && <Materials isAdmin={isAdmin} />}
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
