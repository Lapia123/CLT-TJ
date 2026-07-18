import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import api, { errorMessage } from "../api/client";
import { useToast } from "../components/Toast.jsx";
import { fmtMoney } from "../lib/format";

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
      await api.patch("/api/auth/me", {
        name,
        starting_balance: parseFloat(startingBalance) || 0,
      });
      await refreshUser();
      toast.success("Settings saved.");
    } catch (err) {
      toast.error(errorMessage(err, "Could not save settings."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-500 text-sm">Manage your profile and account baseline.</p>
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
          <label className="label">Starting balance ($)</label>
          <input
            type="number"
            step="0.01"
            className="input"
            value={startingBalance}
            onChange={(e) => setStartingBalance(e.target.value)}
          />
          <p className="text-xs text-slate-500 mt-1">
            Used as the baseline for your equity curve. Current: {fmtMoney(user?.starting_balance)}.
          </p>
        </div>
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>

      <div className="card p-6">
        <h2 className="font-semibold mb-1">About CLT Trading Journal</h2>
        <p className="text-sm text-slate-400">
          Log your trades, track P&L, R-multiples and win rate, and review your process to
          sharpen your edge over time. Version 1.0.0.
        </p>
      </div>
    </div>
  );
}
