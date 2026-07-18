import { useState, useEffect } from "react";
import { Star, Plus, X } from "lucide-react";
import Modal from "./Modal.jsx";
import api, { errorMessage } from "../api/client";
import { useToast } from "./Toast.jsx";
import { useAccounts } from "../context/AccountContext.jsx";
import { fmtDateTimeLocal } from "../lib/format";

const empty = () => ({
  symbol: "",
  direction: "long",
  status: "open",
  quantity: "",
  entry_price: "",
  exit_price: "",
  stop_loss: "",
  take_profit: "",
  fees: "0",
  entry_date: fmtDateTimeLocal(new Date()),
  exit_date: "",
  setup: "",
  tags: "",
  mistakes: "",
  rating: null,
  images: [],
  notes: "",
  account_id: "",
  playbook_id: "",
});

function toPayload(f) {
  const num = (v) => (v === "" || v === null ? null : parseFloat(v));
  const iso = (v) => (v ? new Date(v).toISOString() : null);
  const id = (v) => (v === "" || v === null ? null : Number(v));
  return {
    symbol: f.symbol,
    direction: f.direction,
    status: f.status,
    quantity: num(f.quantity),
    entry_price: num(f.entry_price),
    exit_price: num(f.exit_price),
    stop_loss: num(f.stop_loss),
    take_profit: num(f.take_profit),
    fees: num(f.fees) ?? 0,
    entry_date: iso(f.entry_date),
    exit_date: iso(f.exit_date),
    setup: f.setup || null,
    tags: f.tags || null,
    mistakes: f.mistakes || null,
    rating: f.rating || null,
    images: (f.images || []).filter(Boolean),
    notes: f.notes || null,
    account_id: id(f.account_id),
    playbook_id: id(f.playbook_id),
  };
}

function StarRating({ value, onChange }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          className="text-slate-600 hover:text-amber-400 transition-colors"
        >
          <Star size={20} className={value >= n ? "fill-amber-400 text-amber-400" : ""} />
        </button>
      ))}
      {value ? <span className="text-xs text-slate-500 ml-1">{value}/5</span> : null}
    </div>
  );
}

