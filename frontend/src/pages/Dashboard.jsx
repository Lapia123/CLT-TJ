import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  Wallet,
  Percent,
  TrendingUp,
  Scale,
  Activity,
  Trophy,
  Flame,
  Plus,
} from "lucide-react";
import { TrendingDown } from "lucide-react";
import api from "../api/client";
import { useAuth } from "../context/AuthContext.jsx";
import { useAccounts } from "../context/AccountContext.jsx";
import StatCard from "../components/StatCard.jsx";
import EquityCurve from "../components/EquityCurve.jsx";
import TradeForm from "../components/TradeForm.jsx";
import { fmtMoney, fmtPct, fmtNumber, pnlColor, fmtDate } from "../lib/format";

export default function Dashboard() {
  const { user } = useAuth();
  const { accountParams } = useAccounts();
  const [summary, setSummary] = useState(null);
  const [curve, setCurve] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const accountKey = JSON.stringify(accountParams);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, c, t] = await Promise.all([
        api.get("/api/analytics/summary", { params: accountParams }),
        api.get("/api/analytics/equity-curve", { params: accountParams }),
        api.get("/api/trades", { params: { ...accountParams, limit: 8 } }),
      ]);
      setSummary(s.data);
      setCurve(c.data);
      setRecent(t.data);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !summary) {
    return <div className="text-slate-500">Loading dashboard…</div>;
  }

  const hasTrades = summary.total_trades > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-slate-500 text-sm">Welcome back, {user?.name}.</p>
        </div>
        <button className="btn-primary" onClick={() => setFormOpen(true)}>
          <Plus size={16} /> Log trade
        </button>
      </div>

      {!hasTrades ? (
        <div className="card p-10 text-center">
          <div className="text-slate-300 font-medium">No trades yet</div>
          <p className="text-slate-500 text-sm mt-1">
            Log your first trade to start building your performance history.
          </p>
          <button className="btn-primary mt-4 mx-auto" onClick={() => setFormOpen(true)}>
            <Plus size={16} /> Log your first trade
          </button>
        </div>
      ) : (
        <>
          {/* Top stat row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Net P&L"
              value={fmtMoney(summary.net_pnl)}
              valueClass={pnlColor(summary.net_pnl)}
              sub={`${summary.closed_trades} closed trades`}
              icon={TrendingUp}
            />
            <StatCard
              label="Balance"
              value={fmtMoney(summary.current_balance)}
              sub={`from ${fmtMoney(summary.starting_balance)}`}
              icon={Wallet}
            />
            <StatCard
              label="Win rate"
              value={fmtPct(summary.win_rate)}
              sub={`${summary.wins}W / ${summary.losses}L`}
              icon={Percent}
            />
            <StatCard
              label="Profit factor"
              value={summary.profit_factor === null ? "∞" : fmtNumber(summary.profit_factor)}
              sub={`Expectancy ${fmtMoney(summary.expectancy)}`}
              icon={Scale}
            />
          </div>

          {/* Equity curve */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Equity curve</h2>
              <span className={`text-sm font-medium ${pnlColor(summary.net_pnl)}`}>
                {fmtMoney(summary.net_pnl, { sign: true })}
              </span>
            </div>
            <EquityCurve data={curve} startingBalance={summary.starting_balance} />
          </div>

          {/* Secondary stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Avg win" value={fmtMoney(summary.avg_win)} valueClass="text-emerald-400" icon={Trophy} />
            <StatCard label="Avg loss" value={fmtMoney(summary.avg_loss)} valueClass="text-rose-400" icon={Activity} />
            <StatCard
              label="Best / Worst"
              value={
                <span className="text-base">
                  <span className="text-emerald-400">{fmtMoney(summary.best_trade)}</span>
                  <span className="text-slate-600"> / </span>
                  <span className="text-rose-400">{fmtMoney(summary.worst_trade)}</span>
                </span>
              }
              icon={Scale}
            />
            <StatCard
              label="Streaks"
              value={
                <span className="text-base">
                  <span className="text-emerald-400">{summary.max_win_streak}W</span>
                  <span className="text-slate-600"> · </span>
                  <span className="text-rose-400">{summary.max_loss_streak}L</span>
                </span>
              }
              sub={summary.avg_r_multiple !== null ? `Avg ${fmtNumber(summary.avg_r_multiple)}R` : undefined}
              icon={Flame}
            />
          </div>

          {/* Risk row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Max drawdown"
              value={fmtMoney(summary.max_drawdown ? -summary.max_drawdown : 0)}
              valueClass="text-rose-400"
              sub={summary.max_drawdown_pct ? `${fmtNumber(summary.max_drawdown_pct)}% peak-to-trough` : "—"}
              icon={TrendingDown}
            />
            <StatCard label="Expectancy" value={fmtMoney(summary.expectancy)} valueClass={pnlColor(summary.expectancy)} sub="per trade" icon={Scale} />
            <StatCard label="Open trades" value={summary.open_trades} sub="currently held" icon={Activity} />
            <StatCard label="Avg R" value={summary.avg_r_multiple !== null ? `${fmtNumber(summary.avg_r_multiple)}R` : "—"} valueClass={pnlColor(summary.avg_r_multiple)} icon={TrendingUp} />
          </div>

          {/* Recent trades */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Recent trades</h2>
              <Link to="/trades" className="text-sm text-indigo-400 hover:text-indigo-300">
                View all
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-4 font-medium">Symbol</th>
                    <th className="py-2 pr-4 font-medium">Side</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Entry</th>
                    <th className="py-2 pr-4 font-medium text-right">Net P&L</th>
                    <th className="py-2 font-medium">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((t) => (
                    <tr key={t.id} className="border-b border-slate-800/60 last:border-0">
                      <td className="py-2 pr-4 font-medium">{t.symbol}</td>
                      <td className="py-2 pr-4">
                        <span className={`badge ${t.direction === "long" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
                          {t.direction}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`badge ${t.status === "open" ? "bg-amber-500/15 text-amber-400" : "bg-slate-700 text-slate-300"}`}>
                          {t.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-400">{fmtNumber(t.entry_price)}</td>
                      <td className={`py-2 pr-4 text-right font-medium ${pnlColor(t.net_pnl)}`}>
                        {t.net_pnl === null ? "—" : fmtMoney(t.net_pnl)}
                      </td>
                      <td className="py-2 text-slate-500">{fmtDate(t.entry_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <TradeForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} trade={null} />
    </div>
  );
}
