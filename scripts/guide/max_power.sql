-- «МАТЕМАТИКА MAX POWER ГАЙД» (JUZ40, 2025-2026) ішіндегі материалдар. Қайта іске қосуға қауіпсіз: бар жазба қайталанбайды.
BEGIN;

INSERT INTO materials (title, description, file_path, file_name, created_by, category, external_url, status)
SELECT v.title, v.description, '', 'drive.google.com', (SELECT id FROM students WHERE role = 'admin' ORDER BY id LIMIT 1), 'formula', v.url, 'ready'
FROM (VALUES
  ('Алгебра формула жинақ', 'Құлахмет Нұрдәулет · MAX POWER жинағы', 'https://juzup.fly.dev/files/algebra-formula-zhinak.pdf'),
  ('Математика формула жинақ', 'Олжас Нұрдәулет · MAX POWER жинағы', 'https://drive.google.com/file/d/1p7_1L01Jk4YzCVWcd3yaGcil6BJtw6GU/view?usp=sharing'),
  ('Геометрия формула жинақ', 'ҚНН ағай · MAX POWER жинағы', 'https://drive.google.com/file/d/1IA8NtN-JX9pRnxVjMZUViM2DlsbuEFjO/view?usp=sharing')
) AS v(title, description, url)
WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.external_url = v.url);

INSERT INTO examinations (title, category, youtube_url, thumbnail_url, description)
SELECT v.title, v.category, 'https://www.youtube.com/watch?v=' || v.vid, 'https://img.youtube.com/vi/' || v.vid || '/hqdefault.jpg', v.section
FROM (VALUES
  ('12 САҒАТТЫҚ НҰСҚА ТАЛДАУ 2 | MАТЕМАТИКА', '24_hour', 'OQZLcs94oSY', '12 сағаттық мега нұсқа талдау'),
  ('ДУО НҰСҚА ТАЛДАУ | ФИЗ - МАТ | СЛАНБЕК ЖӘНЕ ОЛЖАС АҒАЙЛАР', 'mathematics', 'NeqRY5R6NR4', 'DUO нұсқа талдаулар'),
  ('ГЕО-МАТ DUO НҰСҚА ТАЛДАУ | БЕРЕКЕ АПАЙ | ОЛЖАС АҒАЙ', 'mathematics', 'ziNS7jaEGeE', 'DUO нұсқа талдаулар'),
  ('ФИЗМАТ НҰСҚА ТАЛДАУ | НҰРС АҒАЙ | АЙЙ АПАЙ', 'mathematics', '9eqP5GAthP0', 'DUO нұсқа талдаулар'),
  ('ҰТО НҰСҚА ТАЛДАУ | ЕРСҰЛТАН АҒАЙ | МАТЕМАТИКА', 'mathematics', 'jzG4_u5LPis', 'ҰТО нұсқа талдау · Ерс ағай'),
  ('ҰТО ЖАҢА НҰСҚА | НҰСҚА ТАЛДАУ | ЕРСҰЛТАН АҒАЙ | МАТЕМАТИКА', 'mathematics', 'm1ASzrjfPGI', 'ҰТО нұсқа талдау · Ерс ағай'),
  ('ҚАҢТАР ҰБТҒА ДАЙЫНДЫҚ | ҰТО НҰСҚАСЫ | МАТЕМАТИКА | ЕРС АҒАЙ', 'mathematics', 'x0eDUj7ldjI', 'ҰТО нұсқа талдау · Ерс ағай'),
  ('ЕРС АҒАЙ | ҰТО НҰСҚА ТАЛДАУЫ | МАТЕМАТИКА', 'mathematics', 'ag2M8IyLcHE', 'ҰТО нұсқа талдау · Ерс ағай'),
  ('GEOMETRY BOOST #1 | Дәулет ағай', 'geometry', 'P7LudM18pDk', 'Geometry Boost'),
  ('GEOMETRY BOOST #2 | Дәулет ағай', 'geometry', '39ahQmKFLGo', 'Geometry Boost'),
  ('ТЕГІН ЛАГЕРЬ | ТРИГОНОМЕТРИЯ БАСТАМАСЫ | ОЛЖАС АҒАЙ | ҰБТ | МАТЕМАТИКА', 'mathematics', '8XqH4dCLTUY', 'Easy нұсқа талдаулар'),
  ('ГЕОМЕТРИЯ НҰСҚА ТАЛДАУ | САЯТ АҒАЙ', 'geometry', 'fFBeFZdSq3c', 'Easy нұсқа талдаулар'),
  ('НҰСҚА ТАЛДАУ | ЕРСҰЛТАН АҒАЙ | МАТЕМАТИКА', 'mathematics', 'RFXQpEm_tXI', 'Easy нұсқа талдаулар'),
  ('МАТЕМАТИКА | НҰСҚА ТАЛДАУ | ДӘУЛЕТ АҒАЙ', 'mathematics', 'ocKsvfGOrK0', 'Easy нұсқа талдаулар'),
  ('ГЕОМЕТРИЯ КРОКАНТ АПАЙ', 'geometry', 'ohs70s-fFGk', 'Easy нұсқа талдаулар'),
  ('ҰБТ | МАТЕМАТИКА | НҰРСҰЛТАН АҒАЙ', 'mathematics', 'mHovrzboYGQ', 'Easy нұсқа талдаулар'),
  ('НҰСҚА ТАЛДАУ | МАТЕМАТИКА | ЕКІ НҰРЕКЕҢМЕН', 'mathematics', 'ZTn8MFmJcsA', 'Easy нұсқа талдаулар'),
  ('Шанжархан ағаймен С деңгейлі есептерді шығару', 'mathematics', 'Iqw-4Eev4qo', 'Easy нұсқа талдаулар'),
  ('МАТЕМАТИКА | НҰСҚА ТАЛДАУ | ҚНН АҒАЙ', 'mathematics', '-ziW1hRV89w', 'Easy нұсқа талдаулар'),
  ('НҰСҚА ТАЛДАУ | ЕРС АҒАЙ МЕН КРОКАНТ АПАЙ | МАТЕМАТИКА', 'mathematics', 'o0raUIQWNUE', 'Комбо нұсқа талдау'),
  ('ШАНЖАРХАН АҒАЙ | МАТЕМАТИКА | НҰСҚА ТАЛДАУ', 'mathematics', 'tTTR2Fp0KRM', 'Нұсқа талдау · 100 есеп'),
  ('ҚАТЕМЕН ЖҰМЫС | МАТЕМАТИКА | ОЛЖАС АҒАЙ', 'mathematics', '65HkSSUCB0k', 'Қатемен жұмыс')
) AS v(title, category, vid, section)
WHERE NOT EXISTS (SELECT 1 FROM examinations e WHERE e.youtube_url LIKE '%' || v.vid || '%');

COMMIT;
