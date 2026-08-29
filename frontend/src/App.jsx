import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import Layout from './components/Layout.jsx';
import RequireAdmin from './components/RequireAdmin.jsx';
import RequireAuth from './components/RequireAuth.jsx';
const AdminCreatePage = lazy(() => import('./pages/AdminCreatePage.jsx'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage.jsx'));
const AdminUploadsPage = lazy(() => import('./pages/AdminUploadsPage.jsx'));
const DashboardPage = lazy(() => import('./pages/DashboardPage.jsx'));
const SubmissionsPage = lazy(() => import('./pages/SubmissionsPage.jsx'));
const HomePage = lazy(() => import('./pages/HomePage.jsx'));
const LoginPage = lazy(() => import('./pages/LoginPage.jsx'));
const ProblemDetailPage = lazy(() => import('./pages/ProblemDetailPage.jsx'));
const ProblemEditPage = lazy(() => import('./pages/ProblemEditPage.jsx'));
const ProblemsPage = lazy(() => import('./pages/ProblemsPage.jsx'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage.jsx'));
const RegisterPage = lazy(() => import('./pages/RegisterPage.jsx'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage.jsx'));
const SettingsPage = lazy(() => import('./pages/SettingsPage.jsx'));
const TermsPage = lazy(() => import('./pages/TermsPage.jsx'));
const UserDashboardPage = lazy(() => import('./pages/UserDashboardPage.jsx'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage.jsx'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage.jsx'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage.jsx'));

function App() {
  return (
    <Suspense fallback={<main className="page-shell" aria-busy="true">Loading…</main>}>
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
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
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

        <Route path="submissions" element={<SubmissionsPage />} />

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
        <Route
          path="admin/uploads"
          element={
            <RequireAdmin>
              <AdminUploadsPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
