import { useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useStore } from './store.js';
import { auth } from './api/client.js';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import Dashboard from './pages/Dashboard.jsx';
import PromptStudio from './pages/PromptStudio.jsx';
import MetadataStudio from './pages/MetadataStudio.jsx';
import AnalysisLab from './pages/AnalysisLab.jsx';
import Tracker from './pages/Tracker.jsx';
import History from './pages/History.jsx';
import Billing from './pages/Billing.jsx';
import Referral from './pages/Referral.jsx';
import Tasks from './pages/Tasks.jsx';
import Settings from './pages/Settings.jsx';
import NotFound from './pages/NotFound.jsx';

function RequireAuth({ children }) {
  const token = useStore((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  return children;
}

export default function App() {
  const token = useStore((s) => s.token);
  const user = useStore((s) => s.user);
  const setUser = useStore((s) => s.setUser);
  const logout = useStore((s) => s.logout);

  useEffect(() => {
    if (token && !user) {
      auth
        .me()
        .then((d) => setUser(d.user))
        .catch(() => logout());
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <Dashboard />
          </RequireAuth>
        }
      >
        <Route index element={<PromptStudio />} />
        <Route path="studio" element={<PromptStudio />} />
        <Route path="metadata" element={<MetadataStudio />} />
        <Route path="analysis" element={<AnalysisLab />} />
        <Route path="tracker" element={<Tracker />} />
        <Route path="history" element={<History />} />
        <Route path="billing" element={<Billing />} />
        <Route path="referral" element={<Referral />} />
        <Route path="tasks" element={<Tasks />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
