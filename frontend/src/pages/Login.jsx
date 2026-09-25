import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './Login.css';
import logo from '../assets/logo.png';
import logoWhite from '../assets/logo-white.png';

const API = 'https://student-platform-backend-h9zs.onrender.com';
const CODE_LENGTH = 6;

// 10 цифр (+7-ден кейінгі) -> "+7 (707) 123 45 67"
const formatPhone = (digits) => {
  const d = digits.padEnd(10, ' ');
  let out = '+7';
  if (digits.length > 0) out += ` (${d.slice(0, 3).trim()}`;
  // Жақша мен бос орын келесі топ басталғанда ғана қосылады, әйтпесе Backspace тұрып қалады
  if (digits.length > 3) out += `) ${d.slice(3, 6).trim()}`;
  if (digits.length > 6) out += ` ${d.slice(6, 8).trim()}`;
  if (digits.length > 8) out += ` ${d.slice(8, 10).trim()}`;
  return out;
};

// Кез келген енгізуден +7-ден кейінгі 10 цифрды алу
const extractPhoneDigits = (value) => {
  let digits = value.replace(/\D/g, '');
  // Қазақстан операторларының коды 7-ден басталады, сондықтан басындағы 8 немесе артық 7 — ел коды
  if (digits.startsWith('8') || (digits.length > 10 && digits.startsWith('7'))) {
    digits = digits.slice(1);
  }
  return digits.slice(0, 10);
};

const FLOATING_SYMBOLS = ['∑', 'π', '√x', '∫', '△', 'x²', '∞', 'sin α', '%', '÷', 'log', '≈'];

const FEATURES = [
  { icon: '📚', title: 'Материалдар', text: 'Тақырып бойынша PDF конспектілер' },
  { icon: '🎬', title: 'Нұсқа талдаулары', text: '24 сағаттық, геометрия, математика' },
  { icon: '🎯', title: 'Жеке куратор', text: 'Апталық және айлық жоспар' }
];

