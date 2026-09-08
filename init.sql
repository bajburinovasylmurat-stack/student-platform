-- Студент кесте
CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  student_number VARCHAR(20) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
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

-- Админ пользователь (default)
INSERT INTO students (student_number, password_hash, name, email) 
VALUES ('admin', '$2b$10$YIjlrHzM8Z7xK8V9qL5F0u.kKLBR6u/C5B5q8c7c7c7c7c7c', 'Администратор', 'admin@platform.local')
ON CONFLICT (student_number) DO NOTHING;
