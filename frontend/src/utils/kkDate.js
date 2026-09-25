// Көп браузерде қазақ тілінің күн форматы жоқ (Chrome "M09 25, Fri" шығарады),
// сондықтан атауларды өзіміз береміз
const MONTHS = [
  'қаңтар', 'ақпан', 'наурыз', 'сәуір', 'мамыр', 'маусым',
  'шілде', 'тамыз', 'қыркүйек', 'қазан', 'қараша', 'желтоқсан'
];
const WEEKDAYS = ['жексенбі', 'дүйсенбі', 'сейсенбі', 'сәрсенбі', 'бейсенбі', 'жұма', 'сенбі'];
const WEEKDAYS_SHORT = ['жс', 'дс', 'сс', 'ср', 'бс', 'жм', 'сб'];

// react-calendar үшін қазақша атаулар
export const calendarFormatters = {
  formatShortWeekday: (locale, date) => WEEKDAYS_SHORT[date.getDay()],
  formatMonthYear: (locale, date) => `${capitalize(MONTHS[date.getMonth()])} ${date.getFullYear()}`,
  formatMonth: (locale, date) => capitalize(MONTHS[date.getMonth()])
};

export const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// formatKkDate(date, { weekday: 'long' | 'short', year: true })
// -> "жұма, 25 қыркүйек 2026"
export const formatKkDate = (date, { weekday, year } = {}) => {
  let out = `${date.getDate()} ${MONTHS[date.getMonth()]}`;
  if (year) out += ` ${date.getFullYear()}`;
  if (weekday === 'long') out = `${WEEKDAYS[date.getDay()]}, ${out}`;
  if (weekday === 'short') out = `${WEEKDAYS_SHORT[date.getDay()]}, ${out}`;
  return out;
};
