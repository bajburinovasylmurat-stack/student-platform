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

// Студент тіркеу
app.post('/api/auth/register', async (req, res) => {
  try {
    const { student_number, password, name, email } = req.body;
    
    if (!student_number || !password || !name) {
      return res.status(400).json({ error: 'Барлық өрістерді толтырыңыз' });
    }

    // Бұл студент номері бар ма?
    const existing = await pool.query(
      'SELECT * FROM students WHERE student_number = $1',
      [student_number]
    );
    
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Бұл студент номері бұрын тіркелген' });
    }

    // Пароль хэшалау
    const password_hash = await bcrypt.hash(password, 10);

    // Студент сақтау
    const result = await pool.query(
      'INSERT INTO students (student_number, password_hash, name, email) VALUES ($1, $2, $3, $4) RETURNING id, student_number, name',
      [student_number, password_hash, name, email]
    );

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
      return res.status(400).json({ error: 'Студент номері және пароль қажет' });
    }

    // Студентті табу
    const result = await pool.query(
      'SELECT * FROM students WHERE student_number = $1',
      [student_number]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Студент табылмады' });
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
        email: student.email
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

// ===== МАТЕРИАЛДАР =====

// Материалдар сұрау
app.get('/api/materials', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, title, description, file_path, file_name, created_at FROM materials ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Материалдар алу қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// Материал қосу (админ)
app.post('/api/materials', verifyToken, upload.single('file'), async (req, res) => {
  try {
    // Админ ғана болса
    if (req.body.is_admin !== 'true') {
      return res.status(403).json({ error: 'Админ ғана материалдар қосо алады' });
    }

    const { title, description } = req.body;
    const file_path = `/uploads/${req.file.filename}`;
    const file_name = req.file.originalname;

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
app.post('/api/examinations', verifyToken, async (req, res) => {
  try {
    if (req.body.is_admin !== 'true') {
      return res.status(403).json({ error: 'Админ ғана нұсқалар қосо алады' });
    }

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

// Бүгінгі тапсырматы өндеу
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
      'SELECT id, student_number, name, email, created_at FROM students WHERE id = $1',
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
      'SELECT id FROM students WHERE id = $1 AND student_number = $2',
      [req.student.id, 'admin']
    );

    res.json({ is_admin: result.rows.length > 0 });
  } catch (error) {
    console.error('Админ проверка қатесі:', error);
    res.status(500).json({ error: 'Сервер қатесі' });
  }
});

// ===== СЕРВЕР ҚОСУ =====

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Сервер ${PORT} портында жүргенде`);
});
