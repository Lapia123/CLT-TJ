import { useState } from "react";
import { MailWarning, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import api from "../api/client";
import { useToast } from "./Toast.jsx";

export default function VerifyBanner() {
  const { user } = useAuth();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(false);
  const [sending, setSending] = useState(false);

  if (!user || user.is_verified || dismissed) return null;

  const resend = async () => {
    setSending(true);
    try {
      await api.post("/api/auth/verify/resend");
      toast.success("Verification email sent. Check your inbox.");
    } catch {
      toast.error("Could not send verification email.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/25 text-amber-200 rounded-lg px-4 py-2.5 mb-5 text-sm">
      <MailWarning size={18} className="shrink-0 text-amber-400" />
      <span className="flex-1">
        Please verify your email address to secure your account.
      </span>
      <button onClick={resend} disabled={sending} className="font-medium underline hover:no-underline disabled:opacity-50">
        {sending ? "Sending…" : "Resend email"}
      </button>
      <button onClick={() => setDismissed(true)} className="text-amber-400/70 hover:text-amber-300">
        <X size={16} />
      </button>
    </div>
  );
}
