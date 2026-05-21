import axios from 'axios';

// const api     = axios.create({ baseURL:'/api', timeout:90000 });
// const apiLong = axios.create({ baseURL:'/api', timeout:180000 });
const api     = axios.create({ baseURL:'http://158.69.165.245:81/api', timeout:90000 });
const apiLong = axios.create({ baseURL:'http://158.69.165.245:81/api', timeout:180000 });

const attach = config => {
  const t = localStorage.getItem('tf_token');
  if (t) config.headers = { ...config.headers, Authorization:`Bearer ${t}` };
  return config;
};
api.interceptors.request.use(attach);
apiLong.interceptors.request.use(attach);

const onErr = err => {
  if (err.response?.status === 401) { localStorage.removeItem('tf_token'); localStorage.removeItem('tf_user'); window.location.href='/login'; }
  return Promise.reject(new Error(err.response?.data?.error || err.message || 'Request failed'));
};
api.interceptors.response.use(r=>r.data, onErr);
apiLong.interceptors.response.use(r=>r.data, onErr);

export const authApi = {
  login:  p => api.post('/auth/login', p),
  logout: () => api.post('/auth/logout'),
  me:     () => api.get('/auth/me'),
  page:   p => api.patch('/auth/page', { page: p }),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  create: p  => api.post('/users', p),
  update: (id,p) => api.put(`/users/${id}`, p),
  remove: id => api.delete(`/users/${id}`),
};

export const resumeApi = {
  parse:       fd   => api.post('/resume/parse', fd, { headers:{ 'Content-Type':'multipart/form-data' } }),
  parseText:   text => api.post('/resume/parse', { text }),
  saveBase:    p    => api.post('/resume/save-base', p),
  updateBase:  (id,p) => api.put(`/resume/base/${id}`, p),
  getBase:     ()   => api.get('/resume/base'),
  getBaseById: id   => api.get(`/resume/base/${id}`),
  getVersions: id   => api.get(`/resume/base/${id}/versions`),
  getTailored: ()   => api.get('/resume/tailored'),
  saveTailored: p   => api.post('/resume/tailored', p),
  deleteBase:  id   => api.delete(`/resume/base/${id}`),
};

export const jdApi = {
  getAll:      ()   => api.get('/jd'),
  getById:     id   => api.get(`/jd/${id}`),
  parse:       text => api.post('/jd/parse', { text }),
  parseFile:   fd   => api.post('/jd/parse-file', fd, { headers:{ 'Content-Type':'multipart/form-data' } }),
  liveParse:   text => api.post('/jd/live-parse', { text }),
  save:        p    => api.post('/jd', p),
  update:      (id,p) => api.put(`/jd/${id}`, p),
  remove:      id   => api.delete(`/jd/${id}`),
  analyzeFit:  (id,base_resume_id) => api.post(`/jd/${id}/analyze-fit`, { base_resume_id }),
};

export const analysisApi = {
  gaps:     p => apiLong.post('/analysis/gaps', p),
  generate: p => apiLong.post('/analysis/generate', p),
};

export const integrateApi = { run: p => api.post('/integrate/run', p) };

export const exportApi = {
  docxFromBase64: async base64 => {
    const res = await axios.post('/api/export/docx-from-base64', { base64 }, { responseType:'blob', timeout:60000, headers:{ Authorization:`Bearer ${localStorage.getItem('tf_token')}` } });
    const url = URL.createObjectURL(new Blob([res.data], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
    const a = document.createElement('a'); a.href=url; a.download='optimized_resume.docx'; a.click(); URL.revokeObjectURL(url);
  },
  txt: async text => {
    const res = await axios.post('/api/export/txt', { text }, { responseType:'blob', timeout:30000, headers:{ Authorization:`Bearer ${localStorage.getItem('tf_token')}` } });
    const url = URL.createObjectURL(new Blob([res.data], { type:'text/plain' }));
    const a = document.createElement('a'); a.href=url; a.download='optimized_resume.txt'; a.click(); URL.revokeObjectURL(url);
  },
};

export const pointsApi = {
  getAll:    params => api.get('/points', { params }),
  getEcos:   ()     => api.get('/points/ecosystems'),
  save:      p      => api.post('/points', p),
  saveBatch: p      => api.post('/points/batch', p),
  copy:      id     => api.post(`/points/${id}/copy`),
  remove:    id     => api.delete(`/points/${id}`),
};

export const monitoringApi = {
  users:        ()    => api.get('/monitoring/users'),
  activity:     (l=50)=> api.get(`/monitoring/activity?limit=${l}`),
  userActivity: id    => api.get(`/monitoring/activity/${id}`),
  stats:        ()    => api.get('/monitoring/stats'),
};

export const coverLetterApi = {
  generate: p => apiLong.post('/coverletter/generate', p),
};

export const healthApi = { check: () => api.get('/health') };

export const settingsApi = {
  getProfile:       ()    => api.get('/auth/me/settings'),
  updateProfile:    p     => api.put('/auth/me/settings', p),
  changePassword:   p     => api.put('/auth/me/password', p),
  getPlatform:      ()    => api.get('/auth/platform-settings'),
  updatePlatform:   p     => api.put('/auth/platform-settings', p),
};

export const interviewApi = {
  getAll:       ()    => api.get('/interview'),
  refreshRole:  id    => api.post(`/interview/refresh/${id}`),
  refreshAll:   ()    => api.post('/interview/refresh-all'),
};
export default api;
