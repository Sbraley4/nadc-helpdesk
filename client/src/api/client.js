import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Helper to get token from either storage (localStorage first for Remember Me)
const getToken = (key) => {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

// Helper to determine which storage is being used
const getActiveStorage = () => {
  if (localStorage.getItem('accessToken')) return localStorage;
  if (sessionStorage.getItem('accessToken')) return sessionStorage;
  return sessionStorage; // Default to sessionStorage
};

// Helper to clear auth from both storages
const clearAllAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
};

// Create axios instance
const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach Authorization header
client.interceptors.request.use(
  (config) => {
    // Check both storages for accessToken (localStorage first for Remember Me)
    const accessToken = getToken('accessToken');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401/403 with token expired and haven't retried yet
    if (
      (error.response?.status === 401 || error.response?.status === 403) &&
      error.response?.data?.error === 'Token expired' &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        // Check both storages for refresh token
        const refreshToken = getToken('refreshToken');
        if (!refreshToken) {
          throw new Error('No refresh token');
        }

        // Determine which storage to use for new tokens
        const storage = getActiveStorage();

        // Try to refresh the token
        const response = await axios.post(`${API_URL}/api/auth/refresh`, {
          refreshToken,
        });

        const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

        // Store new tokens in same storage type
        storage.setItem('accessToken', newAccessToken);
        if (newRefreshToken) {
          storage.setItem('refreshToken', newRefreshToken);
        }

        // Update the original request header
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;

        // Retry the original request
        return client(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear both storages and redirect to login
        clearAllAuth();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default client;
