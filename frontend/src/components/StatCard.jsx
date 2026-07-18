export default function StatCard({ label, value, sub, valueClass = "text-slate-100", icon: Icon }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</span>
        {Icon && <Icon size={16} className="text-slate-600" />}
      </div>
      <div className={`text-2xl font-bold mt-2 ${valueClass}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}
