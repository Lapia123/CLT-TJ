import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Layout from "./components/Layout.jsx";
import Landing from "./pages/Landing.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import VerifyEmail from "./pages/VerifyEmail.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Trades from "./pages/Trades.jsx";
import Analytics from "./pages/Analytics.jsx";
import Insights from "./pages/Insights.jsx";
import Playbooks from "./pages/Playbooks.jsx";
import Simulator from "./pages/Simulator.jsx";
import Goals from "./pages/Goals.jsx";
import Journal from "./pages/Journal.jsx";
import Settings from "./pages/Settings.jsx";

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-slate-500">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return children;
}

function Home() {
  const { user, loading } = useAuth();
  if (loading) {
    return <div className="h-screen flex items-center justify-center text-slate-500">Loading…</div>;
  }
  // Logged-out visitors see the marketing landing page; members see the dashboard.
  if (!user) return <Landing />;
  return (
    <Layout>
      <Dashboard />
    </Layout>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><Register /></PublicOnly>} />
      <Route path="/forgot" element={<ForgotPassword />} />
      <Route path="/reset" element={<ResetPassword />} />
      <Route path="/verify" element={<VerifyEmail />} />
      <Route path="/trades" element={<Protected><Trades /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />
      <Route path="/insights" element={<Protected><Insights /></Protected>} />
      <Route path="/playbooks" element={<Protected><Playbooks /></Protected>} />
      <Route path="/simulator" element={<Protected><Simulator /></Protected>} />
      <Route path="/goals" element={<Protected><Goals /></Protected>} />
      <Route path="/journal" element={<Protected><Journal /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
