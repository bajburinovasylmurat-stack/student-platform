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
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

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

  const counts = {
    all: users.length,
    curator: users.filter(u => u.role === 'curator').length,
    student: users.filter(u => u.role === 'student').length
  };

  // "707 123" сияқты бос орынмен жазылған нөмірді де табу үшін цифрлармен салыстырамыз
  const searchDigits = search.replace(/\D/g, '');
  const visible = users.filter(u =>
    (filter === 'all' || u.role === filter) &&
    (u.name.toLowerCase().includes(search.toLowerCase()) ||
     u.student_number.toLowerCase().includes(search.toLowerCase()) ||
     (searchDigits && u.student_number.includes(searchDigits)))
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
        <input
          type="text"
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Аты немесе нөмірі"
        />
      </div>

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
          </div>
        ))}
      </div>
    </div>
  );
}
