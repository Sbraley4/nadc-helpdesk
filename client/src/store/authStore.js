import { create } from 'zustand';
import { auth } from '../api';

// Helper to get storage based on where tokens are stored
const getStorageType = () => {
  // Check localStorage first (Remember Me was checked)
  if (localStorage.getItem('accessToken')) {
    return 'localStorage';
  }
  // Fall back to sessionStorage
  if (sessionStorage.getItem('accessToken')) {
    return 'sessionStorage';
  }
  return null;
};

// Helper to get token from either storage
const getToken = (key) => {
  return localStorage.getItem(key) || sessionStorage.getItem(key);
};

// Helper to clear both storages
const clearAllAuth = () => {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  sessionStorage.removeItem('accessToken');
  sessionStorage.removeItem('refreshToken');
  sessionStorage.removeItem('user');
};

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: getToken('accessToken'),
  refreshToken: getToken('refreshToken'),
  isAuthenticated: !!getToken('accessToken'),
  isLoading: false,

  login: async (email, password, rememberMe = false) => {
    set({ isLoading: true });
    try {
      const data = await auth.login(email, password, rememberMe);

      // Choose storage based on rememberMe flag
      const storage = rememberMe ? localStorage : sessionStorage;

      // Clear both storages first to prevent conflicts
      clearAllAuth();

      // Store in appropriate storage
      storage.setItem('accessToken', data.accessToken);
      storage.setItem('refreshToken', data.refreshToken);
      storage.setItem('user', JSON.stringify(data.user));

      set({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isLoading: false,
      });

      return data;
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    try {
      await auth.logout();
    } catch (error) {
      // Ignore logout errors
    } finally {
      // Clear both storages
      clearAllAuth();

      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      });

      window.location.href = '/login';
    }
  },

  loadUser: async () => {
    const token = get().accessToken;
    if (!token) {
      set({ isLoading: false });
      return;
    }

    set({ isLoading: true });
    try {
      const data = await auth.getMe();
      // Store user in same storage as token
      const storageType = getStorageType();
      if (storageType === 'localStorage') {
        localStorage.setItem('user', JSON.stringify(data.user));
      } else if (storageType === 'sessionStorage') {
        sessionStorage.setItem('user', JSON.stringify(data.user));
      }
      set({
        user: data.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (error) {
      // Token invalid - clear auth from both storages
      clearAllAuth();
      set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },

  setTokens: (accessToken, refreshToken) => {
    // Use same storage as existing token, default to sessionStorage
    const storageType = getStorageType();
    const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
    storage.setItem('accessToken', accessToken);
    storage.setItem('refreshToken', refreshToken);
    set({ accessToken, refreshToken, isAuthenticated: true });
  },
}));

export default useAuthStore;
