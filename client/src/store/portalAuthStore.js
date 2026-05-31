import { create } from 'zustand';
import { portalAuth } from '../api/portal';

const usePortalAuthStore = create((set, get) => ({
  contact: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (email, password) => {
    try {
      const data = await portalAuth.login(email, password);
      localStorage.setItem('portalAccessToken', data.accessToken);
      localStorage.setItem('portalRefreshToken', data.refreshToken);
      set({ contact: data.contact, isAuthenticated: true, isLoading: false });
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.error || 'Login failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('portalAccessToken');
    localStorage.removeItem('portalRefreshToken');
    set({ contact: null, isAuthenticated: false, isLoading: false });
  },

  loadContact: async () => {
    const token = localStorage.getItem('portalAccessToken');
    if (!token) {
      set({ isLoading: false });
      return;
    }

    try {
      const contact = await portalAuth.getMe();
      set({ contact, isAuthenticated: true, isLoading: false });
    } catch (error) {
      // Token invalid, try refresh
      const refreshToken = localStorage.getItem('portalRefreshToken');
      if (refreshToken) {
        try {
          const data = await portalAuth.refresh(refreshToken);
          localStorage.setItem('portalAccessToken', data.accessToken);
          const contact = await portalAuth.getMe();
          set({ contact, isAuthenticated: true, isLoading: false });
          return;
        } catch (refreshError) {
          // Refresh failed
        }
      }

      // Clear tokens and set unauthenticated
      localStorage.removeItem('portalAccessToken');
      localStorage.removeItem('portalRefreshToken');
      set({ contact: null, isAuthenticated: false, isLoading: false });
    }
  },
}));

export default usePortalAuthStore;
