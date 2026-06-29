import client from './client';

export const auth = {
  login: (email, password, rememberMe = false) => client.post('/api/auth/login', { email, password, rememberMe }).then((r) => r.data),
  logout: () => client.post('/api/auth/logout').then((r) => r.data),
  refresh: (refreshToken) => client.post('/api/auth/refresh', { refreshToken }).then((r) => r.data),
  getMe: () => client.get('/api/auth/me').then((r) => r.data),
  changePassword: (currentPassword, newPassword) => client.put('/api/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
  forgotPassword: (email) => client.post('/api/auth/forgot-password', { email }).then((r) => r.data),
  verifyResetToken: (token) => client.get('/api/auth/verify-reset-token/' + token).then((r) => r.data),
  resetPassword: (token, password) => client.post('/api/auth/reset-password', { token, password }).then((r) => r.data),
};

export const tickets = {
  getTickets: (params) => client.get('/api/tickets', { params }).then((r) => r.data),
  getTicket: (id) => client.get('/api/tickets/' + id).then((r) => r.data),
  createTicket: (data) => client.post('/api/tickets', data).then((r) => r.data),
  updateTicket: (id, data) => client.put('/api/tickets/' + id, data).then((r) => r.data),
  deleteTicket: (id) => client.delete('/api/tickets/' + id).then((r) => r.data),
  mergeTicket: (id, targetId) => client.post('/api/tickets/' + id + '/merge', { targetTicketId: targetId }).then((r) => r.data),
  getTicketActivity: (id) => client.get('/api/tickets/' + id + '/activity').then((r) => r.data),
  addWatcher: (ticketId, userId) => client.post('/api/tickets/' + ticketId + '/watchers', { userId }).then((r) => r.data),
  removeWatcher: (ticketId, userId) => client.delete('/api/tickets/' + ticketId + '/watchers/' + userId).then((r) => r.data),
  linkTickets: (ticketId, relatedId) => client.post('/api/tickets/' + ticketId + '/related', { relatedTicketId: relatedId }).then((r) => r.data),
  unlinkTickets: (ticketId, relatedId) => client.delete('/api/tickets/' + ticketId + '/related/' + relatedId).then((r) => r.data),
  getViews: () => client.get('/api/tickets/views').then((r) => r.data),
  // Ticket schedules (multi-day calendar scheduling)
  getSchedules: (ticketId) => client.get('/api/tickets/' + ticketId + '/schedules').then((r) => r.data),
  createSchedule: (ticketId, data) => client.post('/api/tickets/' + ticketId + '/schedules', data).then((r) => r.data),
  updateSchedule: (ticketId, scheduleId, data) => client.put('/api/tickets/' + ticketId + '/schedules/' + scheduleId, data).then((r) => r.data),
  deleteSchedule: (ticketId, scheduleId) => client.delete('/api/tickets/' + ticketId + '/schedules/' + scheduleId).then((r) => r.data),
  // Mileage
  calculateMileage: (ticketId, address) => client.post('/api/tickets/' + ticketId + '/calculate-mileage', { address }).then((r) => r.data),
};

export const replies = {
  getReplies: (ticketId) => client.get('/api/tickets/' + ticketId + '/replies').then((r) => r.data),
  createReply: (ticketId, formData) => client.post('/api/tickets/' + ticketId + '/replies', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  updateReply: (ticketId, replyId, data) => client.put('/api/tickets/' + ticketId + '/replies/' + replyId, data).then((r) => r.data),
  deleteReply: (ticketId, replyId) => client.delete('/api/tickets/' + ticketId + '/replies/' + replyId).then((r) => r.data),
};

export const attachments = {
  uploadAttachment: (ticketId, formData) => client.post('/api/tickets/' + ticketId + '/attachments', formData, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data),
  getAttachments: (ticketId) => client.get('/api/tickets/' + ticketId + '/attachments').then((r) => r.data),
  deleteAttachment: (id) => client.delete('/api/attachments/' + id).then((r) => r.data),
  getDownloadUrl: (id) => client.defaults.baseURL + '/api/attachments/' + id + '/download',
};

export const contacts = {
  getContacts: (params) => client.get('/api/contacts', { params }).then((r) => r.data),
  getContact: (id) => client.get('/api/contacts/' + id).then((r) => r.data),
  createContact: (data) => client.post('/api/contacts', data).then((r) => r.data),
  updateContact: (id, data) => client.put('/api/contacts/' + id, data).then((r) => r.data),
  deleteContact: (id) => client.delete('/api/contacts/' + id).then((r) => r.data),
  searchContacts: (q) => client.get('/api/contacts/search', { params: { q } }).then((r) => r.data),
  getPortalStatus: (id) => client.get('/api/contacts/' + id + '/portal-status').then((r) => r.data),
  setPortalPassword: (data) => client.post('/api/portal/auth/set-password', data).then((r) => r.data),
  revokePortalAccess: (id) => client.delete('/api/contacts/' + id + '/portal-access').then((r) => r.data),
};

export const companies = {
  getCompanies: (params) => client.get('/api/companies', { params }).then((r) => r.data),
  getCompany: (id) => client.get('/api/companies/' + id).then((r) => r.data),
  createCompany: (data) => client.post('/api/companies', data).then((r) => r.data),
  updateCompany: (id, data) => client.put('/api/companies/' + id, data).then((r) => r.data),
  deleteCompany: (id) => client.delete('/api/companies/' + id).then((r) => r.data),
  searchCompanies: (q) => client.get('/api/companies/search', { params: { q } }).then((r) => r.data),
};

export const agents = {
  getAgents: (params) => client.get('/api/agents', { params }).then((r) => r.data),
  getAgent: (id) => client.get('/api/agents/' + id).then((r) => r.data),
  createAgent: (data) => client.post('/api/agents', data).then((r) => r.data),
  updateAgent: (id, data) => client.put('/api/agents/' + id, data).then((r) => r.data),
  updateAvailability: (id, availability) => client.patch('/api/agents/' + id + '/availability', { availability }).then((r) => r.data),
  deleteAgent: (id) => client.delete('/api/agents/' + id).then((r) => r.data),
  getGroups: () => client.get('/api/groups').then((r) => r.data),
  createGroup: (data) => client.post('/api/groups', data).then((r) => r.data),
};

export const tags = {
  getTags: (params) => client.get('/api/tags', { params }).then((r) => r.data),
  createTag: (data) => client.post('/api/tags', data).then((r) => r.data),
  updateTag: (id, data) => client.put('/api/tags/' + id, data).then((r) => r.data),
  deleteTag: (id) => client.delete('/api/tags/' + id).then((r) => r.data),
};

export const cannedResponses = {
  getCannedResponses: (params) => client.get('/api/canned-responses', { params }).then((r) => r.data),
  getCannedResponse: (id) => client.get('/api/canned-responses/' + id).then((r) => r.data),
  createCannedResponse: (data) => client.post('/api/canned-responses', data).then((r) => r.data),
  updateCannedResponse: (id, data) => client.put('/api/canned-responses/' + id, data).then((r) => r.data),
  deleteCannedResponse: (id) => client.delete('/api/canned-responses/' + id).then((r) => r.data),
  previewCannedResponse: (id, ticketId) => client.post('/api/canned-responses/' + id + '/preview', { ticketId }).then((r) => r.data),
};

export const sla = {
  getSLAPolicies: () => client.get('/api/sla-policies').then((r) => r.data),
  createSLAPolicy: (data) => client.post('/api/sla-policies', data).then((r) => r.data),
  updateSLAPolicy: (id, data) => client.put('/api/sla-policies/' + id, data).then((r) => r.data),
  deleteSLAPolicy: (id) => client.delete('/api/sla-policies/' + id).then((r) => r.data),
};

export const notifications = {
  getNotifications: (params) => client.get('/api/notifications', { params }).then((r) => r.data),
  getUnreadCount: () => client.get('/api/notifications/unread-count').then((r) => r.data),
  markAsRead: (id) => client.put('/api/notifications/' + id + '/read').then((r) => r.data),
  markAllAsRead: () => client.put('/api/notifications/read-all').then((r) => r.data),
  deleteNotification: (id) => client.delete('/api/notifications/' + id).then((r) => r.data),
};

// Phase 5b APIs

export const timeEntries = {
  getTimeEntries: (ticketId) => client.get('/api/tickets/' + ticketId + '/time-entries').then((r) => r.data),
  createTimeEntry: (ticketId, data) => client.post('/api/tickets/' + ticketId + '/time-entries', data).then((r) => r.data),
  updateTimeEntry: (ticketId, entryId, data) => client.put('/api/tickets/' + ticketId + '/time-entries/' + entryId, data).then((r) => r.data),
  deleteTimeEntry: (ticketId, entryId) => client.delete('/api/tickets/' + ticketId + '/time-entries/' + entryId).then((r) => r.data),
};

export const materialEntries = {
  getMaterialEntries: (ticketId) => client.get('/api/tickets/' + ticketId + '/materials').then((r) => r.data),
  createMaterialEntry: (ticketId, data) => client.post('/api/tickets/' + ticketId + '/materials', data).then((r) => r.data),
  updateMaterialEntry: (ticketId, entryId, data) => client.put('/api/tickets/' + ticketId + '/materials/' + entryId, data).then((r) => r.data),
  deleteMaterialEntry: (ticketId, entryId) => client.delete('/api/tickets/' + ticketId + '/materials/' + entryId).then((r) => r.data),
};

export const devices = {
  getDevices: (params) => client.get('/api/devices', { params }).then((r) => r.data),
  getDevice: (id) => client.get('/api/devices/' + id).then((r) => r.data),
  createDevice: (data) => client.post('/api/devices', data).then((r) => r.data),
  updateDevice: (id, data) => client.put('/api/devices/' + id, data).then((r) => r.data),
  deleteDevice: (id) => client.delete('/api/devices/' + id).then((r) => r.data),
  getTicketDevices: (ticketId) => client.get('/api/tickets/' + ticketId + '/devices').then((r) => r.data),
  linkDevice: (ticketId, deviceId) => client.post('/api/tickets/' + ticketId + '/devices', { deviceId }).then((r) => r.data),
  unlinkDevice: (ticketId, deviceId) => client.delete('/api/tickets/' + ticketId + '/devices/' + deviceId).then((r) => r.data),
};

export const templates = {
  getTemplates: (params) => client.get('/api/templates', { params }).then((r) => r.data),
  getTemplate: (id) => client.get('/api/templates/' + id).then((r) => r.data),
  createTemplate: (data) => client.post('/api/templates', data).then((r) => r.data),
  updateTemplate: (id, data) => client.put('/api/templates/' + id, data).then((r) => r.data),
  deleteTemplate: (id) => client.delete('/api/templates/' + id).then((r) => r.data),
  createTicketFromTemplate: (id, data) => client.post('/api/templates/' + id + '/create-ticket', data).then((r) => r.data),
};

export const checklist = {
  getChecklist: (ticketId) => client.get('/api/tickets/' + ticketId + '/checklist').then((r) => r.data),
  addItem: (ticketId, data) => client.post('/api/tickets/' + ticketId + '/checklist', data).then((r) => r.data),
  updateItem: (ticketId, itemId, data) => client.put('/api/tickets/' + ticketId + '/checklist/' + itemId, data).then((r) => r.data),
  deleteItem: (ticketId, itemId) => client.delete('/api/tickets/' + ticketId + '/checklist/' + itemId).then((r) => r.data),
  reorder: (ticketId, items) => client.put('/api/tickets/' + ticketId + '/checklist/reorder', { items }).then((r) => r.data),
};

export const resolution = {
  updateResolution: (ticketId, resolutionSummary) => client.patch('/api/tickets/' + ticketId + '/resolution', { resolutionSummary }).then((r) => r.data),
};

export const satisfaction = {
  getRatings: (params) => client.get('/api/satisfaction/ratings', { params }).then((r) => r.data),
};

export const settings = {
  getSettings: () => client.get('/api/settings').then((r) => r.data),
  getSettingsFull: () => client.get('/api/settings/full').then((r) => r.data),
  updateSetting: (key, value) => client.patch('/api/settings/' + key, { value }).then((r) => r.data),
  updateSettings: (settingsObj) => client.put('/api/settings', { settings: settingsObj }).then((r) => r.data),
};

export const calendar = {
  getCalendarTickets: (params) => client.get('/api/calendar', { params }).then((r) => r.data),
  getWorkloadSummary: (params) => client.get('/api/calendar/workload', { params }).then((r) => r.data),
};

export const calendarEvents = {
  getEvents: (params) => client.get('/api/calendar-events', { params }).then((r) => r.data),
  getEvent: (id) => client.get('/api/calendar-events/' + id).then((r) => r.data),
  createEvent: (data) => client.post('/api/calendar-events', data).then((r) => r.data),
  updateEvent: (id, data) => client.put('/api/calendar-events/' + id, data).then((r) => r.data),
  deleteEvent: (id) => client.delete('/api/calendar-events/' + id).then((r) => r.data),
};

// Phase 7 APIs

export const dashboard = {
  getStats: () => client.get('/api/dashboard/stats').then((r) => r.data),
  getTrends: (period) => client.get('/api/dashboard/trends', { params: { period } }).then((r) => r.data),
};

export const reports = {
  getTicketVolume: (params) => client.get('/api/reports/ticket-volume', { params }).then((r) => r.data),
  getAgentPerformance: (params) => client.get('/api/reports/agent-performance', { params }).then((r) => r.data),
  getSlaCompliance: (params) => client.get('/api/reports/sla-compliance', { params }).then((r) => r.data),
  getTimeMaterials: (params) => client.get('/api/reports/time-materials', { params }).then((r) => r.data),
  exportCsv: (params) => client.get('/api/reports/export', { params, responseType: 'blob' }).then((r) => r.data),
};

export const automations = {
  getAutomations: () => client.get('/api/automations').then((r) => r.data),
  createAutomation: (data) => client.post('/api/automations', data).then((r) => r.data),
  updateAutomation: (id, data) => client.put('/api/automations/' + id, data).then((r) => r.data),
  toggleAutomation: (id) => client.patch('/api/automations/' + id + '/toggle').then((r) => r.data),
  deleteAutomation: (id) => client.delete('/api/automations/' + id).then((r) => r.data),
  testAutomation: (id, ticketId) => client.post('/api/automations/' + id + '/test', { ticketId }).then((r) => r.data),
};

export const businessHours = {
  getBusinessHours: () => client.get('/api/business-hours').then((r) => r.data),
  updateBusinessHours: (hours) => client.put('/api/business-hours', { hours }).then((r) => r.data),
};

export const search = {
  globalSearch: (q) => client.get('/api/search', { params: { q } }).then((r) => r.data),
};

// Phase 8 APIs

export const inventory = {
  getItems: (params) => client.get('/api/inventory', { params }).then((r) => r.data),
  createItem: (data) => client.post('/api/inventory', data).then((r) => r.data),
  updateItem: (id, data) => client.put('/api/inventory/' + id, data).then((r) => r.data),
  deleteItem: (id) => client.delete('/api/inventory/' + id).then((r) => r.data),
  // Deduction suggestions
  getPendingDeductions: () => client.get('/api/inventory/deductions').then((r) => r.data),
  approveDeduction: (id) => client.put('/api/inventory/deductions/' + id + '/approve').then((r) => r.data),
  rejectDeduction: (id) => client.put('/api/inventory/deductions/' + id + '/reject').then((r) => r.data),
  getTicketDeductions: (ticketId) => client.get('/api/tickets/' + ticketId + '/inventory-deductions').then((r) => r.data),
};

export const kb = {
  // Categories
  getCategories: () => client.get('/api/kb/categories').then((r) => r.data),
  getCategory: (slug) => client.get('/api/kb/categories/' + slug).then((r) => r.data),
  createCategory: (data) => client.post('/api/kb/categories', data).then((r) => r.data),
  updateCategory: (id, data) => client.put('/api/kb/categories/' + id, data).then((r) => r.data),
  deleteCategory: (id) => client.delete('/api/kb/categories/' + id).then((r) => r.data),
  // Articles
  getArticles: (params) => client.get('/api/kb/articles', { params }).then((r) => r.data),
  getArticle: (slug) => client.get('/api/kb/articles/' + slug).then((r) => r.data),
  createArticle: (data) => client.post('/api/kb/articles', data).then((r) => r.data),
  updateArticle: (id, data) => client.put('/api/kb/articles/' + id, data).then((r) => r.data),
  deleteArticle: (id) => client.delete('/api/kb/articles/' + id).then((r) => r.data),
  // Search
  searchArticles: (q, limit) => client.get('/api/kb/search', { params: { q, limit } }).then((r) => r.data),
};
