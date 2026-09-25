import express from 'express';
import pg from 'pg';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

dotenv.config();

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORS және орта файлдарын орнату
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Құрылымдар
const uploadsDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Render тегін тарифінде диск әр deploy сайын тазаланады, сондықтан материалдар базада сақталады.
// Файл 2 МБ-тық бөліктермен жүктеледі: бір үлкен сұраныс Render-де үзіліп қалатын
const MAX_MATERIAL_MB = 200;
const MATERIAL_CATEGORIES = ['practice', 'formula'];
const CHUNK_BYTES = 2 * 1024 * 1024;

// PostgreSQL қосылуы
const { Pool } = pg;
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'student_platform',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

// Бос тұрған байланыс үзілсе (база қайта іске қосылса т.б.), сервер құламауы үшін
pool.on('error', (error) => console.error('PostgreSQL байланыс қатесі:', error.message));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

// ===== ТҮСІНІКТЕМЕ ФУНКЦИЯЛАРЫ =====

// ===== SMS РАСТАУ =====

const CODE_TTL_MIN = 15;         // код қанша минут жарамды (Mobizon модерациясы 10 минутқа дейін созылады)
const RESEND_SECONDS = 60;       // қайта жіберуге дейінгі күту
const MAX_ATTEMPTS = 5;          // бір кодты енгізу әрекеттері
const MAX_SENDS_PER_HOUR = 5;    // бір нөмірге сағатына SMS саны

// +7 (707) 123-45-67, 87071234567, 7071234567 -> 77071234567
const normalizePhone = (input) => {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits.length === 10) digits = '7' + digits;
  return /^7\d{10}$/.test(digits) ? digits : null;
};

const hashCode = (phone, code) =>
  crypto.createHmac('sha256', JWT_SECRET).update(`${phone}:${code}`).digest('hex');

const smsEnabled = () => Boolean(process.env.MOBIZON_API_KEY);

// Mobizon.kz арқылы SMS жіберу
const sendSms = async (phone, text) => {
  const domain = process.env.MOBIZON_API_DOMAIN || 'api.mobizon.kz';
  const body = new URLSearchParams({ recipient: phone, text });
  if (process.env.SMS_SENDER) body.append('from', process.env.SMS_SENDER);

  const response = await fetch(
    `https://${domain}/service/message/sendsmsmessage?output=json&api=v1&apiKey=${encodeURIComponent(process.env.MOBIZON_API_KEY)}`,
    { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body }
  );
  const data = await response.json().catch(() => ({}));
  if (data.code !== 0) {
    throw new Error(`Mobizon қатесі: ${data.code} ${data.message || response.status}`);
  }
};

// ===== TELEGRAM БОТ =====

const TG_API = process.env.TELEGRAM_API_BASE || 'https://api.telegram.org';
const telegramEnabled = () => Boolean(process.env.TELEGRAM_BOT_TOKEN);
// Webhook-ты тек Telegram шақыра алуы үшін құпия
const tgWebhookSecret = () =>
  crypto.createHmac('sha256', JWT_SECRET).update('telegram-webhook').digest('hex').slice(0, 48);

