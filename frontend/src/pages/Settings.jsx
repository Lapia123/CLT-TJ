import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Trash2, Star, KeyRound, AlertTriangle } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { useAccounts } from "../context/AccountContext.jsx";
import api, { errorMessage } from "../api/client";
import Modal from "../components/Modal.jsx";
import { useToast } from "../components/Toast.jsx";
import { fmtMoney } from "../lib/format";

function SecurityCard() {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post("/api/auth/change-password", { current_password: current, new_password: next });
      toast.success("Password changed.");
      setCurrent("");
      setNext("");
    } catch (err) {
      toast.error(errorMessage(err, "Could not change password."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-slate-400" />
        <h2 className="font-semibold">Security</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="label">Current password</label>
          <input type="password" className="input" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div>
          <label className="label">New password</label>
          <input type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} minLength={6} required />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Change password"}</button>
      </div>
    </form>
  );
}

function DangerZone() {
  const toast = useToast();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete("/api/auth/me");
      logout();
      navigate("/");
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete account."));
      setBusy(false);
    }
  };

  return (
    <div className="card p-6 border border-rose-500/30">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={18} className="text-rose-400" />
        <h2 className="font-semibold text-rose-300">Danger zone</h2>
      </div>
      <p className="text-sm text-slate-400">
        Permanently delete your account and all trades, accounts, playbooks, goals and journal
        entries. This cannot be undone.
      </p>
      <button className="btn-danger mt-4" onClick={() => setOpen(true)}>Delete my account</button>

      <Modal open={open} onClose={() => setOpen(false)} title="Delete account">
        <div className="space-y-4">
          <p className="text-sm text-slate-300">
            This is permanent. Type <span className="font-semibold text-rose-300">DELETE</span> to confirm.
          </p>
          <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="DELETE" />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button className="btn-danger" disabled={confirmText !== "DELETE" || busy} onClick={remove}>
              {busy ? "Deleting…" : "Permanently delete"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const emptyAcct = () => ({ name: "", broker: "", currency: "USD", starting_balance: 10000, is_default: false });

function AccountsCard() {
  const toast = useToast();
  const { accounts, reloadAccounts } = useAccounts();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyAcct());
  const [saving, setSaving] = useState(false);

  const openNew = () => { setEditing(null); setForm(emptyAcct()); setOpen(true); };
  const openEdit = (a) => {
    setEditing(a);
    setForm({ name: a.name, broker: a.broker || "", currency: a.currency, starting_balance: a.starting_balance, is_default: a.is_default });
    setOpen(true);
  };
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, starting_balance: parseFloat(form.starting_balance) || 0 };
      if (editing) {
        await api.patch(`/api/accounts/${editing.id}`, payload);
        toast.success("Account updated.");
      } else {
        await api.post("/api/accounts", payload);
        toast.success("Account created.");
      }
      setOpen(false);
      reloadAccounts();
    } catch (err) {
      toast.error(errorMessage(err, "Could not save account."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete account "${a.name}"? Its trades remain but lose the account link.`)) return;
    try {
      await api.delete(`/api/accounts/${a.id}`);
      toast.success("Account deleted.");
      reloadAccounts();
    } catch (err) {
      toast.error(errorMessage(err, "Could not delete account."));
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-semibold">Trading accounts</h2>
          <p className="text-xs text-slate-500">Track multiple accounts and filter everything by account.</p>
        </div>
        <button className="btn-primary text-xs" onClick={openNew}><Plus size={14} /> Add</button>
      </div>

      {accounts.length === 0 ? (
        <p className="text-sm text-slate-500">No accounts yet. Add one to group your trades.</p>
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <div key={a.id} className="flex items-center justify-between border border-slate-800 rounded-lg px-4 py-3">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {a.name}
                  {a.is_default && <span className="badge bg-indigo-500/15 text-indigo-300"><Star size={11} className="fill-indigo-300 mr-1" /> default</span>}
                </div>
                <div className="text-xs text-slate-500">{a.broker || "—"} · {a.currency} · start {fmtMoney(a.starting_balance)}</div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(a)} className="p-1.5 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200"><Pencil size={15} /></button>
                <button onClick={() => remove(a)} className="p-1.5 rounded-md hover:bg-rose-600/20 text-slate-400 hover:text-rose-400"><Trash2 size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? "Edit account" : "New account"}>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input className="input" value={form.name} onChange={set("name")} placeholder="Main Account" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Broker</label>
              <input className="input" value={form.broker} onChange={set("broker")} placeholder="Interactive Brokers" />
            </div>
            <div>
              <label className="label">Currency</label>
              <input className="input" value={form.currency} onChange={set("currency")} placeholder="USD" />
            </div>
          </div>
          <div>
            <label className="label">Starting balance</label>
            <input type="number" step="0.01" className="input" value={form.starting_balance} onChange={set("starting_balance")} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={form.is_default} onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))} />
            Set as default account
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || "");
  const [startingBalance, setStartingBalance] = useState(user?.starting_balance ?? 0);
  const [saving, setSaving] = useState(false);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/api/auth/me", { name, starting_balance: parseFloat(startingBalance) || 0 });
      await refreshUser();
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your profile and trading accounts.</p>
      </div>

      <form onSubmit={save} className="card p-6 space-y-4">
        <h2 className="font-semibold">Profile</h2>
        <div>
          <label className="label">Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input opacity-60 cursor-not-allowed" value={user?.email || ""} disabled />
        </div>
        <div>
          <label className="label">Default starting balance ($)</label>
          <input type="number" step="0.01" className="input" value={startingBalance} onChange={(e) => setStartingBalance(e.target.value)} />
          <p className="text-xs text-slate-500 mt-1">Used for the equity baseline when no specific account is selected.</p>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>{saving ? "Saving…" : "Save changes"}</button>
        </div>
      </form>

      <AccountsCard />

      <SecurityCard />

      <div className="card p-6">
        <h2 className="font-semibold mb-1">About CLT Trading Journal</h2>
        <p className="text-sm text-slate-400">
          Log trades, import from your broker, track P&L / R-multiple / drawdown, analyze by
          symbol, setup, playbook, time and hold-time, and review your process. Version 2.3.0.
        </p>
      </div>

      <DangerZone />
    </div>
  );
}
