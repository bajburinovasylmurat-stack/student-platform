-- 2-ай қосымша есептері (Олжас ағай): сайттағы /files/ ішінен ашылады. Қайта іске қосуға қауіпсіз.
INSERT INTO materials (title, description, file_path, file_name, created_by, category, external_url, status)
SELECT v.title, v.description, '', 'juzup.fly.dev', (SELECT id FROM students WHERE role = 'admin' ORDER BY id LIMIT 1), 'practice', v.url, 'ready'
FROM (VALUES
  ('2-ай 1-апта қосымша есептер', 'Жоғары дәрежелі теңдеулер, бұрыштап бөлу, Безу теоремасы, квадрат және жоғары дәрежелі теңсіздіктер · 110 есеп, жауаптарымен', 'https://juzup.fly.dev/files/2-ai-1-apta-kosymsha-esep.pdf'),
  ('2-ай 2-апта қосымша есептер', 'Бөлшек рационал теңдеулер мен теңсіздіктер, теңдеулер жүйесі, күрделі қос теңсіздік · A/B/C деңгей', 'https://juzup.fly.dev/files/2-ai-2-apta-kosymsha-esep.pdf')
) AS v(title, description, url)
WHERE NOT EXISTS (SELECT 1 FROM materials m WHERE m.external_url = v.url);
