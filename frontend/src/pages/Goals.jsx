import { useEffect, useState, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, Target, Calculator, CheckCircle2 } from "lucide-react";
import api, { errorMessage } from "../api/client";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAccounts } from "../context/AccountContext.jsx";
import { fmtMoney, fmtNumber } from "../lib/format";

const METRICS = {
  net_pnl: { label: "Net P&L ($)", fmt: (v) => fmtMoney(v) },
  win_rate: { label: "Win rate (%)", fmt: (v) => `${fmtNumber(v)}%` },
  trades: { label: "Closed trades", fmt: (v) => fmtNumber(v, 0) },
  profit_factor: { label: "Profit factor", fmt: (v) => fmtNumber(v) },
};

const emptyGoal = () => ({ name: "", metric: "net_pnl", target: "", period: "all_time", account_id: "" });

function GoalCard({ goal, onEdit, onDelete }) {
  const meta = METRICS[goal.metric];
  const pct = Math.min(goal.progress_pct, 100);
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{goal.name}</h3>
            {goal.achieved && <CheckCircle2 size={16} className="text-emerald-400" />}
          </div>
          <div className="text-xs text-slate-500">{meta.label} · {goal.period === "monthly" ? "this month" : "all time"}</div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(goal)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200"><Pencil size={15} /></button>
          <button onClick={() => onDelete(goal)} className="p-1.5 rounded-md hover:bg-rose-600/20 text-slate-400 hover:text-rose-400"><Trash2 size={15} /></button>
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-slate-300 font-medium">{meta.fmt(goal.current)}</span>
          <span className="text-slate-500">of {meta.fmt(goal.target)}</span>
        </div>
        <div className="h-2.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${goal.achieved ? "bg-emerald-500" : "bg-indigo-500"}`}
            style={{ width: `${Math.max(pct, 2)}%` }}
          />
        </div>
        <div className="text-right text-xs text-slate-500 mt-1">{fmtNumber(goal.progress_pct, 0)}%</div>
      </div>
    </div>
  );
}

function PositionSizer() {
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");

  const result = useMemo(() => {
    const a = parseFloat(accountSize), r = parseFloat(riskPct), e = parseFloat(entry), s = parseFloat(stop);
    if (!a || !r || !e || !s || e === s) return null;
    const riskAmount = a * (r / 100);
    const perUnit = Math.abs(e - s);
    const units = riskAmount / perUnit;
    return { riskAmount, perUnit, units, positionValue: units * e };
  }, [accountSize, riskPct, entry, stop]);

  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator size={18} className="text-indigo-400" />
        <h2 className="font-semibold">Position size calculator</h2>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Account size ($)</label>
          <input type="number" className="input" value={accountSize} onChange={(e) => setAccountSize(e.target.value)} />
        </div>
        <div>
          <label className="label">Risk per trade (%)</label>
          <input type="number" step="0.1" className="input" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} />
        </div>
        <div>
          <label className="label">Entry price</label>
          <input type="number" step="any" className="input" value={entry} onChange={(e) => setEntry(e.target.value)} placeholder="100" />
        </div>
        <div>
          <label className="label">Stop price</label>
          <input type="number" step="any" className="input" value={stop} onChange={(e) => setStop(e.target.value)} placeholder="98" />
        </div>
      </div>
      {result ? (
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-slate-800">
          <div>
            <div className="text-[11px] text-slate-500 uppercase">Risk amount</div>
            <div className="font-semibold text-rose-400">{fmtMoney(result.riskAmount)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 uppercase">Position size</div>
            <div className="font-semibold">{fmtNumber(result.units, 2)} units</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 uppercase">Risk / unit</div>
            <div className="font-semibold">{fmtMoney(result.perUnit)}</div>
          </div>
          <div>
            <div className="text-[11px] text-slate-500 uppercase">Position value</div>
            <div className="font-semibold">{fmtMoney(result.positionValue)}</div>
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-500 mt-4 pt-4 border-t border-slate-800">
          Enter entry and stop prices to size your position for a fixed risk.
        </p>
      )}
    </div>
  );
}

export default function Goals() {
  const toast = useToast();
  const { accounts } = useAccounts();
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyGoal());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/goals");
      setGoals(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => { setEditing(null); setForm(emptyGoal()); setOpen(true); };
  const openEdit = (g) => {
    setEditing(g);
    setForm({ name: g.name, metric: g.metric, target: g.target, period: g.period, account_id: g.account_id ?? "" });
    setOpen(true);
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        metric: form.metric,
        target: parseFloat(form.target) || 0,
        period: form.period,
        account_id: form.account_id === "" ? null : Number(form.account_id),
      };
      if (editing) {
        await api.patch(`/api/goals/${editing.id}`, payload);
        toast.success("Goal updated.");
      } else {
        await api.post("/api/goals", payload);
        toast.success("Goal created.");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save goal."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g) => {
    if (!window.confirm(`Delete goal "${g.name}"?`)) return;
    try {
      await api.delete(`/api/goals/${g.id}`);
      toast.success("Goal deleted.");
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete goal."));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Goals &amp; Risk</h1>
          <p className="text-slate-500 text-sm">Set targets, track progress, and size positions with discipline.</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={16} /> New goal</button>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : goals.length === 0 ? (
        <div className="card p-10 text-center">
          <Target size={28} className="mx-auto text-slate-600 mb-2" />
          <div className="text-slate-300 font-medium">No goals yet</div>
          <p className="text-slate-500 text-sm mt-1">Set a target like "$1,000 net this month" and track it automatically.</p>
          <button className="btn-primary mt-4 mx-auto" onClick={openNew}><Plus size={16} /> Create a goal</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.map((g) => <GoalCard key={g.id} goal={g} onEdit={openEdit} onDelete={remove} />)}
        </div>
      )}

      <PositionSizer />

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit goal" : "New goal"}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={set("name")} placeholder="Hit $1,000 this month" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Metric</label>
              <select className="input" value={form.metric} onChange={set("metric")}>
                {Object.entries(METRICS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Target</label>
              <input type="number" step="any" className="input" value={form.target} onChange={set("target")} required />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Period</label>
              <select className="input" value={form.period} onChange={set("period")}>
                <option value="all_time">All time</option>
                <option value="monthly">This month</option>
              </select>
            </div>
            <div>
              <label className="label">Account</label>
              <select className="input" value={form.account_id} onChange={set("account_id")}>
                <option value="">All accounts</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
