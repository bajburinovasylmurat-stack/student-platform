import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Materials.css';
import '../styles/PlanTaskItem.css';

const API = 'https://student-platform-backend-h9zs.onrender.com';

const CATEGORIES = {
  practice: { label: 'Практика', icon: '📝', empty: 'Практика материалдары әлі қосылмаған' },
  formula: { label: 'Формула', icon: '📐', empty: 'Формулалар әлі қосылмаған' }
};

export default function Materials({ isAdmin }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [category, setCategory] = useState('practice');

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const response = await axios.get(`${API}/api/materials`);
      setMaterials(response.data);
    } catch (error) {
      console.error('Материалдар алу қатесі:', error);
    } finally {
      setLoading(false);
    }
  };

  const authHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  const handleDelete = async (material) => {
    if (!window.confirm(`«${material.title}» материалын өшіресіз бе? Оны қайтару мүмкін емес.`)) return;

    setBusyId(material.id);
    try {
      await axios.delete(`${API}/api/materials/${material.id}`, authHeaders());
      setMaterials(materials.filter((m) => m.id !== material.id));
    } catch (error) {
      console.error('Материал өшіру қатесі:', error);
      alert(error.response?.data?.error || 'Материал өшіру сәтсіз');
    } finally {
      setBusyId(null);
    }
  };

  const handleMove = async (material, target) => {
    setBusyId(material.id);
    try {
      await axios.patch(`${API}/api/materials/${material.id}`, { category: target }, authHeaders());
      setMaterials(materials.map((m) => (m.id === material.id ? { ...m, category: target } : m)));
    } catch (error) {
      alert(error.response?.data?.error || 'Бөлімді ауыстыру сәтсіз');
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div className="loading">Күтіңіз...</div>;

  const categoryOf = (m) => m.category || 'practice';
  const visible = materials.filter((m) => categoryOf(m) === category);
  const other = category === 'practice' ? 'formula' : 'practice';

  return (
    <div className="materials-section">
      <h2>📚 Оқу Материалдары</h2>

      <div className="material-tabs" role="tablist">
        {Object.entries(CATEGORIES).map(([key, c]) => (
          <button
            key={key}
            role="tab"
            aria-selected={category === key}
            className={category === key ? 'active' : ''}
            onClick={() => setCategory(key)}
          >
            <span>{c.icon}</span> {c.label}
            <span className="tab-count">{materials.filter((m) => categoryOf(m) === key).length}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="no-materials">{CATEGORIES[category].empty}</p>
      ) : (
        <div className="materials-grid" key={category}>
          {visible.map(material => (
            <div key={material.id} className="material-card">
              <h3>{material.title}</h3>
              {material.description && <p className="description">{material.description}</p>}
              <div className="material-actions">
                <a
                  href={`${API}${encodeURI(material.file_path)}`}
                  download
                  className="download-btn"
                >
                  ⬇️ Жүктеу
                </a>
                {isAdmin && (
                  <>
                    <button
                      className="move-btn"
                      onClick={() => handleMove(material, other)}
                      disabled={busyId === material.id}
                      title={`${CATEGORIES[other].label} бөліміне ауыстыру`}
                    >
                      → {CATEGORIES[other].icon} {CATEGORIES[other].label}
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(material)}
                      disabled={busyId === material.id}
                      title="Материалды өшіру"
                    >
                      🗑
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
