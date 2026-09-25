import axios from 'axios';

const API = 'https://student-platform-backend-h9zs.onrender.com';
const PARALLEL = 3; // бір уақытта жіберілетін бөлік саны

// Материалды 2 МБ-тық бөліктермен жүктеу: бір үлкен сұраныс Render-де үзіліп қалатын.
// onProgress(0..100) жүктеу барысын береді
export async function uploadMaterial({ file, title, description, category, onProgress }) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const { data: upload } = await axios.post(`${API}/api/materials/uploads`, {
    title,
    description,
    category,
    file_name: file.name,
    file_mime: file.type || 'application/octet-stream',
    file_size: file.size
  }, { headers });

  const sendChunk = async (index) => {
    const chunk = file.slice(index * upload.chunk_size, (index + 1) * upload.chunk_size);

    // Желі бір сәт үзілсе, бөлікті 3 ретке дейін қайталаймыз
    for (let attempt = 1; ; attempt++) {
      try {
        await axios.put(`${API}/api/materials/uploads/${upload.id}/chunks/${index}`, chunk, {
          headers: { ...headers, 'Content-Type': 'application/octet-stream' }
        });
        return;
      } catch (error) {
        if (attempt >= 3 || (error.response && error.response.status < 500)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  };

  // Бірнеше бөлікті қатар жіберу: үлкен файл тезірек жүктеледі
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < upload.chunks) {
      const index = next++;
      await sendChunk(index);
      done++;
      onProgress?.(Math.round((done / upload.chunks) * 100));
    }
  };
  await Promise.all(Array.from({ length: Math.min(PARALLEL, upload.chunks) }, worker));

  const { data: material } = await axios.post(
    `${API}/api/materials/uploads/${upload.id}/complete`, {}, { headers }
  );
  return material;
}
