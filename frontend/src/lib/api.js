// Router API LOKAL (offline) \u2014 pengganti FastAPI + MongoDB.
// Meniru antarmuka axios: api.get/post/put/delete mengembalikan { data }.
import {
  getAll, setAll, uuid, nowIso, UNCATEGORIZED, DEFAULT_CATEGORIES,
  monthBounds, shiftMonth, monthLabel, approvedTotals, byCategory, dayBefore,
} from "./store";
import { rupiah } from "./format";
import { exportBusinessExcel, transactionsCsv, reportCsv, exportPdf, saveCsv } from "./exporters";

// Kompat: modul lama mengekspor ini. Tidak dipakai lagi pada mode offline.
export const BACKEND_URL = "";
export const API = "";

const PAYMENT_METHODS = ["Tunai", "Transfer Bank", "QRIS", "E-wallet", "Lainnya"];

function err(detail, status = 400) {
  const e = new Error(typeof detail === "string" ? detail : "Terjadi kesalahan");
  e.response = { status, data: { detail } };
  return e;
}

export function apiError(e) {
  const detail = e?.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((d) => d?.msg || JSON.stringify(d)).join(" ");
  if (detail?.msg) return detail.msg;
  return e?.message || "Terjadi kesalahan, coba lagi.";
}

function parse(path) {
  const [p, qs] = String(path).split("?");
  const seg = p.split("/").filter(Boolean);
  const query = {};
  if (qs) new URLSearchParams(qs).forEach((v, k) => { query[k] = v; });
  return { seg, query };
}

// ---------------- businesses ----------------
async function listBusinesses() {
  const businesses = (await getAll("businesses")).filter((b) => !b.is_deleted);
  const txs = (await getAll("transactions")).filter((t) => !t.is_deleted);
  const [start, end] = monthBounds();
  const out = businesses.map((b) => {
    const { income, expense } = approvedTotals(txs, b.id, start, end);
    const bizTx = txs
      .filter((t) => t.business_id === b.id)
      .sort((a, z) => (a.created_at < z.created_at ? 1 : -1));
    const last_activity = bizTx.length ? bizTx[0].created_at : null;
    let status = "active";
    if (!last_activity) {
      status = "no_activity";
    } else {
      const days = Math.floor((Date.now() - new Date(last_activity).getTime()) / 86400000);
      if (days > 7) status = "no_activity";
    }
    return {
      ...b,
      month_income: income,
      month_expense: expense,
      month_profit: income - expense,
      pending_count: 0,
      needs_correction_count: 0,
      last_activity,
      status,
    };
  });
  return out.sort((a, z) => z.month_profit - a.month_profit);
}

async function ensureDefaultCategories(bid) {
  const cats = await getAll("categories");
  const now = nowIso();
  const docs = DEFAULT_CATEGORIES.map(([type, name]) => ({
    id: uuid(), business_id: bid, type, name, is_default: true, is_deleted: false, created_at: now,
  }));
  await setAll("categories", [...cats, ...docs]);
}

async function createBusiness(body) {
  if (!body?.name || !body?.owner_name) throw err("Lengkapi nama usaha dan nama pemilik");
  const businesses = await getAll("businesses");
  const b = {
    id: uuid(),
    name: body.name,
    owner_name: body.owner_name,
    business_type: body.business_type || "Lainnya",
    phone: body.phone || "",
    email: body.email || "",
    address: body.address || "",
    logo_url: body.logo_url ?? null,
    opening_balance: Number(body.opening_balance) || 0,
    is_demo: false,
    is_deleted: false,
    created_at: nowIso(),
  };
  await setAll("businesses", [...businesses, b]);
  await ensureDefaultCategories(b.id);
  return b;
}

async function getBusiness(id) {
  const b = (await getAll("businesses")).find((x) => x.id === id && !x.is_deleted);
  if (!b) throw err("Usaha tidak ditemukan", 404);
  return b;
}

async function updateBusiness(id, body) {
  const businesses = await getAll("businesses");
  const idx = businesses.findIndex((x) => x.id === id);
  if (idx < 0) throw err("Usaha tidak ditemukan", 404);
  const b = businesses[idx];
  const upd = {
    ...b,
    name: body.name ?? b.name,
    owner_name: body.owner_name ?? b.owner_name,
    business_type: body.business_type ?? b.business_type,
    phone: body.phone ?? b.phone,
    email: body.email ?? b.email,
    address: body.address ?? b.address,
    opening_balance: body.opening_balance != null ? Number(body.opening_balance) || 0 : b.opening_balance,
    logo_url: body.logo_url !== undefined ? body.logo_url : b.logo_url,
  };
  businesses[idx] = upd;
  await setAll("businesses", businesses);
  return upd;
}

