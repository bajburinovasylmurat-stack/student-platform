import React, { useState } from 'react';
import { LuMoon, LuSun } from 'react-icons/lu';

const KEY = 'juzup-theme';

// Сақталған тақырыпты бет ашылғанда бірден қолдану (index.js шақырады)
export const applySavedTheme = () => {
  let theme = 'light';
  try { theme = localStorage.getItem(KEY) || 'light'; } catch { /* жеке режим */ }
  document.documentElement.dataset.theme = theme;
  return theme;
};

// Ашық / қараңғы тақырыпты ауыстыратын батырма
export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => document.documentElement.dataset.theme || 'light');

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem(KEY, next); } catch { /* сақталмаса да осы сеанста жұмыс істейді */ }
    setTheme(next);
  };

  const label = theme === 'dark' ? 'Ашық тақырыпқа ауысу' : 'Қараңғы тақырыпқа ауысу';
  return (
    <button type="button" className="theme-toggle" onClick={toggle} title={label} aria-label={label}>
      {theme === 'dark' ? <LuSun /> : <LuMoon />}
    </button>
  );
}
