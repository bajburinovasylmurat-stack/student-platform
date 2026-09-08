import React, { useState } from 'react';
import axios from 'axios';
import '../styles/AdminPanel.css';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('materials');
  const [materialFile, setMaterialFile] = useState(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDesc, setMaterialDesc] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [examCategory, setExamCategory] = useState('24_hour');
  const [examUrl, setExamUrl] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const token = localStorage.getItem('token');

  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    if (!materialFile || !materialTitle) {
      alert('Файл және атаудын енгізіңіз');
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', materialFile);
    formData.append('title', materialTitle);
    formData.append('description', materialDesc);
    formData.append('is_admin', 'true');

    try {
      await axios.post(
        'https://student-platform-backend-h9zs.onrender.com/api/materials',
        formData,
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          } 
        }
      );
      alert('Материал сәтті қосылды!');
      setMaterialFile(null);
      setMaterialTitle('');
      setMaterialDesc('');
    } catch (error) {
      console.error('Материал қосу қатесі:', error);
      alert('Материал қосу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const handleExamSubmit = async (e) => {
    e.preventDefault();
    if (!examTitle || !examUrl) {
      alert('Атау және YouTube URL енгізіңіз');
      return;
    }

    setLoading(true);
    try {
      await axios.post(
        'https://student-platform-backend-h9zs.onrender.com/api/examinations',
        {
          title: examTitle,
          category: examCategory,
          youtube_url: examUrl,
          description: examDesc,
          is_admin: 'true'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Нұсқа сәтті қосылды!');
      setExamTitle('');
      setExamUrl('');
      setExamDesc('');
    } catch (error) {
      console.error('Нұсқа қосу қатесі:', error);
      alert('Нұсқа қосу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <h2>🛠️ Администратор Панелі</h2>

      <nav className="admin-nav">
        <button 
          className={activeTab === 'materials' ? 'active' : ''} 
          onClick={() => setActiveTab('materials')}
        >
          📚 Материалдар қосу
        </button>
        <button 
          className={activeTab === 'exams' ? 'active' : ''} 
          onClick={() => setActiveTab('exams')}
        >
          🎬 Нұсқалар қосу
        </button>
      </nav>

      <div className="admin-content">
        {activeTab === 'materials' && (
          <div className="admin-section">
            <h3>📚 Материалдар қосу</h3>
            <form onSubmit={handleMaterialSubmit} className="admin-form">
              <div className="form-group">
                <label>Материалдың атауы:</label>
                <input
                  type="text"
                  value={materialTitle}
                  onChange={(e) => setMaterialTitle(e.target.value)}
                  placeholder="мысалы: Аффиндік функциялар"
                  required
                />
              </div>

              <div className="form-group">
                <label>Сипаттамасы (міндетті емес):</label>
                <textarea
                  value={materialDesc}
                  onChange={(e) => setMaterialDesc(e.target.value)}
                  placeholder="Материалдың сипаттамасы"
                />
              </div>

              <div className="form-group">
                <label>PDF файлын таңдау:</label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setMaterialFile(e.target.files[0])}
                  required
                />
                {materialFile && <span className="file-name">✓ {materialFile.name}</span>}
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? '⏳ Жүктеу...' : '✓ Материалды қосу'}
              </button>
            </form>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="admin-section">
            <h3>🎬 Нұсқалар қосу</h3>
            <form onSubmit={handleExamSubmit} className="admin-form">
              <div className="form-group">
                <label>Нұсқаның атауы:</label>
                <input
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="мысалы: Тригонометрия теориясы"
                  required
                />
              </div>

              <div className="form-group">
                <label>Бөлім:</label>
                <select 
                  value={examCategory}
                  onChange={(e) => setExamCategory(e.target.value)}
                >
                  <option value="24_hour">24 сағаттық нұсқа</option>
                  <option value="geometry">Геометрия</option>
                  <option value="mathematics">Математика</option>
                </select>
              </div>

              <div className="form-group">
                <label>YouTube видеосының сілтемесі:</label>
                <input
                  type="url"
                  value={examUrl}
                  onChange={(e) => setExamUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  required
                />
              </div>

              <div className="form-group">
                <label>Сипаттамасы (міндетті емес):</label>
                <textarea
                  value={examDesc}
                  onChange={(e) => setExamDesc(e.target.value)}
                  placeholder="Нұсқаның сипаттамасы"
                />
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? '⏳ Қосылуда...' : '✓ Нұсқа қосу'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
