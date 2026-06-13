import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Ticket,
  Calendar,
  LayoutGrid,
  Users,
  Building2,
  Monitor,
  FileText,
  BarChart2,
  BookOpen,
  ThumbsUp,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  Zap,
  Upload,
} from 'lucide-react';
import useAuthStore from '../../store/authStore';
import Avatar from '../shared/Avatar';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Ticket, label: 'Tickets', path: '/tickets' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: LayoutGrid, label: 'Workload', path: '/workload' },
  { icon: Users, label: 'Contacts', path: '/contacts' },
  { icon: Building2, label: 'Companies', path: '/companies' },
  { icon: Monitor, label: 'Devices', path: '/devices' },
  { icon: FileText, label: 'Templates', path: '/templates' },
  { icon: BarChart2, label: 'Reports', path: '/reports' },
  { icon: Zap, label: 'Automations', path: '/automations' },
  { icon: BookOpen, label: 'Knowledge Base', path: '/kb' },
  { icon: ThumbsUp, label: 'Satisfaction', path: '/satisfaction' },
  { icon: Settings, label: 'Settings', path: '/settings' },
  { icon: Upload, label: 'Import Data', path: '/admin/import', adminOnly: true },
];

const availabilityColors = {
  ONLINE: 'bg-green-500',
  BUSY: 'bg-yellow-500',
  AWAY: 'bg-orange-500',
  OFFLINE: 'bg-gray-400',
};

export default function Sidebar({ collapsed, onToggle, isMobile, onClose }) {
  const { user, logout } = useAuthStore();

  const handleNavClick = () => {
    // Close mobile drawer on navigation
    if (isMobile && onClose) {
      onClose();
    }
  };

  return (
    <aside
      className={`fixed left-0 top-0 h-screen bg-primary flex flex-col transition-all duration-300 z-50 ${
        collapsed && !isMobile ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b border-white/10">
        {(!collapsed || isMobile) && (
          <span className="text-white font-semibold text-lg">NADC Helpdesk</span>
        )}
        {isMobile ? (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
          >
            <X size={20} />
          </button>
        ) : (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-hide">
        <ul className="space-y-1 px-2">
          {navItems
            .filter((item) => !item.adminOnly || user?.role === 'ADMIN')
            .map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                onClick={handleNavClick}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-3 rounded-lg transition-colors min-h-[44px] touch-manipulation ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }`
                }
              >
                <item.icon size={20} />
                {(!collapsed || isMobile) && <span>{item.label}</span>}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* User section */}
      <div className="p-4 border-t border-white/10">
        <div className={`flex items-center ${collapsed && !isMobile ? 'justify-center' : 'gap-3'}`}>
          <div className="relative">
            <Avatar name={user?.name} size="sm" />
            <span
              className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-primary ${
                availabilityColors[user?.availability || 'OFFLINE']
              }`}
            />
          </div>
          {(!collapsed || isMobile) && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name}</p>
              <p className="text-xs text-white/50 capitalize">
                {(user?.availability || 'offline').toLowerCase()}
              </p>
            </div>
          )}
          {(!collapsed || isMobile) && (
            <button
              onClick={logout}
              className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center touch-manipulation"
              title="Logout"
            >
              <LogOut size={18} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
