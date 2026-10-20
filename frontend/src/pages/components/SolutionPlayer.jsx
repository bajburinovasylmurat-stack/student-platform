import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LuExternalLink, LuX } from 'react-icons/lu';
import { youtubeId } from '../../utils/youtube';

// Сілтемедегі уақыт (t=1234s, t=1234, t=20m34s) секундқа
const startSeconds = (url) => {
  const t = new URL(url).searchParams.get('t') || '';
  if (/^\d+s?$/.test(t)) return parseInt(t, 10);
  const m = t.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  return m ? (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0) : 0;
};

// Есептің шығарылу жолы сайттың ішінде ойнайды: телефонда YouTube қосымшасы
// бұрын ашылған видеоны ескі жерінен жалғастырып, жаңа уақытты елемейтін
export default function SolutionPlayer({ url, title, onClose }) {
  const id = youtubeId(url);
  const start = startSeconds(url);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!id) return null;
  const src = `https://www.youtube-nocookie.com/embed/${id}?start=${start}&autoplay=1&playsinline=1&rel=0`;

  return createPortal(
    <div className="video-modal" onClick={onClose} role="dialog" aria-label={title}>
      <div className="video-box" onClick={(e) => e.stopPropagation()}>
        <div className="video-head">
          <strong>{title}</strong>
          <button className="icon-close light" onClick={onClose} aria-label="Жабу"><LuX /></button>
        </div>
        <div className="video-frame">
          {/* key: басқа есепке ауысқанда ойнатқыш жаңа уақыттан қайта жүктеледі */}
          <iframe
            key={src}
            src={src}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        </div>
        <div className="video-foot">
          <span />
          <a href={url} target="_blank" rel="noopener noreferrer" className="link-light">
            YouTube-та ашу <LuExternalLink />
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
