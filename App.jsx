import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';

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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('student');
    setStudent(null);
  };

  if (loading) {
    return <div className="app-loading">Жүктеліуде...</div>;
  }

  return (
    <div className="app">
      {student ? (
        <Dashboard student={student} onLogout={handleLogout} />
      ) : (
        <Login onLoginSuccess={handleLoginSuccess} />
      )}
    </div>
  );
}
