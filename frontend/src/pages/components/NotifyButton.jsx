import React, { useState, useEffect, useRef } from 'react';
import '../styles/Features.css';
import { api, errorText } from '../../api';
import { LuBell, LuBellOff, LuMegaphone, LuMoon, LuSend, LuSun, LuTarget } from 'react-icons/lu';

// Жоғарғы панельдегі қоңырау батырмасы: Telegram ескертулерін байланыстыру және қосу/өшіру
export default function NotifyButton() {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef(null);

  const load = () => api.get('/api/notifications/status').then(setStatus).catch(() => {});
  useEffect(() => { load(); }, []);

  // Сыртқа басқанда жабылады
  useEffect(() => {
    if (!open) return;
    const onClick = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  // Telegram-нан қайтқанда күйін жаңарту
  useEffect(() => {
    const onFocus = () => open && load();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open]);

  const link = async () => {
    setBusy(true);
    try {
      const { bot_url } = await api.post('/api/notifications/link');
      window.open(bot_url, '_blank', 'noopener');
    } catch (error) {
      alert(errorText(error, 'Байланыстыру сәтсіз'));
    } finally {
      setBusy(false);
    }
  };

  const toggle = async () => {
    setBusy(true);
    try {
      const result = await api.patch('/api/notifications', { enabled: !status.notify_enabled });
      setStatus({ ...status, ...result });
    } catch (error) {
      alert(errorText(error, 'Өзгерту сәтсіз'));
    } finally {
      setBusy(false);
    }
  };

  if (!status?.available) return null;
  const active = status.linked && status.notify_enabled;

  return (
    <div className="notify-wrap" ref={boxRef}>
      <button
        className={`notify-btn ${active ? 'on' : ''}`}
        onClick={() => { setOpen(!open); if (!open) load(); }}
        title="Telegram ескертулері"
        aria-label="Telegram ескертулері"
      >
        {active ? <LuBell /> : <LuBellOff />}
        {!status.linked && <span className="notify-dot" />}
      </button>

      {open && (
        <div className="notify-pop">
          <strong>Telegram ескертулері</strong>
          <ul>
            <li><LuSun /> Таңертең — бүгінгі жоспар</li>
            <li><LuMoon /> Кешке — орындалмаған тапсырмалар</li>
            <li><LuTarget /> Куратор жаңа жоспар құрғанда</li>
            <li><LuMegaphone /> Маңызды хабарландырулар</li>
          </ul>
          {!status.linked ? (
            <>
              <p className="muted-text small">Ботты ашып, <b>Start</b> басыңыз. Сосын осы бетке оралыңыз.</p>
              <button className="primary-btn wide" disabled={busy} onClick={link}><LuSend /> Telegram-ды қосу</button>
            </>
          ) : (
            <label className="switch-row">
              <span>{status.notify_enabled ? 'Қосулы' : 'Өшірулі'}</span>
              <input type="checkbox" checked={status.notify_enabled} disabled={busy} onChange={toggle} />
              <span className="switch" />
            </label>
          )}
        </div>
      )}
    </div>
  );
}
