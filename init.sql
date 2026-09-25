-- Студент кесте
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_number VARCHAR(20) UNIQUE NOT NULL, -- логин (жаңа тіркелгендерде телефон нөмірі)
  phone VARCHAR(20) UNIQUE,
  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) NOT NULL DEFAULT 'student', -- 'student', 'curator', 'admin'
  curator_id INT REFERENCES students(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Материалдар кесте
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  file_path VARCHAR(500) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by INT REFERENCES students(id)
);

-- Нұсқа талдаулар кесте
CREATE TABLE IF NOT EXISTS examinations (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(50) NOT NULL, -- '24_hour', 'geometry', 'mathematics'
  youtube_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Жоспар кесте
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  plan_date DATE NOT NULL,
  task_title VARCHAR(255) NOT NULL,
  task_time TIME,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Бүгінгі тапсырмалар кесте
CREATE TABLE IF NOT EXISTS daily_tasks (
  id SERIAL PRIMARY KEY,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  task_date DATE NOT NULL,
  task_title VARCHAR(255) NOT NULL,
  task_time TIME,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- SMS растау кодтары
CREATE TABLE IF NOT EXISTS phone_verifications (
  id SERIAL PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  code_hash VARCHAR(64) NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Куратор жоспарлары (апталық / айлық)
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

-- Куратор жоспарының тапсырмалары
CREATE TABLE IF NOT EXISTS curator_plan_tasks (
  id SERIAL PRIMARY KEY,
  plan_id INT NOT NULL REFERENCES curator_plans(id) ON DELETE CASCADE,
  task_date DATE NOT NULL,
  task_title VARCHAR(255) NOT NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Админ пользователь (default)
INSERT INTO students (student_number, password_hash, name, email, role) 
VALUES ('admin', '$2b$10$YIjlrHzM8Z7xK8V9qL5F0u.kKLBR6u/C5B5q8c7c7c7c7c7c', 'Администратор', 'admin@platform.local', 'admin')
ON CONFLICT (student_number) DO NOTHING;