const tg = async (method, payload = {}) => {
  const response = await fetch(`${TG_API}/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!data.ok) throw new Error(`Telegram ${method} қатесі: ${data.description || response.status}`);
  return data.result;
};

let botUsername = process.env.TELEGRAM_BOT_USERNAME || null;
const getBotUsername = async () => {
  if (!botUsername) botUsername = (await tg('getMe')).username;
  return botUsername;
};

const SHARE_PHONE_KEYBOARD = {
  keyboard: [[{ text: '📱 Нөмірді жіберу', request_contact: true }]],
  resize_keyboard: true,
  one_time_keyboard: true
};

// Бот хабарларын өңдеу
const handleTelegramUpdate = async (update) => {
  const message = update.message;
  if (!message?.chat) return;
  const chatId = message.chat.id;

  // /start <token>: сайттан келді, нөмірді сұраймыз
  if (message.text?.startsWith('/start')) {
    const token = message.text.split(' ')[1];
    if (!token) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: 'Сәлем! 👋 Бұл JUZ40 Online Edu платформасының боты.\nТіркелу үшін сайтта «Код алу» батырмасын басыңыз.'
      });
      return;
    }

    const found = await pool.query(`
      UPDATE phone_verifications SET tg_chat_id = $2
      WHERE tg_token = $1 AND used = FALSE AND expires_at > NOW()
      RETURNING id
    `, [token, chatId]);

    if (found.rows.length === 0) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: '⏰ Сілтеменің мерзімі өтті. Сайтқа оралып, кодты қайта сұраңыз.'
      });
      return;
    }

    await tg('sendMessage', {
      chat_id: chatId,
      text: 'Тіркелуді растау үшін төмендегі «📱 Нөмірді жіберу» батырмасын басыңыз.',
      reply_markup: SHARE_PHONE_KEYBOARD
    });
    return;
  }

  // Контакт жіберілді: нөмір сайтта жазылғанмен бірдей ме?
  if (message.contact) {
    // Басқа адамның контактісін жіберсе, қабылдамаймыз
    if (message.contact.user_id !== message.from?.id) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: '❌ Өз нөміріңізді «📱 Нөмірді жіберу» батырмасы арқылы жіберіңіз.',
        reply_markup: SHARE_PHONE_KEYBOARD
      });
      return;
    }

    const phone = normalizePhone(message.contact.phone_number);
    const pending = await pool.query(`
      SELECT id, phone, purpose FROM phone_verifications
      WHERE tg_chat_id = $1 AND channel = 'telegram' AND used = FALSE AND expires_at > NOW()
      ORDER BY created_at DESC LIMIT 1
    `, [chatId]);
    const v = pending.rows[0];

    if (!v) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: '⏰ Сұраныс табылмады немесе мерзімі өтті. Сайтта кодты қайта сұраңыз.',
        reply_markup: { remove_keyboard: true }
      });
      return;
    }

    if (phone !== v.phone) {
      await tg('sendMessage', {
        chat_id: chatId,
        text: `❌ Бұл Telegram аккаунты басқа нөмірге тіркелген.\nСайтта Telegram-ға тіркелген нөміріңізді жазыңыз.`,
        reply_markup: { remove_keyboard: true }
      });
      return;
    }

    const code = String(crypto.randomInt(100000, 1000000));
    await pool.query(
      'UPDATE phone_verifications SET code_hash = $1, attempts = 0 WHERE id = $2',
      [hashCode(v.phone, code), v.id]
    );
    await tg('sendMessage', {
      chat_id: chatId,
      text: `✅ Нөмір расталды!\n\nJUZ40 ${PURPOSE_TEXT[v.purpose] || PURPOSE_TEXT.register}: <b>${code}</b>\n\nКодты сайтқа енгізіңіз. Ешкімге айтпаңыз.`,
      parse_mode: 'HTML',
      reply_markup: { remove_keyboard: true }
    });
    return;
  }

  await tg('sendMessage', {
    chat_id: chatId,
    text: 'Тіркелу үшін сайтта «Код алу» батырмасын басып, берілген сілтеме арқылы келіңіз.'
  });
};

app.post('/api/telegram/webhook', (req, res) => {
  if (req.get('X-Telegram-Bot-Api-Secret-Token') !== tgWebhookSecret()) {
    return res.sendStatus(401);
  }
  res.sendStatus(200);
  handleTelegramUpdate(req.body).catch((error) => console.error('Telegram өңдеу қатесі:', error));
});

// Render-де сайттың жария адресі бар: webhook орнатамыз. Жергілікті ортада long polling
const startTelegramBot = async () => {
  if (!telegramEnabled()) return;
  const publicUrl = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;

  if (publicUrl) {
    await tg('setWebhook', {
      url: `${publicUrl.replace(/\/$/, '')}/api/telegram/webhook`,
      secret_token: tgWebhookSecret(),
      allowed_updates: ['message']
    });
    console.log(`🤖 Telegram бот @${await getBotUsername()} webhook арқылы қосылды`);
    return;
  }

  console.log(`🤖 Telegram бот @${await getBotUsername()} polling режимінде`);
  let offset = 0;
  for (;;) {
    try {
      const updates = await tg('getUpdates', { offset, timeout: 30, allowed_updates: ['message'] });
      for (const update of updates) {
        offset = update.update_id + 1;
        await handleTelegramUpdate(update).catch((error) => console.error('Telegram өңдеу қатесі:', error));
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

const PURPOSE_TEXT = {
  register: 'тіркелу коды',
  reset: 'құпиясөзді қалпына келтіру коды'
};

// Растау кодын тексеру (тіркелу және құпиясөзді қалпына келтіру үшін ортақ)
const checkCode = async (phone, code, purpose) => {
  const verification = await pool.query(`
    SELECT id, code_hash, attempts, expires_at < NOW() AS expired, used
    FROM phone_verifications WHERE phone = $1 AND purpose = $2
    ORDER BY created_at DESC LIMIT 1
  `, [phone, purpose]);
  const v = verification.rows[0];

  if (!v || v.used) return { error: 'Алдымен код алыңыз' };
  if (v.expired) return { error: 'Кодтың мерзімі өтті. Жаңа код алыңыз' };
  if (v.attempts >= MAX_ATTEMPTS) return { error: 'Тым көп қате әрекет. Жаңа код алыңыз' };

  const expected = Buffer.from(v.code_hash, 'hex');
  const actual = Buffer.from(hashCode(phone, String(code).trim()), 'hex');
  if (!crypto.timingSafeEqual(expected, actual)) {
    await pool.query('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1', [v.id]);
    return { error: `Код қате. Қалған әрекет: ${MAX_ATTEMPTS - v.attempts - 1}` };
  }
  return { id: v.id };
};

// Растау кодын жіберу: purpose = 'register' (тіркелу) немесе 'reset' (құпиясөзді қалпына келтіру)
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    const purpose = req.body.purpose === 'reset' ? 'reset' : 'register';
    if (!phone) {
      return res.status(400).json({ error: 'Телефон нөмірі қате. Мысалы: +7 707 123 45 67' });
    }

    const existing = await pool.query(
      'SELECT id FROM students WHERE phone = $1 OR student_number = $1',
      [phone]
    );
    if (purpose === 'register' && existing.rows.length > 0) {
      return res.status(400).json({ error: 'Бұл нөмір бұрын тіркелген. Кіріңіз' });
    }
    if (purpose === 'reset' && existing.rows.length === 0) {
      return res.status(400).json({ error: 'Бұл нөмірмен тіркелген қолданушы жоқ' });
    }

    const recent = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS sends_last_hour,
        EXTRACT(EPOCH FROM (NOW() - MAX(created_at)))::int AS seconds_since_last
      FROM phone_verifications WHERE phone = $1
    `, [phone]);
    const { sends_last_hour, seconds_since_last } = recent.rows[0];

    if (seconds_since_last !== null && seconds_since_last < RESEND_SECONDS) {
      return res.status(429).json({
        error: `Қайта жіберу үшін ${RESEND_SECONDS - seconds_since_last} секунд күтіңіз`,
        retry_after: RESEND_SECONDS - seconds_since_last
      });
    }
    if (sends_last_hour >= MAX_SENDS_PER_HOUR) {
      return res.status(429).json({ error: 'Тым көп әрекет. Бір сағаттан кейін қайталаңыз' });
    }

    const code = String(crypto.randomInt(100000, 1000000));

    // Telegram: код бот нөмірді растағанда ғана жасалады, әзірге сілтеме токенін береміз
    if (telegramEnabled()) {
      const tgToken = crypto.randomBytes(16).toString('hex');
      await pool.query(
        `INSERT INTO phone_verifications (phone, code_hash, expires_at, channel, tg_token, purpose)
         VALUES ($1, $2, NOW() + INTERVAL '${CODE_TTL_MIN} minutes', 'telegram', $3, $4)`,
        [phone, hashCode(phone, crypto.randomBytes(16).toString('hex')), tgToken, purpose]
      );
      const username = await getBotUsername();
      return res.json({
        message: 'Telegram ботқа өтіңіз',
        channel: 'telegram',
        bot_url: `https://t.me/${username}?start=${tgToken}`,
        resend_after: RESEND_SECONDS
      });
    }

    await pool.query(
      `INSERT INTO phone_verifications (phone, code_hash, expires_at, purpose)
       VALUES ($1, $2, NOW() + INTERVAL '${CODE_TTL_MIN} minutes', $3)`,
      [phone, hashCode(phone, code), purpose]
    );

    if (smsEnabled()) {
      await sendSms(phone, `JUZ40: ${PURPOSE_TEXT[purpose]} ${code}. Кодты ешкімге айтпаңыз.`);
      return res.json({ message: 'Код жіберілді', resend_after: RESEND_SECONDS });
    }

    // SMS қызметі бапталмаған: тест режимі, код жауапта қайтарылады
    console.log(`📱 [ТЕСТ РЕЖИМІ] ${phone} коды: ${code}`);
    res.json({ message: 'Тест режимі: SMS жіберілмеді', resend_after: RESEND_SECONDS, dev_code: code });
  } catch (error) {
    console.error('Код жіберу қатесі:', error);
    res.status(502).json({ error: 'Код жіберу сәтсіз. Кейінірек қайталаңыз' });
  }
});

