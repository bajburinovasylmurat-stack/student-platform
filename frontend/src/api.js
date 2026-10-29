import axios from 'axios';

// Render-де сайт (статикалық) пен API бөлек сервистер; басқа хостингте бір доменде
const RENDER_API = 'https://student-platform-backend-h9zs.onrender.com';
export const API = process.env.REACT_APP_API_URL
  || (window.location.hostname.endsWith('.onrender.com') ? RENDER_API : '');

// Кіру мерзімі біткенде немесе аккаунт өшірілгенде сервер 401 қайтарады:
// бос беттерді көрсетіп отырмай, бірден кіру бетіне шығарамыз
axios.interceptors.response.use(undefined, (error) => {
  const hasToken = Boolean(localStorage.getItem('token'));
  if (error.response?.status === 401 && hasToken && !String(error.config?.url || '').includes('/api/auth/')) {
    localStorage.removeItem('token');
    localStorage.removeItem('student');
    window.location.reload();
  }
  return Promise.reject(error);
});

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

// Жаңа беттер үшін қысқа көмекшілер: жауаптың data бөлігін қайтарады
export const api = {
  get: async (path) => (await axios.get(`${API}${path}`, auth())).data,
  post: async (path, body = {}) => (await axios.post(`${API}${path}`, body, auth())).data,
  put: async (path, body = {}) => (await axios.put(`${API}${path}`, body, auth())).data,
  patch: async (path, body = {}) => (await axios.patch(`${API}${path}`, body, auth())).data,
  delete: async (path) => (await axios.delete(`${API}${path}`, auth())).data
};

export const errorText = (error, fallback) => error.response?.data?.error || fallback;

// Қазіргі қолданушының id-і (localStorage-тағы кілттерді бөлу үшін)
export const currentUserId = () => {
  try {
    return JSON.parse(localStorage.getItem('student'))?.id ?? 'anon';
  } catch {
    return 'anon';
  }
};