async function deleteBusiness(id) {
  const businesses = await getAll("businesses");
  const idx = businesses.findIndex((x) => x.id === id && !x.is_deleted);
  if (idx < 0) throw err("Usaha tidak ditemukan", 404);
  businesses[idx] = { ...businesses[idx], is_deleted: true };
  await setAll("businesses", businesses);
  const txs = await getAll("transactions");
  await setAll("transactions", txs.map((t) => (t.business_id === id ? { ...t, is_deleted: true } : t)));
  return { ok: true };
}

// ---------------- categories ----------------
async function listCategories(bid) {
  return (await getAll("categories")).filter((c) => c.business_id === bid && !c.is_deleted);
}

async function createCategory(body) {
  const bid = body.business_id;
  if (!bid) throw err("Usaha tidak ditemukan", 404);
  if (!["income", "expense"].includes(body.type)) throw err("Jenis kategori tidak valid");
  const cats = await getAll("categories");
  const exists = cats.find(
    (c) => c.business_id === bid && c.name === body.name && c.type === body.type && !c.is_deleted
  );
  if (exists) throw err("Kategori sudah ada");
  const doc = {
    id: uuid(), business_id: bid, name: body.name, type: body.type,
    is_default: false, is_deleted: false, created_at: nowIso(),
  };
  await setAll("categories", [...cats, doc]);
  return doc;
}

async function deleteCategory(id) {
  const cats = await getAll("categories");
  const idx = cats.findIndex((c) => c.id === id);
  if (idx < 0) throw err("Kategori tidak ditemukan", 404);
  cats[idx] = { ...cats[idx], is_deleted: true };
  await setAll("categories", cats);
  return { ok: true };
}

