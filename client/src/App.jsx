import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';

// Layout
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/auth/LoginPage';
import TicketListPage from './pages/tickets/TicketListPage';
import NewTicketPage from './pages/tickets/NewTicketPage';
import TicketDetailPage from './pages/tickets/TicketDetailPage';
import ContactListPage from './pages/contacts/ContactListPage';
import ContactDetailPage from './pages/contacts/ContactDetailPage';
import CompanyListPage from './pages/companies/CompanyListPage';
import CompanyDetailPage from './pages/companies/CompanyDetailPage';
import CalendarPage from './pages/CalendarPage';
import WorkloadPage from './pages/WorkloadPage';
import DevicesPage from './pages/DevicesPage';
import TemplatesPage from './pages/TemplatesPage';
import SatisfactionPage from './pages/SatisfactionPage';
import SettingsPage from './pages/SettingsPage';
import NotFoundPage from './pages/NotFoundPage';

// Phase 7 Pages
import DashboardPage from './pages/dashboard/DashboardPage';
import ReportsPage from './pages/reports/ReportsPage';
import AutomationsPage from './pages/settings/AutomationsPage';

// Protected Route wrapper
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function App() {
  const { loadUser, isAuthenticated } = useAuthStore();

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="tickets" element={<TicketListPage />} />
        <Route path="tickets/new" element={<NewTicketPage />} />
        <Route path="tickets/:id" element={<TicketDetailPage />} />
        <Route path="contacts" element={<ContactListPage />} />
        <Route path="contacts/:id" element={<ContactDetailPage />} />
        <Route path="companies" element={<CompanyListPage />} />
        <Route path="companies/:id" element={<CompanyDetailPage />} />
        {/* Phase 5b routes */}
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="workload" element={<WorkloadPage />} />
        <Route path="devices" element={<DevicesPage />} />
        <Route path="devices/:id" element={<DevicesPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="satisfaction" element={<SatisfactionPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Phase 7 routes */}
        <Route path="reports" element={<ReportsPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        {/* Placeholder routes for future phases */}
        <Route path="kb" element={<div className="p-6"><h1 className="text-2xl font-bold">Knowledge Base</h1><p className="text-gray-500 mt-2">Coming in Phase 8</p></div>} />
      </Route>

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
