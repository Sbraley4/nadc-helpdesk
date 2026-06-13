import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Ticket, Calendar, Users, Plus, Menu } from 'lucide-react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import FAB from '../shared/FAB';
import useSocket from '../../hooks/useSocket';

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/tickets': 'Tickets',
  '/tickets/new': 'New Ticket',
  '/contacts': 'Contacts',
  '/companies': 'Companies',
  '/calendar': 'Calendar',
  '/workload': 'Workload',
  '/devices': 'Devices',
  '/templates': 'Templates',
  '/reports': 'Reports',
  '/kb': 'Knowledge Base',
  '/satisfaction': 'Satisfaction',
  '/settings': 'Settings',
};

// Bottom navigation items for mobile
const bottomNavItems = [
  { icon: Ticket, label: 'Tickets', path: '/tickets' },
  { icon: Calendar, label: 'Calendar', path: '/calendar' },
  { icon: Users, label: 'Contacts', path: '/contacts' },
  { icon: Plus, label: 'New', path: '/tickets/new', highlight: true },
  { icon: Menu, label: 'Menu', action: 'menu' },
];

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const location = useLocation();
  const navigate = useNavigate();

  // Initialize socket connection for real-time updates
  useSocket();

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) {
        setMobileDrawerOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileDrawerOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile drawer is open
  useEffect(() => {
    if (mobileDrawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileDrawerOpen]);

  // Get page title based on current route
  const getPageTitle = () => {
    if (pageTitles[location.pathname]) {
      return pageTitles[location.pathname];
    }

    if (location.pathname.startsWith('/tickets/')) {
      return 'Ticket Details';
    }
    if (location.pathname.startsWith('/contacts/')) {
      return 'Contact Details';
    }
    if (location.pathname.startsWith('/companies/')) {
      return 'Company Details';
    }
    if (location.pathname.startsWith('/devices/')) {
      return 'Device Details';
    }
    if (location.pathname.startsWith('/templates/')) {
      return 'Template Details';
    }

    return 'NADC Helpdesk';
  };

  const handleBottomNavClick = (item) => {
    if (item.action === 'menu') {
      setMobileDrawerOpen(true);
    } else {
      navigate(item.path);
    }
  };

  const handleFABAction = (action) => {
    // Handle FAB actions - these will be processed by the ticket detail page
    // via props or context
    console.log('FAB action:', action);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        />
      )}

      {/* Mobile Drawer Backdrop */}
      {isMobile && mobileDrawerOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 animate-fadeIn"
          onClick={() => setMobileDrawerOpen(false)}
        />
      )}

      {/* Mobile Drawer Sidebar */}
      {isMobile && mobileDrawerOpen && (
        <div className="animate-slideInLeft">
          <Sidebar
            isMobile={true}
            onClose={() => setMobileDrawerOpen(false)}
          />
        </div>
      )}

      {/* Main content area */}
      <div
        className={`transition-all duration-300 min-h-screen flex flex-col ${
          isMobile ? 'ml-0' : sidebarCollapsed ? 'ml-16' : 'ml-60'
        }`}
      >
        {/* Sticky header */}
        <div className="sticky top-0 z-30">
          <Topbar
            title={getPageTitle()}
            onMenuClick={isMobile ? () => setMobileDrawerOpen(true) : undefined}
            isMobile={isMobile}
          />
        </div>

        <main className={`flex-1 p-4 md:p-6 ${isMobile ? 'pb-24' : ''}`}>
          <Outlet />
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30 safe-bottom">
          <div className="flex items-center justify-around h-14">
            {bottomNavItems.map((item) => {
              const isActive = item.path && location.pathname === item.path;
              const Icon = item.icon;

              return (
                <button
                  key={item.label}
                  onClick={() => handleBottomNavClick(item)}
                  className={`flex flex-col items-center justify-center flex-1 min-h-[56px] touch-manipulation ${
                    item.highlight
                      ? 'text-accent'
                      : isActive
                      ? 'text-primary'
                      : 'text-gray-500'
                  }`}
                >
                  <Icon size={item.highlight ? 24 : 20} />
                  <span className="text-xs mt-0.5">{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
      )}

      {/* Floating Action Button - hidden on mobile since we have bottom nav */}
      {!isMobile && <FAB onAction={handleFABAction} />}
    </div>
  );
}
