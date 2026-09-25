import axios from 'axios';

const API = 'https://student-platform-backend-h9zs.onrender.com';

const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

// Жоспар мен Бүгінгі тапсырмалар бір кестеде сақталады, сондықтан API ортақ
export const fetchPlansForDate = async (date) =>
  (await axios.get(`${API}/api/plans/${date}`, auth())).data;

export const fetchPlansForMonth = async (year, month) =>
  (await axios.get(`${API}/api/plans-month/${year}/${month}`, auth())).data;

export const createPlan = async (plan) =>
  (await axios.post(`${API}/api/plans`, plan, auth())).data;

export const updatePlan = async (id, changes) =>
  (await axios.patch(`${API}/api/plans/${id}`, changes, auth())).data;

export const deletePlan = async (id) =>
  axios.delete(`${API}/api/plans/${id}`, auth());

// Уақыты бар тапсырмалар алдымен, уақыт бойынша
export const sortPlans = (plans) =>
  [...plans].sort((a, b) => {
    if (!a.task_time && !b.task_time) return a.id - b.id;
    if (!a.task_time) return 1;
    if (!b.task_time) return -1;
    return a.task_time.localeCompare(b.task_time) || a.id - b.id;
  });
