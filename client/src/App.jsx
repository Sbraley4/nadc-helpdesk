import { useEffect, lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import useAuthStore from './store/authStore';
import usePortalAuthStore from './store/portalAuthStore';
import { FullPageSpinner } from './components/shared/Spinner';

// Layout (keep static - used on every authenticated page)
import AppLayout from './components/layout/AppLayout';

// Lazy-loaded Pages
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SetupPasswordPage = lazy(() => import('./pages/auth/SetupPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'));
const TicketListPage = lazy(() => import('./pages/tickets/TicketListPage'));
const NewTicketPage = lazy(() => import('./pages/tickets/NewTicketPage'));
const TicketDetailPage = lazy(() => import('./pages/tickets/TicketDetailPage'));
const ContactListPage = lazy(() => import('./pages/contacts/ContactListPage'));
const ContactDetailPage = lazy(() => import('./pages/contacts/ContactDetailPage'));
const CompanyListPage = lazy(() => import('./pages/companies/CompanyListPage'));
const CompanyDetailPage = lazy(() => import('./pages/companies/CompanyDetailPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const WorkloadPage = lazy(() => import('./pages/WorkloadPage'));
const DevicesPage = lazy(() => import('./pages/DevicesPage'));
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage'));
const TemplatesPage = lazy(() => import('./pages/TemplatesPage'));
const SatisfactionPage = lazy(() => import('./pages/SatisfactionPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const ReviewPage = lazy(() => import('./pages/ReviewPage'));

// Phase 7 Pages
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage'));
const ReportsPage = lazy(() => import('./pages/reports/ReportsPage'));
const AutomationsPage = lazy(() => import('./pages/settings/AutomationsPage'));

// Admin Pages
const ImportPage = lazy(() => import('./pages/admin/ImportPage'));

// Phase 8 Pages
const KnowledgeBasePage = lazy(() => import('./pages/kb').then(m => ({ default: m.KnowledgeBasePage })));
const PortalComingSoonPage = lazy(() => import('./pages/portal').then(m => ({ default: m.PortalComingSoonPage })));

// Protected Route wrapper (Agent/Admin)
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

// Protected Portal Route wrapper (Contact Portal)
function ProtectedPortalRoute({ children }) {
  const { isAuthenticated, isLoading, loadContact } = usePortalAuthStore();

  useEffect(() => {
    loadContact();
  }, [loadContact]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1B2A4A]"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/portal/login" replace />;
  }

  return children;
}

function App() {
  const loadUser = useAuthStore((state) => state.loadUser);

  useEffect(() => {
    loadUser();
  }, []); // Empty dependency - run once on mount only

  return (
    <Suspense fallback={<FullPageSpinner />}>
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup-password/:token" element={<SetupPasswordPage />} />
      <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
      <Route path="/review/:token" element={<ReviewPage />} />

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
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="templates" element={<TemplatesPage />} />
        <Route path="satisfaction" element={<SatisfactionPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Phase 7 routes */}
        <Route path="reports" element={<ReportsPage />} />
        <Route path="automations" element={<AutomationsPage />} />
        {/* Admin routes */}
        <Route path="admin/import" element={<ImportPage />} />
        {/* Phase 8 routes */}
        <Route path="kb" element={<KnowledgeBasePage />} />
      </Route>

      {/* Portal routes - DISABLED: Show "Coming Soon" page for all portal URLs
       * To re-enable:
       * 1. Uncomment the portal routes below
       * 2. Remove the catch-all PortalComingSoonPage route
       * 3. Re-enable portal email links in server/services/emailService.js
       */}
      <Route path="/portal/*" element={<PortalComingSoonPage />} />
      {/*
      <Route path="/portal/login" element={<PortalLoginPage />} />
      <Route path="/portal/forgot-password" element={<PortalForgotPasswordPage />} />
      <Route path="/portal/reset-password" element={<PortalResetPasswordPage />} />
      <Route
        path="/portal"
        element={
          <ProtectedPortalRoute>
            <PortalLayout />
          </ProtectedPortalRoute>
        }
      >
        <Route index element={<Navigate to="/portal/tickets" replace />} />
        <Route path="tickets" element={<PortalTicketsPage />} />
        <Route path="tickets/new" element={<PortalNewTicketPage />} />
        <Route path="tickets/:id" element={<PortalTicketDetailPage />} />
        <Route path="kb" element={<PortalKBPage />} />
        <Route path="kb/:categorySlug" element={<PortalKBPage />} />
        <Route path="kb/:categorySlug/:articleSlug" element={<PortalKBPage />} />
        <Route path="account" element={<PortalAccountPage />} />
      </Route>
      */}

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
    </Suspense>
  );
}

export default App;
