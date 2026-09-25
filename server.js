import express from 'express';
import pg from 'pg';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import multer from 'multer';
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

// Multer конфигурациясы PDF немесе файлдар үшін
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});
const upload = multer({ storage });

// PostgreSQL қосылуы
const { Pool } = pg;
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'student_platform',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
});

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

// Тіркелу кодын жіберу
app.post('/api/auth/send-code', async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) {
      return res.status(400).json({ error: 'Телефон нөмірі қате. Мысалы: +7 707 123 45 67' });
    }

    const existing = await pool.query(
      'SELECT id FROM students WHERE phone = $1 OR student_number = $1',
      [phone]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Бұл нөмір бұрын тіркелген. Кіріңіз' });
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
    await pool.query(
      `INSERT INTO phone_verifications (phone, code_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '${CODE_TTL_MIN} minutes')`,
      [phone, hashCode(phone, code)]
    );

    if (smsEnabled()) {
      await sendSms(phone, `JUZ40: тіркелу коды ${code}. Кодты ешкімге айтпаңыз.`);
      return res.json({ message: 'Код жіберілді', resend_after: RESEND_SECONDS });
    }

    // SMS қызметі бапталмаған: тест режимі, код жауапта қайтарылады
    console.log(`📱 [ТЕСТ РЕЖИМІ] ${phone} коды: ${code}`);
    res.json({ message: 'Тест режимі: SMS жіберілмеді', resend_after: RESEND_SECONDS, dev_code: code });
  } catch (error) {
    console.error('SMS жіберу қатесі:', error);
    res.status(502).json({ error: 'SMS жіберу сәтсіз. Кейінірек қайталаңыз' });
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

    // Соңғы жіберілген кодты тексеру
    const verification = await pool.query(`
      SELECT id, code_hash, attempts, expires_at < NOW() AS expired, used
      FROM phone_verifications WHERE phone = $1
      ORDER BY created_at DESC LIMIT 1
    `, [phone]);
    const v = verification.rows[0];

    if (!v || v.used) {
      return res.status(400).json({ error: 'Алдымен SMS код алыңыз' });
    }
    if (v.expired) {
      return res.status(400).json({ error: 'Кодтың мерзімі өтті. Жаңа код алыңыз' });
    }
    if (v.attempts >= MAX_ATTEMPTS) {
      return res.status(400).json({ error: 'Тым көп қате әрекет. Жаңа код алыңыз' });
    }

    const expected = Buffer.from(v.code_hash, 'hex');
    const actual = Buffer.from(hashCode(phone, String(code).trim()), 'hex');
    if (!crypto.timingSafeEqual(expected, actual)) {
      await pool.query('UPDATE phone_verifications SET attempts = attempts + 1 WHERE id = $1', [v.id]);
      const left = MAX_ATTEMPTS - v.attempts - 1;
      return res.status(400).json({ error: `Код қате. Қалған әрекет: ${left}` });
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
      'SELECT id, title, description, file_path, file_name, created_at FROM materials ORDER BY created_at DESC'
    );
    // Бұрын бұзылып сақталған атауларды да дұрыс көрсету
    res.json(result.rows.map((m) => ({ ...m, file_name: fixFileName(m.file_name) })));
  } catch (error) {
    console.error('Материалдар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Материал қосу (админ)
// Рөл файл жүктелмей тұрып тексеріледі, әйтпесе админ емес адамның файлы дискіге сақталып қалады
app.post('/api/materials', verifyToken, requireRole('admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.body.title) {
      return res.status(400).json({ error: 'Файл және атау қажет' });
    }

    const { title, description } = req.body;
    const file_path = `/uploads/${req.file.filename}`;
    const file_name = fixFileName(req.file.originalname);

    const result = await pool.query(
      'INSERT INTO materials (title, description, file_path, file_name, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, file_path, file_name, req.student.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Материал қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== НҰСҚА ТАЛДАУЛАР =====

// Барлық нұсқалар
app.get('/api/examinations', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM examinations ORDER BY category, created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Нұсқалар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Нұсқа қосу (админ)
app.post('/api/examinations', verifyToken, requireRole('admin'), async (req, res) => {
  try {

    const { title, category, youtube_url, description } = req.body;
    
    // YouTube афишасын алу
    let thumbnail_url = null;
    if (youtube_url) {
      const videoId = youtube_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/)?.[1];
      if (videoId) {
        thumbnail_url = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }

    const result = await pool.query(
      'INSERT INTO examinations (title, category, youtube_url, thumbnail_url, description) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, category, youtube_url, thumbnail_url, description]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Нұсқа қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== ЖОСПАРЛАР =====

// Студенттің жоспарын сұрау
app.get('/api/plans/:date', verifyToken, async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM plans WHERE student_id = $1 AND plan_date = $2 ORDER BY task_time',
      [req.student.id, date]
    );
    
    res.json(result.rows);
  } catch (error) {
    console.error('Жоспарлар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Жоспарды месячный календарь ретінде сұрау
app.get('/api/plans-month/:year/:month', verifyToken, async (req, res) => {
  try {
    const { year, month } = req.params;
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    const result = await pool.query(
      'SELECT * FROM plans WHERE student_id = $1 AND plan_date BETWEEN $2 AND $3 ORDER BY plan_date, task_time',
      [req.student.id, start, end]
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

    const result = await pool.query(
      'INSERT INTO plans (student_id, plan_date, task_title, task_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.student.id, plan_date, task_title, task_time]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Жоспар қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Жоспарды өндеу (галочка білену)
app.patch('/api/plans/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_completed } = req.body;

    const result = await pool.query(
      'UPDATE plans SET is_completed = $1 WHERE id = $2 AND student_id = $3 RETURNING *',
      [is_completed, id, req.student.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Жоспар табылмады' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Жоспар өндеу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== БҮГІНГІ ТАПСЫРМАЛАР =====

// Бүгінгі тапсырмалар
app.get('/api/daily-tasks', verifyToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      'SELECT * FROM daily_tasks WHERE student_id = $1 AND task_date = $2 ORDER BY task_time',
      [req.student.id, today]
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Бүгінгі тапсырмалар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Бүгінгі тапсырма қосу
app.post('/api/daily-tasks', verifyToken, async (req, res) => {
  try {
    const { task_title, task_time } = req.body;
    const today = new Date().toISOString().split('T')[0];

    const result = await pool.query(
      'INSERT INTO daily_tasks (student_id, task_date, task_title, task_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.student.id, today, task_title, task_time]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Бүгінгі тапсырма қосу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

app.patch('/api/daily-tasks/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { is_completed } = req.body;

    const result = await pool.query(
      'UPDATE daily_tasks SET is_completed = $1 WHERE id = $2 AND student_id = $3 RETURNING *',
      [is_completed, id, req.student.id]
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
    });
  });
