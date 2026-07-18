import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, X, Upload, Star } from "lucide-react";
import api, { errorMessage } from "../api/client";
import TradeForm from "../components/TradeForm.jsx";
import TradeDetail from "../components/TradeDetail.jsx";
import ImportModal from "../components/ImportModal.jsx";
import { useToast } from "../components/Toast.jsx";
import { useAccounts } from "../context/AccountContext.jsx";
import { fmtMoney, fmtNumber, fmtPct, pnlColor, fmtDate } from "../lib/format";

export default function Trades() {
  const toast = useToast();
  const { accounts, accountParams } = useAccounts();
  const [trades, setTrades] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const [filters, setFilters] = useState({ status: "", direction: "" });
  const [search, setSearch] = useState("");

  const accountKey = JSON.stringify(accountParams);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...accountParams };
      if (filters.status) params.status = filters.status;
      if (filters.direction) params.direction = filters.direction;
      const [t, pb] = await Promise.all([
        api.get("/api/trades", { params }),
        api.get("/api/playbooks"),
      ]);
      setTrades(t.data);
      setPlaybooks(pb.data);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, accountKey]);

  useEffect(() => {
    load();
  }, [load]);

  const nameFor = (list, id) => list.find((x) => x.id === id)?.name;

  const openNew = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (t) => { setDetail(null); setEditing(t); setFormOpen(true); };

  const remove = async (t) => {
    if (!window.confirm(`Delete ${t.symbol} trade? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/trades/${t.id}`);
      toast.success("Trade deleted.");
      setDetail(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete trade."));
    }
  };

  const visible = trades.filter((t) =>
    search ? t.symbol.toLowerCase().includes(search.toLowerCase()) : true
  );
  const setF = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Trades</h1>
          <p className="text-slate-500 text-sm">{visible.length} of {trades.length} trades</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost" onClick={() => setImportOpen(true)}><Upload size={16} /> Import</button>
          <button className="btn-primary" onClick={openNew}><Plus size={16} /> Log trade</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[160px]">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input className="input pl-9" placeholder="Search symbol…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input w-auto" value={filters.status} onChange={setF("status")}>
          <option value="">All status</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>
        <select className="input w-auto" value={filters.direction} onChange={setF("direction")}>
          <option value="">All sides</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </select>
        {(filters.status || filters.direction || search) && (
          <button className="btn-ghost" onClick={() => { setFilters({ status: "", direction: "" }); setSearch(""); }}>
            <X size={14} /> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-800 bg-slate-900/40">
                <th className="py-3 px-4 font-medium">Symbol</th>
                <th className="py-3 px-4 font-medium">Side</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Net P&L</th>
                <th className="py-3 px-4 font-medium text-right">R</th>
                <th className="py-3 px-4 font-medium">Playbook</th>
                <th className="py-3 px-4 font-medium">Rating</th>
                <th className="py-3 px-4 font-medium">Date</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">Loading…</td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-10 text-slate-500">No trades match.</td></tr>
              ) : (
                visible.map((t) => (
                  <tr key={t.id} onClick={() => setDetail(t)} className="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/30 cursor-pointer">
                    <td className="py-3 px-4 font-medium">{t.symbol}</td>
                    <td className="py-3 px-4">
                      <span className={`badge ${t.direction === "long" ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>{t.direction}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className={`badge ${t.status === "open" ? "bg-amber-500/15 text-amber-400" : "bg-slate-700 text-slate-300"}`}>{t.status}</span>
                    </td>
                    <td className={`py-3 px-4 text-right font-medium ${pnlColor(t.net_pnl)}`}>
                      {t.net_pnl === null ? "—" : fmtMoney(t.net_pnl)}
                      {t.return_pct !== null && <span className="block text-[11px] text-slate-500">{fmtPct(t.return_pct)}</span>}
                    </td>
                    <td className={`py-3 px-4 text-right ${pnlColor(t.r_multiple)}`}>{t.r_multiple === null ? "—" : `${fmtNumber(t.r_multiple)}R`}</td>
                    <td className="py-3 px-4 text-slate-400">{nameFor(playbooks, t.playbook_id) || "—"}</td>
                    <td className="py-3 px-4">
                      {t.rating ? (
                        <span className="flex items-center gap-0.5 text-amber-400"><Star size={13} className="fill-amber-400" /> {t.rating}</span>
                      ) : <span className="text-slate-600">—</span>}
                    </td>
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{fmtDate(t.entry_date)}</td>
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(t)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200"><Pencil size={15} /></button>
                        <button onClick={() => remove(t)} className="p-1.5 rounded-md hover:bg-rose-600/20 text-slate-400 hover:text-rose-400"><Trash2 size={15} /></button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <TradeForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} trade={editing} />
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
      <TradeDetail
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        trade={detail}
        playbookName={detail && nameFor(playbooks, detail.playbook_id)}
        accountName={detail && nameFor(accounts, detail.account_id)}
        onEdit={openEdit}
        onDelete={remove}
      />
    </div>
  );
}