export default function Login({ onLoginSuccess }) {
  const [mode, setMode] = useState('login');
  const [error, setError] = useState('');
  const [errorKey, setErrorKey] = useState(0);
  const [loading, setLoading] = useState(false);

  // Кіру
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Тіркелу
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [phoneDigits, setPhoneDigits] = useState('');
  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [resendIn, setResendIn] = useState(0);
  const [devMode, setDevMode] = useState(false);
  const [botUrl, setBotUrl] = useState('');
  const codeRefs = useRef([]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  const showError = (message) => {
    setError(message);
    setErrorKey((k) => k + 1);
  };

  const switchMode = (next) => {
    setMode(next);
    setError('');
    setStep(1);
  };

  const doLogin = async (loginValue, passwordValue) => {
    const response = await axios.post(`${API}/api/auth/login`, {
      student_number: loginValue,
      password: passwordValue
    });
    localStorage.setItem('token', response.data.token);
    localStorage.setItem('student', JSON.stringify(response.data.student));
    onLoginSuccess(response.data.student);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await doLogin(login, password);
    } catch (err) {
      showError(err.response?.data?.error || 'Кіру сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const sendCode = async () => {
    if (phoneDigits.length !== 10) {
      showError('Телефон нөмірін толық енгізіңіз');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(`${API}/api/auth/send-code`, { phone: `7${phoneDigits}` });
      setResendIn(response.data.resend_after || 60);
      setStep(2);
      setBotUrl(response.data.channel === 'telegram' ? response.data.bot_url : '');
      if (response.data.dev_code) {
        setDevMode(true);
        setCode(response.data.dev_code.split(''));
      } else {
        setDevMode(false);
        setCode(Array(CODE_LENGTH).fill(''));
        setTimeout(() => codeRefs.current[0]?.focus(), 350);
      }
    } catch (err) {
      if (err.response?.data?.retry_after) {
        setResendIn(err.response.data.retry_after);
        setStep(2);
      }
      showError(err.response?.data?.error || 'Код жіберу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const handleSendCode = (e) => {
    e.preventDefault();
    sendCode();
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    const joined = code.join('');
    if (joined.length !== CODE_LENGTH) {
      showError('Кодты толық енгізіңіз');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await axios.post(`${API}/api/auth/register`, {
        phone: `7${phoneDigits}`,
        code: joined,
        name,
        password: newPassword
      });
      // Тіркелгеннен кейін бірден кіру
      await doLogin(`7${phoneDigits}`, newPassword);
    } catch (err) {
      showError(err.response?.data?.error || 'Тіркеу сәтсіз');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (index, value) => {
    const digits = value.replace(/\D/g, '');
    if (!digits) {
      const next = [...code];
      next[index] = '';
      setCode(next);
      return;
    }
    // Бірнеше цифр қойылса (paste / SMS autofill), қатарынан толтыру
    const next = [...code];
    digits.split('').slice(0, CODE_LENGTH - index).forEach((d, i) => { next[index + i] = d; });
    setCode(next);
    const focusIndex = Math.min(index + digits.length, CODE_LENGTH - 1);
    codeRefs.current[focusIndex]?.focus();
  };

  const handleCodeKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="brand-glow glow-1" />
        <div className="brand-glow glow-2" />
        <div className="floating-symbols" aria-hidden="true">
          {FLOATING_SYMBOLS.map((symbol, i) => (
            <span
              key={i}
              style={{
                left: `${(i * 37) % 88 + 4}%`,
                top: `${(i * 53) % 84 + 6}%`,
                fontSize: `${22 + (i * 7) % 38}px`,
                animationDuration: `${9 + (i * 1.3) % 7}s`,
                animationDelay: `${-1.7 * i}s`
              }}
            >
              {symbol}
            </span>
          ))}
        </div>

        <div className="brand-content">
          <img src={logoWhite} alt="JUZ40" className="brand-logo" />
          <h1>Біліміңді <span>жаңа деңгейге</span> көтер</h1>
          <p className="brand-subtitle">
            Материалдар, нұсқа талдаулары және жеке куратормен жоспарлау, бәрі бір жерде.
          </p>

          <ul className="brand-features">
            {FEATURES.map((f, i) => (
              <li key={f.title} style={{ '--d': `${0.35 + i * 0.12}s` }}>
                <span className="feature-icon">{f.icon}</span>
                <div>
                  <strong>{f.title}</strong>
                  <span>{f.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <img src={logo} alt="JUZ40" className="auth-card-logo" />

          <div className={`auth-tabs ${mode}`}>
            <span className="auth-tabs-pill" />
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>
              Кіру
            </button>
            <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>
              Тіркелу
            </button>
          </div>

          {mode === 'login' && (
            <form key="login" onSubmit={handleLogin} className="auth-form">
              <div className="auth-heading">
                <h2>Қош келдіңіз! 👋</h2>
                <p>Аккаунтыңызға кіріңіз</p>
              </div>

              <label className="field">
                <span>Телефон нөмірі немесе логин</span>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="+7 (707) 123 45 67"
                  autoComplete="username"
                  required
                />
              </label>

              <label className="field">
                <span>Пароль</span>
                <div className="password-wrap">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    required
                  />
                  <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? 'Жасыру' : 'Көрсету'}
                  </button>
                </div>
              </label>

              {error && <div key={errorKey} className="auth-error">{error}</div>}

              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Кіру'}
              </button>
            </form>
          )}

          {mode === 'register' && (
            <div className="auth-form" key={`register-${step}`}>
              <div className="steps">
                <div className={`step ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`}>
                  <span>{step > 1 ? '✓' : '1'}</span> Нөмір
                </div>
                <div className={`step-line ${step > 1 ? 'filled' : ''}`} />
                <div className={`step ${step >= 2 ? 'active' : ''}`}>
                  <span>2</span> Растау
                </div>
              </div>

              {step === 1 && (
                <form onSubmit={handleSendCode}>
                  <div className="auth-heading">
                    <h2>Тіркелу</h2>
                    <p>Нөміріңізді растау үшін 6 таңбалы код жібереміз</p>
                  </div>

                  <label className="field">
                    <span>Аты-жөніңіз</span>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Мысалы: Айгерім Сейітқызы"
                      autoComplete="name"
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Телефон нөмірі</span>
                    <input
                      type="tel"
                      inputMode="tel"
                      value={phoneDigits ? formatPhone(phoneDigits) : ''}
                      onChange={(e) => setPhoneDigits(extractPhoneDigits(e.target.value.replace(/^\+7/, '')))}
                      placeholder="+7 (707) 123 45 67"
                      autoComplete="tel"
                      required
                    />
                  </label>

                  {error && <div key={errorKey} className="auth-error">{error}</div>}

                  <button type="submit" className="auth-submit" disabled={loading || phoneDigits.length !== 10 || !name.trim()}>
                    {loading ? <span className="spinner" /> : 'Код алу →'}
                  </button>
                </form>
              )}

              {step === 2 && (
                <form onSubmit={handleRegister}>
                  <div className="auth-heading">
                    <h2>Кодты енгізіңіз</h2>
                    <p>
                      {botUrl ? (
                        <><strong>{formatPhone(phoneDigits)}</strong> нөмірін Telegram арқылы растаңыз.{' '}</>
                      ) : (
                        <><strong>{formatPhone(phoneDigits)}</strong> нөміріне 6 таңбалы код жіберілді.{' '}</>
                      )}
                      <button type="button" className="link-btn" onClick={() => { setStep(1); setError(''); }}>
                        Нөмірді өзгерту
                      </button>
                    </p>
                  </div>

                  {botUrl && (
                    <div className="tg-box">
                      <ol>
                        <li>Төмендегі батырманы басып, ботты ашыңыз</li>
                        <li>Ботта <b>Start</b>, содан кейін <b>«📱 Нөмірді жіберу»</b> басыңыз</li>
                        <li>Бот жіберген кодты осында енгізіңіз</li>
                      </ol>
                      <a href={botUrl} target="_blank" rel="noopener noreferrer" className="tg-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                          <path d="M21.94 4.3 18.9 19.1c-.23 1.03-.83 1.29-1.69.8l-4.66-3.44-2.25 2.17c-.25.25-.46.46-.94.46l.33-4.76 8.66-7.83c.38-.33-.08-.52-.58-.19L7.06 13.05 2.45 11.6c-1-.31-1.02-1 .21-1.48L20.66 3.2c.83-.31 1.56.19 1.28 1.1z" />
                        </svg>
                        Telegram-да ашу
                      </a>
                    </div>
                  )}

                  {devMode && (
                    <div className="dev-notice">
                      ⚙️ Тест режимі: SMS қызметі әлі қосылмаған, сондықтан код автоматты түрде қойылды.
                    </div>
                  )}

                  <div className="code-inputs">
                    {code.map((digit, i) => (
                      <input
                        key={i}
                        ref={(el) => { codeRefs.current[i] = el; }}
                        type="text"
                        inputMode="numeric"
                        autoComplete={i === 0 ? 'one-time-code' : 'off'}
                        value={digit}
                        onChange={(e) => handleCodeChange(i, e.target.value)}
                        onKeyDown={(e) => handleCodeKeyDown(i, e)}
                        onFocus={(e) => e.target.select()}
                        className={digit ? 'filled' : ''}
                        style={{ '--i': i }}
                        aria-label={`Кодтың ${i + 1}-цифры`}
                      />
                    ))}
                  </div>

                  <div className="resend">
                    {resendIn > 0 ? (
                      <span>Қайта жіберу: {Math.floor(resendIn / 60)}:{String(resendIn % 60).padStart(2, '0')}</span>
                    ) : (
                      <button type="button" className="link-btn" onClick={sendCode} disabled={loading}>
                        Кодты қайта жіберу
                      </button>
                    )}
                  </div>

                  <label className="field">
                    <span>Құпиясөз ойлап табыңыз</span>
                    <div className="password-wrap">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Кемінде 6 таңба"
                        autoComplete="new-password"
                        minLength={6}
                        required
                      />
                      <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? 'Жасыру' : 'Көрсету'}
                      </button>
                    </div>
                  </label>

                  {error && <div key={errorKey} className="auth-error">{error}</div>}

                  <button type="submit" className="auth-submit" disabled={loading}>
                    {loading ? <span className="spinner" /> : 'Тіркелу ✓'}
                  </button>
                </form>
              )}
            </div>
          )}

          <p className="auth-footer">© {new Date().getFullYear()} JUZ40 Online Edu</p>
        </div>
      </main>
    </div>
  );
}
