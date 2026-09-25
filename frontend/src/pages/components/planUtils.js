// Күнді жергілікті уақыт бойынша YYYY-MM-DD түрінде (toISOString UTC-ке ауыстырып, күнді жылжытады)
export const toDateString = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const parseDate = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
};

// Сервердегі есеппен бірдей: апта = 7 күн, ай = бір ай минус бір күн
export const getEndDate = (startStr, planType) => {
  const start = parseDate(startStr);
  const end = planType === 'weekly'
    ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
    : new Date(start.getFullYear(), start.getMonth() + 1, start.getDate() - 1);
  return toDateString(end);
};

// Келесі дүйсенбі (апталық жоспар үшін), немесе келесі айдың 1-і (айлық үшін)
export const defaultStartDate = (planType) => {
  const today = new Date();
  if (planType === 'monthly') {
    return toDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  }
  const diff = (8 - today.getDay()) % 7;
  return toDateString(new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff));
};

export const formatDay = (str) =>
  parseDate(str).toLocaleDateString('kk-KZ', { weekday: 'short', day: 'numeric', month: 'long' });

export const formatRange = (start, end) =>
  `${parseDate(start).toLocaleDateString('kk-KZ', { day: 'numeric', month: 'long' })} — ${
    parseDate(end).toLocaleDateString('kk-KZ', { day: 'numeric', month: 'long', year: 'numeric' })}`;

export const PLAN_TYPE_LABELS = {
  weekly: '📆 Апталық',
  monthly: '🗓️ Айлық'
};

// Тапсырмаларды күн бойынша топтау
export const groupByDate = (tasks) =>
  tasks.reduce((acc, task) => {
    (acc[task.task_date] = acc[task.task_date] || []).push(task);
    return acc;
  }, {});
