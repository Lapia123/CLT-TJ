import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, NotebookPen } from "lucide-react";
import api, { errorMessage } from "../api/client";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { fmtMoney, fmtPct, fmtNumber, pnlColor } from "../lib/format";

const empty = () => ({ name: "", description: "", rules: "" });

export default function Playbooks() {
  const toast = useToast();
  const [playbooks, setPlaybooks] = useState([]);
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pb, st] = await Promise.all([
        api.get("/api/playbooks"),
        api.get("/api/playbooks/stats"),
      ]);
      setPlaybooks(pb.data);
      setStats(st.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statFor = (id) => stats.find((s) => s.id === id);

  const openNew = () => {
    setEditing(null);
    setForm(empty());
    setOpen(true);
  };
  const openEdit = (pb) => {
    setEditing(pb);
    setForm({ name: pb.name, description: pb.description || "", rules: pb.rules || "" });
    setOpen(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/api/playbooks/${editing.id}`, form);
        toast.success("Playbook updated.");
      } else {
        await api.post("/api/playbooks", form);
        toast.success("Playbook created.");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save playbook."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (pb) => {
    if (!window.confirm(`Delete playbook "${pb.name}"? Trades keep their history but lose the link.`)) return;
    try {
      await api.delete(`/api/playbooks/${pb.id}`);
      toast.success("Playbook deleted.");
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete playbook."));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Playbooks</h1>
          <p className="text-slate-500 text-sm">Define your strategies and see which ones actually make money.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> New playbook
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : playbooks.length === 0 ? (
        <div className="card p-10 text-center">
          <NotebookPen size={28} className="mx-auto text-slate-600 mb-2" />
          <div className="text-slate-300 font-medium">No playbooks yet</div>
          <p className="text-slate-500 text-sm mt-1">Create a strategy, tag your trades to it, and track its edge.</p>
          <button className="btn-primary mt-4 mx-auto" onClick={openNew}>
            <Plus size={16} /> Create your first playbook
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {playbooks.map((pb) => {
            const s = statFor(pb.id);
            return (
              <div key={pb.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{pb.name}</h3>
                    {pb.description && <p className="text-sm text-slate-400 mt-0.5">{pb.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(pb)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200"><Pencil size={15} /></button>
                    <button onClick={() => remove(pb)} className="p-1.5 rounded-md hover:bg-rose-600/20 text-slate-400 hover:text-rose-400"><Trash2 size={15} /></button>
                  </div>
                </div>

                {pb.rules && (
                  <pre className="text-xs text-slate-400 mt-3 whitespace-pre-wrap font-sans bg-slate-800/40 rounded-lg p-3">{pb.rules}</pre>
                )}

                <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-slate-800">
                  <div>
                    <div className="text-[11px] text-slate-500 uppercase">Net P&L</div>
                    <div className={`font-semibold ${pnlColor(s?.net_pnl)}`}>{s ? fmtMoney(s.net_pnl) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 uppercase">Trades</div>
                    <div className="font-semibold">{s?.closed_trades ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 uppercase">Win %</div>
                    <div className="font-semibold">{s ? fmtPct(s.win_rate) : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 uppercase">Factor</div>
                    <div className="font-semibold">{s?.profit_factor === null || s?.profit_factor === undefined ? "—" : fmtNumber(s.profit_factor)}</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit playbook" : "New playbook"}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={set("name")} placeholder="Breakout" required />
          </div>
          <div>
            <label className="label">Description</label>
            <input className="input" value={form.description} onChange={set("description")} placeholder="Trade breakouts of key levels on volume." />
          </div>
          <div>
            <label className="label">Rules / checklist</label>
            <textarea className="input min-h-[120px]" value={form.rules} onChange={set("rules")} placeholder={"1. Level tested 2+ times\n2. Volume expansion\n3. Stop below level"} />
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
