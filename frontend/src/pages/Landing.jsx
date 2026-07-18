import { Link } from "react-router-dom";
import {
  TrendingUp,
  BarChart3,
  Lightbulb,
  Target,
  Upload,
  NotebookPen,
  LineChart,
  ShieldCheck,
} from "lucide-react";

const FEATURES = [
  { icon: LineChart, title: "Trade log & metrics", desc: "Log long/short trades and get net P&L, R-multiple, win rate and profit factor automatically." },
  { icon: BarChart3, title: "Analytics & reports", desc: "Equity curve, cumulative P&L, drawdown, R-distribution, time-of-day and hold-time breakdowns." },
  { icon: Lightbulb, title: "AI-style insights", desc: "Automated review of your trading that flags your best setups and your costly leaks." },
  { icon: NotebookPen, title: "Playbooks", desc: "Define strategies with rules and see which ones actually make money." },
  { icon: Target, title: "Goals & risk", desc: "Track targets with live progress and size positions for a fixed risk." },
  { icon: Upload, title: "Import & export", desc: "Bring trades in from a broker CSV and export your log anytime." },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="max-w-6xl mx-auto flex items-center justify-between p-5">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <TrendingUp size={20} className="text-white" />
          </div>
          <div>
            <div className="font-bold leading-tight">CLT</div>
            <div className="text-[11px] text-slate-500 leading-tight">Trading Journal</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-ghost">Sign in</Link>
          <Link to="/register" className="btn-primary">Get started</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-4xl mx-auto text-center px-5 pt-16 pb-20">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-3 py-1 mb-6">
          <ShieldCheck size={13} /> Your data, your edge
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight">
          Journal your trades.
          <br />
          <span className="text-indigo-400">Find your edge.</span>
        </h1>
        <p className="text-slate-400 text-lg mt-6 max-w-2xl mx-auto">
          CLT is a modern trading journal that logs every trade, computes your P&L and
          risk metrics, and reviews your performance so you can trade with an edge — not a hunch.
        </p>
        <div className="flex items-center justify-center gap-3 mt-8">
          <Link to="/register" className="btn-primary text-base px-6 py-3">Start free</Link>
          <Link to="/login" className="btn-ghost text-base px-6 py-3">Sign in</Link>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-5 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="card p-6">
              <div className="w-10 h-10 rounded-lg bg-indigo-500/15 flex items-center justify-center mb-4">
                <Icon size={20} className="text-indigo-400" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-slate-400 mt-1">{desc}</p>
            </div>
          ))}
        </div>

        <div className="card p-10 text-center mt-10">
          <h2 className="text-2xl font-bold">Ready to level up your trading?</h2>
          <p className="text-slate-400 mt-2">Create a free account and log your first trade in under a minute.</p>
          <Link to="/register" className="btn-primary mx-auto mt-6 text-base px-6 py-3">Get started</Link>
        </div>
      </section>

      <footer className="border-t border-slate-800 py-6 text-center text-xs text-slate-600">
        CLT Trading Journal · Built for traders
      </footer>
    </div>
  );
}
