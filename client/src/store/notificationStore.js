import { create } from 'zustand';
import { notifications as notificationApi } from '../api';
import { getSocket } from '../hooks/useSocket';

const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,

  // Fetch notifications
  fetchNotifications: async (params = {}) => {
    set({ isLoading: true });
    try {
      const data = await notificationApi.getNotifications(params);
      set({
        notifications: data.notifications,
        unreadCount: data.unreadCount,
        isLoading: false,
      });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      set({ isLoading: false });
    }
  },

  // Fetch just the unread count
  fetchUnreadCount: async () => {
    try {
      const data = await notificationApi.getUnreadCount();
      set({ unreadCount: data.unreadCount });
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  },

  // Mark single notification as read
  markAsRead: async (id) => {
    try {
      await notificationApi.markAsRead(id);
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, readAt: new Date().toISOString() } : n
        ),
        unreadCount: Math.max(0, state.unreadCount - 1),
      }));
    } catch (error) {
      console.error('Failed to mark as read:', error);
    }
  },

  // Mark all as read
  markAllAsRead: async () => {
    try {
      await notificationApi.markAllAsRead();
      set((state) => ({
        notifications: state.notifications.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
        })),
        unreadCount: 0,
      }));
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  },

  // Delete notification
  deleteNotification: async (id) => {
    try {
      await notificationApi.deleteNotification(id);
      set((state) => {
        const notification = state.notifications.find((n) => n.id === id);
        return {
          notifications: state.notifications.filter((n) => n.id !== id),
          unreadCount: notification && !notification.readAt
            ? Math.max(0, state.unreadCount - 1)
            : state.unreadCount,
        };
      });
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  },

  // Add new notification (from socket)
  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadCount: state.unreadCount + 1,
    }));
  },

  // Initialize socket listeners
  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('notification:new', (notification) => {
      get().addNotification(notification);
    });
  },

  // Cleanup socket listeners
  cleanupSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('notification:new');
  },
}));

export default useNotificationStore;
