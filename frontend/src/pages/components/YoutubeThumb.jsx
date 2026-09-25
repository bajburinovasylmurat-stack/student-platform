import React, { useState } from 'react';
import { youtubeId, youtubeThumbnail } from '../../utils/youtube';
import '../styles/YoutubeThumb.css';

// Видео афишасы: үлкен сурет жоқ болса, hqdefault-қа ауысады (ол әр видеода бар)
export function YoutubeThumb({ url, fallbackSrc, alt, className }) {
  const id = youtubeId(url);
  const [quality, setQuality] = useState('maxresdefault');
  const src = id ? youtubeThumbnail(id, quality) : fallbackSrc;
  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => { if (id && quality !== 'hqdefault') setQuality('hqdefault'); }}
    />
  );
}

// Формадағы алдын ала көрініс: сілтемені қойған бойда афиша шығады
export function YoutubePreview({ url }) {
  if (!url?.trim()) return null;
  const id = youtubeId(url);

  if (!id) {
    return <div className="yt-preview invalid">⚠️ YouTube сілтемесі танылмады. Видеоның сілтемесін толық көшіріп қойыңыз.</div>;
  }

  return (
    <div className="yt-preview" key={id}>
      <YoutubeThumb url={url} alt="Видео афишасы" className="yt-preview-img" />
      <span className="yt-preview-ok">✓ Видео табылды, афиша осылай көрінеді</span>
    </div>
  );
}
