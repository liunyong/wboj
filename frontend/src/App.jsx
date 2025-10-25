import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import AdminCreatePage from './pages/AdminCreatePage.jsx';
import AdminUsersPage from './pages/AdminUsersPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import SubmissionsPage from './pages/SubmissionsPage.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import ProblemDetailPage from './pages/ProblemDetailPage.jsx';
import ProblemEditPage from './pages/ProblemEditPage.jsx';
import ProblemsPage from './pages/ProblemsPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import UserDashboardPage from './pages/UserDashboardPage.jsx';
import VerifyEmailPage from './pages/VerifyEmailPage.jsx';
import ResetPasswordPage from './pages/ResetPasswordPage.jsx';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="forgot-password" element={<ForgotPasswordPage />} />
        <Route path="auth/verify" element={<VerifyEmailPage />} />
        <Route path="auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="problems" element={<ProblemsPage />} />
        <Route path="problems/:problemId" element={<ProblemDetailPage />} />
        <Route
          path="problems/:problemId/edit"
          element={
            <RequireAuth>
              <ProblemEditPage />
            </RequireAuth>
          }
        />

        <Route
          path="dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route path="u/:username" element={<UserDashboardPage />} />

        <Route
          path="submissions"
          element={
            <RequireAuth>
              <SubmissionsPage />
            </RequireAuth>
          }
        />

        <Route
          path="dashboard/submissions"
          element={<Navigate to="/submissions" replace />}
        />

        <Route
          path="settings"
          element={
            <RequireAuth>
              <SettingsPage />
            </RequireAuth>
          }
        />

        <Route
          path="admin/create"
          element={
            <RequireAdmin>
              <AdminCreatePage />
            </RequireAdmin>
          }
        />
        <Route
          path="admin/users"
          element={
            <RequireAdmin>
              <AdminUsersPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default App;
