import { Star, Pencil, Trash2 } from "lucide-react";
import Modal from "./Modal.jsx";
import { fmtMoney, fmtNumber, fmtPct, pnlColor, fmtDate } from "../lib/format";

function Row({ label, children }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-slate-800/50 last:border-0">
      <span className="text-slate-500 text-sm">{label}</span>
      <span className="text-sm font-medium text-slate-200">{children}</span>
    </div>
  );
}

export default function TradeDetail({ open, onClose, trade, playbookName, accountName, onEdit, onDelete }) {
  if (!trade) return null;

  return (
    <Modal open={open} onClose={onClose} title={`${trade.symbol} · ${trade.direction}`} maxWidth="max-w-3xl">
      <div className="space-y-5">
        {/* Headline */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className={`text-3xl font-bold ${pnlColor(trade.net_pnl)}`}>
              {trade.net_pnl === null ? "Open" : fmtMoney(trade.net_pnl)}
            </div>
            {trade.return_pct !== null && (
              <div className="text-sm text-slate-500">
                {fmtPct(trade.return_pct)} · {trade.r_multiple !== null ? `${fmtNumber(trade.r_multiple)}R` : "—"}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {trade.rating ? (
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star key={n} size={16} className={trade.rating >= n ? "fill-amber-400 text-amber-400" : "text-slate-700"} />
                ))}
              </div>
            ) : null}
            <button onClick={() => onEdit(trade)} className="btn-ghost text-xs"><Pencil size={14} /> Edit</button>
            <button onClick={() => onDelete(trade)} className="btn-danger text-xs"><Trash2 size={14} /> Delete</button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <div>
            <Row label="Status"><span className={trade.status === "open" ? "text-amber-400" : "text-slate-300"}>{trade.status}</span></Row>
            <Row label="Quantity">{fmtNumber(trade.quantity, 0)}</Row>
            <Row label="Entry price">{fmtNumber(trade.entry_price)}</Row>
            <Row label="Exit price">{trade.exit_price ? fmtNumber(trade.exit_price) : "—"}</Row>
            <Row label="Stop loss">{trade.stop_loss ? fmtNumber(trade.stop_loss) : "—"}</Row>
            <Row label="Take profit">{trade.take_profit ? fmtNumber(trade.take_profit) : "—"}</Row>
          </div>
          <div>
            <Row label="Fees">{fmtMoney(trade.fees)}</Row>
            <Row label="Entry date">{fmtDate(trade.entry_date)}</Row>
            <Row label="Exit date">{trade.exit_date ? fmtDate(trade.exit_date) : "—"}</Row>
            <Row label="Hold time">{trade.holding_period_hours !== null ? `${fmtNumber(trade.holding_period_hours, 1)}h` : "—"}</Row>
            <Row label="Account">{accountName || "—"}</Row>
            <Row label="Playbook">{playbookName || "—"}</Row>
          </div>
        </div>

        {(trade.setup || trade.tags || trade.mistakes) && (
          <div className="flex flex-wrap gap-2">
            {trade.setup && <span className="badge bg-indigo-500/15 text-indigo-300">{trade.setup}</span>}
            {(trade.tags || "").split(",").filter((t) => t.trim()).map((t) => (
              <span key={t} className="badge bg-slate-700 text-slate-300">{t.trim()}</span>
            ))}
            {(trade.mistakes || "").split(",").filter((t) => t.trim()).map((t) => (
              <span key={t} className="badge bg-rose-500/15 text-rose-300">⚠ {t.trim()}</span>
            ))}
          </div>
        )}

        {trade.notes && (
          <div>
            <div className="label">Notes</div>
            <p className="text-sm text-slate-300 whitespace-pre-wrap">{trade.notes}</p>
          </div>
        )}

        {trade.images?.length > 0 && (
          <div>
            <div className="label">Screenshots</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {trade.images.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-slate-800">
                  <img src={url} alt={`chart ${i + 1}`} className="w-full h-auto object-cover max-h-64" loading="lazy" />
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
