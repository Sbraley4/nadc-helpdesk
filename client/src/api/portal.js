import portalClient from './portalClient';

export const portalAuth = {
  login: (email, password) => portalClient.post('/api/portal/auth/login', { email, password }).then((r) => r.data),
  refresh: (refreshToken) => portalClient.post('/api/portal/auth/refresh', { refreshToken }).then((r) => r.data),
  getMe: () => portalClient.get('/api/portal/auth/me').then((r) => r.data),
  changePassword: (currentPassword, newPassword) => portalClient.post('/api/portal/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
  forgotPassword: (email) => portalClient.post('/api/portal/auth/forgot-password', { email }).then((r) => r.data),
  resetPassword: (token, newPassword) => portalClient.post('/api/portal/auth/reset-password', { token, newPassword }).then((r) => r.data),
};

export const portalTickets = {
  getTickets: (params) => portalClient.get('/api/portal/tickets', { params }).then((r) => r.data),
  getTicket: (id) => portalClient.get('/api/portal/tickets/' + id).then((r) => r.data),
  createTicket: (data) => portalClient.post('/api/portal/tickets', data).then((r) => r.data),
  getReplies: (ticketId) => portalClient.get('/api/portal/tickets/' + ticketId + '/replies').then((r) => r.data),
  addReply: (ticketId, body) => portalClient.post('/api/portal/tickets/' + ticketId + '/replies', { body }).then((r) => r.data),
};

export const portalKB = {
  getCategories: () => portalClient.get('/api/kb/categories').then((r) => r.data),
  getCategory: (slug) => portalClient.get('/api/kb/categories/' + slug).then((r) => r.data),
  getArticles: (params) => portalClient.get('/api/kb/articles', { params }).then((r) => r.data),
  getArticle: (slug) => portalClient.get('/api/kb/articles/' + slug).then((r) => r.data),
  searchArticles: (q) => portalClient.get('/api/kb/search', { params: { q } }).then((r) => r.data),
};
