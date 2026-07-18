import { useState } from "react";
import { Upload, Download, CheckCircle2, AlertTriangle } from "lucide-react";
import Modal from "./Modal.jsx";
import api, { errorMessage } from "../api/client";
import { useToast } from "./Toast.jsx";
import { useAccounts } from "../context/AccountContext.jsx";

export default function ImportModal({ open, onClose, onImported }) {
  const toast = useToast();
  const { accounts } = useAccounts();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [accountId, setAccountId] = useState("");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setBusy(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const downloadTemplate = async () => {
    try {
      const res = await api.get("/api/trades/import/template", { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clt_trades_template.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err, "Could not download template."));
    }
  };

  const doUpload = async (commit) => {
    if (!file) return toast.error("Choose a CSV file first.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const params = { commit };
      if (accountId) params.account_id = accountId;
      const { data } = await api.post("/api/trades/import", fd, { params });
      if (commit) {
        toast.success(`Imported ${data.imported} trade${data.imported === 1 ? "" : "s"}.`);
        onImported();
        close();
      } else {
        setPreview(data);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Import failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={close} title="Import trades from CSV" maxWidth="max-w-3xl">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm text-slate-400">
            Upload a broker CSV export. Download the template to see the expected columns.
          </p>
          <button onClick={downloadTemplate} className="btn-ghost text-xs">
            <Download size={14} /> Template
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">CSV file</label>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreview(null);
              }}
              className="block w-full text-sm text-slate-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 hover:file:bg-slate-600"
            />
          </div>
          <div>
            <label className="label">Import into account</label>
            <select className="input" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>
        </div>

        {preview && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <span className="flex items-center gap-1 text-emerald-400">
                <CheckCircle2 size={15} /> {preview.valid} valid
              </span>
              {preview.invalid > 0 && (
                <span className="flex items-center gap-1 text-rose-400">
                  <AlertTriangle size={15} /> {preview.invalid} with errors
                </span>
              )}
              <span className="text-slate-500">{preview.total} rows total</span>
            </div>

            <div className="max-h-64 overflow-y-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900">
                  <tr className="text-left text-slate-500">
                    <th className="py-2 px-3">Row</th>
                    <th className="py-2 px-3">Status</th>
                    <th className="py-2 px-3">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((r) => (
                    <tr key={r.row} className="border-t border-slate-800/60">
                      <td className="py-1.5 px-3 text-slate-400">{r.row}</td>
                      <td className="py-1.5 px-3">
                        {r.ok ? (
                          <span className="text-emerald-400">OK</span>
                        ) : (
                          <span className="text-rose-400">Error</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 text-slate-400">
                        {r.ok ? `${r.data.symbol} ${r.data.direction} x${r.data.quantity}` : r.error}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={close} className="btn-ghost">Cancel</button>
          {!preview ? (
            <button onClick={() => doUpload(false)} className="btn-primary" disabled={busy || !file}>
              <Upload size={15} /> {busy ? "Checking…" : "Validate"}
            </button>
          ) : (
            <button onClick={() => doUpload(true)} className="btn-primary" disabled={busy || preview.valid === 0}>
              {busy ? "Importing…" : `Import ${preview.valid} trade${preview.valid === 1 ? "" : "s"}`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