// Студент тіркеу (SMS кодымен)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { password, name, code } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!phone || !password || !name?.trim() || !code) {
      return res.status(400).json({ error: 'Барлық өрістерді толтырыңыз' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль кемінде 6 таңбадан тұруы керек' });
    }

    const v = await checkCode(phone, code, 'register');
    if (v.error) {
      return res.status(400).json({ error: v.error });
    }

    const existing = await pool.query(
      'SELECT id FROM students WHERE phone = $1 OR student_number = $1',
      [phone]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Бұл нөмір бұрын тіркелген' });
    }

    const password_hash = await bcrypt.hash(password, 10);

    // Телефон нөмірі логин ретінде де қолданылады
    const result = await pool.query(
      `INSERT INTO students (student_number, phone, password_hash, name, email, phone_verified)
       VALUES ($1, $1, $2, $3, NULL, TRUE) RETURNING id, student_number, name`,
      [phone, password_hash, name.trim()]
    );
    await pool.query('UPDATE phone_verifications SET used = TRUE WHERE id = $1', [v.id]);

    res.status(201).json({
      message: 'Тіркеу сәтті',
      student: result.rows[0]
    });
  } catch (error) {
    console.error('Тіркеу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Құпиясөзді қалпына келтіру (Telegram / SMS кодымен)
app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { password, code } = req.body;
    const phone = normalizePhone(req.body.phone);

    if (!phone || !password || !code) {
      return res.status(400).json({ error: 'Барлық өрістерді толтырыңыз' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Пароль кемінде 6 таңбадан тұруы керек' });
    }

    const v = await checkCode(phone, code, 'reset');
    if (v.error) {
      return res.status(400).json({ error: v.error });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `UPDATE students SET password_hash = $1, phone_verified = TRUE
       WHERE phone = $2 OR student_number = $2 RETURNING id`,
      [password_hash, phone]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Қолданушы табылмады' });
    }
    await pool.query('UPDATE phone_verifications SET used = TRUE WHERE id = $1', [v.id]);

    res.json({ message: 'Құпиясөз жаңартылды' });
  } catch (error) {
    console.error('Құпиясөзді қалпына келтіру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Кіру
app.post('/api/auth/login', async (req, res) => {
  try {
    const { student_number, password } = req.body;

    if (!student_number || !password) {
      return res.status(400).json({ error: 'Телефон нөмірі және пароль қажет' });
    }

    // Студентті табу (логин немесе телефон нөмірі кез келген форматта)
    const result = await pool.query(
      'SELECT * FROM students WHERE student_number = $1 OR phone = $2 ORDER BY (student_number = $1) DESC LIMIT 1',
      [student_number.trim(), normalizePhone(student_number) || '']
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Бұл нөмірмен тіркелген қолданушы жоқ' });
    }

    const student = result.rows[0];

    // Пароль тексеру
    const isPasswordValid = await bcrypt.compare(password, student.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Пароль қате' });
    }

    // JWT токен құру
    const token = jwt.sign(
      { id: student.id, student_number: student.student_number },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Кіру сәтті',
      token,
      student: {
        id: student.id,
        student_number: student.student_number,
        name: student.name,
        email: student.email,
        phone: student.phone,
        role: student.role || 'student'
      }
    });
  } catch (error) {
    console.error('Кіру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Токен тексеру middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Токен қажет' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.student = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Токен жарамсыз' });
  }
};

// ===== РӨЛДЕР =====

// Қолданушының рөлін базадан алу (рөл өзгеруі мүмкін, сондықтан токенге сенбейміз)
const getRole = async (userId) => {
  const result = await pool.query(
    'SELECT role, student_number FROM students WHERE id = $1',
    [userId]
  );
  const user = result.rows[0];
  if (!user) return null;
  if (user.student_number === 'admin') return 'admin';
  return user.role || 'student';
};

const requireRole = (...roles) => async (req, res, next) => {
  try {
    const role = await getRole(req.student.id);
    if (!roles.includes(role)) {
      return res.status(403).json({ error: 'Бұл әрекетке рұқсат жоқ' });
    }
    req.role = role;
    next();
  } catch (error) {
    console.error('Рөл тексеру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
};

// ===== МАТЕРИАЛДАР =====

// multer файл атауын latin1 деп оқиды, сондықтан кирилл атаулар "ÐÑ..." болып бұзылады
const fixFileName = (name) => {
  if (!name || !/[\u0080-\u00ff]/.test(name) || /[^\u0000-\u00ff]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('\ufffd') ? name : decoded;
};

// Материалдар сұрау
app.get('/api/materials', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, title, description, file_path, file_name, category, created_at FROM materials
       WHERE COALESCE(status, 'ready') = 'ready' ORDER BY created_at DESC`
    );
    // Бұрын бұзылып сақталған атауларды да дұрыс көрсету
    res.json(result.rows.map((m) => ({ ...m, file_name: fixFileName(m.file_name) })));
  } catch (error) {
    console.error('Материалдар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Материал қосу (админ), үш қадам:
// 1) POST /api/materials/uploads — жазба жасау; 2) PUT .../chunks/:index — бөліктер; 3) POST .../complete
app.post('/api/materials/uploads', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { title, description, file_name, file_mime, file_size } = req.body;
    const category = MATERIAL_CATEGORIES.includes(req.body.category) ? req.body.category : 'practice';
    const size = Number(file_size);
    if (!title?.trim() || !file_name || !size) {
      return res.status(400).json({ error: 'Файл және атау қажет' });
    }
    if (size > MAX_MATERIAL_MB * 1024 * 1024) {
      return res.status(413).json({ error: `Файл ${MAX_MATERIAL_MB} МБ-тан аспауы керек` });
    }

    // Аяқталмай қалған ескі жүктеулерді тазалау
    await pool.query(`DELETE FROM materials WHERE status = 'uploading' AND created_at < NOW() - INTERVAL '1 day'`);

    const result = await pool.query(
      `INSERT INTO materials (title, description, file_path, file_name, created_by, file_mime, file_size, status, category)
       VALUES ($1, $2, '', $3, $4, $5, $6, 'uploading', $7) RETURNING id`,
      [title.trim(), description || null, file_name, req.student.id, file_mime || 'application/octet-stream', size, category]
    );
    const id = result.rows[0].id;
    await pool.query('UPDATE materials SET file_path = $1 WHERE id = $2', [`/api/materials/${id}/file`, id]);

    res.status(201).json({ id, chunk_size: CHUNK_BYTES, chunks: Math.ceil(size / CHUNK_BYTES) });
  } catch (error) {
    console.error('Материал жүктеуді бастау қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі', detail: error.message });
  }
});

app.put(
  '/api/materials/uploads/:id/chunks/:index',
  verifyToken,
  requireRole('admin'),
  express.raw({ type: 'application/octet-stream', limit: CHUNK_BYTES + 1024 }),
  async (req, res) => {
    try {
      const index = Number(req.params.index);
      if (!Number.isInteger(index) || index < 0 || !Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'Бөлік қате' });
      }
      const result = await pool.query(
        `INSERT INTO material_chunks (material_id, idx, data)
         SELECT id, $2, $3 FROM materials WHERE id = $1 AND status = 'uploading'
         ON CONFLICT (material_id, idx) DO UPDATE SET data = EXCLUDED.data
         RETURNING idx`,
        [req.params.id, index, req.body]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Жүктеу табылмады' });
      }
      res.json({ ok: true });
    } catch (error) {
      console.error('Бөлік сақтау қатесі:', error);
      res.status(500).json({ error: 'Сервер қатесі', detail: error.message });
    }
  }
);

app.post('/api/materials/uploads/:id/complete', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const check = await pool.query(`
      SELECT m.file_size, COUNT(c.idx)::int AS chunks, COALESCE(SUM(octet_length(c.data)), 0)::bigint AS bytes
      FROM materials m LEFT JOIN material_chunks c ON c.material_id = m.id
      WHERE m.id = $1 AND m.status = 'uploading'
      GROUP BY m.id
    `, [req.params.id]);
    const c = check.rows[0];
    if (!c) {
      return res.status(404).json({ error: 'Жүктеу табылмады' });
    }
    if (Number(c.bytes) !== Number(c.file_size)) {
      return res.status(400).json({ error: `Файл толық жүктелмеді (${c.bytes} / ${c.file_size} байт)` });
    }

    const result = await pool.query(
      `UPDATE materials SET status = 'ready' WHERE id = $1
       RETURNING id, title, description, file_path, file_name, category, created_at`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Жүктеуді аяқтау қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі', detail: error.message });
  }
});

// Материал файлын жүктеу
app.get('/api/materials/:id/file', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT file_name, file_mime, file_size, file_data IS NOT NULL AS has_data,
              (SELECT COUNT(*) FROM material_chunks WHERE material_id = m.id)::int AS chunks
       FROM materials m WHERE id = $1 AND COALESCE(status, 'ready') = 'ready'`,
      [req.params.id]
    );
    const m = result.rows[0];
    if (!m || (!m.has_data && m.chunks === 0)) {
      return res.status(404).json({ error: 'Файл табылмады' });
    }
    const name = fixFileName(m.file_name) || 'material.pdf';
    const asciiName = name.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '');
    res.setHeader('Content-Type', m.file_mime || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(name)}`
    );

    // Бір сұраныспен сақталған ескі файл
    if (m.has_data) {
      const data = await pool.query('SELECT file_data FROM materials WHERE id = $1', [req.params.id]);
      return res.send(data.rows[0].file_data);
    }

    // Бөліктерді кезекпен жіберу: бүкіл файл жадқа оқылмайды
    if (m.file_size) res.setHeader('Content-Length', m.file_size);
    for (let i = 0; i < m.chunks; i++) {
      const chunk = await pool.query(
        'SELECT data FROM material_chunks WHERE material_id = $1 AND idx = $2',
        [req.params.id, i]
      );
      if (!chunk.rows[0]) break;
      if (!res.write(chunk.rows[0].data)) {
        await new Promise((resolve) => res.once('drain', resolve));
      }
    }
    res.end();
  } catch (error) {
    console.error('Файл жүктеу қатесі:', error);
    if (res.headersSent) return res.end();
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Материалдың бөлімін ауыстыру (админ): практика <-> формула
app.patch('/api/materials/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    if (!MATERIAL_CATEGORIES.includes(req.body.category)) {
      return res.status(400).json({ error: 'Бөлім қате' });
    }
    const result = await pool.query(
      'UPDATE materials SET category = $1 WHERE id = $2 RETURNING id, category',
      [req.body.category, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Материал табылмады' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Материал бөлімін өзгерту қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Материалды өшіру (админ)
app.delete('/api/materials/:id', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM materials WHERE id = $1 RETURNING file_path',
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Материал табылмады' });
    }

    // Ескі материалдардың файлы дискіде болса, оны да өшіреміз
    const filePath = result.rows[0].file_path;
    if (filePath?.startsWith('/uploads/')) {
      const fullPath = path.join(uploadsDir, path.basename(filePath));
      fs.promises.unlink(fullPath).catch(() => {});
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Материал өшіру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== НҰСҚА ТАЛДАУЛАР =====

// YouTube сілтемесінің кез келген түрінен видео ID-ін алу:
// watch?v=, youtu.be/, live/, shorts/, embed/, m.youtube.com, music.youtube.com
const youtubeId = (url) => {
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

const youtubeThumbnail = (id) => `https://img.youtube.com/vi/${id}/maxresdefault.jpg`;

// Барлық нұсқалар (афиша сілтемеден есептеледі, сондықтан бұрын қосылғандары да түзеледі)
app.get('/api/examinations', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM examinations ORDER BY category, created_at DESC'
    );
    res.json(result.rows.map((exam) => {
      const id = youtubeId(exam.youtube_url);
      return { ...exam, video_id: id, thumbnail_url: id ? youtubeThumbnail(id) : exam.thumbnail_url };
    }));
  } catch (error) {
    console.error('Нұсқалар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Нұсқа қосу (админ)
app.post('/api/examinations', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const { title, category, youtube_url, description } = req.body;

    const id = youtubeId(youtube_url);
    if (!title?.trim() || !id) {
      return res.status(400).json({ error: 'Атау және дұрыс YouTube сілтемесі қажет' });
    }

    const result = await pool.query(
      'INSERT INTO examinations (title, category, youtube_url, thumbnail_url, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title.trim(), category, youtube_url.trim(), youtubeThumbnail(id), description]
    );

    res.status(201).json({ ...result.rows[0], video_id: id });
  } catch (error) {
    console.error('Нұсқа қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== ЖОСПАРЛАР =====
// Жоспар мен бүгінгі тапсырмалар бір кестеде (plans): белгілі күнге қосылған жоспар
// сол күні «Бүгінгі тапсырмалар» бөлімінде көрінеді

const PLAN_COLUMNS = `
  id, student_id, task_title, is_completed, created_at,
  to_char(plan_date, 'YYYY-MM-DD') AS plan_date,
  to_char(task_time, 'HH24:MI') AS task_time
`;
const isDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '');
const isTime = (value) => /^\d{2}:\d{2}$/.test(value || '');

// Клиент өз жергілікті күнін жібереді; жібермесе, Қазақстан уақыты бойынша бүгін
const todayDate = async (clientDate) => {
  if (isDate(clientDate)) return clientDate;
  const result = await pool.query(`SELECT to_char((NOW() AT TIME ZONE 'Asia/Almaty')::date, 'YYYY-MM-DD') AS d`);
  return result.rows[0].d;
};

const listPlans = (studentId, date) => pool.query(
  `SELECT ${PLAN_COLUMNS} FROM plans WHERE student_id = $1 AND plan_date = $2
   ORDER BY task_time NULLS LAST, id`,
  [studentId, date]
);

// Белгілі күннің жоспары
app.get('/api/plans/:date', verifyToken, async (req, res) => {
  try {
    if (!isDate(req.params.date)) {
      return res.status(400).json({ error: 'Күн форматы қате' });
    }
    const result = await listPlans(req.student.id, req.params.date);
    res.json(result.rows);
  } catch (error) {
    console.error('Жоспарлар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Айдағы жоспары бар күндер (күнтізбеде белгілеу үшін)
app.get('/api/plans-month/:year/:month', verifyToken, async (req, res) => {
  try {
    const year = Number(req.params.year);
    const month = Number(req.params.month);
    const result = await pool.query(
      `SELECT ${PLAN_COLUMNS} FROM plans
       WHERE student_id = $1 AND plan_date >= make_date($2, $3, 1)
         AND plan_date < make_date($2, $3, 1) + INTERVAL '1 month'
       ORDER BY plan_date, task_time NULLS LAST, id`,
      [req.student.id, year, month]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Ай жоспарлары алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Жоспар қосу
app.post('/api/plans', verifyToken, async (req, res) => {
  try {
    const { plan_date, task_title, task_time } = req.body;
    if (!isDate(plan_date) || !task_title?.trim()) {
      return res.status(400).json({ error: 'Күн және тапсырма қажет' });
    }

    const result = await pool.query(
      `INSERT INTO plans (student_id, plan_date, task_title, task_time)
       VALUES ($1, $2, $3, $4) RETURNING ${PLAN_COLUMNS}`,
      [req.student.id, plan_date, task_title.trim(), isTime(task_time) ? task_time : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Жоспар қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Жоспарды өзгерту: атауы, уақыты, күні немесе орындалғаны
app.patch('/api/plans/:id', verifyToken, async (req, res) => {
  try {
    const { task_title, task_time, plan_date, is_completed } = req.body;
    if (task_title !== undefined && !task_title.trim()) {
      return res.status(400).json({ error: 'Тапсырма бос болмауы керек' });
    }
    if (plan_date !== undefined && !isDate(plan_date)) {
      return res.status(400).json({ error: 'Күн форматы қате' });
    }

    const result = await pool.query(
      `UPDATE plans SET
         task_title = COALESCE($1, task_title),
         task_time = CASE WHEN $2::boolean THEN $3::time ELSE task_time END,
         plan_date = COALESCE($4::date, plan_date),
         is_completed = COALESCE($5, is_completed)
       WHERE id = $6 AND student_id = $7
       RETURNING ${PLAN_COLUMNS}`,
      [
        task_title?.trim() ?? null,
        task_time !== undefined,
        isTime(task_time) ? task_time : null,
        plan_date ?? null,
        typeof is_completed === 'boolean' ? is_completed : null,
        req.params.id,
        req.student.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Жоспар табылмады' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Жоспар өзгерту қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Жоспарды өшіру
app.delete('/api/plans/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM plans WHERE id = $1 AND student_id = $2 RETURNING id',
      [req.params.id, req.student.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Жоспар табылмады' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Жоспар өшіру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== БҮГІНГІ ТАПСЫРМАЛАР =====
// Бүгінгі күннің жоспарлары; ?date=YYYY-MM-DD арқылы клиенттің жергілікті күні беріледі

app.get('/api/daily-tasks', verifyToken, async (req, res) => {
  try {
    const result = await listPlans(req.student.id, await todayDate(req.query.date));
    res.json(result.rows);
  } catch (error) {
    console.error('Бүгінгі тапсырмалар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

app.post('/api/daily-tasks', verifyToken, async (req, res) => {
  try {
    const { task_title, task_time, date } = req.body;
    if (!task_title?.trim()) {
      return res.status(400).json({ error: 'Тапсырма қажет' });
    }
    const result = await pool.query(
      `INSERT INTO plans (student_id, plan_date, task_title, task_time)
       VALUES ($1, $2, $3, $4) RETURNING ${PLAN_COLUMNS}`,
      [req.student.id, await todayDate(date), task_title.trim(), isTime(task_time) ? task_time : null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Бүгінгі тапсырма қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

app.patch('/api/daily-tasks/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE plans SET is_completed = $1 WHERE id = $2 AND student_id = $3 RETURNING ${PLAN_COLUMNS}`,
      [!!req.body.is_completed, req.params.id, req.student.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Тапсырма табылмады' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Тапсырма өндеу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== ПРОФИЛЬ =====

// Студенттің профилін сұрау
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, student_number, phone, name, email, role, curator_id, created_at FROM students WHERE id = $1',
      [req.student.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Профиль табылмады' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Профиль алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== АДМИН ПАНЕЛІ =====

// Админ проверка
app.get('/api/admin/check', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id FROM students WHERE id = $1 AND (role = 'admin' OR student_number = 'admin')",
      [req.student.id]
    );

    res.json({ is_admin: result.rows.length > 0 });
  } catch (error) {
    console.error('Админ проверка қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Жоспарды тапсырмаларымен бірге алу
const PLAN_SELECT = `
  SELECT p.id, p.student_id, p.curator_id, p.plan_type, p.title, p.description,
         to_char(p.start_date, 'YYYY-MM-DD') AS start_date,
         to_char(p.end_date, 'YYYY-MM-DD') AS end_date,
         p.created_at,
         c.name AS curator_name,
         COALESCE(
           json_agg(
             json_build_object(
               'id', t.id,
               'task_date', to_char(t.task_date, 'YYYY-MM-DD'),
               'task_title', t.task_title,
               'is_completed', t.is_completed
             ) ORDER BY t.task_date, t.id
           ) FILTER (WHERE t.id IS NOT NULL),
           '[]'
         ) AS tasks
  FROM curator_plans p
  JOIN students c ON c.id = p.curator_id
  LEFT JOIN curator_plan_tasks t ON t.plan_id = p.id
`;

// ===== АДМИН: ҚОЛДАНУШЫЛАР =====

// Барлық тіркелген қолданушылар
app.get('/api/admin/users', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.student_number, s.name, s.email, s.created_at,
             CASE WHEN s.student_number = 'admin' THEN 'admin' ELSE COALESCE(s.role, 'student') END AS role,
             s.curator_id, c.name AS curator_name,
             (SELECT COUNT(*) FROM students x WHERE x.curator_id = s.id)::int AS students_count
      FROM students s
      LEFT JOIN students c ON c.id = s.curator_id
      ORDER BY s.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Қолданушылар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Рөл беру: student <-> curator
app.patch('/api/admin/users/:id/role', verifyToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!['student', 'curator'].includes(role)) {
      return res.status(400).json({ error: 'Рөл қате' });
    }

    const target = await client.query('SELECT id, role, student_number FROM students WHERE id = $1', [id]);
    if (target.rows.length === 0) {
      return res.status(404).json({ error: 'Қолданушы табылмады' });
    }
    if (target.rows[0].role === 'admin' || target.rows[0].student_number === 'admin') {
      return res.status(400).json({ error: 'Админнің рөлін өзгертуге болмайды' });
    }

    await client.query('BEGIN');
    if (role === 'curator') {
      // Куратор өзі біреудің оқушысы бола алмайды
      await client.query('UPDATE students SET role = $1, curator_id = NULL WHERE id = $2', [role, id]);
    } else {
      // Куратордан алынса, оқушылары бос қалады
      await client.query('UPDATE students SET curator_id = NULL WHERE curator_id = $1', [id]);
      await client.query('UPDATE students SET role = $1 WHERE id = $2', [role, id]);
    }
    await client.query('COMMIT');

    res.json({ id: Number(id), role });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Рөл өзгерту қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  } finally {
    client.release();
  }
});

// Админ уақытша құпиясөз жасайды (Telegram арқылы қалпына келтіре алмайтындар үшін)
app.post('/api/admin/users/:id/reset-password', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    // Шатастыратын таңбаларсыз (0/O, 1/l/I)
    const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
    const tempPassword = Array.from({ length: 8 }, () => alphabet[crypto.randomInt(alphabet.length)]).join('');
    const password_hash = await bcrypt.hash(tempPassword, 10);

    const result = await pool.query(
      `UPDATE students SET password_hash = $1
       WHERE id = $2 AND student_number <> 'admin' AND COALESCE(role, 'student') <> 'admin'
       RETURNING id, name, student_number`,
      [password_hash, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Қолданушы табылмады' });
    }

    res.json({ ...result.rows[0], temp_password: tempPassword });
  } catch (error) {
    console.error('Уақытша құпиясөз қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Оқушыны басқа куратордың қарауына беру (curator_id = null болса, кураторсыз қалады).
// Куратор құрған жоспарлар оқушымен бірге жаңа кураторға өтеді
const assignCurator = async (client, studentIds, curatorId) => {
  await client.query('UPDATE students SET curator_id = $1 WHERE id = ANY($2::int[])', [curatorId, studentIds]);
  if (curatorId) {
    await client.query('UPDATE curator_plans SET curator_id = $1 WHERE student_id = ANY($2::int[])', [curatorId, studentIds]);
  }
};

const findCurator = async (client, id) => {
  const result = await client.query(
    "SELECT id, name FROM students WHERE id = $1 AND role = 'curator'",
    [id]
  );
  return result.rows[0];
};

// Бір оқушының куратор ауыстыру (админ)
app.patch('/api/admin/users/:id/curator', verifyToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const curatorId = req.body.curator_id ? Number(req.body.curator_id) : null;
    const student = await client.query(
      "SELECT id FROM students WHERE id = $1 AND COALESCE(role, 'student') = 'student' AND student_number <> 'admin'",
      [req.params.id]
    );
    if (student.rows.length === 0) {
      return res.status(404).json({ error: 'Оқушы табылмады' });
    }
    if (curatorId && !(await findCurator(client, curatorId))) {
      return res.status(400).json({ error: 'Куратор табылмады' });
    }

    await client.query('BEGIN');
    await assignCurator(client, [Number(req.params.id)], curatorId);
    await client.query('COMMIT');
    res.json({ id: Number(req.params.id), curator_id: curatorId });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Куратор ауыстыру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  } finally {
    client.release();
  }
});

// Куратордың барлық оқушыларын басқа кураторға көшіру (админ)
app.post('/api/admin/curators/:id/transfer', verifyToken, requireRole('admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const fromId = Number(req.params.id);
    const toId = Number(req.body.to_curator_id);
    if (!toId || toId === fromId) {
      return res.status(400).json({ error: 'Басқа куратор таңдаңыз' });
    }
    if (!(await findCurator(client, fromId)) || !(await findCurator(client, toId))) {
      return res.status(404).json({ error: 'Куратор табылмады' });
    }

    await client.query('BEGIN');
    const students = await client.query('SELECT id FROM students WHERE curator_id = $1', [fromId]);
    const ids = students.rows.map((r) => r.id);
    await assignCurator(client, ids, toId);
    await client.query('COMMIT');
    res.json({ moved: ids.length });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Оқушыларды көшіру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  } finally {
    client.release();
  }
});

// Оқушының куратор құрған жоспарлары (админ көреді)
app.get('/api/admin/students/:id/plans', verifyToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `${PLAN_SELECT} WHERE p.student_id = $1 GROUP BY p.id, c.name ORDER BY p.start_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Оқушы жоспарларын алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== КУРАТОР =====

// Куратордың оқушылары
app.get('/api/curator/students', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.id, s.student_number, s.name, s.email,
             (SELECT COUNT(*) FROM curator_plans p WHERE p.student_id = s.id AND p.curator_id = $1)::int AS plans_count
      FROM students s
      WHERE s.curator_id = $1
      ORDER BY s.name
    `, [req.student.id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Оқушылар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Кураторы жоқ оқушылар (қосу үшін)
app.get('/api/curator/available-students', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  try {
    const q = `%${(req.query.q || '').trim()}%`;
    const result = await pool.query(`
      SELECT id, student_number, name
      FROM students
      WHERE curator_id IS NULL
        AND COALESCE(role, 'student') = 'student'
        AND student_number <> 'admin'
        AND (name ILIKE $1 OR student_number ILIKE $1)
      ORDER BY name
      LIMIT 50
    `, [q]);
    res.json(result.rows);
  } catch (error) {
    console.error('Бос оқушылар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Оқушыны өзіне қосу
app.post('/api/curator/students', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  try {
    const { student_id } = req.body;
    const result = await pool.query(`
      UPDATE students SET curator_id = $1
      WHERE id = $2 AND curator_id IS NULL
        AND COALESCE(role, 'student') = 'student' AND student_number <> 'admin'
      RETURNING id, student_number, name, email
    `, [req.student.id, student_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Оқушы табылмады немесе басқа куратордың оқушысы' });
    }
    res.status(201).json({ ...result.rows[0], plans_count: 0 });
  } catch (error) {
    console.error('Оқушы қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Оқушыны тізімнен шығару
app.delete('/api/curator/students/:id', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE students SET curator_id = NULL WHERE id = $1 AND curator_id = $2 RETURNING id',
      [req.params.id, req.student.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Оқушы табылмады' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Оқушыны шығару қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Оқушының жоспарлары (куратор үшін)
app.get('/api/curator/students/:id/plans', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      `${PLAN_SELECT} WHERE p.student_id = $1 AND p.curator_id = $2
       GROUP BY p.id, c.name ORDER BY p.start_date DESC`,
      [req.params.id, req.student.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Жоспарлар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Апталық / айлық жоспар құру
app.post('/api/curator/plans', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { student_id, plan_type, start_date, title, description, tasks = [] } = req.body;

    if (!['weekly', 'monthly'].includes(plan_type) || !start_date || !title) {
      return res.status(400).json({ error: 'Жоспар түрі, басталу күні және атауы қажет' });
    }

    const own = await client.query(
      'SELECT id FROM students WHERE id = $1 AND curator_id = $2',
      [student_id, req.student.id]
    );
    if (own.rows.length === 0) {
      return res.status(403).json({ error: 'Бұл сіздің оқушыңыз емес' });
    }

    await client.query('BEGIN');
    const plan = await client.query(`
      INSERT INTO curator_plans (curator_id, student_id, plan_type, title, description, start_date, end_date)
      VALUES ($1, $2, $3, $4, $5, $6::date,
              $6::date + CASE WHEN $3::varchar = 'weekly' THEN INTERVAL '6 days' ELSE INTERVAL '1 month' - INTERVAL '1 day' END)
      RETURNING id, start_date, end_date
    `, [req.student.id, student_id, plan_type, title, description || null, start_date]);

    const planId = plan.rows[0].id;
    for (const t of tasks) {
      if (!t.task_title?.trim() || !t.task_date) continue;
      // Тапсырма күні жоспар аралығында болуы керек
      await client.query(`
        INSERT INTO curator_plan_tasks (plan_id, task_date, task_title)
        SELECT $1, $2::date, $3
        FROM curator_plans WHERE id = $1 AND $2::date BETWEEN start_date AND end_date
      `, [planId, t.task_date, t.task_title.trim()]);
    }
    await client.query('COMMIT');

    const result = await pool.query(`${PLAN_SELECT} WHERE p.id = $1 GROUP BY p.id, c.name`, [planId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Жоспар құру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  } finally {
    client.release();
  }
});

// Жоспарды өшіру
app.delete('/api/curator/plans/:id', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM curator_plans WHERE id = $1 AND curator_id = $2 RETURNING id',
      [req.params.id, req.student.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Жоспар табылмады' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Жоспар өшіру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Бар жоспарға тапсырма қосу
app.post('/api/curator/plans/:id/tasks', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  try {
    const { task_date, task_title } = req.body;
    if (!task_title?.trim() || !task_date) {
      return res.status(400).json({ error: 'Күн және тапсырма қажет' });
    }

    const result = await pool.query(`
      INSERT INTO curator_plan_tasks (plan_id, task_date, task_title)
      SELECT id, $3::date, $4 FROM curator_plans
      WHERE id = $1 AND curator_id = $2 AND $3::date BETWEEN start_date AND end_date
      RETURNING id, to_char(task_date, 'YYYY-MM-DD') AS task_date, task_title, is_completed
    `, [req.params.id, req.student.id, task_date, task_title.trim()]);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Жоспар табылмады немесе күн жоспар аралығынан тыс' });
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Тапсырма қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Жоспардан тапсырма өшіру
app.delete('/api/curator/plan-tasks/:id', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM curator_plan_tasks t USING curator_plans p
      WHERE t.id = $1 AND t.plan_id = p.id AND p.curator_id = $2
      RETURNING t.id
    `, [req.params.id, req.student.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Тапсырма табылмады' });
    }
    res.json({ ok: true });
  } catch (error) {
    console.error('Тапсырма өшіру қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== ОҚУШЫ: КУРАТОР ЖОСПАРЛАРЫ =====

app.get('/api/my-curator-plans', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `${PLAN_SELECT} WHERE p.student_id = $1 GROUP BY p.id, c.name ORDER BY p.start_date DESC`,
      [req.student.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Куратор жоспарлары алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Оқушы тапсырманы орындалды деп белгілейді
app.patch('/api/curator-plan-tasks/:id', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE curator_plan_tasks t SET is_completed = $1
      FROM curator_plans p
      WHERE t.id = $2 AND t.plan_id = p.id AND p.student_id = $3
      RETURNING t.id, t.is_completed
    `, [!!req.body.is_completed, req.params.id, req.student.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Тапсырма табылмады' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Тапсырма белгілеу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== МИГРАЦИЯ =====

// Сервер қосылғанда жаңа бағандар мен кестелерді құру (қайта іске қосуға қауіпсіз)
const runMigrations = async () => {
  await pool.query(`
    ALTER TABLE students ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'student';
    ALTER TABLE students ADD COLUMN IF NOT EXISTS curator_id INT REFERENCES students(id) ON DELETE SET NULL;
    UPDATE students SET role = 'admin' WHERE student_number = 'admin' AND role <> 'admin';
    ALTER TABLE students ADD COLUMN IF NOT EXISTS phone VARCHAR(20) UNIQUE;
    ALTER TABLE students ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN NOT NULL DEFAULT FALSE;

    CREATE TABLE IF NOT EXISTS phone_verifications (
      id SERIAL PRIMARY KEY,
      phone VARCHAR(20) NOT NULL,
      code_hash VARCHAR(64) NOT NULL,
      attempts INT NOT NULL DEFAULT 0,
      used BOOLEAN NOT NULL DEFAULT FALSE,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone, created_at DESC);
    -- Бүгінгі тапсырмалар енді plans кестесінде; ескі жазбаларды бір рет көшіреміз
    WITH moved AS (
      DELETE FROM daily_tasks RETURNING student_id, task_date, task_title, task_time, is_completed, created_at
    )
    INSERT INTO plans (student_id, plan_date, task_title, task_time, is_completed, created_at)
    SELECT student_id, task_date, task_title, task_time, is_completed, created_at FROM moved;

    ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_data BYTEA;
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_mime VARCHAR(100);
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS file_size BIGINT;
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'practice';
    ALTER TABLE materials ADD COLUMN IF NOT EXISTS status VARCHAR(10) NOT NULL DEFAULT 'ready';
    CREATE TABLE IF NOT EXISTS material_chunks (
      material_id INT NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
      idx INT NOT NULL,
      data BYTEA NOT NULL,
      PRIMARY KEY (material_id, idx)
    );
    ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS purpose VARCHAR(10) NOT NULL DEFAULT 'register';
    ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS channel VARCHAR(10) NOT NULL DEFAULT 'sms';
    ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS tg_token VARCHAR(64) UNIQUE;
    ALTER TABLE phone_verifications ADD COLUMN IF NOT EXISTS tg_chat_id BIGINT;

    CREATE TABLE IF NOT EXISTS curator_plans (
      id SERIAL PRIMARY KEY,
      curator_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      plan_type VARCHAR(10) NOT NULL CHECK (plan_type IN ('weekly', 'monthly')),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS curator_plan_tasks (
      id SERIAL PRIMARY KEY,
      plan_id INT NOT NULL REFERENCES curator_plans(id) ON DELETE CASCADE,
      task_date DATE NOT NULL,
      task_title VARCHAR(255) NOT NULL,
      is_completed BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_students_curator ON students(curator_id);
    CREATE INDEX IF NOT EXISTS idx_curator_plans_student ON curator_plans(student_id);
  `);
};

// ===== СЕРВЕР ҚОСУ =====

const PORT = process.env.PORT || 5000;
runMigrations()
  .catch((error) => console.error('Миграция қатесі:', error))
  .finally(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Сервер ${PORT} портында жүргенде`);
      startTelegramBot().catch((error) => console.error('Telegram бот қатесі:', error.message));
    });
  });
