import { useEffect, useState, useCallback, useRef } from "react";
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
import { FlaskConical, Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import api, { errorMessage } from "../api/client";
import { useAccounts } from "../context/AccountContext.jsx";
import { useToast } from "../components/Toast.jsx";
import { fmtMoney, fmtPct, fmtNumber, pnlColor } from "../lib/format";

const WEEKDAYS = [
  { i: 0, l: "Mon" }, { i: 1, l: "Tue" }, { i: 2, l: "Wed" }, { i: 3, l: "Thu" },
  { i: 4, l: "Fri" }, { i: 5, l: "Sat" }, { i: 6, l: "Sun" },
];

function StatDelta({ label, filtered, all, fmt = fmtMoney, color }) {
  return (
    <div className="card p-4">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className={`text-xl font-bold mt-1 ${color ? color(filtered) : ""}`}>{fmt(filtered)}</div>
      <div className="text-xs text-slate-500 mt-0.5">all trades: {fmt(all)}</div>
    </div>
  );
}

function ReplayChart({ equity, baseline }) {
  const [k, setK] = useState(equity.length - 1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    setK(equity.length - 1);
    setPlaying(false);
  }, [equity]);

  useEffect(() => {
    if (!playing) return;
    timer.current = setInterval(() => {
      setK((cur) => {
        if (cur >= equity.length - 1) {
          setPlaying(false);
          return cur;
        }
        return cur + 1;
      });
    }, 250);
    return () => clearInterval(timer.current);
  }, [playing, equity.length]);

  const startReplay = () => {
    setK(0);
    setPlaying(true);
  };

  const shown = equity.slice(0, k + 1);
  const current = equity[k];

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <h2 className="font-semibold">Equity replay</h2>
          <p className="text-xs text-slate-500">Play back the filtered trades one at a time.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={startReplay}><RotateCcw size={14} /> Replay</button>
          <button className="btn-primary" onClick={() => setPlaying((p) => !p)}>
            {playing ? <><Pause size={15} /> Pause</> : <><Play size={15} /> Play</>}
          </button>
          <button className="btn-ghost" onClick={() => setK((c) => Math.min(c + 1, equity.length - 1))}>
            <SkipForward size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 mb-2 text-sm">
        <span className="text-slate-400">Trade {k}/{equity.length - 1}</span>
        <span className={`font-semibold ${pnlColor(current?.equity - baseline)}`}>
          Equity {fmtMoney(current?.equity ?? baseline)}
        </span>
        {current?.symbol && (
          <span className={`text-xs ${pnlColor(current.pnl)}`}>{current.symbol} {fmtMoney(current.pnl)}</span>
        )}
      </div>

      <input
        type="range"
        min={0}
        max={equity.length - 1}
        value={k}
        onChange={(e) => { setPlaying(false); setK(Number(e.target.value)); }}
        className="w-full accent-indigo-500 mb-3"
      />

      <ResponsiveContainer width="100%" height={260}>
        <AreaChart data={shown} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="simFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis dataKey="index" hide />
          <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} width={52} domain={["auto", "auto"]} />
          <Tooltip
            contentStyle={{ background: "#0f172a", border: "1px solid #1e293b", borderRadius: 8, fontSize: 12 }}
            formatter={(v) => fmtMoney(v)}
          />
          <ReferenceLine y={baseline} stroke="#475569" strokeDasharray="4 4" />
          <Area type="monotone" dataKey="equity" stroke="#6366f1" strokeWidth={2} fill="url(#simFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Simulator() {
  const toast = useToast();
  const { accountParams } = useAccounts();
  const accountKey = JSON.stringify(accountParams);
  const [playbooks, setPlaybooks] = useState([]);
  const [filters, setFilters] = useState({
    directions: [], playbook_ids: [], weekdays: [], min_rating: "", exclude_mistakes: false, setups: "",
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/api/playbooks").then((r) => setPlaybooks(r.data)).catch(() => {});
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const body = {
        ...accountParams,
        directions: filters.directions,
        playbook_ids: filters.playbook_ids,
        weekdays: filters.weekdays,
        min_rating: filters.min_rating ? Number(filters.min_rating) : null,
        exclude_mistakes: filters.exclude_mistakes,
        setups: filters.setups.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const { data } = await api.post("/api/backtest", body);
      setResult(data);
    } catch (err) {
      toast.error(errorMessage(err, "Backtest failed."));
    } finally {
      setLoading(false);
    }
  }, [filters, accountKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Run once on load (and when account changes) to show the full history replay.
  useEffect(() => { run(); }, [accountKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleIn = (key, val) =>
    setFilters((f) => ({
      ...f,
      [key]: f[key].includes(val) ? f[key].filter((x) => x !== val) : [...f[key], val],
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FlaskConical size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold">Simulator &amp; Replay</h1>
          <p className="text-slate-500 text-sm">Filter your history to test a strategy, then replay the result.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Direction</label>
            <div className="flex gap-2">
              {["long", "short"].map((d) => (
                <button key={d} onClick={() => toggleIn("directions", d)} className={`badge px-3 py-1.5 ${filters.directions.includes(d) ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>{d}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Weekday</label>
            <div className="flex gap-1 flex-wrap">
              {WEEKDAYS.map((w) => (
                <button key={w.i} onClick={() => toggleIn("weekdays", w.i)} className={`badge px-2.5 py-1.5 ${filters.weekdays.includes(w.i) ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>{w.l}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Playbook</label>
            <div className="flex gap-1 flex-wrap">
              {playbooks.length === 0 && <span className="text-xs text-slate-500">No playbooks</span>}
              {playbooks.map((p) => (
                <button key={p.id} onClick={() => toggleIn("playbook_ids", p.id)} className={`badge px-2.5 py-1.5 ${filters.playbook_ids.includes(p.id) ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"}`}>{p.name}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Min rating</label>
              <select className="input" value={filters.min_rating} onChange={(e) => setFilters((f) => ({ ...f, min_rating: e.target.value }))}>
                <option value="">Any</option>
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+ ★</option>)}
              </select>
            </div>
            <div>
              <label className="label">Setups (comma)</label>
              <input className="input" value={filters.setups} onChange={(e) => setFilters((f) => ({ ...f, setups: e.target.value }))} placeholder="Breakout, Pullback" />
            </div>
          </div>
        </div>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={filters.exclude_mistakes} onChange={(e) => setFilters((f) => ({ ...f, exclude_mistakes: e.target.checked }))} />
            Exclude trades with mistakes
          </label>
          <div className="flex gap-2">
            <button className="btn-ghost" onClick={() => setFilters({ directions: [], playbook_ids: [], weekdays: [], min_rating: "", exclude_mistakes: false, setups: "" })}>Reset</button>
            <button className="btn-primary" onClick={run} disabled={loading}>{loading ? "Running…" : "Run simulation"}</button>
          </div>
        </div>
      </div>

      {result && (
        <>
          <div className="text-sm text-slate-400">
            Matched <span className="font-semibold text-slate-200">{result.matched}</span> of {result.total_closed} closed trades.
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatDelta label="Net P&L" filtered={result.filtered.net_pnl} all={result.all.net_pnl} color={pnlColor} />
            <StatDelta label="Win rate" filtered={result.filtered.win_rate} all={result.all.win_rate} fmt={fmtPct} />
            <StatDelta label="Profit factor" filtered={result.filtered.profit_factor ?? 0} all={result.all.profit_factor ?? 0} fmt={(v) => fmtNumber(v)} />
            <StatDelta label="Max drawdown" filtered={-(result.filtered.max_drawdown || 0)} all={0} fmt={fmtMoney} color={() => "text-rose-400"} />
          </div>
          {result.equity_curve.length > 1 ? (
            <ReplayChart equity={result.equity_curve} baseline={result.baseline} />
          ) : (
            <div className="card p-10 text-center text-slate-500 text-sm">No matching closed trades to replay. Loosen your filters.</div>
          )}
        </>
      )}
    </div>
  );
}
