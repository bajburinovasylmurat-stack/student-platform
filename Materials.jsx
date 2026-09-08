import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Materials.css';

export default function Materials() {
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMaterials();
  }, []);

  const fetchMaterials = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/materials');
      setMaterials(response.data);
    } catch (error) {
      console.error('Материалдар алу қатесі:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="loading">Күтіңіз...</div>;

  return (
    <div className="materials-section">
      <h2>📚 Оқу Материалдары</h2>
      
      {materials.length === 0 ? (
        <p className="no-materials">Материалдар құш қосылмаған</p>
      ) : (
        <div className="materials-grid">
          {materials.map(material => (
            <div key={material.id} className="material-card">
              <h3>{material.title}</h3>
              <p className="description">{material.description}</p>
              <p className="file-name">📄 {material.file_name}</p>
              <a 
                href={`http://localhost:5000${material.file_path}`} 
                download 
                className="download-btn"
              >
                ⬇️ Жүктеу
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