export default function TradeForm({ open, onClose, onSaved, trade }) {
  const toast = useToast();
  const { accounts } = useAccounts();
  const [form, setForm] = useState(empty());
  const [playbooks, setPlaybooks] = useState([]);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(trade);

  useEffect(() => {
    if (open) api.get("/api/playbooks").then((r) => setPlaybooks(r.data)).catch(() => {});
  }, [open]);

  useEffect(() => {
    if (trade) {
      setForm({
        symbol: trade.symbol ?? "",
        direction: trade.direction ?? "long",
        status: trade.status ?? "open",
        quantity: trade.quantity ?? "",
        entry_price: trade.entry_price ?? "",
        exit_price: trade.exit_price ?? "",
        stop_loss: trade.stop_loss ?? "",
        take_profit: trade.take_profit ?? "",
        fees: trade.fees ?? "0",
        entry_date: fmtDateTimeLocal(trade.entry_date),
        exit_date: trade.exit_date ? fmtDateTimeLocal(trade.exit_date) : "",
        setup: trade.setup ?? "",
        tags: trade.tags ?? "",
        mistakes: trade.mistakes ?? "",
        rating: trade.rating ?? null,
        images: trade.images ?? [],
        notes: trade.notes ?? "",
        account_id: trade.account_id ?? "",
        playbook_id: trade.playbook_id ?? "",
      });
    } else {
      const def = accounts.find((a) => a.is_default) || accounts[0];
      setForm({ ...empty(), account_id: def ? def.id : "" });
    }
  }, [trade, open, accounts]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const setImage = (i, val) =>
    setForm((f) => ({ ...f, images: f.images.map((x, idx) => (idx === i ? val : x)) }));
  const addImage = () => setForm((f) => ({ ...f, images: [...f.images, ""] }));
  const removeImage = (i) =>
    setForm((f) => ({ ...f, images: f.images.filter((_, idx) => idx !== i) }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.status === "closed" && !form.exit_price) return toast.error("A closed trade needs an exit price.");
    if (form.status === "closed" && !form.exit_date) return toast.error("A closed trade needs an exit date.");
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editing) {
        await api.patch(`/api/trades/${trade.id}`, payload);
        toast.success("Trade updated.");
      } else {
        await api.post("/api/trades", payload);
        toast.success("Trade logged.");
      }
      onSaved();
      onClose();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save trade."));
    } finally {
      setSaving(false);
    }
  };

  const isClosed = form.status === "closed";

  return (
    <Modal open={open} onClose={onClose} title={editing ? "Edit trade" : "Log a trade"} maxWidth="max-w-2xl">
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Symbol</label>
            <input className="input uppercase" value={form.symbol} onChange={set("symbol")} placeholder="AAPL" required />
          </div>
          <div>
            <label className="label">Direction</label>
            <select className="input" value={form.direction} onChange={set("direction")}>
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Status</label>
            <select className="input" value={form.status} onChange={set("status")}>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="label">Quantity</label>
            <input type="number" step="any" className="input" value={form.quantity} onChange={set("quantity")} required />
          </div>
          <div>
            <label className="label">Fees</label>
            <input type="number" step="any" className="input" value={form.fees} onChange={set("fees")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Entry price</label>
            <input type="number" step="any" className="input" value={form.entry_price} onChange={set("entry_price")} required />
          </div>
          <div>
            <label className="label">Exit price {isClosed && <span className="text-rose-400">*</span>}</label>
            <input type="number" step="any" className="input" value={form.exit_price} onChange={set("exit_price")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Entry date</label>
            <input type="datetime-local" className="input" value={form.entry_date} onChange={set("entry_date")} required />
          </div>
          <div>
            <label className="label">Exit date {isClosed && <span className="text-rose-400">*</span>}</label>
            <input type="datetime-local" className="input" value={form.exit_date} onChange={set("exit_date")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Stop loss</label>
            <input type="number" step="any" className="input" value={form.stop_loss} onChange={set("stop_loss")} />
          </div>
          <div>
            <label className="label">Take profit</label>
            <input type="number" step="any" className="input" value={form.take_profit} onChange={set("take_profit")} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Account</label>
            <select className="input" value={form.account_id} onChange={set("account_id")}>
              <option value="">—</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Playbook</label>
            <select className="input" value={form.playbook_id} onChange={set("playbook_id")}>
              <option value="">—</option>
              {playbooks.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Setup</label>
            <input className="input" value={form.setup} onChange={set("setup")} placeholder="Breakout" />
          </div>
          <div>
            <label className="label">Tags</label>
            <input className="input" value={form.tags} onChange={set("tags")} placeholder="A+, watchlist" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Mistakes</label>
            <input className="input" value={form.mistakes} onChange={set("mistakes")} placeholder="FOMO, moved stop" />
          </div>
          <div>
            <label className="label">Rating</label>
            <StarRating value={form.rating} onChange={(v) => setForm((f) => ({ ...f, rating: v }))} />
          </div>
        </div>

        <div>
          <label className="label">Chart screenshots (image URLs)</label>
          <div className="space-y-2">
            {form.images.map((url, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  className="input"
                  value={url}
                  onChange={(e) => setImage(i, e.target.value)}
                  placeholder="https://…/chart.png"
                />
                <button type="button" onClick={() => removeImage(i)} className="p-2 rounded-md hover:bg-rose-600/20 text-slate-400 hover:text-rose-400">
                  <X size={16} />
                </button>
              </div>
            ))}
            <button type="button" onClick={addImage} className="btn-ghost text-xs">
              <Plus size={14} /> Add screenshot
            </button>
          </div>
        </div>

        <div>
          <label className="label">Notes</label>
          <textarea className="input min-h-[80px]" value={form.notes} onChange={set("notes")} placeholder="What was the thesis? How did you execute?" />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-ghost">Cancel</button>
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Log trade"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
