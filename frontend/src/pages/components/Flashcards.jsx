import React, { useState, useEffect, useMemo } from 'react';
import '../styles/Features.css';
import { api, currentUserId } from '../../api';
import { LuArrowLeft, LuArrowRight, LuBrain, LuCheck, LuPartyPopper, LuRotateCcw } from 'react-icons/lu';

// Формула карточкалары: аударып жаттау, «білемін» белгісі осы құрылғыда сақталады
export default function Flashcards() {
  const [cards, setCards] = useState(null);
  const [topic, setTopic] = useState('all');
  const [onlyUnknown, setOnlyUnknown] = useState(false);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const storageKey = `flashcards-known-${currentUserId()}`;
  const [known, setKnown] = useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(storageKey)) || []);
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    api.get('/api/flashcards').then(setCards).catch(() => setCards([]));
  }, []);

  const topics = useMemo(() => [...new Set((cards || []).map((c) => c.topic || 'Жалпы'))], [cards]);
  const deck = useMemo(() => (cards || []).filter((c) =>
    (topic === 'all' || (c.topic || 'Жалпы') === topic) && (!onlyUnknown || !known.has(c.id))
  ), [cards, topic, onlyUnknown, known]);

  useEffect(() => { setIndex(0); setFlipped(false); }, [topic, onlyUnknown]);

  const saveKnown = (next) => {
    setKnown(next);
    try { localStorage.setItem(storageKey, JSON.stringify([...next])); } catch { /* жеке терезе */ }
  };

  const go = (delta) => {
    setFlipped(false);
    setTimeout(() => setIndex((i) => (deck.length ? (i + delta + deck.length) % deck.length : 0)), 150);
  };

  const mark = (isKnown) => {
    const card = deck[index];
    const next = new Set(known);
    if (isKnown) next.add(card.id); else next.delete(card.id);
    saveKnown(next);
    if (!onlyUnknown || !isKnown) go(1);
    else setFlipped(false);
  };

  // Пернетақта: бос орын — аудару, көрсеткілер — ауыстыру
  useEffect(() => {
    const onKey = (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || !deck.length) return;
      if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!cards) return <div className="loading">Жүктелуде...</div>;
  if (cards.length === 0) {
    return (
      <div className="feature-page">
        <h2><LuBrain /> Формула карточкалары</h2>
        <p className="empty-state">Әзірге карточка қосылмаған</p>
      </div>
    );
  }

  const card = deck[index];
  const knownCount = cards.filter((c) => known.has(c.id)).length;

  return (
    <div className="feature-page">
      <h2><LuBrain /> Формула карточкалары</h2>

      <div className="cards-toolbar">
        <div className="chip-row">
          <button className={topic === 'all' ? 'chip active' : 'chip'} onClick={() => setTopic('all')}>Барлығы</button>
          {topics.map((t) => (
            <button key={t} className={topic === t ? 'chip active' : 'chip'} onClick={() => setTopic(t)}>{t}</button>
          ))}
        </div>
        <label className="toggle-label">
          <input type="checkbox" checked={onlyUnknown} onChange={(e) => setOnlyUnknown(e.target.checked)} />
          Тек жаттамағандарым
        </label>
      </div>

      <div className="cards-progress">
        <div className="progress-track"><div style={{ width: `${(knownCount / cards.length) * 100}%` }} /></div>
        <span>{knownCount}/{cards.length} жатталды</span>
      </div>

      {!card ? (
        <p className="empty-state"><LuPartyPopper /> Бұл бөлімдегі барлық карточканы жаттадыңыз!</p>
      ) : (
        <>
          <div className="flashcard-stage">
            <button
              className={`flashcard ${flipped ? 'flipped' : ''}`}
              onClick={() => setFlipped(!flipped)}
              aria-label="Карточканы аудару"
            >
              <div className="flashcard-inner">
                <div className="flashcard-face front">
                  {card.topic && <span className="card-topic">{card.topic}</span>}
                  <div className="card-text">{card.front}</div>
                  <span className="card-hint">Аудару үшін басыңыз</span>
                </div>
                <div className="flashcard-face back">
                  <div className="card-text">{card.back}</div>
                  {known.has(card.id) && <span className="card-known"><LuCheck /> Жатталған</span>}
                </div>
              </div>
            </button>
          </div>

          <div className="card-controls">
            <button className="secondary-btn" onClick={() => go(-1)} aria-label="Алдыңғы"><LuArrowLeft /></button>
            <span className="muted-text">{index + 1} / {deck.length}</span>
            <button className="secondary-btn" onClick={() => go(1)} aria-label="Келесі"><LuArrowRight /></button>
          </div>
          <div className="card-controls">
            <button className="secondary-btn" onClick={() => mark(false)}><LuRotateCcw /> Қайталау керек</button>
            <button className="primary-btn" onClick={() => mark(true)}><LuCheck /> Білемін</button>
          </div>
        </>
      )}
    </div>
  );
}
