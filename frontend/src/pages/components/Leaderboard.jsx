import React, { useState, useEffect } from 'react';
import '../styles/Features.css';
import { api } from '../../api';
import { LuMedal, LuTrophy } from 'react-icons/lu';

// Алғашқы үш орынға медаль иконкасы (алтын, күміс, қола түсі CSS-те)
const medal = (rank) => (rank <= 3 ? <LuMedal className={`medal medal-${rank}`} /> : rank);

// Апталық рейтинг: орындалған тапсырма = 1 ұпай, тест = жинаған балы
export default function Leaderboard() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get('/api/leaderboard').then(setData).catch(() => setData({ top: [], me: {}, groups: [] }));
  }, []);

  if (!data) return <div className="loading">Жүктелуде...</div>;

  return (
    <div className="feature-page">
      <h2><LuTrophy /> Апта рейтингі</h2>
      <p className="muted-text">Дүйсенбіден бастап: орындалған әр тапсырма — 1 ұпай, тесттен жинаған әр балл — 1 ұпай</p>

      {data.me?.rank ? (
        <div className="my-rank">
          Сен <b>{data.me.rank}-орындасың</b> · {data.me.points} ұпай
          <span className="muted-text"> ({data.me.total} қатысушы)</span>
        </div>
      ) : (
        <div className="my-rank muted">Бұл аптада әлі ұпайың жоқ. Бір тапсырма орындасаң, рейтингке кіресің!</div>
      )}

      <div className="leaderboard-grid">
        <section>
          <h3>Оқушылар</h3>
          {data.top.length === 0 ? <p className="empty-state">Бұл аптада әлі ешкім ұпай жинамады</p> : (
            <ol className="leader-list">
              {data.top.map((r) => (
                <li key={r.rank} className={`${r.is_me ? 'me' : ''} ${r.rank <= 3 ? 'podium' : ''}`}>
                  <span className="rank">{medal(r.rank)}</span>
                  <span className="grow">{r.name}{r.is_me && ' (сен)'}</span>
                  <b>{r.points}</b>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section>
          <h3>Куратор топтары</h3>
          <p className="muted-text small">Оқушы басына орташа ұпай</p>
          {data.groups.length === 0 ? <p className="empty-state">Әзірге дерек жоқ</p> : (
            <ol className="leader-list">
              {data.groups.map((g, i) => (
                <li key={g.curator_name} className={i < 3 ? 'podium' : ''}>
                  <span className="rank">{medal(i + 1)}</span>
                  <span className="grow">
                    {g.curator_name}
                    <span className="muted-text small"> · {g.active}/{g.students} белсенді</span>
                  </span>
                  <b>{g.avg}</b>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
