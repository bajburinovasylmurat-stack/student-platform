import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Examinations.css';

export default function Examinations({ isAdmin }) {
  const [examinations, setExaminations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    category: '24_hour',
    youtube_url: '',
    description: ''
  });

  const categories = {
    '24_hour': '24 сағаттық нұсқа',
    'geometry': 'Геометрия',
    'mathematics': 'Математика'
  };

  useEffect(() => {
    fetchExaminations();
  }, []);

  const fetchExaminations = async () => {
    try {
      const response = await axios.get('https://student-platform-backend-h9zs.onrender.com/api/examinations');
      setExaminations(response.data);
    } catch (error) {
      console.error('Нұсқалар алу қатесі:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddExamination = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.post(
        'https://student-platform-backend-h9zs.onrender.com/api/examinations',
        {
          ...formData,
          is_admin: 'true'
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchExaminations();
      setFormData({ title: '', category: '24_hour', youtube_url: '', description: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Нұсқа қосу қатесі:', error);
      alert('Нұсқа қосу сәтсіз');
    }
  };

  const filteredExaminations = selectedCategory === 'all' 
    ? examinations 
    : examinations.filter(exam => exam.category === selectedCategory);

  if (loading) return <div className="loading">Күтіңіз...</div>;

  return (
    <div className="examinations-section">
      <h2>🎬 Нұсқа Талдаулары</h2>

      {isAdmin && (
        <button 
          className="add-btn" 
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? '✕ Жабу' : '+ Нұсқа қосу'}
        </button>
      )}

      {showAddForm && isAdmin && (
        <form className="add-form" onSubmit={handleAddExamination}>
          <input
            type="text"
            placeholder="Атауы"
            value={formData.title}
            onChange={(e) => setFormData({...formData, title: e.target.value})}
            required
          />
          <select 
            value={formData.category}
            onChange={(e) => setFormData({...formData, category: e.target.value})}
          >
            <option value="24_hour">24 сағаттық нұсқа</option>
            <option value="geometry">Геометрия</option>
            <option value="mathematics">Математика</option>
          </select>
          <input
            type="url"
            placeholder="YouTube URL"
            value={formData.youtube_url}
            onChange={(e) => setFormData({...formData, youtube_url: e.target.value})}
            required
          />
          <textarea
            placeholder="Сипаттамасы"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
          <button type="submit">Қосу</button>
        </form>
      )}

      <div className="category-filter">
        <button 
          className={selectedCategory === 'all' ? 'active' : ''} 
          onClick={() => setSelectedCategory('all')}
        >
          Барлығы
        </button>
        {Object.entries(categories).map(([key, label]) => (
          <button 
            key={key}
            className={selectedCategory === key ? 'active' : ''} 
            onClick={() => setSelectedCategory(key)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="examinations-grid">
        {filteredExaminations.map(exam => (
          <div key={exam.id} className="exam-card">
            {exam.thumbnail_url && (
              <img 
                src={exam.thumbnail_url} 
                alt={exam.title} 
                className="exam-thumbnail"
              />
            )}
            <h3>{exam.title}</h3>
            <p className="category">{categories[exam.category]}</p>
            {exam.description && <p className="description">{exam.description}</p>}
            {exam.youtube_url && (
              <a 
                href={exam.youtube_url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="watch-btn"
              >
                🎥 Қарау
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
