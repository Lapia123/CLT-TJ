import { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import api, { errorMessage } from "../api/client";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { fmtDate, fmtDateTimeLocal } from "../lib/format";

const MOODS = ["confident", "calm", "focused", "fomo", "anxious", "frustrated"];

const empty = () => ({
  title: "",
  content: "",
  mood: "",
  entry_date: fmtDateTimeLocal(new Date()),
});

export default function Journal() {
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/journal");
      setEntries(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm(empty());
    setOpen(true);
  };

  const openEdit = (e) => {
    setEditing(e);
    setForm({
      title: e.title,
      content: e.content,
      mood: e.mood || "",
      entry_date: fmtDateTimeLocal(e.entry_date),
    });
    setOpen(true);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        content: form.content,
        mood: form.mood || null,
        entry_date: new Date(form.entry_date).toISOString(),
      };
      if (editing) {
        await api.patch(`/api/journal/${editing.id}`, payload);
        toast.success("Entry updated.");
      } else {
        await api.post("/api/journal", payload);
        toast.success("Entry saved.");
      }
      setOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save entry."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (entry) => {
    if (!window.confirm("Delete this journal entry?")) return;
    try {
      await api.delete(`/api/journal/${entry.id}`);
      toast.success("Entry deleted.");
      load();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete entry."));
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Journal</h1>
          <p className="text-slate-500 text-sm">Reflect on your process, not just your P&L.</p>
        </div>
        <button className="btn-primary" onClick={openNew}>
          <Plus size={16} /> New entry
        </button>
      </div>

      {loading ? (
        <div className="text-slate-500">Loading…</div>
      ) : entries.length === 0 ? (
        <div className="card p-10 text-center">
          <div className="text-slate-300 font-medium">No journal entries yet</div>
          <p className="text-slate-500 text-sm mt-1">Capture your mindset, lessons, and weekly reviews.</p>
          <button className="btn-primary mt-4 mx-auto" onClick={openNew}>
            <Plus size={16} /> Write your first entry
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((e) => (
            <div key={e.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{e.title}</h3>
                    {e.mood && (
                      <span className="badge bg-indigo-500/15 text-indigo-300">{e.mood}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">{fmtDate(e.entry_date)}</div>
                  {e.content && (
                    <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">{e.content}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(e)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => remove(e)} className="p-1.5 rounded-md hover:bg-rose-600/20 text-slate-400 hover:text-rose-400">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit entry" : "New journal entry"}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Title</label>
            <input className="input" value={form.title} onChange={set("title")} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Date</label>
              <input type="datetime-local" className="input" value={form.entry_date} onChange={set("entry_date")} required />
            </div>
            <div>
              <label className="label">Mood</label>
              <select className="input" value={form.mood} onChange={set("mood")}>
                <option value="">—</option>
                {MOODS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Notes</label>
            <textarea className="input min-h-[140px]" value={form.content} onChange={set("content")} placeholder="What went well? What will you do differently?" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save entry"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
