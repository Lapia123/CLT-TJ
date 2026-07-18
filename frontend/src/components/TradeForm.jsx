import { useState, useEffect } from "react";
import Modal from "./Modal.jsx";
import api, { errorMessage } from "../api/client";
import { useToast } from "./Toast.jsx";
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
  notes: "",
});

function toPayload(f) {
  const num = (v) => (v === "" || v === null ? null : parseFloat(v));
  const iso = (v) => (v ? new Date(v).toISOString() : null);
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
    notes: f.notes || null,
  };
}

export default function TradeForm({ open, onClose, onSaved, trade }) {
  const toast = useToast();
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);
  const editing = Boolean(trade);

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
        notes: trade.notes ?? "",
      });
    } else {
      setForm(empty());
    }
  }, [trade, open]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (form.status === "closed" && !form.exit_price) {
      toast.error("A closed trade needs an exit price.");
      return;
    }
    if (form.status === "closed" && !form.exit_date) {
      toast.error("A closed trade needs an exit date.");
      return;
    }
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

        <div className="grid grid-cols-2 gap-3">
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

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label">Stop loss</label>
            <input type="number" step="any" className="input" value={form.stop_loss} onChange={set("stop_loss")} />
          </div>
          <div>
            <label className="label">Take profit</label>
            <input type="number" step="any" className="input" value={form.take_profit} onChange={set("take_profit")} />
          </div>
          <div>
            <label className="label">Fees</label>
            <input type="number" step="any" className="input" value={form.fees} onChange={set("fees")} />
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
