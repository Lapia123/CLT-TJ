import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import api from "../api/client";
import { fmtMoney, fmtPct, pnlColor } from "../lib/format";
import PnlCalendar from "../components/PnlCalendar.jsx";

const DIMENSIONS = [
  { key: "symbol", label: "Symbol" },
  { key: "setup", label: "Setup" },
  { key: "direction", label: "Direction" },
  { key: "weekday", label: "Weekday" },
];

export default function Analytics() {
  const [dimension, setDimension] = useState("symbol");
  const [breakdown, setBreakdown] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBreakdown = useCallback(async (dim) => {
    const { data } = await api.get("/api/analytics/breakdown", { params: { dimension: dim } });
    setBreakdown(data);
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [, cal] = await Promise.all([
          loadBreakdown(dimension),
          api.get("/api/analytics/calendar"),
        ]);
        setCalendar(cal.data);
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadBreakdown(dimension);
  }, [dimension, loadBreakdown]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="card px-3 py-2 text-xs space-y-0.5">
        <div className="font-semibold">{p.key}</div>
        <div className={pnlColor(p.net_pnl)}>{fmtMoney(p.net_pnl)}</div>
        <div className="text-slate-400">{p.trades} trades · {fmtPct(p.win_rate)} win</div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics</h1>
        <p className="text-slate-500 text-sm">Break down where your edge comes from.</p>
      </div>

      {/* Breakdown */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-semibold">Performance by</h2>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
            {DIMENSIONS.map((d) => (
              <button
                key={d.key}
                onClick={() => setDimension(d.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  dimension === d.key ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {breakdown.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No closed trades to analyze yet.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={breakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="key" tick={{ fill: "#64748b", fontSize: 11 }} />
                <YAxis
                  tick={{ fill: "#64748b", fontSize: 11 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
                  width={52}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "#1e293b55" }} />
                <Bar dataKey="net_pnl" radius={[4, 4, 0, 0]}>
                  {breakdown.map((entry, i) => (
                    <Cell key={i} fill={entry.net_pnl >= 0 ? "#10b981" : "#f43f5e"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-800">
                    <th className="py-2 pr-4 font-medium">{DIMENSIONS.find((d) => d.key === dimension)?.label}</th>
                    <th className="py-2 pr-4 font-medium text-right">Trades</th>
                    <th className="py-2 pr-4 font-medium text-right">Win rate</th>
                    <th className="py-2 font-medium text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b) => (
                    <tr key={b.key} className="border-b border-slate-800/50 last:border-0">
                      <td className="py-2 pr-4 font-medium">{b.key}</td>
                      <td className="py-2 pr-4 text-right text-slate-400">{b.trades}</td>
                      <td className="py-2 pr-4 text-right text-slate-400">{fmtPct(b.win_rate)}</td>
                      <td className={`py-2 text-right font-medium ${pnlColor(b.net_pnl)}`}>{fmtMoney(b.net_pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Calendar */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4">Daily P&L calendar</h2>
        {loading ? (
          <div className="text-slate-500 text-sm">Loading…</div>
        ) : (
          <PnlCalendar data={calendar} />
        )}
      </div>
    </div>
  );
}
