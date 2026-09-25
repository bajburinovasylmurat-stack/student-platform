import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Curator.css';
import { prettyPhone } from '../../utils/phone';
import { formatRange, formatDay, groupByDate, PLAN_TYPE_LABELS } from './planUtils';

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
  const [openPlans, setOpenPlans] = useState({}); // оқушы id -> жоспарлар (null = жүктелуде)
  const [transferTo, setTransferTo] = useState('');

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

  // Оқушыны басқа кураторға беру (жоспарлары бірге өтеді)
  const moveStudent = async (user, curatorId) => {
    const target = curators.find((c) => c.id === Number(curatorId));
    const text = target
      ? `${user.name} оқушысын ${target.name} кураторына ауыстырасыз ба? Жоспарлары да бірге өтеді.`
      : `${user.name} оқушысын кураторсыз қалдырасыз ба?`;
    if (!window.confirm(text)) return;

    setSavingId(user.id);
    try {
      await axios.patch(`${API}/api/admin/users/${user.id}/curator`, { curator_id: curatorId || null }, { headers });
      await fetchUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Куратор ауыстыру сәтсіз');
    } finally {
      setSavingId(null);
    }
  };

  // Куратордың барлық оқушыларын басқа кураторға көшіру
  const transferAll = async () => {
    const from = curators.find((c) => c.id === Number(curatorFilter));
    const to = curators.find((c) => c.id === Number(transferTo));
    if (!from || !to) return;
    if (!window.confirm(`${from.name} кураторының ${from.students_count} оқушысын ${to.name} кураторына көшіресіз бе? Жоспарлары да бірге өтеді.`)) return;

    setSavingId('transfer');
    try {
      const response = await axios.post(
        `${API}/api/admin/curators/${from.id}/transfer`, { to_curator_id: to.id }, { headers }
      );
      alert(`${response.data.moved} оқушы ${to.name} кураторына көшірілді`);
      setTransferTo('');
      setCuratorFilter(String(to.id));
      await fetchUsers();
    } catch (error) {
      alert(error.response?.data?.error || 'Оқушыларды көшіру сәтсіз');
    } finally {
      setSavingId(null);
    }
  };

  const togglePlans = async (user) => {
    if (user.id in openPlans) {
      const { [user.id]: _, ...rest } = openPlans;
      setOpenPlans(rest);
      return;
    }
    setOpenPlans({ ...openPlans, [user.id]: null });
    try {
      const response = await axios.get(`${API}/api/admin/students/${user.id}/plans`, { headers });
      setOpenPlans((prev) => ({ ...prev, [user.id]: response.data }));
    } catch (error) {
      alert(error.response?.data?.error || 'Жоспарларды жүктеу сәтсіз');
      setOpenPlans((prev) => {
        const { [user.id]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const showCuratorStudents = (curatorId) => {
    setCuratorFilter(String(curatorId));
    setFilter('student');
    setSearch('');
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

  // Іздеуде куратордың аты жазылса, соның оқушыларын көрсетуді ұсынамыз
  const matchedCurators = query && curatorFilter === 'all'
    ? curators.filter((c) => c.name.toLowerCase().includes(query))
    : [];
  const selectedCurator = curators.find((c) => c.id === Number(curatorFilter));

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

      {matchedCurators.length > 0 && (
        <div className="curator-hits">
          {matchedCurators.map((c) => (
            <button key={c.id} className="curator-hit" onClick={() => showCuratorStudents(c.id)}>
              🧑‍🏫 <b>{c.name}</b> кураторы табылды · {c.students_count} оқушы
              <span>Оқушыларын көрсету →</span>
            </button>
          ))}
        </div>
      )}

      {selectedCurator && selectedCurator.students_count > 0 && (
        <div className="transfer-bar">
          <span>Барлық {selectedCurator.students_count} оқушысын көшіру:</span>
          <select className="search-input" value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
            <option value="">Жаңа куратор...</option>
            {curators.filter((c) => c.id !== selectedCurator.id).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <button
            className="small-btn primary"
            disabled={!transferTo || savingId === 'transfer'}
            onClick={transferAll}
          >
            {savingId === 'transfer' ? '...' : 'Көшіру'}
          </button>
        </div>
      )}

      <div className="users-list">
        {visible.length === 0 && <p className="empty-text">Қолданушы табылмады</p>}
        {visible.map(user => (
          <div key={user.id} className="user-row">
            <div className="user-info">
              <strong>{user.name}</strong>
              <span className="muted">{prettyPhone(user.student_number)}</span>
              {user.role === 'student' && (
                <label className="curator-select">
                  <span className="muted">Куратор:</span>
                  <select
                    value={user.curator_id || ''}
                    disabled={savingId === user.id}
                    onChange={(e) => moveStudent(user, e.target.value)}
                  >
                    <option value="">— жоқ</option>
                    {curators.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
              )}
              {user.role === 'curator' && (
                <button className="link-btn" onClick={() => showCuratorStudents(user.id)}>
                  Оқушылары: {user.students_count} →
                </button>
              )}
            </div>
            <span className={`role-badge role-${user.role}`}>{ROLE_LABELS[user.role]}</span>
            {user.role === 'student' && (
              <button
                className={`small-btn ${user.id in openPlans ? 'active' : ''}`}
                onClick={() => togglePlans(user)}
              >
                📋 Жоспарлар
              </button>
            )}
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
            {user.id in openPlans && <StudentPlans plans={openPlans[user.id]} />}
          </div>
        ))}
      </div>
    </div>
  );
}

// Оқушының куратор құрған жоспарлары (тек көру үшін)
function StudentPlans({ plans }) {
  if (plans === null) return <div className="student-plans"><p className="empty-text">Жүктелуде...</p></div>;
  if (plans.length === 0) {
    return <div className="student-plans"><p className="empty-text">Куратор бұл оқушыға әлі жоспар құрмаған</p></div>;
  }

  return (
    <div className="student-plans curator-panel">
      {plans.map((plan) => {
        const done = plan.tasks.filter((t) => t.is_completed).length;
        const total = plan.tasks.length;
        const percent = total ? Math.round((done / total) * 100) : 0;
        const grouped = groupByDate(plan.tasks);
        return (
          <details key={plan.id} className="plan-card">
            <summary className="plan-card-header">
              <div>
                <span className={`type-badge type-${plan.plan_type}`}>{PLAN_TYPE_LABELS[plan.plan_type]}</span>
                <strong>{plan.title}</strong>
                <span className="muted">{formatRange(plan.start_date, plan.end_date)} · Куратор: {plan.curator_name}</span>
              </div>
              <div className="plan-progress">
                <span>{done}/{total}</span>
                <div className="progress-bar"><div className="progress-fill" style={{ width: `${percent}%` }} /></div>
              </div>
            </summary>
            <div className="plan-card-body">
              {plan.description && <p className="plan-description">{plan.description}</p>}
              {Object.keys(grouped).map((date) => (
                <div key={date} className="day-group">
                  <div className="day-title">{formatDay(date)}</div>
                  {grouped[date].map((t) => (
                    <div key={t.id} className={`plan-task ${t.is_completed ? 'done' : ''}`}>
                      <span>{t.is_completed ? '✅' : '⬜'}</span>
                      <span className="grow">{t.task_title}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}
