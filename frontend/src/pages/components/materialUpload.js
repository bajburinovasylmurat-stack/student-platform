import axios from 'axios';

const API = 'https://student-platform-backend-h9zs.onrender.com';

// Материалды 2 МБ-тық бөліктермен жүктеу: бір үлкен сұраныс Render-де үзіліп қалатын.
// onProgress(0..100) жүктеу барысын береді
export async function uploadMaterial({ file, title, description, onProgress }) {
  const headers = { Authorization: `Bearer ${localStorage.getItem('token')}` };

  const { data: upload } = await axios.post(`${API}/api/materials/uploads`, {
    title,
    description,
    file_name: file.name,
    file_mime: file.type || 'application/octet-stream',
    file_size: file.size
  }, { headers });

  for (let index = 0; index < upload.chunks; index++) {
    const chunk = file.slice(index * upload.chunk_size, (index + 1) * upload.chunk_size);

    // Желі бір сәт үзілсе, бөлікті 3 ретке дейін қайталаймыз
    for (let attempt = 1; ; attempt++) {
      try {
        await axios.put(`${API}/api/materials/uploads/${upload.id}/chunks/${index}`, chunk, {
          headers: { ...headers, 'Content-Type': 'application/octet-stream' }
        });
        break;
      } catch (error) {
        if (attempt >= 3 || (error.response && error.response.status < 500)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
    onProgress?.(Math.round(((index + 1) / upload.chunks) * 100));
  }

  const { data: material } = await axios.post(
    `${API}/api/materials/uploads/${upload.id}/complete`, {}, { headers }
  );
  return material;
}