async function suggestCategory(bid, type, text) {
  if (!["income", "expense"].includes(type)) return { suggestion: null, confidence: 0 };
  const t = (text || "").toLowerCase().trim();
  if (t.length < 2) return { suggestion: null, confidence: 0 };
  const tokens = t.replace(/\//g, " ").replace(/,/g, " ").split(/\s+/).filter((x) => x.length >= 3);
  if (!tokens.length) return { suggestion: null, confidence: 0 };
  const rows = (await getAll("transactions"))
    .filter((r) => r.business_id === bid && r.type === type && !r.is_deleted && r.category !== UNCATEGORIZED)
    .sort((a, z) => (a.created_at < z.created_at ? 1 : -1))
    .slice(0, 500);
  const scores = {};
  rows.forEach((r) => {
    const desc = (r.description || "").toLowerCase();
    if (!desc) return;
    const matched = tokens.reduce((n, tok) => n + (desc.includes(tok) ? 1 : 0), 0);
    if (matched) scores[r.category] = (scores[r.category] || 0) + matched;
  });
  const entries = Object.entries(scores);
  if (!entries.length) return { suggestion: null, confidence: 0 };
  const best = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const total = entries.reduce((n, [, v]) => n + v, 0);
  return { suggestion: best[0], confidence: best[1] / total, match_score: best[1] };
}

// ---------------- transactions ----------------
async function listTransactions(params) {
  let rows = (await getAll("transactions")).filter((t) => !t.is_deleted);
  if (params.business_id) rows = rows.filter((t) => t.business_id === params.business_id);
  if (["income", "expense"].includes(params.type)) rows = rows.filter((t) => t.type === params.type);
  if (params.category) rows = rows.filter((t) => t.category === params.category);
  if (params.status) rows = rows.filter((t) => t.status === params.status);
  if (params.start_date) rows = rows.filter((t) => t.date >= params.start_date);
  if (params.end_date) rows = rows.filter((t) => t.date <= params.end_date);
  if (params.search) {
    const s = String(params.search).toLowerCase();
    rows = rows.filter((t) => (t.description || "").toLowerCase().includes(s));
  }
  const dir = params.sort === "oldest" ? 1 : -1;
  rows.sort((a, z) => {
    if (a.date !== z.date) return a.date < z.date ? -dir : dir;
    return a.created_at < z.created_at ? -dir : dir;
  });
  const limit = Math.min(Number(params.limit) || 200, 1000);
  return rows.slice(0, limit);
}

async function createTransaction(body) {
  const bid = body.business_id;
  if (!bid) throw err("Usaha tidak ditemukan", 404);
  if (!(body.amount > 0)) throw err("Nominal harus lebih dari 0");
  if (!["income", "expense"].includes(body.type)) throw err("Jenis transaksi tidak valid");
  const category = (body.category || "").trim() || UNCATEGORIZED;
  if (category === UNCATEGORIZED) {
    const cats = await getAll("categories");
    const exists = cats.find(
      (c) => c.business_id === bid && c.name === UNCATEGORIZED && c.type === body.type && !c.is_deleted
    );
    if (!exists) {
      await setAll("categories", [
        ...cats,
        { id: uuid(), business_id: bid, type: body.type, name: UNCATEGORIZED, is_default: true, is_deleted: false, created_at: nowIso() },
      ]);
    }
  }
  const now = nowIso();
  const doc = {
    id: uuid(),
    business_id: bid,
    date: body.date,
    type: body.type,
    category,
    amount: Number(body.amount),
    description: body.description || "",
    payment_method: PAYMENT_METHODS.includes(body.payment_method) ? body.payment_method : "Lainnya",
    receipt_id: null,
    status: "approved",
    review_note: null,
    created_at: now,
    updated_at: now,
    is_deleted: false,
  };
  const txs = await getAll("transactions");
  await setAll("transactions", [...txs, doc]);
  return doc;
}

async function updateTransaction(id, body) {
  if (!(body.amount > 0)) throw err("Nominal harus lebih dari 0");
  const txs = await getAll("transactions");
  const idx = txs.findIndex((t) => t.id === id && !t.is_deleted);
  if (idx < 0) throw err("Transaksi tidak ditemukan", 404);
  const t = txs[idx];
  const upd = {
    ...t,
    date: body.date,
    type: body.type,
    category: (body.category || "").trim() || UNCATEGORIZED,
    amount: Number(body.amount),
    description: body.description || "",
    payment_method: PAYMENT_METHODS.includes(body.payment_method) ? body.payment_method : t.payment_method,
    updated_at: nowIso(),
  };
  txs[idx] = upd;
  await setAll("transactions", txs);
  return upd;
}

async function deleteTransaction(id) {
  const txs = await getAll("transactions");
  const idx = txs.findIndex((t) => t.id === id && !t.is_deleted);
  if (idx < 0) throw err("Transaksi tidak ditemukan", 404);
  txs[idx] = { ...txs[idx], is_deleted: true, updated_at: nowIso() };
  await setAll("transactions", txs);
  return { ok: true };
}

// ---------------- dashboard / reports / insights ----------------
async function dashboardBusiness(bid) {
  const b = (await getAll("businesses")).find((x) => x.id === bid && !x.is_deleted);
  if (!b) throw err("Usaha tidak ditemukan", 404);
  const txs = (await getAll("transactions")).filter((t) => !t.is_deleted);
  const [start, end] = monthBounds();
  const month = approvedTotals(txs, bid, start, end);
  const all = approvedTotals(txs, bid, null, null);
  const balance = (b.opening_balance || 0) + all.income - all.expense;
  const today = new Date();
  const monthly = [];
  for (let k = 5; k >= 0; k -= 1) {
    const first = shiftMonth(new Date(today.getFullYear(), today.getMonth(), 1), -k);
    const [ms, me] = monthBounds(first);
    const { income, expense } = approvedTotals(txs, bid, ms, me);
    monthly.push({ month: monthLabel(first), income, expense, profit: income - expense });
  }
  const recent = txs
    .filter((t) => t.business_id === bid)
    .sort((a, z) => (a.created_at < z.created_at ? 1 : -1))
    .slice(0, 8);
  return {
    business: b,
    balance,
    month_income: month.income,
    month_expense: month.expense,
    month_profit: month.income - month.expense,
    pending_count: 0,
    needs_correction_count: 0,
    monthly,
    expense_categories: byCategory(month.rows, "expense"),
    recent,
    period: { start, end },
  };
}

async function buildReport(bid, start, end) {
  const b = (await getAll("businesses")).find((x) => x.id === bid);
  if (!b) throw err("Usaha tidak ditemukan", 404);
  const txs = (await getAll("transactions")).filter((t) => !t.is_deleted);
  const { income, expense, rows } = approvedTotals(txs, bid, start, end);
  const prior = approvedTotals(txs, bid, null, dayBefore(start));
  const opening = (b.opening_balance || 0) + prior.income - prior.expense;
  return {
    business_name: b.name,
    period: { start, end },
    total_income: income,
    total_expense: expense,
    net_profit: income - expense,
    profit_margin: income ? ((income - expense) / income) * 100 : 0,
    opening_balance: opening,
    closing_balance: opening + income - expense,
    income_by_category: byCategory(rows, "income"),
    expense_by_category: byCategory(rows, "expense"),
    transaction_count: rows.length,
  };
}

async function getInsights(bid) {
  const txs = (await getAll("transactions")).filter((t) => !t.is_deleted);
  const today = new Date();
  const [cs, ce] = monthBounds(today);
  const prevFirst = shiftMonth(new Date(today.getFullYear(), today.getMonth(), 1), -1);
  const [ps, pe] = monthBounds(prevFirst);
  const cur = approvedTotals(txs, bid, cs, ce);
  const prev = approvedTotals(txs, bid, ps, pe);
  const income = cur.income;
  const expense = cur.expense;
  const rows = cur.rows;
  const pIncome = prev.income;
  const pExpense = prev.expense;
  const insights = [];
  const pct = (n, o) => (!o ? null : ((n - o) / o) * 100);

  const ri = pct(income, pIncome);
  if (ri !== null) {
    insights.push({
      tone: ri >= 0 ? "positive" : "warning",
      title: "Uang masuk bulan ini",
      text: `Uang masuk ${ri >= 0 ? "naik" : "turun"} ${Math.abs(Math.round(ri))}% dibanding bulan lalu (${rupiah(income)} vs ${rupiah(pIncome)}).`,
    });
  } else if (income) {
    insights.push({
      tone: "neutral",
      title: "Uang masuk bulan ini",
      text: `Total uang masuk bulan ini ${rupiah(income)}. Belum ada data bulan lalu untuk dibandingkan.`,
    });
  }

  const re = pct(expense, pExpense);
  if (re !== null) {
    insights.push({
      tone: re > 0 ? "warning" : "positive",
      title: "Uang keluar bulan ini",
      text: `Uang keluar ${re >= 0 ? "naik" : "turun"} ${Math.abs(Math.round(re))}% dibanding bulan lalu (${rupiah(expense)}).`,
    });
  }

  const expCats = byCategory(rows, "expense");
  if (expCats.length) {
    const top = expCats[0];
    insights.push({
      tone: "neutral",
      title: "Pengeluaran terbesar",
      text: `"${top.name}" adalah pengeluaran terbesar bulan ini, ${Math.round(top.percentage)}% dari total pengeluaran (${rupiah(top.amount)}).`,
    });
  }

  const incCats = byCategory(rows, "income");
  if (incCats.length) {
    const top = incCats[0];
    insights.push({
      tone: "positive",
      title: "Sumber pemasukan utama",
      text: `"${top.name}" menyumbang ${Math.round(top.percentage)}% dari uang masuk bulan ini.`,
    });
  }

  const margin = income ? ((income - expense) / income) * 100 : 0;
  const pMargin = pIncome ? ((pIncome - pExpense) / pIncome) * 100 : null;
  if (income) {
    if (pMargin !== null) {
      const better = margin >= pMargin;
      insights.push({
        tone: better ? "positive" : "warning",
        title: "Margin keuntungan",
        text: `Margin keuntungan bulan ini ${Math.round(margin)}%, ${better ? "lebih baik" : "lebih rendah"} dari bulan lalu (${Math.round(pMargin)}%).`,
      });
    } else {
      insights.push({
        tone: "neutral",
        title: "Margin keuntungan",
        text: `Margin keuntungan bulan ini ${Math.round(margin)}% dari total uang masuk.`,
      });
    }
  }

  const dayNames = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
  const dayTotals = {};
  rows.forEach((r) => {
    if (r.type !== "income") return;
    const js = new Date(`${r.date}T00:00:00`).getDay();
    const wd = (js + 6) % 7;
    dayTotals[wd] = (dayTotals[wd] || 0) + r.amount;
  });
  const dayEntries = Object.entries(dayTotals);
  if (dayEntries.length) {
    const best = dayEntries.reduce((a, b) => (b[1] > a[1] ? b : a));
    insights.push({
      tone: "neutral",
      title: "Hari paling ramai",
      text: `Hari ${dayNames[best[0]]} menghasilkan penjualan tertinggi bulan ini (${rupiah(best[1])}).`,
    });
  }

  if (expense > income && income) {
    insights.push({
      tone: "warning",
      title: "Perhatian",
      text: "Pengeluaran bulan ini lebih besar dari pemasukan. Coba tinjau kembali pengeluaran terbesar Anda.",
    });
  }

  if (!insights.length) {
    insights.push({
      tone: "neutral",
      title: "Belum ada data",
      text: "Catat transaksi Anda terlebih dahulu untuk melihat analisis usaha.",
    });
  }
  return { insights, period: { start: cs, end: ce } };
}

// ---------------- router ----------------
async function handle(method, path, data, config = {}) {
  const { seg, query } = parse(path);
  const params = { ...query, ...(config.params || {}) };
  const r = seg[0];

  if (r === "businesses") {
    if (seg.length === 1) {
      if (method === "GET") return { data: await listBusinesses() };
      if (method === "POST") return { data: await createBusiness(data) };
    }
    if (seg.length === 2) {
      const id = seg[1];
      if (method === "GET") return { data: await getBusiness(id) };
      if (method === "PUT") return { data: await updateBusiness(id, data) };
      if (method === "DELETE") return { data: await deleteBusiness(id) };
    }
  }
  if (r === "categories") {
    if (seg.length === 1) {
      if (method === "GET") return { data: await listCategories(params.business_id) };
      if (method === "POST") return { data: await createCategory(data) };
    }
    if (seg.length === 2) {
      if (seg[1] === "suggest" && method === "GET")
        return { data: await suggestCategory(params.business_id, params.type, params.text) };
      if (method === "DELETE") return { data: await deleteCategory(seg[1]) };
    }
  }
  if (r === "transactions") {
    if (seg.length === 1) {
      if (method === "GET") return { data: await listTransactions(params) };
      if (method === "POST") return { data: await createTransaction(data) };
    }
    if (seg.length === 2) {
      const id = seg[1];
      if (method === "PUT") return { data: await updateTransaction(id, data) };
      if (method === "DELETE") return { data: await deleteTransaction(id) };
    }
  }
  if (r === "dashboard" && seg[1] === "business" && method === "GET")
    return { data: await dashboardBusiness(params.business_id) };
  if (r === "reports" && method === "GET") {
    const [ms, me] = monthBounds();
    return { data: await buildReport(params.business_id, params.start_date || ms, params.end_date || me) };
  }
  if (r === "insights" && method === "GET") return { data: await getInsights(params.business_id) };

  throw err(`Endpoint tidak dikenal: ${method} ${path}`, 404);
}

const api = {
  get: (path, config = {}) => handle("GET", path, undefined, config),
  delete: (path, config = {}) => handle("DELETE", path, undefined, config),
  post: (path, data, config = {}) => handle("POST", path, data, config),
  put: (path, data, config = {}) => handle("PUT", path, data, config),
};

// ---------------- unduhan (Excel / CSV / PDF) ----------------
export async function downloadFile(path, filename) {
  const { seg, query } = parse(path);
  const params = query;
  const [ms, me] = monthBounds();

  // /businesses/{id}/export -> Excel
  if (seg[0] === "businesses" && seg[2] === "export") {
    const bid = seg[1];
    const start = params.start_date || ms;
    const end = params.end_date || me;
    const business = await getBusiness(bid);
    const report = await buildReport(bid, start, end);
    const txsAll = (await getAll("transactions")).filter((t) => !t.is_deleted);
    const txs = txsAll
      .filter((t) => t.business_id === bid && t.status === "approved" && t.date >= start && t.date <= end)
      .sort((a, z) => (a.date < z.date ? -1 : 1));
    const today = new Date();
    const monthly = [];
    for (let k = 5; k >= 0; k -= 1) {
      const first = shiftMonth(new Date(today.getFullYear(), today.getMonth(), 1), -k);
      const [a, b] = monthBounds(first);
      const { income, expense } = approvedTotals(txsAll, bid, a, b);
      monthly.push({ month: monthLabel(first), income, expense, profit: income - expense });
    }
    await exportBusinessExcel(business, report, monthly, txs, `${start} s/d ${end}`, filename);
    return;
  }

  // /export/{kind}?format=csv|pdf
  if (seg[0] === "export") {
    const kind = seg[1];
    const format = params.format || "csv";
    const bid = params.business_id;
    const start = params.start_date || ms;
    const end = params.end_date || me;
    const report = await buildReport(bid, start, end);
    const name = report.business_name;
    const period = `${start} s/d ${end}`;
    if (kind === "transactions") {
      const rows = (await getAll("transactions"))
        .filter((t) => !t.is_deleted && t.business_id === bid && t.date >= start && t.date <= end)
        .sort((a, z) => (a.date < z.date ? 1 : -1));
      if (format === "pdf") { exportPdf(name, period, report, "transactions", rows, filename); return; }
      saveCsv(transactionsCsv(rows), filename);
      return;
    }
    if (format === "pdf") { exportPdf(name, period, report, kind, null, filename); return; }
    saveCsv(reportCsv(name, period, report, kind), filename);
    return;
  }

  throw err("Unduhan tidak dikenal", 404);
}

export default api;
