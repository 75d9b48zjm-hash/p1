// Mesin pembukuan sisi-klien (offline). Semua perhitungan berjalan di browser.
export const UNCATEGORIZED = "Belum Dikategorikan";

export const DEFAULT_CATEGORIES = [
  ["income", "Belum Dikategorikan"], ["income", "Penjualan"], ["income", "Pendapatan Jasa"],
  ["income", "Pendapatan Lain"], ["income", "Suntikan Modal"],
  ["expense", "Belum Dikategorikan"], ["expense", "Stok / Bahan"], ["expense", "Gaji"],
  ["expense", "Sewa"], ["expense", "Listrik"], ["expense", "Internet"], ["expense", "Transportasi"],
  ["expense", "Pemasaran"], ["expense", "Perlengkapan"], ["expense", "Biaya Operasional"], ["expense", "Pengeluaran Lain"],
];

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const rp = (n) => "Rp" + Math.round(Math.abs(Number(n) || 0)).toLocaleString("id-ID");

export function monthBounds(ref = new Date()) {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return [iso(start), iso(end)];
}
export function shiftMonth(ref, months) {
  return new Date(ref.getFullYear(), ref.getMonth() + months, 1);
}
function labelMonth(d) { return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`; }
function dayBefore(s) { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() - 1); return iso(d); }

const txForBiz = (state, bid) => state.transactions.filter((t) => t.business_id === bid);

export function totals(state, bid, start, end) {
  let rows = txForBiz(state, bid);
  if (start) rows = rows.filter((t) => t.date >= start);
  if (end) rows = rows.filter((t) => t.date <= end);
  const income = rows.filter((t) => t.type === "income").reduce((a, b) => a + b.amount, 0);
  const expense = rows.filter((t) => t.type === "expense").reduce((a, b) => a + b.amount, 0);
  return { income, expense, rows };
}

export function byCategory(rows, kind) {
  const agg = {};
  rows.filter((r) => r.type === kind).forEach((r) => { agg[r.category] = (agg[r.category] || 0) + r.amount; });
  const total = Object.values(agg).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(agg)
    .map(([name, amount]) => ({ name, amount, percentage: (amount / total) * 100 }))
    .sort((a, b) => b.amount - a.amount);
}

export function listBusinesses(state) {
  const [start, end] = monthBounds();
  return state.businesses
    .map((b) => {
      const { income, expense } = totals(state, b.id, start, end);
      const last = txForBiz(state, b.id).map((t) => t.created_at).sort().slice(-1)[0] || null;
      return { ...b, month_income: income, month_expense: expense, month_profit: income - expense, last_activity: last };
    })
    .sort((a, b) => b.month_profit - a.month_profit);
}

export function dashboardBusiness(state, bid) {
  const b = state.businesses.find((x) => x.id === bid);
  if (!b) return null;
  const [start, end] = monthBounds();
  const m = totals(state, bid, start, end);
  const all = totals(state, bid);
  const balance = (b.opening_balance || 0) + all.income - all.expense;
  const today = new Date();
  const monthly = [];
  for (let k = 5; k >= 0; k--) {
    const first = shiftMonth(new Date(today.getFullYear(), today.getMonth(), 1), -k);
    const [s, e] = monthBounds(first);
    const t = totals(state, bid, s, e);
    monthly.push({ month: labelMonth(first), income: t.income, expense: t.expense, profit: t.income - t.expense });
  }
  const recent = txForBiz(state, bid).slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 8);
  return {
    business: b, balance,
    month_income: m.income, month_expense: m.expense, month_profit: m.income - m.expense,
    monthly, expense_categories: byCategory(m.rows, "expense"), recent, period: { start, end },
  };
}

export function buildReport(state, bid, start, end) {
  const b = state.businesses.find((x) => x.id === bid) || { name: "", opening_balance: 0 };
  const { income, expense, rows } = totals(state, bid, start, end);
  const prior = totals(state, bid, null, dayBefore(start));
  const opening = (b.opening_balance || 0) + prior.income - prior.expense;
  return {
    business_name: b.name, period: { start, end },
    total_income: income, total_expense: expense, net_profit: income - expense,
    profit_margin: income ? ((income - expense) / income) * 100 : 0,
    opening_balance: opening, closing_balance: opening + income - expense,
    income_by_category: byCategory(rows, "income"),
    expense_by_category: byCategory(rows, "expense"),
    transaction_count: rows.length,
  };
}

export function listTransactions(state, p = {}) {
  let rows = state.transactions.slice();
  if (p.business_id) rows = rows.filter((t) => t.business_id === p.business_id);
  if (["income", "expense"].includes(p.type)) rows = rows.filter((t) => t.type === p.type);
  if (p.category) rows = rows.filter((t) => t.category === p.category);
  if (p.start_date) rows = rows.filter((t) => t.date >= p.start_date);
  if (p.end_date) rows = rows.filter((t) => t.date <= p.end_date);
  if (p.search) { const s = p.search.toLowerCase(); rows = rows.filter((t) => (t.description || "").toLowerCase().includes(s)); }
  const dir = p.sort === "oldest" ? 1 : -1;
  rows.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -dir : dir;
    return a.created_at < b.created_at ? -dir : dir;
  });
  return rows.slice(0, Math.min(p.limit || 200, 1000));
}

export function suggest(state, bid, type, text) {
  text = (text || "").toLowerCase().trim();
  if (!["income", "expense"].includes(type) || text.length < 2) return { suggestion: null, confidence: 0 };
  const tokens = text.replace(/[/,]/g, " ").split(/\s+/).filter((t) => t.length >= 3);
  if (!tokens.length) return { suggestion: null, confidence: 0 };
  const rows = txForBiz(state, bid)
    .filter((t) => t.type === type && t.category !== UNCATEGORIZED)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 500);
  const scores = {};
  rows.forEach((r) => {
    const desc = (r.description || "").toLowerCase();
    if (!desc) return;
    const matched = tokens.filter((tok) => desc.includes(tok)).length;
    if (matched) scores[r.category] = (scores[r.category] || 0) + matched;
  });
  const ent = Object.entries(scores);
  if (!ent.length) return { suggestion: null, confidence: 0 };
  const best = ent.slice().sort((a, b) => b[1] - a[1])[0];
  const total = ent.reduce((a, [, v]) => a + v, 0);
  return { suggestion: best[0], confidence: best[1] / total, match_score: best[1] };
}

export function buildInsights(state, bid) {
  const today = new Date();
  const [cs, ce] = monthBounds(today);
  const prevFirst = shiftMonth(new Date(today.getFullYear(), today.getMonth(), 1), -1);
  const [ps, pe] = monthBounds(prevFirst);
  const cur = totals(state, bid, cs, ce);
  const prev = totals(state, bid, ps, pe);
  const insights = [];
  const pct = (nw, old) => (!old ? null : ((nw - old) / old) * 100);

  const ri = pct(cur.income, prev.income);
  if (ri !== null) insights.push({ tone: ri >= 0 ? "positive" : "warning", title: "Uang masuk bulan ini",
    text: `Uang masuk ${ri >= 0 ? "naik" : "turun"} ${Math.abs(ri).toFixed(0)}% dibanding bulan lalu (${rp(cur.income)} vs ${rp(prev.income)}).` });
  else if (cur.income) insights.push({ tone: "neutral", title: "Uang masuk bulan ini",
    text: `Total uang masuk bulan ini ${rp(cur.income)}. Belum ada data bulan lalu untuk dibandingkan.` });

  const re = pct(cur.expense, prev.expense);
  if (re !== null) insights.push({ tone: re > 0 ? "warning" : "positive", title: "Uang keluar bulan ini",
    text: `Uang keluar ${re >= 0 ? "naik" : "turun"} ${Math.abs(re).toFixed(0)}% dibanding bulan lalu (${rp(cur.expense)}).` });

  const expCats = byCategory(cur.rows, "expense");
  if (expCats.length) insights.push({ tone: "neutral", title: "Pengeluaran terbesar",
    text: `"${expCats[0].name}" adalah pengeluaran terbesar bulan ini, ${expCats[0].percentage.toFixed(0)}% dari total pengeluaran (${rp(expCats[0].amount)}).` });

  const incCats = byCategory(cur.rows, "income");
  if (incCats.length) insights.push({ tone: "positive", title: "Sumber pemasukan utama",
    text: `"${incCats[0].name}" menyumbang ${incCats[0].percentage.toFixed(0)}% dari uang masuk bulan ini.` });

  const margin = cur.income ? ((cur.income - cur.expense) / cur.income) * 100 : 0;
  const pMargin = prev.income ? ((prev.income - prev.expense) / prev.income) * 100 : null;
  if (cur.income) {
    if (pMargin !== null) { const better = margin >= pMargin; insights.push({ tone: better ? "positive" : "warning", title: "Margin keuntungan",
      text: `Margin keuntungan bulan ini ${margin.toFixed(0)}%, ${better ? "lebih baik" : "lebih rendah"} dari bulan lalu (${pMargin.toFixed(0)}%).` }); }
    else insights.push({ tone: "neutral", title: "Margin keuntungan", text: `Margin keuntungan bulan ini ${margin.toFixed(0)}% dari total uang masuk.` });
  }
  if (cur.expense > cur.income && cur.income) insights.push({ tone: "warning", title: "Perhatian",
    text: "Pengeluaran bulan ini lebih besar dari pemasukan. Coba tinjau kembali pengeluaran terbesar Anda." });
  if (!insights.length) insights.push({ tone: "neutral", title: "Belum ada data", text: "Catat transaksi Anda terlebih dahulu untuk melihat analisis usaha." });
  return { insights, period: { start: cs, end: ce } };
}
