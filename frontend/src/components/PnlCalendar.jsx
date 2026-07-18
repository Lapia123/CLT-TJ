import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { fmtMoney } from "../lib/format";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function PnlCalendar({ data }) {
  // Map YYYY-MM-DD -> {net_pnl, trades}
  const byDay = useMemo(() => {
    const m = {};
    for (const d of data) m[d.date] = d;
    return m;
  }, [data]);

  // Default to the month of the most recent trade day, else current month.
  const latest = data.length ? new Date(data[data.length - 1].date + "T00:00:00") : new Date();
  const [cursor, setCursor] = useState(new Date(latest.getFullYear(), latest.getMonth(), 1));

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthKey = (d) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const monthTotal = cells.reduce((sum, d) => {
    if (!d) return sum;
    const rec = byDay[monthKey(d)];
    return sum + (rec ? rec.net_pnl : 0);
  }, 0);

  const shift = (delta) => setCursor(new Date(year, month + delta, 1));

  const cellClass = (rec) => {
    if (!rec) return "bg-slate-800/40 text-slate-600";
    if (rec.net_pnl > 0) return "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30";
    if (rec.net_pnl < 0) return "bg-rose-500/20 text-rose-300 border border-rose-500/30";
    return "bg-slate-700/50 text-slate-300";
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => shift(-1)} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400">
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <div className="font-medium">
            {cursor.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <div className={`text-xs ${monthTotal >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmtMoney(monthTotal, { sign: true })}
          </div>
        </div>
        <button onClick={() => shift(1)} className="p-1.5 rounded-md hover:bg-slate-800 text-slate-400">
          <ChevronRight size={18} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center text-[11px] text-slate-500 font-medium pb-1">
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const rec = byDay[monthKey(d)];
          return (
            <div
              key={i}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs ${cellClass(rec)}`}
              title={rec ? `${monthKey(d)}: ${fmtMoney(rec.net_pnl)} (${rec.trades} trades)` : ""}
            >
              <span className="text-[11px] opacity-70">{d}</span>
              {rec && (
                <span className="text-[10px] font-semibold leading-tight">
                  {rec.net_pnl >= 0 ? "+" : ""}
                  {Math.round(rec.net_pnl)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
