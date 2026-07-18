// Formatting + small presentation helpers.

export function fmtMoney(value, { sign = false } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const opts = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  const str = Math.abs(value).toLocaleString("en-US", opts);
  const prefix = value < 0 ? "-$" : sign ? "+$" : "$";
  return value < 0 ? `-$${str}` : `${prefix}${str}`;
}

export function fmtNumber(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(2)}%`;
}

export function pnlColor(value) {
  if (value === null || value === undefined) return "text-slate-400";
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-rose-400";
  return "text-slate-400";
}

export function fmtDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTimeLocal(value) {
  // Produce a value suitable for <input type="datetime-local">
  if (!value) return "";
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
