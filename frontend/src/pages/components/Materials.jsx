import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Materials.css';
import '../styles/PlanTaskItem.css';

const API = 'https://student-platform-backend-h9zs.onrender.com';

export default function Materials({ isAdmin }) {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

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

  const handleDelete = async (material) => {
    if (!window.confirm(`«${material.title}» материалын өшіресіз бе? Оны қайтару мүмкін емес.`)) return;

    setDeletingId(material.id);
    try {
      await axios.delete(`${API}/api/materials/${material.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      setMaterials(materials.filter((m) => m.id !== material.id));
    } catch (error) {
      console.error('Материал өшіру қатесі:', error);
      alert(error.response?.data?.error || 'Материал өшіру сәтсіз');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <div className="loading">Күтіңіз...</div>;

  return (
    <div className="materials-section">
      <h2>📚 Оқу Материалдары</h2>

      {materials.length === 0 ? (
        <p className="no-materials">Материалдар әлі қосылмаған</p>
      ) : (
        <div className="materials-grid">
          {materials.map(material => (
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
                  <button
                    className="delete-btn"
                    onClick={() => handleDelete(material)}
                    disabled={deletingId === material.id}
                    title="Материалды өшіру"
                  >
                    {deletingId === material.id ? '...' : '🗑 Өшіру'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
