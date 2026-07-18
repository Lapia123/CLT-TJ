import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { fmtMoney, fmtDate } from "../lib/format";

export default function EquityCurve({ data, startingBalance }) {
  const chartData = data.map((p, i) => ({
    idx: i,
    equity: p.equity,
    date: p.date,
    symbol: p.symbol,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="card px-3 py-2 text-xs">
        <div className="font-semibold text-slate-100">{fmtMoney(p.equity)}</div>
        {p.date && <div className="text-slate-400">{fmtDate(p.date)}</div>}
        {p.symbol && <div className="text-slate-500">{p.symbol}</div>}
      </div>
    );
  };

  const last = chartData[chartData.length - 1]?.equity ?? startingBalance;
  const up = last >= startingBalance;
  const color = up ? "#10b981" : "#f43f5e";

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
        <XAxis dataKey="idx" hide />
        <YAxis
          tick={{ fill: "#64748b", fontSize: 11 }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`}
          width={52}
          domain={["auto", "auto"]}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine y={startingBalance} stroke="#475569" strokeDasharray="4 4" />
        <Area type="monotone" dataKey="equity" stroke={color} strokeWidth={2} fill="url(#equityFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}
