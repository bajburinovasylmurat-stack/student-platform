import React, { useState, useEffect } from 'react';
import '../styles/Features.css';
import { api } from '../../api';
import { formatKkDate } from '../../utils/kkDate';
import { LuAlertTriangle, LuBarChart3, LuChevronDown, LuChevronUp } from 'react-icons/lu';

const SORTS = {
  risk: (a, b) => Number(b.at_risk) - Number(a.at_risk) || (a.percent_week ?? 101) - (b.percent_week ?? 101),
  percent: (a, b) => (b.percent_week ?? -1) - (a.percent_week ?? -1),
  name: (a, b) => a.name.localeCompare(b.name)
};

// Куратор: оқушылардың апталық орындау көрсеткіші, артта қалғандар белгіленеді
export default function CuratorAnalytics({ refreshKey }) {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState('risk');
  const [open, setOpen] = useState(true);

  useEffect(() => {
    api.get('/api/curator/analytics').then(setRows).catch(() => setRows([]));
  }, [refreshKey]);

  if (!rows || rows.length === 0) return null;
  const atRisk = rows.filter((r) => r.at_risk).length;
  const withPlans = rows.filter((r) => r.percent_week !== null);
  const avg = withPlans.length
    ? Math.round(withPlans.reduce((s, r) => s + r.percent_week, 0) / withPlans.length)
    : null;

  return (
    <section className="analytics">
      <button className="analytics-head" onClick={() => setOpen(!open)}>
        <strong><LuBarChart3 /> Аналитика</strong>
        <span className="analytics-kpis">
          <span>Апта орташасы: <b>{avg === null ? '—' : `${avg}%`}</b></span>
          <span className={atRisk ? 'risk' : ''}><LuAlertTriangle className="risk-icon" /> Артта қалған: <b>{atRisk}</b></span>
        </span>
        <span className="chevron-small">{open ? <LuChevronUp /> : <LuChevronDown />}</span>
      </button>

      {open && (
        <>
          <div className="chip-row">
            <span className="muted-text small">Сұрыптау:</span>
            <button className={sort === 'risk' ? 'chip active' : 'chip'} onClick={() => setSort('risk')}>Алдымен артта қалғандар</button>
            <button className={sort === 'percent' ? 'chip active' : 'chip'} onClick={() => setSort('percent')}>Пайыз бойынша</button>
            <button className={sort === 'name' ? 'chip active' : 'chip'} onClick={() => setSort('name')}>Аты бойынша</button>
          </div>
          <div className="analytics-table" role="table">
            <div className="at-row at-head" role="row">
              <span>Оқушы</span><span>Бүгін</span><span>7 күн</span><span>Мерзімі өткен</span><span>Соңғы белсенділік</span>
            </div>
            {[...rows].sort(SORTS[sort]).map((r) => (
              <div key={r.id} className={`at-row ${r.at_risk ? 'at-risk' : ''}`} role="row">
                <span className="at-name">{r.at_risk && <LuAlertTriangle className="risk-icon" />} {r.name}</span>
                <span>{r.due_today ? `${r.done_today}/${r.due_today}` : '—'}</span>
                <span>
                  {r.percent_week === null ? '—' : (
                    <span className="mini-bar" title={`${r.done_week}/${r.due_week}`}>
                      <span style={{ width: `${r.percent_week}%` }} className={r.percent_week >= 70 ? 'good' : r.percent_week >= 40 ? 'mid' : 'low'} />
                      <em>{r.percent_week}%</em>
                    </span>
                  )}
                </span>
                <span className={r.overdue ? 'overdue' : ''}>{r.overdue || '—'}</span>
                <span className="muted-text">{r.last_done_at ? formatKkDate(new Date(r.last_done_at)) : 'әлі жоқ'}</span>
              </div>
            ))}
          </div>
          <p className="muted-text small"><LuAlertTriangle className="risk-icon" /> — соңғы 3 күнде тапсырмасы болса да, ештеңе орындамаған оқушылар</p>
        </>
      )}
    </section>
  );
}
