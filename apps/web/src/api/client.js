import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1', timeout: 60000 });

api.interceptors.request.use((cfg) => {
  const t = localStorage.getItem('promptlens_token');
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      localStorage.removeItem('promptlens_token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

/** Human-readable message from an API error. */
export function errMsg(err, fallback = 'Something went wrong. Please try again.') {
  return err?.response?.data?.error?.message || err?.message || fallback;
}

export function errCode(err) {
  return err?.response?.data?.error?.code;
}

export function isUnconfigured(err) {
  return err?.response?.status === 501;
}

const get = (url, params) => api.get(url, { params }).then((r) => r.data);
const post = (url, body, config) => api.post(url, body, config).then((r) => r.data);
const patch = (url, body) => api.patch(url, body).then((r) => r.data);
const put = (url, body) => api.put(url, body).then((r) => r.data);
const del = (url, params) => api.delete(url, { params }).then((r) => r.data);

function downloadBlob(promise, filename) {
  return promise.then((blob) => {
    const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
}

export const auth = {
  register: (name, email, password, referredBy) =>
    post('/auth/register', { name, email, password, ...(referredBy ? { referredBy } : {}) }),
  login: (email, password) => post('/auth/login', { email, password }),
  logout: () => post('/auth/logout', {}),
  me: () => get('/auth/me'),
  updateMe: (name) => patch('/auth/me', { name }),
  changePassword: (currentPassword, newPassword) =>
    post('/auth/password', { currentPassword, newPassword }),
  forgotPassword: (email) => post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => post('/auth/reset-password', { token, password }),
  googleUrl: () => get('/auth/google/url'),
};

export const uploads = {
  upload: (file, onProgress) => {
    const form = new FormData();
    form.append('file', file);
    return api
      .post('/uploads', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        },
      })
      .then((r) => r.data);
  },
  remove: (id) => del(`/uploads/${id}`),
};

export const jobs = {
  create: (tool, input, idempotencyKey) =>
    post('/jobs', { tool, input }, idempotencyKey ? { headers: { 'Idempotency-Key': idempotencyKey } } : undefined),
  get: (id) => get(`/jobs/${id}`),
  list: (params) => get('/jobs', params),
  cancel: (id) => post(`/jobs/${id}/cancel`, {}),
  regenerate: (id) => post(`/jobs/${id}/regenerate`, {}),
  remove: (id) => del(`/jobs/${id}`),
  clear: (tool) => del('/jobs', tool ? { tool } : undefined),
  exportCsv: (id) =>
    downloadBlob(
      api.get(`/jobs/${id}/export`, { params: { format: 'csv' }, responseType: 'blob' }).then((r) => r.data),
      `job-${id}.csv`
    ),
  exportManyCsv: (ids) =>
    downloadBlob(
      api.post('/jobs/export', { ids, format: 'csv' }, { responseType: 'blob' }).then((r) => r.data),
      'jobs-export.csv'
    ),
};

export const batches = {
  create: (tool, items, common) => post('/jobs/batch', { tool, items, ...(common ? { common } : {}) }),
  get: (id) => get(`/batches/${id}`),
};

export const platforms = {
  list: () => get('/platforms'),
};

export const settings = {
  get: () => get('/settings'),
  update: (body) => put('/settings', body),
  testProvider: (name) => post(`/settings/providers/${name}/test`, {}),
};

export const billing = {
  plans: () => get('/billing/plans'),
  me: () => get('/billing/me'),
  checkout: (planId) => post('/billing/checkout-session', { planId }),
};

export const credits = {
  balance: () => get('/credits'),
  ledger: (params) => get('/credits/ledger', params),
};

export const referral = {
  me: () => get('/referral/me'),
  redeem: (code) => post('/redeem', { code }),
  redeemHistory: (params) => get('/redeem/history', params),
};

export const tasks = {
  list: () => get('/tasks'),
  claim: (id) => post(`/tasks/${id}/claim`, {}),
};

export const reviews = {
  summary: () => get('/reviews/summary'),
  list: (params) => get('/reviews', params),
  submit: (rating, comment) => post('/reviews', { rating, comment }),
};

export const tracker = {
  search: (q, limit = 20, offset = 0) => get('/tracker/search', { q, limit, offset }),
  contributor: (creatorId, limit = 20, offset = 0) =>
    get('/tracker/contributor', { creatorId, limit, offset }),
};

export default api;
