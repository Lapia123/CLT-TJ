import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, XCircle, TrendingUp, Loader2 } from "lucide-react";
import api, { errorMessage } from "../api/client";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const [status, setStatus] = useState("loading"); // loading | ok | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }
    api
      .post("/api/auth/verify", { token })
      .then(() => setStatus("ok"))
      .catch((err) => {
        setStatus("error");
        setMessage(errorMessage(err, "Verification failed."));
      });
  }, [params]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-11 h-11 rounded-xl bg-indigo-600 flex items-center justify-center">
            <TrendingUp size={24} className="text-white" />
          </div>
          <div className="text-xl font-bold">CLT Trading Journal</div>
        </div>
        <div className="card p-8">
          {status === "loading" && (
            <>
              <Loader2 size={32} className="mx-auto text-indigo-400 animate-spin" />
              <p className="text-slate-400 mt-4">Verifying your email…</p>
            </>
          )}
          {status === "ok" && (
            <>
              <CheckCircle2 size={40} className="mx-auto text-emerald-400" />
              <h1 className="text-lg font-semibold mt-4">Email verified</h1>
              <p className="text-slate-400 text-sm mt-1">Your email address is confirmed. You're all set.</p>
              <Link to="/" className="btn-primary mx-auto mt-6">Go to app</Link>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle size={40} className="mx-auto text-rose-400" />
              <h1 className="text-lg font-semibold mt-4">Verification failed</h1>
              <p className="text-slate-400 text-sm mt-1">{message}</p>
              <Link to="/" className="btn-ghost mx-auto mt-6">Back to app</Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
