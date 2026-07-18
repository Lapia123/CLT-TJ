import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TrendingUp } from "lucide-react";
import api, { errorMessage } from "../api/client";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post("/api/auth/reset-password", { token, new_password: password });
      localStorage.setItem("clt_token", data.access_token);
      // Full reload so the auth context picks up the new session.
      window.location.assign("/");
    } catch (err) {
      setError(errorMessage(err, "Could not reset password."));
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div className="text-xl font-bold">CLT Trading Journal</div>
        </div>

        {!token ? (
          <div className="card p-8 text-center">
            <h1 className="text-lg font-semibold">Invalid reset link</h1>
            <p className="text-slate-400 text-sm mt-1">This link is missing its token.</p>
            <Link to="/forgot" className="btn-primary mx-auto mt-6">Request a new link</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6 space-y-4">
            <h1 className="text-lg font-semibold">Choose a new password</h1>
            {error && (
              <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>
            )}
            <div>
              <label className="label">New password</label>
              <input type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
            </div>
            <div>
              <label className="label">Confirm password</label>
              <input type="password" className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} minLength={6} required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? "Resetting…" : "Reset password"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
