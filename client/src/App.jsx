import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage            from './pages/LoginPage';
import DashboardLayout      from './pages/DashboardLayout';
import AdminDashboard       from './pages/admin/AdminDashboard';
import MonitorPage          from './pages/admin/MonitorPage';
import AnalyticsPage        from './pages/admin/AnalyticsPage';
import UsersPage            from './pages/admin/UsersPage';
import JobsPage             from './pages/jobs/JobsPage';
import ResumesPage          from './pages/resumes/ResumesPage';
import ResumeOptimizerPage  from './pages/shared/ResumeOptimizerPage';
import RecruiterDashboard   from './pages/shared/RecruiterDashboard';
import LibraryPage          from './pages/shared/LibraryPage';
import HomePage             from './pages/shared/HomePage';
import SettingsPage         from './pages/shared/SettingsPage';
import './index.css';

function PrivateRoute({ children, roles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}

function DefaultDash() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  // Recruiters: /dashboard always redirects to /dashboard/home (combined page)
  // Admin: /dashboard stays as AdminDashboard (monitoring/operations view)
  return user.role === 'admin' ? <AdminDashboard /> : <Navigate to="/dashboard/home" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<PrivateRoute><DashboardLayout /></PrivateRoute>}>
            <Route index                element={<DefaultDash />} />
            <Route path="monitor"       element={<PrivateRoute roles={['admin']}><MonitorPage /></PrivateRoute>} />
            <Route path="analytics"     element={<PrivateRoute roles={['admin']}><AnalyticsPage /></PrivateRoute>} />
            <Route path="users"         element={<PrivateRoute roles={['admin']}><UsersPage /></PrivateRoute>} />
            <Route path="jobs"          element={<PrivateRoute><JobsPage /></PrivateRoute>} />
            <Route path="resumes"       element={<PrivateRoute><ResumesPage /></PrivateRoute>} />
            <Route path="optimizer"     element={<PrivateRoute><ResumeOptimizerPage /></PrivateRoute>} />
            <Route path="library"       element={<PrivateRoute><LibraryPage /></PrivateRoute>} />
            <Route path="home"          element={<PrivateRoute><HomePage /></PrivateRoute>} />
            <Route path="settings"      element={<PrivateRoute><SettingsPage /></PrivateRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
