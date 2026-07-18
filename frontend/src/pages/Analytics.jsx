import { useEffect, useState, useCallback } from "react";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  CartesianGrid,
} from "recharts";
import api from "../api/client";
import { useAccounts } from "../context/AccountContext.jsx";
import { fmtMoney, fmtPct, pnlColor } from "../lib/format";
import PnlCalendar from "../components/PnlCalendar.jsx";

const DIMENSIONS = [
  { key: "symbol", label: "Symbol" },
  { key: "setup", label: "Setup" },
  { key: "direction", label: "Direction" },
  { key: "weekday", label: "Weekday" },
  { key: "tag", label: "Tag" },
  { key: "mistake", label: "Mistake" },
];

function ChartCard({ title, children, subtitle }) {
  return (
    <div className="card p-5">
      <div className="mb-3">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export default function Analytics() {
  const { accountParams } = useAccounts();
  const accountKey = JSON.stringify(accountParams);
  const [dimension, setDimension] = useState("symbol");
  const [breakdown, setBreakdown] = useState([]);
  const [calendar, setCalendar] = useState([]);
  const [cumulative, setCumulative] = useState([]);
  const [rDist, setRDist] = useState([]);
  const [timeOfDay, setTimeOfDay] = useState([]);
  const [holdTime, setHoldTime] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadBreakdown = useCallback(
    async (dim) => {
      const { data } = await api.get("/api/analytics/breakdown", { params: { ...accountParams, dimension: dim } });
      setBreakdown(data);
    },
    [accountKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [cal, cum, rd, tod, ht] = await Promise.all([
          api.get("/api/analytics/calendar", { params: accountParams }),
          api.get("/api/analytics/cumulative", { params: accountParams }),
          api.get("/api/analytics/r-distribution", { params: accountParams }),
          api.get("/api/analytics/time-of-day", { params: accountParams }),
          api.get("/api/analytics/hold-time", { params: accountParams }),
        ]);
        setCalendar(cal.data);
        setCumulative(cum.data);
        setRDist(rd.data);
        setTimeOfDay(tod.data.filter((h) => h.trades > 0));
        setHoldTime(ht.data);
      } finally {
        setLoading(false);
      }
    })();
    loadBreakdown(dimension);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey]);

  useEffect(() => {
    loadBreakdown(dimension);
  }, [dimension, loadBreakdown]);

  const money = (v) => `$${(v / 1000).toFixed(1)}k`;

  const BreakdownTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="card px-3 py-2 text-xs space-y-0.5">
        <div className="font-semibold">{p.key ?? p.bucket ?? p.hour}</div>
        {p.net_pnl !== undefined && <div className={pnlColor(p.net_pnl)}>{fmtMoney(p.net_pnl)}</div>}
        {p.trades !== undefined && <div className="text-slate-400">{p.trades} trades {p.win_rate !== undefined ? `· ${fmtPct(p.win_rate)}` : ""}</div>}
        {p.count !== undefined && <div className="text-slate-400">{p.count} trades</div>}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Analytics &amp; Reports</h1>
        <p className="text-slate-500 text-sm">Break down where your edge comes from.</p>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : (
        <>
          {/* Cumulative P&L */}
          <ChartCard title="Cumulative net P&L" subtitle="Running total across closed trades">
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={cumulative} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="index" hide />
                <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={money} width={52} />
                <Tooltip content={<BreakdownTooltip />} />
                <Area type="monotone" dataKey="cumulative" stroke="#6366f1" strokeWidth={2} fill="url(#cumFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Breakdown */}
          <ChartCard title="Performance by">
            <div className="flex gap-1 bg-slate-800 rounded-lg p-1 mb-4 flex-wrap w-fit">
              {DIMENSIONS.map((d) => (
                <button
                  key={d.key}
                  onClick={() => setDimension(d.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${dimension === d.key ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {breakdown.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No closed trades to analyze yet.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={breakdown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="key" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={money} width={52} />
                    <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "#1e293b55" }} />
                    <Bar dataKey="net_pnl" radius={[4, 4, 0, 0]}>
                      {breakdown.map((e, i) => (
                        <Cell key={i} fill={e.net_pnl >= 0 ? "#10b981" : "#f43f5e"} />
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
          </ChartCard>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* R distribution */}
            <ChartCard title="R-multiple distribution" subtitle="How your risk-adjusted outcomes cluster">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={rDist} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="bucket" tick={{ fill: "#64748b", fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={50} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} allowDecimals={false} width={30} />
                  <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "#1e293b55" }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {rDist.map((e, i) => (
                      <Cell key={i} fill={e.bucket.includes("-") && !e.bucket.includes("..") ? "#f43f5e" : e.bucket.startsWith("-") || e.bucket.startsWith("<") ? "#f43f5e" : "#10b981"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            {/* Hold time */}
            <ChartCard title="Performance by hold time" subtitle="Do you do better on scalps or swings?">
              {holdTime.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-sm">No closed trades yet.</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={holdTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="key" tick={{ fill: "#64748b", fontSize: 11 }} />
                    <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={money} width={52} />
                    <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "#1e293b55" }} />
                    <Bar dataKey="net_pnl" radius={[4, 4, 0, 0]}>
                      {holdTime.map((e, i) => (
                        <Cell key={i} fill={e.net_pnl >= 0 ? "#10b981" : "#f43f5e"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </div>

          {/* Time of day */}
          <ChartCard title="Performance by time of day" subtitle="Net P&L grouped by entry hour">
            {timeOfDay.length === 0 ? (
              <div className="text-center py-10 text-slate-500 text-sm">No closed trades yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={timeOfDay} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="hour" tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(h) => `${h}:00`} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={money} width={52} />
                  <Tooltip content={<BreakdownTooltip />} cursor={{ fill: "#1e293b55" }} />
                  <Bar dataKey="net_pnl" radius={[4, 4, 0, 0]}>
                    {timeOfDay.map((e, i) => (
                      <Cell key={i} fill={e.net_pnl >= 0 ? "#10b981" : "#f43f5e"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Calendar */}
          <ChartCard title="Daily P&L calendar">
            <PnlCalendar data={calendar} />
          </ChartCard>
        </>
      )}
    </div>
  );
}
