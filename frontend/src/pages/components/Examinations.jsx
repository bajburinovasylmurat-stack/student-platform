import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Examinations.css';
import { YoutubeThumb, YoutubePreview } from './YoutubeThumb';
import '../styles/Features.css';
import { api } from '../../api';
import { youtubeId } from '../../utils/youtube';
import VideoPlayer from './VideoPlayer';
import { LuCheck, LuClapperboard, LuPlay, LuPlus, LuX } from 'react-icons/lu';

const WATCHED_PERCENT = 90; // осыдан көп көрілсе, «көрілді» деп есептеледі

export default function Examinations({ isAdmin }) {
  const [examinations, setExaminations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showAddForm, setShowAddForm] = useState(false);
  const [views, setViews] = useState({}); // видео id -> { progress, position_sec }
  const [playing, setPlaying] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    category: '24_hour',
    youtube_url: '',
    description: ''
  });

  const categories = {
    '24_hour': '12 сағаттық нұсқа',
    'geometry': 'Геометрия',
    'mathematics': 'Математика'
  };

  useEffect(() => {
    fetchExaminations();
    api.get('/api/my-video-views')
      .then((rows) => setViews(Object.fromEntries(rows.map((r) => [r.exam_id, r]))))
      .catch(() => {});
  }, []);

  // Видеоны сайттың ішінде ашу (YouTube сілтемесі болмаса, жаңа бетте)
  const openVideo = (exam) => {
    if (!youtubeId(exam.youtube_url)) {
      window.open(exam.youtube_url, '_blank', 'noopener');
      return;
    }
    setPlaying(exam);
  };

  const handleProgress = (examId, result) =>
    setViews((prev) => ({ ...prev, [examId]: { ...prev[examId], ...result } }));

  const progressOf = (exam) => views[exam.id]?.progress || 0;
  const watchedCount = examinations.filter((e) => progressOf(e) >= WATCHED_PERCENT).length;

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
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      fetchExaminations();
      setFormData({ title: '', category: '24_hour', youtube_url: '', description: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Нұсқа қосу қатесі:', error);
      alert(error.response?.data?.error || 'Нұсқа қосу сәтсіз');
    }
  };

  const filteredExaminations = selectedCategory === 'all' 
    ? examinations 
    : examinations.filter(exam => exam.category === selectedCategory);

  if (loading) return <div className="loading">Күтіңіз...</div>;

  return (
    <div className="examinations-section">
      <h2><LuClapperboard /> Нұсқа Талдаулары</h2>

      {isAdmin && (
        <button 
          className="add-btn" 
          onClick={() => setShowAddForm(!showAddForm)}
        >
          {showAddForm ? <><LuX /> Жабу</> : <><LuPlus /> Нұсқа қосу</>}
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
            <option value="24_hour">12 сағаттық нұсқа</option>
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
          <YoutubePreview url={formData.youtube_url} />
          <textarea
            placeholder="Сипаттамасы"
            value={formData.description}
            onChange={(e) => setFormData({...formData, description: e.target.value})}
          />
          <button type="submit">Қосу</button>
        </form>
      )}

      {examinations.length > 0 && (
        <div className="cards-progress">
          <div className="progress-track">
            <div style={{ width: `${(watchedCount / examinations.length) * 100}%` }} />
          </div>
          <span>{watchedCount}/{examinations.length} видео толық көрілді</span>
        </div>
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
          <div key={exam.id} className={`exam-card ${progressOf(exam) >= WATCHED_PERCENT ? 'viewed' : ''}`}>
            <button className="thumb-button" onClick={() => openVideo(exam)} aria-label={`${exam.title} видеосын ашу`}>
              <YoutubeThumb
                url={exam.youtube_url}
                fallbackSrc={exam.thumbnail_url}
                alt={exam.title}
                className="exam-thumbnail"
              />
              <span className="play-icon"><LuPlay /></span>
              {progressOf(exam) >= WATCHED_PERCENT ? (
                <span className="viewed-badge"><LuCheck /> Көрілді</span>
              ) : progressOf(exam) > 0 && (
                <span className="viewed-badge partial">{progressOf(exam)}% көрілді</span>
              )}
              {progressOf(exam) > 0 && (
                <span className="thumb-progress"><span style={{ width: `${progressOf(exam)}%` }} /></span>
              )}
            </button>
            <h3>{exam.title}</h3>
            <p className="category">{categories[exam.category]}</p>
            {exam.description && <p className="description">{exam.description}</p>}
            {exam.youtube_url && (
              <button className="watch-btn" onClick={() => openVideo(exam)}>
                <LuPlay /> {progressOf(exam) > 0 && progressOf(exam) < WATCHED_PERCENT ? 'Жалғастыру' : 'Қарау'}
              </button>
            )}
          </div>
        ))}
      </div>

      {playing && (
        <VideoPlayer
          exam={playing}
          startAt={progressOf(playing) < WATCHED_PERCENT ? views[playing.id]?.position_sec || 0 : 0}
          initialProgress={progressOf(playing)}
          onProgress={handleProgress}
          onClose={() => setPlaying(null)}
        />
      )}
    </div>
  );
}
