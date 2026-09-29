import axios from 'axios';

export const API = 'https://student-platform-backend-h9zs.onrender.com';

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
