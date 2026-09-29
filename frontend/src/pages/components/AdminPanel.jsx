import React, { useState } from 'react';
import axios from 'axios';
import '../styles/AdminPanel.css';
import '../styles/PlanTaskItem.css';
import UsersManager from './UsersManager';
import { uploadMaterial } from './materialUpload';
import { YoutubePreview } from './YoutubeThumb';
import AdminTests from './AdminTests';
import AdminFlashcards from './AdminFlashcards';
import AdminAnnouncements from './Announcements';
import { LuBookOpen, LuBrain, LuCheck, LuClapperboard, LuFileQuestion, LuLoader2, LuMegaphone, LuPlus, LuSettings2, LuUpload, LuUsers } from 'react-icons/lu';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('materials');
  const [materialFile, setMaterialFile] = useState(null);
  const [materialTitle, setMaterialTitle] = useState('');
  const [materialDesc, setMaterialDesc] = useState('');
  const [materialCategory, setMaterialCategory] = useState('practice');
  const [examTitle, setExamTitle] = useState('');
  const [examCategory, setExamCategory] = useState('24_hour');
  const [examUrl, setExamUrl] = useState('');
  const [examDesc, setExamDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);

  const token = localStorage.getItem('token');

  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
    if (!materialFile || !materialTitle) {
      alert('Файл және атаудын енгізіңіз');
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    try {
      await uploadMaterial({
        file: materialFile,
        title: materialTitle,
        description: materialDesc,
        category: materialCategory,
        onProgress: setUploadProgress
      });
      alert('Материал сәтті қосылды!');
      setMaterialFile(null);
      setMaterialTitle('');
      setMaterialDesc('');
      e.target.reset();
    } catch (error) {
      console.error('Материал қосу қатесі:', error);
      // Себебін көрсету: сервер хабары, HTTP коды немесе желі қатесі
      const data = error.response?.data;
      const reason = error.response
        ? `${data?.error || 'Сервер қатесі'}${data?.detail ? ` (${data.detail})` : ''} [${error.response.status}]`
        : `Серверге жету мүмкін болмады: ${error.message}`;
      alert(`Материал қосу сәтсіз.\n${reason}`);
    } finally {
      setLoading(false);
      setUploadProgress(null);
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
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      alert('Нұсқа сәтті қосылды!');
      setExamTitle('');
      setExamUrl('');
      setExamDesc('');
    } catch (error) {
      console.error('Нұсқа қосу қатесі:', error);
      alert(error.response?.data?.error || 'Нұсқа қосу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-panel">
      <h2><LuSettings2 /> Администратор Панелі</h2>

      <nav className="admin-nav">
        <button 
          className={activeTab === 'materials' ? 'active' : ''} 
          onClick={() => setActiveTab('materials')}
        >
          <LuBookOpen /> Материалдар қосу
        </button>
        <button 
          className={activeTab === 'exams' ? 'active' : ''} 
          onClick={() => setActiveTab('exams')}
        >
          <LuClapperboard /> Нұсқалар қосу
        </button>
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => setActiveTab('users')}
        >
          <LuUsers /> Қолданушылар
        </button>
        <button className={activeTab === 'tests' ? 'active' : ''} onClick={() => setActiveTab('tests')}>
          <LuFileQuestion /> Тесттер
        </button>
        <button className={activeTab === 'cards' ? 'active' : ''} onClick={() => setActiveTab('cards')}>
          <LuBrain /> Карточкалар
        </button>
        <button className={activeTab === 'news' ? 'active' : ''} onClick={() => setActiveTab('news')}>
          <LuMegaphone /> Хабарландыру
        </button>
      </nav>

      <div className="admin-content">
        {activeTab === 'users' && <UsersManager />}
        {activeTab === 'tests' && <AdminTests />}
        {activeTab === 'cards' && <AdminFlashcards />}
        {activeTab === 'news' && <AdminAnnouncements />}

        {activeTab === 'materials' && (
          <div className="admin-section">
            <h3><LuBookOpen /> Материалдар қосу</h3>
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
                <label>Бөлім:</label>
                <select value={materialCategory} onChange={(e) => setMaterialCategory(e.target.value)}>
                  <option value="practice">Практика</option>
                  <option value="formula">Формула</option>
                </select>
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
                {materialFile && <span className="file-name"><LuCheck /> {materialFile.name}</span>}
                {materialFile && (
                  <span className="file-size">{(materialFile.size / 1024 / 1024).toFixed(1)} МБ · ең көбі 200 МБ</span>
                )}
              </div>

              <button type="submit" disabled={loading} className="submit-btn">
                {loading ? <><LuLoader2 className="spin" /> Жүктелуде... {uploadProgress ?? 0}%</> : <><LuUpload /> Материалды қосу</>}
              </button>
              {uploadProgress !== null && (
                <div className="upload-progress" aria-label="Жүктеу барысы">
                  <div style={{ width: `${uploadProgress}%` }} />
                </div>
              )}
            </form>
          </div>
        )}

        {activeTab === 'exams' && (
          <div className="admin-section">
            <h3><LuClapperboard /> Нұсқалар қосу</h3>
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
                  <option value="24_hour">12 сағаттық нұсқа</option>
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
                <YoutubePreview url={examUrl} />
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
                {loading ? <><LuLoader2 className="spin" /> Қосылуда...</> : <><LuPlus /> Нұсқа қосу</>}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
