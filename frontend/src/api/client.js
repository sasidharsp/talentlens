import axios from 'axios';

// In Railway: VITE_API_URL = https://talentlens-backend.railway.app
// Locally: proxy handles /api -> localhost:8000
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const api = axios.create({ baseURL });

// Attach JWT
api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// Auto-refresh on 401
let refreshing = false;
api.interceptors.response.use(
  r => r,
  async err => {
    const orig = err.config;
    if (err.response?.status === 401 && !orig._retry && !refreshing) {
      orig._retry = true;
      refreshing = true;
      try {
        const refresh = localStorage.getItem('refresh_token');
        if (refresh) {
          const r = await axios.post(`${baseURL}/auth/refresh`, { refresh_token: refresh });
          localStorage.setItem('access_token', r.data.access_token);
          orig.headers.Authorization = `Bearer ${r.data.access_token}`;
          return api(orig);
        }
      } catch {
        localStorage.clear();
        window.location.href = '/admin/login';
      } finally { refreshing = false; }
    }
    return Promise.reject(err);
  }
);

export default api;
