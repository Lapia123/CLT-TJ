import { useState } from "react";
import { Link } from "react-router-dom";
import { TrendingUp, MailCheck } from "lucide-react";
import api, { errorMessage } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err, "Something went wrong."));
    } finally {
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

        {sent ? (
          <div className="card p-8 text-center">
            <MailCheck size={40} className="mx-auto text-emerald-400" />
            <h1 className="text-lg font-semibold mt-4">Check your email</h1>
            <p className="text-slate-400 text-sm mt-1">
              If <span className="text-slate-200">{email}</span> is registered, we've sent a
              password reset link. It expires in 30 minutes.
            </p>
            <Link to="/login" className="btn-ghost mx-auto mt-6">Back to sign in</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="card p-6 space-y-4">
            <h1 className="text-lg font-semibold">Reset your password</h1>
            <p className="text-sm text-slate-400">Enter your email and we'll send you a reset link.</p>
            {error && (
              <div className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">{error}</div>
            )}
            <div>
              <label className="label">Email</label>
              <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>{loading ? "Sending…" : "Send reset link"}</button>
            <div className="text-center">
              <Link to="/login" className="text-sm text-indigo-400 hover:text-indigo-300">Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
