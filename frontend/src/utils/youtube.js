// YouTube сілтемесінің кез келген түрінен видео ID-ін алу (сервердегі youtubeId-мен бірдей):
// watch?v=, youtu.be/, live/, shorts/, embed/, m.youtube.com, music.youtube.com
export const youtubeId = (url) => {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.replace(/^(www|m|music)\./, '');
    let id = null;
    if (host === 'youtu.be') {
      id = u.pathname.split('/')[1];
    } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
      id = u.searchParams.get('v') || u.pathname.match(/^\/(?:live|shorts|embed|v)\/([^/?#]+)/)?.[1];
    }
    return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
  } catch {
    return null;
  }
};

export const youtubeThumbnail = (id, quality = 'maxresdefault') =>
  `https://img.youtube.com/vi/${id}/${quality}.jpg`;
