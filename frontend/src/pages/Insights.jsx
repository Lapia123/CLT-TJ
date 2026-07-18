import { useEffect, useState, useCallback } from "react";
import { Lightbulb, TrendingUp, TrendingDown, Minus, Sparkles } from "lucide-react";
import api from "../api/client";
import { useAccounts } from "../context/AccountContext.jsx";

const STYLES = {
  positive: { icon: TrendingUp, ring: "border-emerald-500/30 bg-emerald-500/5", chip: "text-emerald-400" },
  negative: { icon: TrendingDown, ring: "border-rose-500/30 bg-rose-500/5", chip: "text-rose-400" },
  neutral: { icon: Minus, ring: "border-slate-700 bg-slate-800/30", chip: "text-slate-400" },
};

export default function Insights() {
  const { accountParams } = useAccounts();
  const accountKey = JSON.stringify(accountParams);
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/api/insights", { params: accountParams });
      setInsights(data);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountKey]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Sparkles size={22} className="text-indigo-400" />
        <div>
          <h1 className="text-2xl font-bold">Insights</h1>
          <p className="text-slate-500 text-sm">Automated review of your trading — what's working and what's leaking.</p>
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500">Analyzing your trades…</div>
      ) : insights.length === 0 ? (
        <div className="card p-10 text-center">
          <Lightbulb size={28} className="mx-auto text-slate-600 mb-2" />
          <div className="text-slate-300 font-medium">No insights yet</div>
          <p className="text-slate-500 text-sm mt-1">Log more closed trades and insights will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((ins) => {
            const s = STYLES[ins.sentiment] || STYLES.neutral;
            const Icon = s.icon;
            return (
              <div key={ins.key} className={`card p-5 border ${s.ring}`}>
                <div className="flex items-start gap-3">
                  <div className={`mt-0.5 ${s.chip}`}>
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{ins.title}</h3>
                    <p className="text-sm text-slate-400 mt-1">{ins.detail}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
