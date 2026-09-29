// Қосымша мүмкіндіктер: онлайн тесттер, Telegram ескертулері, куратор аналитикасы,
// серия (streak), рейтинг, формула карточкалары, видео көрілімдері, хабарландырулар
import crypto from 'crypto';

// Қазақстан уақыты бойынша бүгінгі күн мен сағат
const almatyNow = async (pool) => {
  const result = await pool.query(`
    SELECT to_char((NOW() AT TIME ZONE 'Asia/Almaty')::date, 'YYYY-MM-DD') AS today,
           EXTRACT(HOUR FROM NOW() AT TIME ZONE 'Asia/Almaty')::int AS hour
  `);
  return result.rows[0];
};

const escapeHtml = (text) =>
  String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const featureMigrations = `
  -- Тапсырма қашан орындалғаны (серия, рейтинг, аналитика үшін).
  -- Жаңа уақыт бағандары TIMESTAMPTZ: Қазақстан уақытына ауыстыру сервердің белдеуіне тәуелді емес
  ALTER TABLE plans ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE curator_plan_tasks ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  UPDATE plans SET completed_at = created_at WHERE is_completed AND completed_at IS NULL;
  UPDATE curator_plan_tasks SET completed_at = created_at WHERE is_completed AND completed_at IS NULL;

  -- Telegram ескертулері
  ALTER TABLE students ADD COLUMN IF NOT EXISTS telegram_chat_id BIGINT;
  ALTER TABLE students ADD COLUMN IF NOT EXISTS notify_enabled BOOLEAN NOT NULL DEFAULT TRUE;
  -- Telegram арқылы тіркелгендердің чатын бірден байланыстырамыз
  UPDATE students s SET telegram_chat_id = v.tg_chat_id
  FROM (
    SELECT DISTINCT ON (phone) phone, tg_chat_id FROM phone_verifications
    WHERE used AND tg_chat_id IS NOT NULL ORDER BY phone, created_at DESC
  ) v
  WHERE s.telegram_chat_id IS NULL AND (s.phone = v.phone OR s.student_number = v.phone);

  CREATE TABLE IF NOT EXISTS telegram_link_tokens (
    token VARCHAR(64) PRIMARY KEY,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  );
  CREATE TABLE IF NOT EXISTS notification_log (
    kind VARCHAR(20) NOT NULL,
    day DATE NOT NULL,
    PRIMARY KEY (kind, day)
  );

  -- Онлайн тесттер
  CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    duration_min INT NOT NULL DEFAULT 60,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE TABLE IF NOT EXISTS test_questions (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    idx INT NOT NULL DEFAULT 0,
    question TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_index INT NOT NULL,
    points INT NOT NULL DEFAULT 1
  );
  CREATE TABLE IF NOT EXISTS test_attempts (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    answers JSONB,
    score INT,
    max_score INT
  );
  CREATE INDEX IF NOT EXISTS idx_test_attempts_student ON test_attempts(student_id, finished_at);

  -- Формула карточкалары
  CREATE TABLE IF NOT EXISTS flashcards (
    id SERIAL PRIMARY KEY,
    topic VARCHAR(100),
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Видео көрілімдері
  CREATE TABLE IF NOT EXISTS video_views (
    student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    exam_id INT NOT NULL REFERENCES examinations(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (student_id, exam_id)
  );

  -- Хабарландырулар
  CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    created_by INT REFERENCES students(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

export function registerFeatures(app, { pool, verifyToken, requireRole, tg, telegramEnabled, getBotUsername }) {
  const fail = (res, label, error) => {
    console.error(`${label}:`, error);
    res.status(500).json({ error: 'Сервер қатесі' });
  };

  // ===== TELEGRAM: ЖІБЕРУ =====

  const notifyStudent = async (studentId, html) => {
    if (!telegramEnabled()) return false;
    const result = await pool.query(
      'SELECT telegram_chat_id FROM students WHERE id = $1 AND notify_enabled AND telegram_chat_id IS NOT NULL',
      [studentId]
    );
    const chatId = result.rows[0]?.telegram_chat_id;
    if (!chatId) return false;
    try {
      await tg('sendMessage', { chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true });
      return true;
    } catch (error) {
      // Оқушы ботты бұғаттаса, ескертулерді өшіреміз
      if (/blocked|chat not found|deactivated/i.test(error.message)) {
        await pool.query('UPDATE students SET notify_enabled = FALSE WHERE id = $1', [studentId]);
      }
      console.error('Telegram хабар қатесі:', error.message);
      return false;
    }
  };

  // Көп адамға кезекпен жіберу (Telegram секундына 30 хабардан көп жібертпейді)
  const notifyMany = async (items) => {
    let sent = 0;
    for (const { studentId, html } of items) {
      if (await notifyStudent(studentId, html)) sent++;
      await sleep(60);
    }
    return sent;
  };

  // ===== TELEGRAM: АККАУНТТЫ БАЙЛАНЫСТЫРУ =====

  app.get('/api/notifications/status', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT telegram_chat_id IS NOT NULL AS linked, notify_enabled FROM students WHERE id = $1',
        [req.student.id]
      );
      res.json({ ...result.rows[0], available: telegramEnabled() });
    } catch (error) {
      fail(res, 'Ескерту күйі қатесі', error);
    }
  });

  app.post('/api/notifications/link', verifyToken, async (req, res) => {
    try {
      if (!telegramEnabled()) {
        return res.status(503).json({ error: 'Telegram бот қосылмаған' });
      }
      const token = crypto.randomBytes(12).toString('hex');
      await pool.query(
        `INSERT INTO telegram_link_tokens (token, student_id, expires_at)
         VALUES ($1, $2, NOW() + INTERVAL '30 minutes')`,
        [token, req.student.id]
      );
      res.json({ bot_url: `https://t.me/${await getBotUsername()}?start=link_${token}` });
    } catch (error) {
      fail(res, 'Telegram байланыстыру қатесі', error);
    }
  });

  app.patch('/api/notifications', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        'UPDATE students SET notify_enabled = $1 WHERE id = $2 RETURNING notify_enabled',
        [!!req.body.enabled, req.student.id]
      );
      res.json(result.rows[0]);
    } catch (error) {
      fail(res, 'Ескерту баптау қатесі', error);
    }
  });

  // Бот хабарларының бір бөлігі осында өңделеді; өңделсе true қайтарады
  const handleBotCommand = async (message) => {
    const chatId = message.chat.id;
    const text = message.text || '';

    if (text.startsWith('/start link_')) {
      const token = text.split(' ')[1].slice('link_'.length);
      const found = await pool.query(
        `DELETE FROM telegram_link_tokens WHERE token = $1 AND expires_at > NOW() RETURNING student_id`,
        [token]
      );
      const studentId = found.rows[0]?.student_id;
      if (!studentId) {
        await tg('sendMessage', { chat_id: chatId, text: '⏰ Сілтеменің мерзімі өтті. Сайттан қайта басыңыз.' });
        return true;
      }
      // Бір чат бір аккаунтқа ғана байланысады
      await pool.query('UPDATE students SET telegram_chat_id = NULL WHERE telegram_chat_id = $1', [chatId]);
      const student = await pool.query(
        'UPDATE students SET telegram_chat_id = $1, notify_enabled = TRUE WHERE id = $2 RETURNING name',
        [chatId, studentId]
      );
      await tg('sendMessage', {
        chat_id: chatId,
        text: `✅ ${student.rows[0].name}, ескертулер қосылды!\n\n` +
          '• Таңертең — бүгінгі жоспар\n• Кешке — орындалмаған тапсырмалар\n• Куратор жаңа жоспар құрғанда\n\n' +
          'Өшіру үшін: /stop'
      });
      return true;
    }

    if (text === '/stop') {
      const result = await pool.query(
        'UPDATE students SET notify_enabled = FALSE WHERE telegram_chat_id = $1 RETURNING id',
        [chatId]
      );
      await tg('sendMessage', {
        chat_id: chatId,
        text: result.rows.length
          ? '🔕 Ескертулер өшірілді. Қайта қосу үшін: /on'
          : 'Бұл чат ешбір аккаунтқа байланыспаған.'
      });
      return true;
    }

    if (text === '/on') {
      const result = await pool.query(
        'UPDATE students SET notify_enabled = TRUE WHERE telegram_chat_id = $1 RETURNING id',
        [chatId]
      );
      await tg('sendMessage', {
        chat_id: chatId,
        text: result.rows.length
          ? '🔔 Ескертулер қайта қосылды.'
          : 'Алдымен сайтта «🔔 Ескертулер» батырмасы арқылы аккаунтыңызды байланыстырыңыз.'
      });
      return true;
    }

    return false;
  };

  // ===== TELEGRAM: КҮНДЕЛІКТІ ЕСКЕРТУЛЕР =====

  // Бүгінгі тапсырмалар: өз жоспарлары + куратор жоспарлары
  const todaysTasks = async (today, onlyOpen) => pool.query(`
    SELECT s.id AS student_id, s.name, t.title, t.task_time, t.done
    FROM students s
    JOIN (
      SELECT student_id, task_title AS title, to_char(task_time, 'HH24:MI') AS task_time, is_completed AS done
      FROM plans WHERE plan_date = $1
      UNION ALL
      SELECT p.student_id, t.task_title, NULL, t.is_completed
      FROM curator_plan_tasks t JOIN curator_plans p ON p.id = t.plan_id
      WHERE t.task_date = $1
    ) t ON t.student_id = s.id
    WHERE s.telegram_chat_id IS NOT NULL AND s.notify_enabled
      AND ($2::boolean = FALSE OR t.done = FALSE)
    ORDER BY s.id, t.task_time NULLS LAST
  `, [today, onlyOpen]);

  const groupByStudent = (rows) => {
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row.student_id)) map.set(row.student_id, { name: row.name, tasks: [] });
      map.get(row.student_id).tasks.push(row);
    }
    return map;
  };

  const taskLines = (tasks) =>
    tasks.slice(0, 10).map((t) => `• ${t.task_time ? `${t.task_time} — ` : ''}${escapeHtml(t.title)}`).join('\n') +
    (tasks.length > 10 ? `\n…және тағы ${tasks.length - 10}` : '');

  const sendMorning = async (today) => {
    const groups = groupByStudent((await todaysTasks(today, false)).rows);
    return notifyMany([...groups].map(([studentId, g]) => ({
      studentId,
      html: `☀️ Қайырлы таң, ${escapeHtml(g.name.split(' ')[0])}!\n\n<b>Бүгінгі жоспарың (${g.tasks.length}):</b>\n${taskLines(g.tasks)}\n\nСәттілік! 💪`
    })));
  };

  const sendEvening = async (today) => {
    const groups = groupByStudent((await todaysTasks(today, true)).rows);
    return notifyMany([...groups].map(([studentId, g]) => ({
      studentId,
      html: `🌙 ${escapeHtml(g.name.split(' ')[0])}, бүгін әлі <b>${g.tasks.length}</b> тапсырма орындалмады:\n${taskLines(g.tasks)}\n\nҰйықтар алдында үлгересің! ✅`
    })));
  };

  // Серверге бір рет қана жіберу үшін журналға алдымен жазамыз
  const runOnce = async (kind, day, job) => {
    const claimed = await pool.query(
      'INSERT INTO notification_log (kind, day) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING kind',
      [kind, day]
    );
    if (claimed.rows.length === 0) return;
    const sent = await job(day);
    console.log(`📨 ${kind} ескертуі: ${sent} хабар`);
  };

  // Тегін Render ұйықтап қалуы мүмкін, сондықтан уақыт терезесі кең: ояна салысымен жібереді
  const tick = async () => {
    if (!telegramEnabled()) return;
    const { today, hour } = await almatyNow(pool);
    if (hour >= 8 && hour < 12) await runOnce('morning', today, sendMorning);
    if (hour >= 20 && hour < 23) await runOnce('evening', today, sendEvening);
  };

  const startScheduler = () => {
    const run = () => tick().catch((error) => console.error('Ескерту жоспарлаушысы қатесі:', error.message));
    setTimeout(run, 30 * 1000);
    setInterval(run, 5 * 60 * 1000);
  };

  // ===== КУРАТОР ЖАҢА ЖОСПАР ҚҰРДЫ =====

  const notifyNewCuratorPlan = async (planId) => {
    const result = await pool.query(`
      SELECT p.student_id, p.title, p.plan_type, c.name AS curator_name,
             to_char(p.start_date, 'DD.MM') AS start_date, to_char(p.end_date, 'DD.MM') AS end_date,
             (SELECT COUNT(*) FROM curator_plan_tasks WHERE plan_id = p.id)::int AS tasks
      FROM curator_plans p JOIN students c ON c.id = p.curator_id
      WHERE p.id = $1
    `, [planId]);
    const p = result.rows[0];
    if (!p) return;
    await notifyStudent(p.student_id,
      `🎯 Куратор <b>${escapeHtml(p.curator_name)}</b> саған жаңа ${p.plan_type === 'weekly' ? 'апталық' : 'айлық'} жоспар құрды:\n\n` +
      `<b>${escapeHtml(p.title)}</b>\n📅 ${p.start_date} — ${p.end_date} · ${p.tasks} тапсырма\n\nСайттағы «🎯 Куратор жоспары» бөлімінен қара.`);
  };

  // ===== СЕРИЯ (STREAK) ЖӘНЕ ӨЗ СТАТИСТИКАСЫ =====

  // Тапсырма орындалған күндер (Қазақстан уақыты бойынша)
  const completionDays = async (studentId) => {
    const result = await pool.query(`
      SELECT DISTINCT to_char((completed_at AT TIME ZONE 'Asia/Almaty')::date, 'YYYY-MM-DD') AS day
      FROM (
        SELECT completed_at FROM plans WHERE student_id = $1 AND completed_at IS NOT NULL
        UNION ALL
        SELECT t.completed_at FROM curator_plan_tasks t JOIN curator_plans p ON p.id = t.plan_id
        WHERE p.student_id = $1 AND t.completed_at IS NOT NULL
      ) x
      WHERE completed_at > NOW() - INTERVAL '400 days'
    `, [studentId]);
    return new Set(result.rows.map((r) => r.day));
  };

  const shiftDay = (day, delta) => {
    const [y, m, d] = day.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d + delta));
    return date.toISOString().slice(0, 10);
  };

  const streakFrom = (days, today) => {
    // Бүгін әлі ештеңе орындалмаса, кешегі күннен санаймыз (серия үзілмейді)
    let day = days.has(today) ? today : shiftDay(today, -1);
    let streak = 0;
    while (days.has(day)) {
      streak++;
      day = shiftDay(day, -1);
    }
    return streak;
  };

  const bestStreak = (days) => {
    const sorted = [...days].sort();
    let best = 0;
    let run = 0;
    let prev = null;
    for (const day of sorted) {
      run = prev && shiftDay(prev, 1) === day ? run + 1 : 1;
      best = Math.max(best, run);
      prev = day;
    }
    return best;
  };

  app.get('/api/me/stats', verifyToken, async (req, res) => {
    try {
      const { today } = await almatyNow(pool);
      const days = await completionDays(req.student.id);
      res.json({
        streak: streakFrom(days, today),
        best_streak: bestStreak(days),
        done_today: days.has(today)
      });
    } catch (error) {
      fail(res, 'Статистика қатесі', error);
    }
  });

  // ===== РЕЙТИНГ =====

  // Апталық ұпай: орындалған тапсырма = 1 ұпай, тест = жинаған балы
  app.get('/api/leaderboard', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(`
        WITH week AS (
          SELECT date_trunc('week', NOW() AT TIME ZONE 'Asia/Almaty') AT TIME ZONE 'Asia/Almaty' AS start
        ),
        points AS (
          SELECT student_id, COUNT(*) AS pts FROM plans, week
          WHERE completed_at >= week.start GROUP BY student_id
          UNION ALL
          SELECT p.student_id, COUNT(*) FROM curator_plan_tasks t
          JOIN curator_plans p ON p.id = t.plan_id, week
          WHERE t.completed_at >= week.start GROUP BY p.student_id
          UNION ALL
          SELECT student_id, SUM(score) FROM test_attempts, week
          WHERE finished_at >= week.start GROUP BY student_id
        )
        SELECT s.id, s.name, s.curator_id, c.name AS curator_name, SUM(pts)::int AS points
        FROM points JOIN students s ON s.id = points.student_id
        LEFT JOIN students c ON c.id = s.curator_id
        WHERE COALESCE(s.role, 'student') = 'student' AND s.student_number <> 'admin'
        GROUP BY s.id, c.name
        HAVING SUM(pts) > 0
        ORDER BY points DESC, s.name
      `);

      const rows = result.rows.map((r, i) => ({ ...r, rank: i + 1 }));
      // Аты ғана көрсетіледі; тегі қысқартылады
      const shortName = (name) => {
        const [first, last] = name.split(' ');
        return last ? `${first} ${last[0]}.` : first;
      };

      // Куратор топтарының жарысы: оқушы басына орташа ұпай
      const groups = new Map();
      for (const r of rows) {
        if (!r.curator_id) continue;
        const g = groups.get(r.curator_id) || { curator_name: r.curator_name, points: 0, active: 0 };
        g.points += r.points;
        g.active += 1;
        groups.set(r.curator_id, g);
      }
      const sizes = await pool.query(
        "SELECT curator_id, COUNT(*)::int AS size FROM students WHERE curator_id IS NOT NULL GROUP BY curator_id"
      );
      const groupList = sizes.rows
        .filter((s) => groups.has(s.curator_id))
        .map((s) => {
          const g = groups.get(s.curator_id);
          return { curator_name: g.curator_name, students: s.size, active: g.active, avg: Math.round((g.points / s.size) * 10) / 10 };
        })
        .sort((a, b) => b.avg - a.avg);

      const me = rows.find((r) => r.id === req.student.id);
      res.json({
        top: rows.slice(0, 20).map((r) => ({ rank: r.rank, name: shortName(r.name), points: r.points, is_me: r.id === req.student.id })),
        me: me ? { rank: me.rank, points: me.points, total: rows.length } : { rank: null, points: 0, total: rows.length },
        groups: groupList
      });
    } catch (error) {
      fail(res, 'Рейтинг қатесі', error);
    }
  });

  // ===== КУРАТОР АНАЛИТИКАСЫ =====

  app.get('/api/curator/analytics', verifyToken, requireRole('curator', 'admin'), async (req, res) => {
    try {
      const { today } = await almatyNow(pool);
      const result = await pool.query(`
        SELECT s.id, s.name,
          COUNT(t.id) FILTER (WHERE t.task_date BETWEEN $2::date - 6 AND $2::date)::int AS due_week,
          COUNT(t.id) FILTER (WHERE t.task_date BETWEEN $2::date - 6 AND $2::date AND t.is_completed)::int AS done_week,
          COUNT(t.id) FILTER (WHERE t.task_date < $2::date AND NOT t.is_completed)::int AS overdue,
          COUNT(t.id) FILTER (WHERE t.task_date = $2::date)::int AS due_today,
          COUNT(t.id) FILTER (WHERE t.task_date = $2::date AND t.is_completed)::int AS done_today,
          COUNT(t.id) FILTER (WHERE t.task_date BETWEEN $2::date - 2 AND $2::date)::int AS due_3days,
          GREATEST(
            MAX(t.completed_at),
            (SELECT MAX(completed_at) FROM plans WHERE student_id = s.id)
          ) AS last_done_at,
          COALESCE(GREATEST(
            MAX(t.completed_at),
            (SELECT MAX(completed_at) FROM plans WHERE student_id = s.id)
          ) < NOW() - INTERVAL '3 days', TRUE) AS inactive_3days
        FROM students s
        LEFT JOIN curator_plans p ON p.student_id = s.id
        LEFT JOIN curator_plan_tasks t ON t.plan_id = p.id
        WHERE s.curator_id = $1
        GROUP BY s.id
        ORDER BY s.name
      `, [req.student.id, today]);

      res.json(result.rows.map(({ inactive_3days, ...r }) => ({
        ...r,
        percent_week: r.due_week ? Math.round((r.done_week / r.due_week) * 100) : null,
        // 🔴 Соңғы 3 күнде тапсырмасы болса да ештеңе орындамаған
        at_risk: r.due_3days > 0 && inactive_3days
      })));
    } catch (error) {
      fail(res, 'Аналитика қатесі', error);
    }
  });

  // ===== ОНЛАЙН ТЕСТТЕР: АДМИН =====

  const cleanQuestions = (questions) =>
    (Array.isArray(questions) ? questions : [])
      .map((q) => ({
        question: String(q.question || '').trim(),
        options: (Array.isArray(q.options) ? q.options : []).map((o) => String(o ?? '').trim()),
        correct_index: Number(q.correct_index),
        points: Math.max(1, Number(q.points) || 1)
      }))
      .filter((q) => q.question && q.options.length >= 2 && q.options.every(Boolean) &&
        Number.isInteger(q.correct_index) && q.correct_index >= 0 && q.correct_index < q.options.length);

  app.get('/api/admin/tests', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.*, (SELECT COUNT(*) FROM test_questions WHERE test_id = t.id)::int AS questions,
               (SELECT COUNT(*) FROM test_attempts WHERE test_id = t.id AND finished_at IS NOT NULL)::int AS attempts
        FROM tests t ORDER BY t.created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      fail(res, 'Тесттер тізімі қатесі', error);
    }
  });

  app.get('/api/admin/tests/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const test = await pool.query('SELECT * FROM tests WHERE id = $1', [req.params.id]);
      if (!test.rows[0]) return res.status(404).json({ error: 'Тест табылмады' });
      const questions = await pool.query(
        'SELECT id, question, options, correct_index, points FROM test_questions WHERE test_id = $1 ORDER BY idx, id',
        [req.params.id]
      );
      res.json({ ...test.rows[0], questions: questions.rows });
    } catch (error) {
      fail(res, 'Тест алу қатесі', error);
    }
  });

  // Тестті сақтау: жаңа (id жоқ) немесе бар тестті сұрақтарымен бірге толық ауыстыру
  const saveTest = async (req, res, id) => {
    const client = await pool.connect();
    try {
      const { title, description, duration_min, is_published } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'Тест атауы қажет' });
      const questions = cleanQuestions(req.body.questions);
      if (is_published && questions.length === 0) {
        return res.status(400).json({ error: 'Жариялау үшін кемінде бір толық сұрақ керек' });
      }
      const duration = Math.min(300, Math.max(1, Number(duration_min) || 60));

      await client.query('BEGIN');
      let testId = id;
      if (testId) {
        const updated = await client.query(
          `UPDATE tests SET title = $1, description = $2, duration_min = $3, is_published = $4
           WHERE id = $5 RETURNING id`,
          [title.trim(), description || null, duration, !!is_published, testId]
        );
        if (!updated.rows[0]) {
          await client.query('ROLLBACK');
          return res.status(404).json({ error: 'Тест табылмады' });
        }
        await client.query('DELETE FROM test_questions WHERE test_id = $1', [testId]);
      } else {
        const created = await client.query(
          `INSERT INTO tests (title, description, duration_min, is_published) VALUES ($1, $2, $3, $4) RETURNING id`,
          [title.trim(), description || null, duration, !!is_published]
        );
        testId = created.rows[0].id;
      }
      for (const [idx, q] of questions.entries()) {
        await client.query(
          `INSERT INTO test_questions (test_id, idx, question, options, correct_index, points)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [testId, idx, q.question, JSON.stringify(q.options), q.correct_index, q.points]
        );
      }
      await client.query('COMMIT');
      res.status(id ? 200 : 201).json({ id: testId, questions: questions.length });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      fail(res, 'Тест сақтау қатесі', error);
    } finally {
      client.release();
    }
  };

  app.post('/api/admin/tests', verifyToken, requireRole('admin'), (req, res) => saveTest(req, res, null));
  app.put('/api/admin/tests/:id', verifyToken, requireRole('admin'), (req, res) => saveTest(req, res, Number(req.params.id)));

  app.delete('/api/admin/tests/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const result = await pool.query('DELETE FROM tests WHERE id = $1 RETURNING id', [req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Тест табылмады' });
      res.json({ ok: true });
    } catch (error) {
      fail(res, 'Тест өшіру қатесі', error);
    }
  });

  // ===== ОНЛАЙН ТЕСТТЕР: ОҚУШЫ =====

  const GRACE_SECONDS = 30; // желі кешігуіне жол

  app.get('/api/tests', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT t.id, t.title, t.description, t.duration_min,
          (SELECT COUNT(*) FROM test_questions WHERE test_id = t.id)::int AS questions,
          (SELECT COALESCE(SUM(points), 0) FROM test_questions WHERE test_id = t.id)::int AS max_score,
          (SELECT MAX(score) FROM test_attempts WHERE test_id = t.id AND student_id = $1 AND finished_at IS NOT NULL) AS best_score,
          (SELECT COUNT(*) FROM test_attempts WHERE test_id = t.id AND student_id = $1 AND finished_at IS NOT NULL)::int AS attempts,
          (SELECT id FROM test_attempts WHERE test_id = t.id AND student_id = $1 AND finished_at IS NULL
             AND started_at + (t.duration_min * INTERVAL '1 minute') + INTERVAL '${GRACE_SECONDS} seconds' > NOW()
           ORDER BY started_at DESC LIMIT 1) AS active_attempt
        FROM tests t WHERE t.is_published ORDER BY t.created_at DESC
      `, [req.student.id]);
      res.json(result.rows);
    } catch (error) {
      fail(res, 'Тесттер алу қатесі', error);
    }
  });

  const attemptPayload = async (attempt, test) => {
    const questions = await pool.query(
      'SELECT id, question, options, points FROM test_questions WHERE test_id = $1 ORDER BY idx, id',
      [test.id]
    );
    return {
      attempt_id: attempt.id,
      test: { id: test.id, title: test.title, duration_min: test.duration_min },
      started_at: attempt.started_at,
      deadline: new Date(new Date(attempt.started_at).getTime() + test.duration_min * 60000).toISOString(),
      answers: attempt.answers || {},
      questions: questions.rows
    };
  };

  // Тестті бастау; аяқталмаған әрекет болса, соны жалғастырамыз
  app.post('/api/tests/:id/start', verifyToken, async (req, res) => {
    try {
      const test = await pool.query('SELECT * FROM tests WHERE id = $1 AND is_published', [req.params.id]);
      if (!test.rows[0]) return res.status(404).json({ error: 'Тест табылмады' });
      const t = test.rows[0];

      const active = await pool.query(`
        SELECT * FROM test_attempts
        WHERE test_id = $1 AND student_id = $2 AND finished_at IS NULL
          AND started_at + ($3 * INTERVAL '1 minute') > NOW()
        ORDER BY started_at DESC LIMIT 1
      `, [t.id, req.student.id, t.duration_min]);

      const attempt = active.rows[0] || (await pool.query(
        'INSERT INTO test_attempts (test_id, student_id) VALUES ($1, $2) RETURNING *',
        [t.id, req.student.id]
      )).rows[0];

      res.json(await attemptPayload(attempt, t));
    } catch (error) {
      fail(res, 'Тест бастау қатесі', error);
    }
  });

  // Жауаптарды аралықта сақтау (бет жабылып қалса жоғалмау үшін)
  app.put('/api/attempts/:id/answers', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE test_attempts SET answers = $1
         WHERE id = $2 AND student_id = $3 AND finished_at IS NULL RETURNING id`,
        [JSON.stringify(req.body.answers || {}), req.params.id, req.student.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Әрекет табылмады' });
      res.json({ ok: true });
    } catch (error) {
      fail(res, 'Жауап сақтау қатесі', error);
    }
  });

  const attemptResult = async (attemptId, studentId) => {
    const attempt = await pool.query(`
      SELECT a.*, t.title, t.duration_min FROM test_attempts a JOIN tests t ON t.id = a.test_id
      WHERE a.id = $1 AND a.student_id = $2 AND a.finished_at IS NOT NULL
    `, [attemptId, studentId]);
    const a = attempt.rows[0];
    if (!a) return null;
    const questions = await pool.query(
      'SELECT id, question, options, correct_index, points FROM test_questions WHERE test_id = $1 ORDER BY idx, id',
      [a.test_id]
    );
    const answers = a.answers || {};
    return {
      attempt_id: a.id,
      test_id: a.test_id,
      title: a.title,
      score: a.score,
      max_score: a.max_score,
      started_at: a.started_at,
      finished_at: a.finished_at,
      questions: questions.rows.map((q) => ({
        ...q,
        chosen: answers[q.id] ?? null,
        is_correct: answers[q.id] === q.correct_index
      }))
    };
  };

  app.post('/api/attempts/:id/submit', verifyToken, async (req, res) => {
    try {
      const attempt = await pool.query(`
        SELECT a.*, t.duration_min FROM test_attempts a JOIN tests t ON t.id = a.test_id
        WHERE a.id = $1 AND a.student_id = $2
      `, [req.params.id, req.student.id]);
      const a = attempt.rows[0];
      if (!a) return res.status(404).json({ error: 'Әрекет табылмады' });

      if (!a.finished_at) {
        // Уақыт өтсе де қабылдаймыз, бірақ соңғы сақталған жауаптармен
        const deadline = new Date(a.started_at).getTime() + (a.duration_min * 60 + GRACE_SECONDS) * 1000;
        const answers = Date.now() <= deadline && req.body.answers ? req.body.answers : (a.answers || {});

        const questions = await pool.query(
          'SELECT id, correct_index, points FROM test_questions WHERE test_id = $1',
          [a.test_id]
        );
        let score = 0;
        let max = 0;
        const clean = {};
        for (const q of questions.rows) {
          max += q.points;
          const chosen = answers[q.id];
          if (Number.isInteger(chosen)) clean[q.id] = chosen;
          if (chosen === q.correct_index) score += q.points;
        }
        await pool.query(
          `UPDATE test_attempts SET finished_at = NOW(), answers = $1, score = $2, max_score = $3
           WHERE id = $4 AND finished_at IS NULL`,
          [JSON.stringify(clean), score, max, a.id]
        );
      }
      res.json(await attemptResult(a.id, req.student.id));
    } catch (error) {
      fail(res, 'Тест тапсыру қатесі', error);
    }
  });

  app.get('/api/attempts/:id', verifyToken, async (req, res) => {
    try {
      const result = await attemptResult(req.params.id, req.student.id);
      if (!result) return res.status(404).json({ error: 'Нәтиже табылмады' });
      res.json(result);
    } catch (error) {
      fail(res, 'Нәтиже алу қатесі', error);
    }
  });

  app.get('/api/my-test-history', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT a.id, a.test_id, t.title, a.score, a.max_score, a.finished_at
        FROM test_attempts a JOIN tests t ON t.id = a.test_id
        WHERE a.student_id = $1 AND a.finished_at IS NOT NULL
        ORDER BY a.finished_at
      `, [req.student.id]);
      res.json(result.rows);
    } catch (error) {
      fail(res, 'Тест тарихы қатесі', error);
    }
  });

  // ===== ФОРМУЛА КАРТОЧКАЛАРЫ =====

  app.get('/api/flashcards', verifyToken, async (req, res) => {
    try {
      const result = await pool.query('SELECT id, topic, front, back FROM flashcards ORDER BY topic NULLS LAST, id');
      res.json(result.rows);
    } catch (error) {
      fail(res, 'Карточкалар алу қатесі', error);
    }
  });

  app.post('/api/flashcards', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const { topic, front, back } = req.body;
      if (!front?.trim() || !back?.trim()) return res.status(400).json({ error: 'Екі жағы да толтырылуы керек' });
      const result = await pool.query(
        'INSERT INTO flashcards (topic, front, back) VALUES ($1, $2, $3) RETURNING id, topic, front, back',
        [topic?.trim() || null, front.trim(), back.trim()]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      fail(res, 'Карточка қосу қатесі', error);
    }
  });

  app.put('/api/flashcards/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const { topic, front, back } = req.body;
      if (!front?.trim() || !back?.trim()) return res.status(400).json({ error: 'Екі жағы да толтырылуы керек' });
      const result = await pool.query(
        'UPDATE flashcards SET topic = $1, front = $2, back = $3 WHERE id = $4 RETURNING id, topic, front, back',
        [topic?.trim() || null, front.trim(), back.trim(), req.params.id]
      );
      if (!result.rows[0]) return res.status(404).json({ error: 'Карточка табылмады' });
      res.json(result.rows[0]);
    } catch (error) {
      fail(res, 'Карточка өзгерту қатесі', error);
    }
  });

  app.delete('/api/flashcards/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      await pool.query('DELETE FROM flashcards WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (error) {
      fail(res, 'Карточка өшіру қатесі', error);
    }
  });

  // ===== ВИДЕО КӨРІЛІМДЕРІ =====

  app.get('/api/my-video-views', verifyToken, async (req, res) => {
    try {
      const result = await pool.query('SELECT exam_id FROM video_views WHERE student_id = $1', [req.student.id]);
      res.json(result.rows.map((r) => r.exam_id));
    } catch (error) {
      fail(res, 'Көрілімдер алу қатесі', error);
    }
  });

  app.post('/api/examinations/:id/view', verifyToken, async (req, res) => {
    try {
      await pool.query(
        `INSERT INTO video_views (student_id, exam_id) SELECT $1, id FROM examinations WHERE id = $2
         ON CONFLICT (student_id, exam_id) DO UPDATE SET viewed_at = NOW()`,
        [req.student.id, req.params.id]
      );
      res.json({ ok: true });
    } catch (error) {
      fail(res, 'Көрілім сақтау қатесі', error);
    }
  });

  app.delete('/api/examinations/:id/view', verifyToken, async (req, res) => {
    try {
      await pool.query('DELETE FROM video_views WHERE student_id = $1 AND exam_id = $2', [req.student.id, req.params.id]);
      res.json({ ok: true });
    } catch (error) {
      fail(res, 'Көрілім өшіру қатесі', error);
    }
  });

  // ===== ХАБАРЛАНДЫРУЛАР =====

  app.get('/api/announcements', verifyToken, async (req, res) => {
    try {
      const result = await pool.query(
        'SELECT id, title, body, created_at FROM announcements ORDER BY created_at DESC LIMIT 20'
      );
      res.json(result.rows);
    } catch (error) {
      fail(res, 'Хабарландырулар алу қатесі', error);
    }
  });

  app.post('/api/announcements', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      const { title, body, notify_telegram } = req.body;
      if (!title?.trim()) return res.status(400).json({ error: 'Тақырып қажет' });
      const result = await pool.query(
        'INSERT INTO announcements (title, body, created_by) VALUES ($1, $2, $3) RETURNING id, title, body, created_at',
        [title.trim(), body?.trim() || null, req.student.id]
      );

      let telegram = 0;
      if (notify_telegram && telegramEnabled()) {
        const recipients = await pool.query(
          "SELECT id FROM students WHERE telegram_chat_id IS NOT NULL AND notify_enabled AND COALESCE(role, 'student') <> 'admin'"
        );
        const html = `📢 <b>${escapeHtml(title.trim())}</b>${body?.trim() ? `\n\n${escapeHtml(body.trim())}` : ''}`;
        // Жауапты күттірмеу үшін фонда жібереміз
        notifyMany(recipients.rows.map((r) => ({ studentId: r.id, html })))
          .then((sent) => console.log(`📢 Хабарландыру Telegram-ға: ${sent}`))
          .catch((error) => console.error('Хабарландыру жіберу қатесі:', error.message));
        telegram = recipients.rows.length;
      }
      res.status(201).json({ ...result.rows[0], telegram_recipients: telegram });
    } catch (error) {
      fail(res, 'Хабарландыру қосу қатесі', error);
    }
  });

  app.delete('/api/announcements/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
      await pool.query('DELETE FROM announcements WHERE id = $1', [req.params.id]);
      res.json({ ok: true });
    } catch (error) {
      fail(res, 'Хабарландыру өшіру қатесі', error);
    }
  });

  return { handleBotCommand, startScheduler, notifyNewCuratorPlan, sendMorning, sendEvening };
}
