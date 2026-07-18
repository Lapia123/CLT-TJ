import { NavLink, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  ListOrdered,
  BarChart3,
  BookOpen,
  NotebookPen,
  Lightbulb,
  Target,
  FlaskConical,
  Settings as SettingsIcon,
  LogOut,
  TrendingUp,
  Menu,
  X,
  Wallet,
  Sun,
  Moon,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useAccounts } from "../context/AccountContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import Tour from "./Tour.jsx";
import VerifyBanner from "./VerifyBanner.jsx";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/trades", label: "Trades", icon: ListOrdered },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/insights", label: "Insights", icon: Lightbulb },
  { to: "/playbooks", label: "Playbooks", icon: NotebookPen },
  { to: "/simulator", label: "Simulator", icon: FlaskConical },
  { to: "/goals", label: "Goals & Risk", icon: Target },
  { to: "/journal", label: "Journal", icon: BookOpen },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

function TopBarActions({ onTour }) {
  const { theme, toggle } = useTheme();
  return (
    <div className="flex items-center gap-1">
      <button onClick={onTour} title="Take a tour" className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
        <HelpCircle size={18} />
      </button>
      <button onClick={toggle} title="Toggle theme" className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800">
        {theme === "light" ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </div>
  );
}

function AccountSelector() {
  const { accounts, selectedId, setSelectedId } = useAccounts();
  if (!accounts.length) return null;
  return (
    <div className="flex items-center gap-2">
      <Wallet size={15} className="text-slate-500" />
      <select
        value={selectedId ?? ""}
        onChange={(e) => setSelectedId(e.target.value ? Number(e.target.value) : null)}
        className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
      >
        <option value="">All accounts</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  // Auto-show the tour once for first-time visitors.
  useEffect(() => {
    if (!localStorage.getItem("clt_tour_seen")) {
      setTourOpen(true);
      localStorage.setItem("clt_tour_seen", "1");
    }
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const NavItems = () => (
    <>
      {nav.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          onClick={() => setOpen(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-indigo-600/20 text-indigo-300 border border-indigo-600/30"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </>
  );

  return (
    <div className="min-h-screen flex">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-60 flex-col border-r border-slate-800 bg-slate-900/50 p-4 fixed inset-y-0">
        <div className="flex items-center gap-2 px-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-slate-100 leading-tight">CLT</div>
            <div className="text-[11px] text-slate-500 leading-tight">Trading Journal</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          <NavItems />
        </nav>
        <div className="border-t border-slate-800 pt-3 mt-3">
          <div className="px-3 mb-2">
            <div className="text-sm font-medium text-slate-200 truncate">{user?.name}</div>
            <div className="text-xs text-slate-500 truncate">{user?.email}</div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-rose-300 hover:bg-slate-800 w-full"
          >
            <LogOut size={18} /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between px-4 h-14 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
            <TrendingUp size={16} className="text-white" />
          </div>
          <span className="font-bold">CLT</span>
        </div>
        <div className="flex items-center gap-1">
          <TopBarActions onTour={() => setTourOpen(true)} />
          <button onClick={() => setOpen((o) => !o)} className="text-slate-300">
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden fixed inset-0 top-14 z-40 bg-slate-950/95 p-4">
          <div className="mb-3">
            <AccountSelector />
          </div>
          <nav className="flex flex-col gap-1">
            <NavItems />
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-rose-300 hover:bg-slate-800 mt-2"
            >
              <LogOut size={18} /> Sign out
            </button>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0">
        {/* Top bar with account selector (desktop) */}
        <div className="hidden md:flex items-center justify-end gap-3 px-8 h-14 border-b border-slate-800/60 sticky top-0 bg-slate-950/80 backdrop-blur z-30">
          <AccountSelector />
          <TopBarActions onTour={() => setTourOpen(true)} />
        </div>
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <VerifyBanner />
          {children}
        </div>
      </main>

      <Tour open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
