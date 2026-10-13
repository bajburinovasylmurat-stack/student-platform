import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Logo from './components/Logo';
import { IconContext } from 'react-icons';

export default function App() {
  const [student, setStudent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Сохраненный студенттің проверкасы
    const savedStudent = localStorage.getItem('student');
    if (savedStudent) {
      try {
        setStudent(JSON.parse(savedStudent));
      } catch (error) {
        console.error('Студент деректерін жүктеу қатесі:', error);
        localStorage.removeItem('student');
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (studentData) => {
    setStudent(studentData);
  };

  // Профиль өзгергенде (мысалы аты-жөні) күйді де, сақталған көшірмені де жаңартамыз
  const handleProfileUpdate = (changes) => {
    setStudent((prev) => {
      const next = { ...prev, ...changes };
      localStorage.setItem('student', JSON.stringify(next));
      return next;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('student');
    setStudent(null);
  };

  if (loading) {
    return (
      <div className="app-loading">
        <Logo size="lg" className="loading-logo" />
        <div className="loader-bar" />
      </div>
    );
  }

  return (
    // Барлық иконкаға ортақ класс: мәтінмен бір деңгейде тұрады
    <IconContext.Provider value={{ className: 'ic' }}>
      <div className="app">
        {student ? (
          <Dashboard student={student} onLogout={handleLogout} onProfileUpdate={handleProfileUpdate} />
        ) : (
          <Login onLoginSuccess={handleLoginSuccess} />
        )}
      </div>
    </IconContext.Provider>
  );
}
