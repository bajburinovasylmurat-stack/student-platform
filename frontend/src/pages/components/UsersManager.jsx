import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Curator.css';
import { prettyPhone } from '../../utils/phone';

const API = 'https://student-platform-backend-h9zs.onrender.com';

const ROLE_LABELS = {
  admin: '👨‍💼 Админ',
  curator: '🧑‍🏫 Куратор',
  student: '🎓 Оқушы'
};

export default function UsersManager() {
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [curatorFilter, setCuratorFilter] = useState('all'); // 'all' | 'none' | куратор id
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);

  const token = localStorage.getItem('token');
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/api/admin/users`, { headers });
      setUsers(response.data);
    } catch (error) {
      console.error('Қолданушылар алу қатесі:', error);
      alert('Қолданушыларды жүктеу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const changeRole = async (user, role) => {
    if (role === 'student' && user.students_count > 0 &&
        !window.confirm(`${user.name} куратордан алынса, оның ${user.students_count} оқушысы кураторсыз қалады. Жалғастырасыз ба?`)) {
      return;
    }

    setSavingId(user.id);
    try {
      await axios.patch(`${API}/api/admin/users/${user.id}/role`, { role }, { headers });
      await fetchUsers();
    } catch (error) {
      console.error('Рөл өзгерту қатесі:', error);
      alert(error.response?.data?.error || 'Рөл өзгерту сәтсіз');
    } finally {
      setSavingId(null);
    }
  };

  const resetPassword = async (user) => {
    if (!window.confirm(`${user.name} үшін жаңа уақытша құпиясөз жасайсыз ба? Ескі құпиясөзі жұмыс істемей қалады.`)) {
      return;
    }
    setSavingId(user.id);
    try {
      const response = await axios.post(`${API}/api/admin/users/${user.id}/reset-password`, {}, { headers });
      setTempPassword({ id: user.id, value: response.data.temp_password, copied: false });
    } catch (error) {
      console.error('Құпиясөзді қалпына келтіру қатесі:', error);
      alert(error.response?.data?.error || 'Құпиясөзді қалпына келтіру сәтсіз');
    } finally {
      setSavingId(null);
    }
  };

  const copyTempPassword = async () => {
    try {
      await navigator.clipboard.writeText(tempPassword.value);
      setTempPassword({ ...tempPassword, copied: true });
    } catch {
      // Көшіру мүмкін болмаса, құпиясөз экранда көрініп тұр
    }
  };

  const counts = {
    all: users.length,
    curator: users.filter(u => u.role === 'curator').length,
    student: users.filter(u => u.role === 'student').length
  };

  // "707 123" сияқты бос орынмен жазылған нөмірді де табу үшін цифрлармен салыстырамыз
  const curators = users.filter((u) => u.role === 'curator').sort((a, b) => a.name.localeCompare(b.name));

  const matchesCurator = (u) => {
    if (curatorFilter === 'all') return true;
    if (curatorFilter === 'none') return u.role === 'student' && !u.curator_id;
    return u.curator_id === Number(curatorFilter);
  };

  // Аты, нөмірі немесе куратордың аты бойынша іздеу
  const query = search.trim().toLowerCase();
  const searchDigits = search.replace(/\D/g, '');
  const matchesSearch = (u) =>
    !query ||
    u.name.toLowerCase().includes(query) ||
    u.student_number.toLowerCase().includes(query) ||
    (u.curator_name || '').toLowerCase().includes(query) ||
    (searchDigits && u.student_number.includes(searchDigits));

  const visible = users.filter((u) =>
    (filter === 'all' || u.role === filter) && matchesCurator(u) && matchesSearch(u)
  );

  if (loading) return <div className="loading">Жүктелуде...</div>;

  return (
    <div className="admin-section">
      <h3>👥 Тіркелген қолданушылар</h3>

      <div className="users-toolbar">
        <div className="role-filter">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            Барлығы ({counts.all})
          </button>
          <button className={filter === 'curator' ? 'active' : ''} onClick={() => setFilter('curator')}>
            🧑‍🏫 Кураторлар ({counts.curator})
          </button>
          <button className={filter === 'student' ? 'active' : ''} onClick={() => setFilter('student')}>
            🎓 Оқушылар ({counts.student})
          </button>
        </div>
        <div className="users-search">
          <select
            className="search-input"
            value={curatorFilter}
            onChange={(e) => setCuratorFilter(e.target.value)}
            aria-label="Куратор бойынша"
          >
            <option value="all">🧑‍🏫 Куратор бойынша: барлығы</option>
            <option value="none">Кураторы жоқ оқушылар</option>
            {curators.map((c) => (
              <option key={c.id} value={c.id}>{c.name} ({c.students_count})</option>
            ))}
          </select>
          <input
            type="text"
            className="search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Аты, нөмірі немесе куратор"
          />
        </div>
      </div>

      {curatorFilter !== 'all' && (
        <p className="filter-note">
          {curatorFilter === 'none'
            ? `Кураторы жоқ оқушылар: ${visible.length}`
            : `${curators.find((c) => c.id === Number(curatorFilter))?.name || ''} кураторының оқушылары: ${visible.length}`}
          {' '}
          <button className="link-btn" onClick={() => setCuratorFilter('all')}>Сүзгіні алу</button>
        </p>
      )}

      <div className="users-list">
        {visible.length === 0 && <p className="empty-text">Қолданушы табылмады</p>}
        {visible.map(user => (
          <div key={user.id} className="user-row">
            <div className="user-info">
              <strong>{user.name}</strong>
              <span className="muted">{prettyPhone(user.student_number)}</span>
              {user.role === 'student' && (
                <span className="muted">
                  Куратор: {user.curator_name || '—'}
                </span>
              )}
              {user.role === 'curator' && (
                <span className="muted">Оқушылары: {user.students_count}</span>
              )}
            </div>
            <span className={`role-badge role-${user.role}`}>{ROLE_LABELS[user.role]}</span>
            {user.role !== 'admin' && (
              <button
                className="small-btn"
                disabled={savingId === user.id}
                onClick={() => resetPassword(user)}
                title="Уақытша құпиясөз жасау"
              >
                🔑 Құпиясөз
              </button>
            )}
            {user.role === 'student' && (
              <button
                className="small-btn primary"
                disabled={savingId === user.id}
                onClick={() => changeRole(user, 'curator')}
              >
                Куратор ету
              </button>
            )}
            {user.role === 'curator' && (
              <button
                className="small-btn danger"
                disabled={savingId === user.id}
                onClick={() => changeRole(user, 'student')}
              >
                Куратордан алу
              </button>
            )}
            {tempPassword?.id === user.id && (
              <div className="temp-password">
                <span>Уақытша құпиясөз:</span>
                <code>{tempPassword.value}</code>
                <button className="small-btn" onClick={copyTempPassword}>
                  {tempPassword.copied ? '✓ Көшірілді' : 'Көшіру'}
                </button>
                <span className="muted">Оқушыға беріңіз, ол осы құпиясөзбен кіреді. Бұл терезе жабылғаннан кейін құпиясөз қайта көрсетілмейді.</span>
                <button className="icon-btn" onClick={() => setTempPassword(null)} aria-label="Жабу">✕</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
