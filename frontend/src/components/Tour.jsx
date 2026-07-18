import { useState, useEffect } from "react";
import {
  X,
  LayoutDashboard,
  ListOrdered,
  BarChart3,
  Lightbulb,
  NotebookPen,
  Target,
  FlaskConical,
  BookOpen,
  Upload,
  Wallet,
  ArrowRight,
  ArrowLeft,
} from "lucide-react";

const STEPS = [
  {
    icon: LayoutDashboard,
    title: "Welcome to CLT Trading Journal",
    body: "This quick tour explains each area of the app and how to get around. You can reopen it anytime from the help (?) button in the top bar.",
  },
  {
    icon: Wallet,
    title: "Accounts filter (top-right)",
    body: "Track multiple trading accounts. The selector in the top bar filters your entire dashboard, analytics and trades to one account — or 'All accounts'.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    body: "Your at-a-glance scorecard: net P&L, balance, win rate, profit factor, expectancy, max drawdown, streaks, and your equity curve.",
  },
  {
    icon: ListOrdered,
    title: "Trades",
    body: "Log every trade (long/short, open/closed) with entry/exit, stops, fees, setup, tags, mistakes, a star rating and chart screenshots. Click any row to see full detail.",
  },
  {
    icon: Upload,
    title: "Import & export",
    body: "On the Trades page, use Import to bulk-load a broker CSV (with a validation preview and a downloadable template), and Export to download your log anytime.",
  },
  {
    icon: BarChart3,
    title: "Analytics & Reports",
    body: "Cumulative P&L, R-multiple distribution, performance by time-of-day and hold-time, breakdowns by symbol/setup/tag/mistake, and a daily P&L calendar.",
  },
  {
    icon: Lightbulb,
    title: "Insights",
    body: "An automated review of your trading that surfaces what's working and what's leaking — your strongest day, best setup, revenge-trading patterns, and more.",
  },
  {
    icon: NotebookPen,
    title: "Playbooks",
    body: "Define named strategies with rules, tag trades to them, and see which playbooks actually make money.",
  },
  {
    icon: FlaskConical,
    title: "Simulator & Replay",
    body: "Filter your history by setup, direction, playbook, rating and more to see how a strategy would have performed — then press play to replay the equity curve trade by trade.",
  },
  {
    icon: Target,
    title: "Goals & Risk",
    body: "Set targets (net P&L, win rate, trades, profit factor) with live progress bars, and size positions for a fixed risk with the calculator.",
  },
  {
    icon: BookOpen,
    title: "Journal",
    body: "Keep dated notes with a mood tag to reflect on your process — not just your P&L. You're all set. Happy trading!",
  },
];

export default function Tour({ open, onClose }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setStep((s) => Math.min(s + 1, STEPS.length - 1));
      if (e.key === "ArrowLeft") setStep((s) => Math.max(s - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const s = STEPS[step];
  const Icon = s.icon;
  const last = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="card relative w-full max-w-lg p-6 z-10">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-500 hover:text-slate-300">
          <X size={20} />
        </button>

        <div className="w-12 h-12 rounded-xl bg-indigo-500/15 flex items-center justify-center mb-4">
          <Icon size={24} className="text-indigo-400" />
        </div>
        <h2 className="text-lg font-semibold">{s.title}</h2>
        <p className="text-sm text-slate-400 mt-2 leading-relaxed">{s.body}</p>

        {/* Progress dots */}
        <div className="flex items-center gap-1.5 mt-6">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-indigo-500" : "w-1.5 bg-slate-700 hover:bg-slate-600"}`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        <div className="flex items-center justify-between mt-6">
          <div className="text-xs text-slate-500">{step + 1} / {STEPS.length}</div>
          <div className="flex gap-2">
            {step > 0 && (
              <button className="btn-ghost" onClick={() => setStep((x) => x - 1)}>
                <ArrowLeft size={15} /> Back
              </button>
            )}
            {last ? (
              <button className="btn-primary" onClick={onClose}>Get started</button>
            ) : (
              <button className="btn-primary" onClick={() => setStep((x) => x + 1)}>
                Next <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
