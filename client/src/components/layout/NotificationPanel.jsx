import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, CheckCheck, Trash2, X, AlertTriangle, MessageSquare, UserCheck, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import useNotificationStore from '../../store/notificationStore';
import Spinner from '../shared/Spinner';

const notificationIcons = {
  ticket_assigned: UserCheck,
  ticket_reply: MessageSquare,
  ticket_status_changed: Clock,
  sla_warning: AlertTriangle,
  sla_breached: AlertTriangle,
  default: Bell,
};

const notificationColors = {
  ticket_assigned: 'text-blue-500 bg-blue-50',
  ticket_reply: 'text-green-500 bg-green-50',
  ticket_status_changed: 'text-purple-500 bg-purple-50',
  sla_warning: 'text-yellow-500 bg-yellow-50',
  sla_breached: 'text-red-500 bg-red-50',
  default: 'text-gray-500 bg-gray-50',
};

function NotificationItem({ notification, onRead, onDelete, onNavigate }) {
  const Icon = notificationIcons[notification.type] || notificationIcons.default;
  const colorClass = notificationColors[notification.type] || notificationColors.default;
  const isUnread = !notification.readAt;

  const handleClick = () => {
    if (isUnread) {
      onRead(notification.id);
    }
    if (notification.link) {
      onNavigate(notification.link);
    }
  };

  return (
    <div
      className={`px-4 py-3 flex gap-3 hover:bg-gray-50 cursor-pointer transition-colors ${
        isUnread ? 'bg-blue-50/50' : ''
      }`}
      onClick={handleClick}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${colorClass}`}>
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={`text-sm ${isUnread ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
            {notification.title}
          </p>
          {isUnread && (
            <span className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
          )}
        </div>
        <p className="text-sm text-gray-600 truncate">{notification.message}</p>
        <p className="text-xs text-gray-400 mt-1">
          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
        </p>
      </div>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}

export default function NotificationPanel({ isOpen, onClose }) {
  const navigate = useNavigate();
  const panelRef = useRef(null);
  const {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotificationStore();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications({ limit: 20 });
    }
  }, [isOpen, fetchNotifications]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  const handleNavigate = (link) => {
    navigate(link);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 md:w-96 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden z-50"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Notifications</h3>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="p-1.5 text-gray-500 hover:text-primary hover:bg-gray-100 rounded-lg transition-colors"
              title="Mark all as read"
            >
              <CheckCheck size={18} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors md:hidden"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="py-12 flex justify-center">
            <Spinner />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <Bell size={32} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No notifications</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onRead={markAsRead}
                onDelete={deleteNotification}
                onNavigate={handleNavigate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          <button
            onClick={() => {
              navigate('/notifications');
              onClose();
            }}
            className="w-full text-center text-sm text-primary hover:text-primary/80 font-medium"
          >
            View all notifications
          </button>
        </div>
      )}
    </div>
  );
}
