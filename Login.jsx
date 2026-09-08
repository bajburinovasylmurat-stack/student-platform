import React, { useState } from 'react';
import axios from 'axios';
import './Login.css';

export default function Login({ onLoginSuccess }) {
  const [student_number, setStudentNumber] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('https://student-platform-backend-h9zs.onrender.com/api/auth/login', {
        student_number,
        password
      });

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('student', JSON.stringify(response.data.student));
      onLoginSuccess(response.data.student);
    } catch (err) {
      setError(err.response?.data?.error || 'Кіру сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await axios.post('https://student-platform-backend-h9zs.onrender.com/api/auth/register', {
        student_number,
        password,
        name,
        email: `${student_number}@student.local`
      });

      setError('');
      alert('Тіркеу сәтті! Қазір кіріңіз');
      setIsRegister(false);
    } catch (err) {
      setError(err.response?.data?.error || 'Тіркеу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1>📚 Студенттік Платформа</h1>
        
        <form onSubmit={isRegister ? handleRegister : handleLogin}>
          {isRegister && (
            <div className="form-group">
              <label>Атыңыз:</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Толық атыңыз"
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Студент номері:</label>
            <input
              type="text"
              value={student_number}
              onChange={(e) => setStudentNumber(e.target.value)}
              placeholder="мысал: 2024001"
              required
            />
          </div>

          <div className="form-group">
            <label>Пароль:</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              required
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" disabled={loading}>
            {loading ? 'Күтіңіз...' : (isRegister ? 'Тіркеу' : 'Кіру')}
          </button>
        </form>

        <div className="toggle-auth">
          {isRegister ? (
            <>
              Бұрын тіркелген пе?{' '}
              <button onClick={() => setIsRegister(false)}>Кіру</button>
            </>
          ) : (
            <>
              Тіркелмеген пе?{' '}
              <button onClick={() => setIsRegister(true)}>Тіркеу</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
