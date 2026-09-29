import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API } from '../../api';
import { youtubeId } from '../../utils/youtube';
import { LuExternalLink, LuX } from 'react-icons/lu';

const BUCKETS = 100; // видео 100 бөлікке бөлінеді, әр көрілген бөлік = 1%

// YouTube IFrame API бір рет жүктеледі
let apiPromise = null;
const loadYoutubeApi = () => {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previous?.();
        resolve(window.YT);
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(script);
    });
  }
  return apiPromise;
};

// Бет жабылып жатса да жіберілуі үшін keepalive
const sendProgress = (examId, watched, position) =>
  fetch(`${API}/api/examinations/${examId}/progress`, {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
    body: JSON.stringify({ watched, position })
  }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

// Видео ойнатқыш: шын көрілген бөліктерді санайды (айналдырып жіберу 100% бермейді)
export default function VideoPlayer({ exam, startAt = 0, initialProgress = 0, onProgress, onClose }) {
  const holderRef = useRef(null);
  const bucketsRef = useRef(new Array(BUCKETS).fill(false));
  const dirtyRef = useRef(false);
  const positionRef = useRef(startAt);
  const [progress, setProgress] = useState(initialProgress);
  const id = youtubeId(exam.youtube_url);

  useEffect(() => {
    let player;
    let sampler;
    let saver;
    let cancelled = false;

    const flush = async () => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      const watched = bucketsRef.current.map((b) => (b ? '1' : '0')).join('');
      const result = await sendProgress(exam.id, watched, positionRef.current);
      if (result) {
        setProgress(result.progress);
        onProgress?.(exam.id, result);
      }
    };

    loadYoutubeApi().then((YT) => {
      if (cancelled || !holderRef.current) return;
      player = new YT.Player(holderRef.current, {
        videoId: id,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 1, rel: 0, start: Math.floor(startAt), playsinline: 1 },
        events: {
          onReady: (e) => e.target.playVideo()
        }
      });

      // Секунд сайын: ойнап тұрса, қазіргі бөлікті көрілді деп белгілейміз
      sampler = setInterval(() => {
        if (!player?.getPlayerState || player.getPlayerState() !== YT.PlayerState.PLAYING) return;
        const duration = player.getDuration();
        const time = player.getCurrentTime();
        if (!duration) return;
        positionRef.current = time;
        const bucket = Math.min(BUCKETS - 1, Math.floor((time / duration) * BUCKETS));
        if (!bucketsRef.current[bucket]) {
          bucketsRef.current[bucket] = true;
          dirtyRef.current = true;
        }
      }, 1000);
      saver = setInterval(flush, 10000);
    });

    const onHide = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onHide);

    return () => {
      cancelled = true;
      clearInterval(sampler);
      clearInterval(saver);
      document.removeEventListener('visibilitychange', onHide);
      if (player?.getCurrentTime) {
        positionRef.current = player.getCurrentTime();
        dirtyRef.current = true;
      }
      flush();
      player?.destroy?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exam.id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // body-ге шығарамыз: контент бөлігіндегі анимация (transform) fixed терезені өзіне қамап тастайды
  return createPortal(
    <div className="video-modal" onClick={onClose} role="dialog" aria-label={exam.title}>
      <div className="video-box" onClick={(e) => e.stopPropagation()}>
        <div className="video-head">
          <strong>{exam.title}</strong>
          <button className="icon-close light" onClick={onClose} aria-label="Жабу"><LuX /></button>
        </div>
        <div className="video-frame">
          <div ref={holderRef} />
        </div>
        <div className="video-foot">
          <span className="watch-progress">
            <span className="watch-track"><span style={{ width: `${progress}%` }} /></span>
            {progress}% көрілді
          </span>
          <a href={exam.youtube_url} target="_blank" rel="noopener noreferrer" className="link-light">
            YouTube-та ашу <LuExternalLink />
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
