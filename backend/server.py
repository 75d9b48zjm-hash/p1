from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import os
import uuid
import logging
from calendar import monthrange
from datetime import datetime, timezone, timedelta, date
from typing import Optional, List

from fastapi import FastAPI, APIRouter, Depends, HTTPException, UploadFile, File, Query, Response, Header
from fastapi.responses import StreamingResponse, FileResponse, HTMLResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

from starlette.concurrency import run_in_threadpool

from db import db, client
import ocr
import auth as auth_mod
from auth import (router as auth_router, get_current_user, require_admin, assert_business_access,
                  hash_password, public_user, create_business, seed_admin, create_default_categories,
                  UNCATEGORIZED)
from seed import seed_demo
from storage import init_storage, put_object, get_object, APP_NAME, MIME_TYPES
import exports
import excel_export

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI(title="KasUMKM API")
api = APIRouter(prefix="/api")

STATUSES = ["pending", "approved", "needs_correction"]
PAYMENT_METHODS = ["Tunai", "Transfer Bank", "QRIS", "E-wallet", "Lainnya"]


# ---------------- helpers ----------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def month_bounds(ref: Optional[date] = None):
    ref = ref or datetime.now(timezone.utc).date()
    start = ref.replace(day=1)
    end = ref.replace(day=monthrange(ref.year, ref.month)[1])
    return start.isoformat(), end.isoformat()


def shift_month(ref: date, months: int) -> date:
    y = ref.year + (ref.month - 1 + months) // 12
    m = (ref.month - 1 + months) % 12 + 1
    return date(y, m, 1)


async def log_audit(user: dict, action: str, business_id: Optional[str], record_type: str,
                    record_id: str, old_value=None, new_value=None, label: str = ""):
    await db.audit_logs.insert_one({
        "_id": str(uuid.uuid4()),
        "business_id": business_id,
        "user_id": user["_id"],
        "user_name": user.get("name"),
        "user_role": user.get("role"),
        "action": action,
        "record_type": record_type,
        "record_id": record_id,
        "label": label,
        "old_value": old_value,
        "new_value": new_value,
        "created_at": now_iso(),
    })


async def notify(business_id: Optional[str], role: str, title: str, message: str, link: str = "", kind: str = "general"):
    await db.notifications.insert_one({
        "_id": str(uuid.uuid4()),
        "business_id": business_id,
        "target_role": role,
        "title": title,
        "message": message,
        "link": link,
        "kind": kind,
        "is_read": False,
        "created_at": now_iso(),
    })


async def approved_totals(business_id: str, start: Optional[str] = None, end: Optional[str] = None):
    q = {"business_id": business_id, "status": "approved", "is_deleted": False}
    if start or end:
        q["date"] = {}
        if start:
            q["date"]["$gte"] = start
        if end:
            q["date"]["$lte"] = end
    rows = await db.transactions.find(q, {"amount": 1, "type": 1, "category": 1, "date": 1}).to_list(100000)
    income = sum(r["amount"] for r in rows if r["type"] == "income")
    expense = sum(r["amount"] for r in rows if r["type"] == "expense")
    return income, expense, rows


def by_category(rows, kind):
    agg = {}
    for r in rows:
        if r["type"] != kind:
            continue
        agg[r["category"]] = agg.get(r["category"], 0) + r["amount"]
    total = sum(agg.values()) or 1
    out = [{"name": k, "amount": v, "percentage": v / total * 100} for k, v in agg.items()]
    return sorted(out, key=lambda x: -x["amount"])


def clean_business(b: dict) -> dict:
    b = dict(b)
    b["id"] = b.pop("_id")
    return b


def clean(doc: dict) -> dict:
    doc = dict(doc)
    doc["id"] = doc.pop("_id")
    return doc


# ---------------- models ----------------
class BusinessInput(BaseModel):
    name: str
    owner_name: str
    business_type: str = "Lainnya"
    phone: str = ""
    email: str = ""
    address: str = ""
    opening_balance: float = 0
    logo_url: Optional[str] = None


class BusinessCreateInput(BusinessInput):
    user_email: EmailStr
    user_password: str = Field(min_length=6)


class TransactionInput(BaseModel):
    business_id: Optional[str] = None
    date: str
    type: str
    category: str
    amount: float
    description: str = ""
    payment_method: str = "Tunai"
    receipt_id: Optional[str] = None


class ReviewInput(BaseModel):
    status: str
    note: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None


class CategoryInput(BaseModel):
    business_id: Optional[str] = None
    name: str
    type: str


class ProfileInput(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    notify_email: Optional[bool] = None
    notify_app: Optional[bool] = None


# ---------------- businesses ----------------
@api.get("/businesses")
async def list_businesses(user: dict = Depends(require_admin)):
    businesses = await db.businesses.find({"is_deleted": False}).to_list(1000)
    start, end = month_bounds()
    out = []
    for b in businesses:
        income, expense, _ = await approved_totals(b["_id"], start, end)
        pending = await db.transactions.count_documents({"business_id": b["_id"], "status": "pending", "is_deleted": False})
        needs_fix = await db.transactions.count_documents({"business_id": b["_id"], "status": "needs_correction", "is_deleted": False})
        last = await db.transactions.find({"business_id": b["_id"], "is_deleted": False}).sort("created_at", -1).limit(1).to_list(1)
        last_activity = last[0]["created_at"] if last else None
        status = "active"
        if pending > 3 or needs_fix > 0:
            status = "needs_attention"
        if last_activity:
            days = (datetime.now(timezone.utc) - datetime.fromisoformat(last_activity)).days
            if days > 7:
                status = "no_activity"
        else:
            status = "no_activity"
        out.append({**clean_business(b), "month_income": income, "month_expense": expense,
                    "month_profit": income - expense, "pending_count": pending,
                    "needs_correction_count": needs_fix, "last_activity": last_activity, "status": status})
    return sorted(out, key=lambda x: -x["month_profit"])


@api.post("/businesses")
async def create_business_endpoint(body: BusinessInput, user: dict = Depends(get_current_user)):
    bid = await create_business(body.name, body.owner_name, body.business_type, body.phone, body.email, body.address)
    await db.businesses.update_one({"_id": bid}, {"$set": {"opening_balance": body.opening_balance, "logo_url": body.logo_url}})
    await log_audit(user, "business_created", bid, "business", bid, None, body.name, f"UMKM dibuat: {body.name}")
    b = await db.businesses.find_one({"_id": bid})
    return clean_business(b)


@api.get("/businesses/{business_id}")
async def get_business(business_id: str, user: dict = Depends(get_current_user)):
    assert_business_access(user, business_id)
    b = await db.businesses.find_one({"_id": business_id, "is_deleted": False})
    if not b:
        raise HTTPException(status_code=404, detail="Usaha tidak ditemukan")
    return clean_business(b)


@api.put("/businesses/{business_id}")
async def update_business(business_id: str, body: BusinessInput, user: dict = Depends(get_current_user)):
    assert_business_access(user, business_id)
    old = await db.businesses.find_one({"_id": business_id})
    if not old:
        raise HTTPException(status_code=404, detail="Usaha tidak ditemukan")
    data = body.model_dump()
    if user.get("role") != "admin":
        data.pop("opening_balance", None)
    await db.businesses.update_one({"_id": business_id}, {"$set": data})
    await log_audit(user, "business_updated", business_id, "business", business_id, old.get("name"), body.name, "Profil usaha diperbarui")
    b = await db.businesses.find_one({"_id": business_id})
    return clean_business(b)


@api.delete("/businesses/{business_id}")
async def delete_business(business_id: str, user: dict = Depends(get_current_user)):
    b = await db.businesses.find_one({"_id": business_id, "is_deleted": False})
    if not b:
        raise HTTPException(status_code=404, detail="Usaha tidak ditemukan")
    await db.businesses.update_one({"_id": business_id}, {"$set": {"is_deleted": True}})
    await db.transactions.update_many({"business_id": business_id}, {"$set": {"is_deleted": True}})
    await log_audit(user, "business_deleted", business_id, "business", business_id, b.get("name"), None, f"UMKM dihapus: {b.get('name')}")
    return {"ok": True}


# ---------------- categories ----------------
@api.get("/categories")
async def list_categories(business_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    bid = business_id or user.get("business_id")
    assert_business_access(user, bid)
    rows = await db.categories.find({"business_id": bid, "is_deleted": False}).to_list(500)
    return [clean(r) for r in rows]


@api.post("/categories")
async def create_category(body: CategoryInput, user: dict = Depends(get_current_user)):
    bid = body.business_id or user.get("business_id")
    assert_business_access(user, bid)
    if user.get("role") != "admin" and not user.get("can_manage_categories", True):
        raise HTTPException(status_code=403, detail="Anda tidak diizinkan mengelola kategori")
    if body.type not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="Jenis kategori tidak valid")
    exists = await db.categories.find_one({"business_id": bid, "name": body.name, "type": body.type, "is_deleted": False})
    if exists:
        raise HTTPException(status_code=400, detail="Kategori sudah ada")
    doc = {"_id": str(uuid.uuid4()), "business_id": bid, "name": body.name, "type": body.type,
           "is_default": False, "is_deleted": False, "created_at": now_iso()}
    await db.categories.insert_one(doc)
    await log_audit(user, "category_created", bid, "category", doc["_id"], None, body.name, f"Kategori dibuat: {body.name}")
    return clean(doc)


@api.get("/categories/suggest")
async def suggest_category(
    text: str = "",
    type: str = "expense",
    business_id: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """Saran kategori dari histori transaksi UMKM (rule-based, gratis). Cocokkan kata kunci
    dari deskripsi terbaru pengguna. Jangan pernah menyarankan 'Belum Dikategorikan'."""
    bid = business_id or user.get("business_id")
    assert_business_access(user, bid)
    if type not in ("income", "expense"):
        return {"suggestion": None, "confidence": 0}
    text = (text or "").lower().strip()
    if len(text) < 2:
        return {"suggestion": None, "confidence": 0}
    tokens = [t for t in text.replace("/", " ").replace(",", " ").split() if len(t) >= 3]
    if not tokens:
        return {"suggestion": None, "confidence": 0}
    rows = await db.transactions.find(
        {"business_id": bid, "type": type, "is_deleted": False,
         "category": {"$ne": UNCATEGORIZED}},
        {"description": 1, "category": 1}
    ).sort("created_at", -1).limit(500).to_list(500)
    scores = {}
    for r in rows:
        desc = (r.get("description") or "").lower()
        if not desc:
            continue
        matched = sum(1 for tok in tokens if tok in desc)
        if matched:
            cat = r["category"]
            scores[cat] = scores.get(cat, 0) + matched
    if not scores:
        return {"suggestion": None, "confidence": 0}
    best = max(scores.items(), key=lambda kv: kv[1])
    total = sum(scores.values())
    return {"suggestion": best[0], "confidence": best[1] / total, "match_score": best[1]}


@api.delete("/categories/{category_id}")
async def delete_category(category_id: str, user: dict = Depends(get_current_user)):
    cat = await db.categories.find_one({"_id": category_id})
    if not cat:
        raise HTTPException(status_code=404, detail="Kategori tidak ditemukan")
    assert_business_access(user, cat["business_id"])
    await db.categories.update_one({"_id": category_id}, {"$set": {"is_deleted": True}})
    await log_audit(user, "category_deleted", cat["business_id"], "category", category_id, cat["name"], None,
                    f"Kategori dihapus: {cat['name']}")
    return {"ok": True}


# ---------------- transactions ----------------
@api.get("/transactions")
async def list_transactions(
    business_id: Optional[str] = None,
    search: Optional[str] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    sort: str = "newest",
    limit: int = 200,
    user: dict = Depends(get_current_user),
):
    q = {"is_deleted": False}
    if user.get("role") == "admin":
        if business_id:
            q["business_id"] = business_id
    else:
        bid = business_id or user.get("business_id")
        assert_business_access(user, bid)
        q["business_id"] = bid
    if type in ("income", "expense"):
        q["type"] = type
    if category:
        q["category"] = category
    if status in STATUSES:
        q["status"] = status
    if start_date or end_date:
        q["date"] = {}
        if start_date:
            q["date"]["$gte"] = start_date
        if end_date:
            q["date"]["$lte"] = end_date
    if search:
        q["description"] = {"$regex": search, "$options": "i"}
    direction = 1 if sort == "oldest" else -1
    rows = await db.transactions.find(q).sort([("date", direction), ("created_at", direction)]).limit(min(limit, 1000)).to_list(1000)
    biz_names = {}
    if user.get("role") == "admin":
        for b in await db.businesses.find({}, {"name": 1}).to_list(1000):
            biz_names[b["_id"]] = b["name"]
    return [{**clean(r), "business_name": biz_names.get(r["business_id"])} for r in rows]


@api.post("/transactions")
async def create_transaction(body: TransactionInput, user: dict = Depends(get_current_user)):
    bid = body.business_id or user.get("business_id")
    assert_business_access(user, bid)
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Nominal harus lebih dari 0")
    if body.type not in ("income", "expense"):
        raise HTTPException(status_code=400, detail="Jenis transaksi tidak valid")
    category = (body.category or "").strip() or UNCATEGORIZED
    if category == UNCATEGORIZED:
        exists = await db.categories.find_one({"business_id": bid, "name": UNCATEGORIZED, "type": body.type, "is_deleted": False})
        if not exists:
            await db.categories.insert_one({
                "_id": str(uuid.uuid4()), "business_id": bid, "type": body.type,
                "name": UNCATEGORIZED, "is_default": True, "is_deleted": False,
                "created_at": now_iso(),
            })
    is_admin = user.get("role") == "admin"
    doc = {
        "_id": str(uuid.uuid4()),
        "business_id": bid,
        "date": body.date,
        "type": body.type,
        "category": category,
        "amount": float(body.amount),
        "description": body.description,
        "payment_method": body.payment_method if body.payment_method in PAYMENT_METHODS else "Lainnya",
        "receipt_id": body.receipt_id,
        "status": "approved" if is_admin else "pending",
        "review_note": None,
        "created_by": user["_id"],
        "created_by_name": user.get("name"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
        "reviewed_by": user["_id"] if is_admin else None,
        "reviewed_by_name": user.get("name") if is_admin else None,
        "reviewed_at": now_iso() if is_admin else None,
        "is_deleted": False,
        "is_demo": False,
    }
    await db.transactions.insert_one(doc)
    await log_audit(user, "transaction_created", bid, "transaction", doc["_id"], None,
                    {"amount": doc["amount"], "category": doc["category"], "type": doc["type"]},
                    f"Transaksi dibuat: {doc['category']}")
    if not is_admin:
        b = await db.businesses.find_one({"_id": bid}, {"name": 1})
        await notify(bid, "admin", "Transaksi baru masuk",
                     f"{b['name'] if b else 'UMKM'} mengirim transaksi baru menunggu tinjauan.", "/admin/review")
    return clean(doc)


@api.put("/transactions/{transaction_id}")
async def update_transaction(transaction_id: str, body: TransactionInput, user: dict = Depends(get_current_user)):
    t = await db.transactions.find_one({"_id": transaction_id, "is_deleted": False})
    if not t:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    assert_business_access(user, t["business_id"])
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail="Nominal harus lebih dari 0")
    is_admin = user.get("role") == "admin"
    if not is_admin and t["status"] == "approved":
        raise HTTPException(status_code=403, detail="Transaksi yang sudah disetujui tidak bisa diubah")
    update = {
        "date": body.date, "type": body.type, "category": body.category, "amount": float(body.amount),
        "description": body.description, "payment_method": body.payment_method,
        "updated_at": now_iso(),
    }
    if body.receipt_id is not None:
        update["receipt_id"] = body.receipt_id
    if not is_admin:
        update["status"] = "pending"
        update["review_note"] = None
    await db.transactions.update_one({"_id": transaction_id}, {"$set": update})
    if t.get("category") != body.category:
        await log_audit(user, "category_changed", t["business_id"], "transaction", transaction_id,
                        t.get("category"), body.category, f"Kategori diubah: {t.get('category')} → {body.category}")
    await log_audit(user, "transaction_updated", t["business_id"], "transaction", transaction_id,
                    {"amount": t["amount"], "description": t.get("description")},
                    {"amount": update["amount"], "description": update["description"]}, "Transaksi diperbarui")
    new = await db.transactions.find_one({"_id": transaction_id})
    return clean(new)


@api.post("/transactions/{transaction_id}/review")
async def review_transaction(transaction_id: str, body: ReviewInput, user: dict = Depends(require_admin)):
    if body.status not in ("approved", "needs_correction", "pending"):
        raise HTTPException(status_code=400, detail="Status tidak valid")
    t = await db.transactions.find_one({"_id": transaction_id, "is_deleted": False})
    if not t:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    update = {
        "status": body.status, "review_note": body.note, "reviewed_by": user["_id"],
        "reviewed_by_name": user.get("name"), "reviewed_at": now_iso(), "updated_at": now_iso(),
    }
    if body.category and body.category != t.get("category"):
        update["category"] = body.category
        await log_audit(user, "category_changed", t["business_id"], "transaction", transaction_id,
                        t.get("category"), body.category, f"Kategori dikelompokkan: {t.get('category')} → {body.category}")
    if body.description is not None and body.description != t.get("description", ""):
        update["description"] = body.description
    await db.transactions.update_one({"_id": transaction_id}, {"$set": update})
    action = "transaction_approved" if body.status == "approved" else "transaction_rejected"
    await log_audit(user, action, t["business_id"], "transaction", transaction_id, t["status"], body.status,
                    "Transaksi disetujui" if body.status == "approved" else "Transaksi perlu perbaikan")
    if body.status == "approved":
        await notify(t["business_id"], "msme", "Transaksi disetujui",
                     f"Transaksi {t['category']} sebesar {exports.rupiah(t['amount'])} sudah disetujui.", "/transactions")
    elif body.status == "needs_correction":
        await notify(t["business_id"], "msme", "Transaksi perlu perbaikan",
                     body.note or f"Transaksi {t['category']} perlu diperbaiki.", "/transactions")
    new = await db.transactions.find_one({"_id": transaction_id})
    return clean(new)


@api.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str, user: dict = Depends(get_current_user)):
    t = await db.transactions.find_one({"_id": transaction_id, "is_deleted": False})
    if not t:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
    assert_business_access(user, t["business_id"])
    if user.get("role") != "admin" and t["status"] == "approved":
        raise HTTPException(status_code=403, detail="Transaksi yang sudah disetujui tidak bisa dihapus")
    await db.transactions.update_one({"_id": transaction_id}, {"$set": {"is_deleted": True, "updated_at": now_iso()}})
    await log_audit(user, "transaction_deleted", t["business_id"], "transaction", transaction_id,
                    {"amount": t["amount"], "category": t["category"]}, None, "Transaksi dihapus")
    return {"ok": True}


# ---------------- receipts ----------------
@api.post("/receipts")
async def upload_receipt(business_id: Optional[str] = None, file: UploadFile = File(...),
                         user: dict = Depends(get_current_user)):
    bid = business_id or user.get("business_id")
    assert_business_access(user, bid)
    ext = (file.filename or "").split(".")[-1].lower()
    if ext not in MIME_TYPES:
        raise HTTPException(status_code=400, detail="Format tidak didukung. Gunakan JPG, PNG, atau PDF.")
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran berkas maksimal 10MB")
    content_type = MIME_TYPES[ext]
    rid = str(uuid.uuid4())
    path = f"{APP_NAME}/receipts/{bid}/{rid}.{ext}"
    result = put_object(path, data, content_type)
    doc = {"_id": rid, "business_id": bid, "storage_path": result["path"],
           "original_filename": file.filename, "content_type": content_type,
           "size": result.get("size", len(data)), "uploaded_by": user["_id"],
           "is_deleted": False, "created_at": now_iso()}
    await db.receipts.insert_one(doc)
    return {"id": rid, "filename": file.filename, "content_type": content_type}


@api.get("/receipts/{receipt_id}")
async def download_receipt(receipt_id: str, user: dict = Depends(get_current_user)):
    rec = await db.receipts.find_one({"_id": receipt_id, "is_deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="Bukti tidak ditemukan")
    assert_business_access(user, rec["business_id"])
    data, ct = get_object(rec["storage_path"])
    return Response(content=data, media_type=rec.get("content_type", ct),
                    headers={"Content-Disposition": f'inline; filename="{rec.get("original_filename", "bukti")}"'})


@api.post("/receipts/{receipt_id}/extract")
async def extract_receipt(receipt_id: str, user: dict = Depends(get_current_user)):
    """Foto Nota Pintar: baca nominal & tanggal dari nota via OCR (Tesseract, gratis)."""
    rec = await db.receipts.find_one({"_id": receipt_id, "is_deleted": False})
    if not rec:
        raise HTTPException(status_code=404, detail="Bukti tidak ditemukan")
    assert_business_access(user, rec["business_id"])
    if rec.get("content_type") == "application/pdf":
        raise HTTPException(status_code=400, detail="Baca otomatis hanya mendukung foto JPG/PNG")
    data, _ = get_object(rec["storage_path"])
    try:
        result = await run_in_threadpool(ocr.extract_receipt_data, data)
    except Exception as e:
        logger.error(f"OCR gagal untuk {receipt_id}: {e}")
        raise HTTPException(status_code=422, detail="Nota tidak dapat dibaca. Isi manual saja ya.")
    return {
        "amount": result["amount"],
        "date": result["date"],
        "found": bool(result["amount"] or result["date"]),
    }


# ---------------- reminders (Ingatkan Otomatis) ----------------
INACTIVITY_DAYS = 3


@api.get("/reminders/status")
async def reminder_status(business_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    """Cek berapa hari usaha belum mencatat transaksi. Dipanggil saat dashboard dibuka."""
    bid = business_id or user.get("business_id")
    assert_business_access(user, bid)
    now = datetime.now(timezone.utc)
    last = await db.transactions.find({"business_id": bid, "is_deleted": False}).sort("created_at", -1).limit(1).to_list(1)
    if last:
        days = (now - datetime.fromisoformat(last[0]["created_at"])).days
        last_date = last[0]["date"]
    else:
        b = await db.businesses.find_one({"_id": bid}, {"created_at": 1})
        created = b.get("created_at") if b else None
        days = (now - datetime.fromisoformat(created)).days if created else INACTIVITY_DAYS
        last_date = None
    remind = days >= INACTIVITY_DAYS
    if remind and user.get("role") == "msme":
        today = now.date().isoformat()
        exists = await db.notifications.find_one({
            "business_id": bid, "target_role": "msme", "kind": "inactivity_reminder",
            "created_at": {"$gte": today},
        })
        if not exists:
            await notify(bid, "msme", "Jangan lupa catat transaksi",
                         f"Sudah {days} hari Anda belum mencatat transaksi. Catat sekarang agar laporan tetap rapi.",
                         "/transaksi", kind="inactivity_reminder")
    return {"remind": remind, "inactive_days": days, "last_transaction_date": last_date,
            "threshold_days": INACTIVITY_DAYS}


# ---------------- dashboards ----------------
@api.get("/dashboard/admin")
async def admin_dashboard(user: dict = Depends(require_admin)):
    businesses = await db.businesses.find({"is_deleted": False}).to_list(1000)
    start, end = month_bounds()
    total_income = total_expense = 0.0
    for b in businesses:
        i, e, _ = await approved_totals(b["_id"], start, end)
        total_income += i
        total_expense += e
    pending = await db.transactions.count_documents({"status": "pending", "is_deleted": False})
    needs_fix = await db.transactions.count_documents({"status": "needs_correction", "is_deleted": False})
    return {
        "total_businesses": len(businesses),
        "total_income": total_income,
        "total_expense": total_expense,
        "net_profit": total_income - total_expense,
        "pending_count": pending,
        "needs_correction_count": needs_fix,
        "period": {"start": start, "end": end},
    }


@api.get("/dashboard/business")
async def business_dashboard(business_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    bid = business_id or user.get("business_id")
    assert_business_access(user, bid)
    b = await db.businesses.find_one({"_id": bid})
    if not b:
        raise HTTPException(status_code=404, detail="Usaha tidak ditemukan")
    start, end = month_bounds()
    m_income, m_expense, month_rows = await approved_totals(bid, start, end)
    all_income, all_expense, _ = await approved_totals(bid)
    balance = b.get("opening_balance", 0) + all_income - all_expense
    today = datetime.now(timezone.utc).date()
    monthly = []
    for k in range(5, -1, -1):
        first = shift_month(today.replace(day=1), -k)
        last = first.replace(day=monthrange(first.year, first.month)[1])
        i, e, _ = await approved_totals(bid, first.isoformat(), last.isoformat())
        monthly.append({"month": first.strftime("%b %Y"), "income": i, "expense": e, "profit": i - e})
    pending = await db.transactions.count_documents({"business_id": bid, "status": "pending", "is_deleted": False})
    needs_fix = await db.transactions.count_documents({"business_id": bid, "status": "needs_correction", "is_deleted": False})
    recent = await db.transactions.find({"business_id": bid, "is_deleted": False}).sort("created_at", -1).limit(8).to_list(8)
    return {
        "business": clean_business(b),
        "balance": balance,
        "month_income": m_income,
        "month_expense": m_expense,
        "month_profit": m_income - m_expense,
        "pending_count": pending,
        "needs_correction_count": needs_fix,
        "monthly": monthly,
        "expense_categories": by_category(month_rows, "expense"),
        "recent": [clean(r) for r in recent],
        "period": {"start": start, "end": end},
    }


# ---------------- reports ----------------
async def build_report(bid: str, start: str, end: str):
    b = await db.businesses.find_one({"_id": bid})
    income, expense, rows = await approved_totals(bid, start, end)
    prior_income, prior_expense, _ = await approved_totals(bid, None, (date.fromisoformat(start) - timedelta(days=1)).isoformat())
    opening = b.get("opening_balance", 0) + prior_income - prior_expense
    return {
        "business_name": b["name"],
        "period": {"start": start, "end": end},
        "total_income": income,
        "total_expense": expense,
        "net_profit": income - expense,
        "profit_margin": (income - expense) / income * 100 if income else 0,
        "opening_balance": opening,
        "closing_balance": opening + income - expense,
        "income_by_category": by_category(rows, "income"),
        "expense_by_category": by_category(rows, "expense"),
        "transaction_count": len(rows),
    }


@api.get("/reports")
async def get_reports(business_id: Optional[str] = None, start_date: Optional[str] = None,
                      end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    bid = business_id or user.get("business_id")
    assert_business_access(user, bid)
    ms, me = month_bounds()
    return await build_report(bid, start_date or ms, end_date or me)


@api.get("/insights")
async def get_insights(business_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    bid = business_id or user.get("business_id")
    assert_business_access(user, bid)
    today = datetime.now(timezone.utc).date()
    cs, ce = month_bounds(today)
    prev_first = shift_month(today.replace(day=1), -1)
    ps, pe = month_bounds(prev_first)
    income, expense, rows = await approved_totals(bid, cs, ce)
    p_income, p_expense, _ = await approved_totals(bid, ps, pe)
    insights = []

    def pct(new, old):
        if not old:
            return None
        return (new - old) / old * 100

    ri = pct(income, p_income)
    if ri is not None:
        insights.append({
            "tone": "positive" if ri >= 0 else "warning",
            "title": "Uang masuk bulan ini",
            "text": f"Uang masuk {'naik' if ri >= 0 else 'turun'} {abs(ri):.0f}% dibanding bulan lalu ({exports.rupiah(income)} vs {exports.rupiah(p_income)}).",
        })
    elif income:
        insights.append({"tone": "neutral", "title": "Uang masuk bulan ini",
                         "text": f"Total uang masuk bulan ini {exports.rupiah(income)}. Belum ada data bulan lalu untuk dibandingkan."})
    re_ = pct(expense, p_expense)
    if re_ is not None:
        insights.append({
            "tone": "warning" if re_ > 0 else "positive",
            "title": "Uang keluar bulan ini",
            "text": f"Uang keluar {'naik' if re_ >= 0 else 'turun'} {abs(re_):.0f}% dibanding bulan lalu ({exports.rupiah(expense)}).",
        })
    exp_cats = by_category(rows, "expense")
    if exp_cats:
        top = exp_cats[0]
        insights.append({"tone": "neutral", "title": "Pengeluaran terbesar",
                         "text": f"\"{top['name']}\" adalah pengeluaran terbesar bulan ini, {top['percentage']:.0f}% dari total pengeluaran ({exports.rupiah(top['amount'])})."})
    inc_cats = by_category(rows, "income")
    if inc_cats:
        top = inc_cats[0]
        insights.append({"tone": "positive", "title": "Sumber pemasukan utama",
                         "text": f"\"{top['name']}\" menyumbang {top['percentage']:.0f}% dari uang masuk bulan ini."})
    margin = (income - expense) / income * 100 if income else 0
    p_margin = (p_income - p_expense) / p_income * 100 if p_income else None
    if income:
        if p_margin is not None:
            better = margin >= p_margin
            insights.append({"tone": "positive" if better else "warning", "title": "Margin keuntungan",
                             "text": f"Margin keuntungan bulan ini {margin:.0f}%, {'lebih baik' if better else 'lebih rendah'} dari bulan lalu ({p_margin:.0f}%)."})
        else:
            insights.append({"tone": "neutral", "title": "Margin keuntungan",
                             "text": f"Margin keuntungan bulan ini {margin:.0f}% dari total uang masuk."})
    day_names = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"]
    day_totals = {}
    for r in rows:
        if r["type"] != "income":
            continue
        wd = date.fromisoformat(r["date"]).weekday()
        day_totals[wd] = day_totals.get(wd, 0) + r["amount"]
    if day_totals:
        best = max(day_totals, key=day_totals.get)
        insights.append({"tone": "neutral", "title": "Hari paling ramai",
                         "text": f"Hari {day_names[best]} menghasilkan penjualan tertinggi bulan ini ({exports.rupiah(day_totals[best])})."})
    if expense > income and income:
        insights.append({"tone": "warning", "title": "Perhatian",
                         "text": "Pengeluaran bulan ini lebih besar dari pemasukan. Coba tinjau kembali pengeluaran terbesar Anda."})
    pending = await db.transactions.count_documents({"business_id": bid, "status": "pending", "is_deleted": False})
    if pending:
        insights.append({"tone": "neutral", "title": "Menunggu tinjauan",
                         "text": f"Ada {pending} transaksi yang masih menunggu tinjauan pembukuan dan belum masuk laporan resmi."})
    if not insights:
        insights.append({"tone": "neutral", "title": "Belum ada data",
                         "text": "Catat transaksi Anda terlebih dahulu untuk melihat analisis usaha."})
    return {"insights": insights, "period": {"start": cs, "end": ce}}


# ---------------- export ----------------
@api.get("/export/{kind}")
async def export_report(kind: str, format: str = "csv", business_id: Optional[str] = None,
                        start_date: Optional[str] = None, end_date: Optional[str] = None,
                        user: dict = Depends(get_current_user)):
    if kind not in ("transactions", "pnl", "cashflow", "income", "expense"):
        raise HTTPException(status_code=400, detail="Jenis ekspor tidak valid")
    bid = business_id or user.get("business_id")
    assert_business_access(user, bid)
    ms, me = month_bounds()
    start, end = start_date or ms, end_date or me
    report = await build_report(bid, start, end)
    period = f"{start} s/d {end}"
    name = report["business_name"]
    if kind == "transactions":
        rows = await db.transactions.find({"business_id": bid, "is_deleted": False,
                                           "date": {"$gte": start, "$lte": end}}).sort("date", -1).to_list(5000)
        if format == "pdf":
            content = exports.build_pdf(name, period, report, "transactions", rows)
            media, ext = "application/pdf", "pdf"
        else:
            content = exports.transactions_csv(rows)
            media, ext = "text/csv", "csv"
    else:
        if format == "pdf":
            content = exports.build_pdf(name, period, report, kind)
            media, ext = "application/pdf", "pdf"
        else:
            content = exports.report_csv(name, period, report, kind)
            media, ext = "text/csv", "csv"
    filename = f"{kind}-{name.replace(' ', '_')}-{start}.{ext}"
    return StreamingResponse(iter([content]), media_type=media,
                             headers={"Content-Disposition": f'attachment; filename="{filename}"'})


@api.get("/businesses/{business_id}/export")
async def export_business_excel(business_id: str, start_date: Optional[str] = None,
                                end_date: Optional[str] = None, user: dict = Depends(get_current_user)):
    assert_business_access(user, business_id)
    b = await db.businesses.find_one({"_id": business_id, "is_deleted": False})
    if not b:
        raise HTTPException(status_code=404, detail="Usaha tidak ditemukan")
    ms, me = month_bounds()
    start, end = start_date or ms, end_date or me
    report = await build_report(business_id, start, end)
    today = datetime.now(timezone.utc).date()
    monthly = []
    for k in range(5, -1, -1):
        first = shift_month(today.replace(day=1), -k)
        last = first.replace(day=monthrange(first.year, first.month)[1])
        i, e, _ = await approved_totals(business_id, first.isoformat(), last.isoformat())
        monthly.append({"month": first.strftime("%b %Y"), "income": i, "expense": e, "profit": i - e})
    rows = await db.transactions.find(
        {"business_id": business_id, "is_deleted": False, "status": "approved",
         "date": {"$gte": start, "$lte": end}}
    ).sort("date", 1).to_list(5000)
    content = await run_in_threadpool(
        excel_export.build_business_excel, clean_business(b), report, monthly, rows, f"{start} s/d {end}")
    fname = f"Laporan-{b['name'].replace(' ', '_')}-{start}.xlsx"
    return StreamingResponse(
        iter([content]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'})


# ---------------- audit + notifications ----------------
@api.get("/audit-logs")
async def audit_logs(business_id: Optional[str] = None, limit: int = 100, user: dict = Depends(get_current_user)):
    q = {}
    if user.get("role") == "admin":
        if business_id:
            q["business_id"] = business_id
    else:
        bid = business_id or user.get("business_id")
        assert_business_access(user, bid)
        q["business_id"] = bid
    rows = await db.audit_logs.find(q).sort("created_at", -1).limit(min(limit, 500)).to_list(500)
    names = {b["_id"]: b["name"] for b in await db.businesses.find({}, {"name": 1}).to_list(1000)}
    return [{**clean(r), "business_name": names.get(r.get("business_id"))} for r in rows]


@api.get("/notifications")
async def list_notifications(user: dict = Depends(get_current_user)):
    if user.get("role") == "admin":
        q = {"target_role": "admin"}
    else:
        q = {"target_role": "msme", "business_id": user.get("business_id")}
    rows = await db.notifications.find(q).sort("created_at", -1).limit(30).to_list(30)
    names = {b["_id"]: b["name"] for b in await db.businesses.find({}, {"name": 1}).to_list(1000)}
    unread = await db.notifications.count_documents({**q, "is_read": False})
    return {"items": [{**clean(r), "business_name": names.get(r.get("business_id"))} for r in rows], "unread": unread}


@api.post("/notifications/read-all")
async def read_all(user: dict = Depends(get_current_user)):
    q = {"target_role": "admin"} if user.get("role") == "admin" else {"target_role": "msme", "business_id": user.get("business_id")}
    await db.notifications.update_many(q, {"$set": {"is_read": True}})
    return {"ok": True}


@api.put("/profile")
async def update_profile(body: ProfileInput, user: dict = Depends(get_current_user)):
    data = {k: v for k, v in body.model_dump().items() if v is not None}
    if data:
        await db.users.update_one({"_id": user["_id"]}, {"$set": data})
    fresh = await db.users.find_one({"_id": user["_id"]})
    return public_user(fresh)


@api.get("/")
async def root():
    return {"message": "KasUMKM API siap"}


EXCEL_DIR = ROOT_DIR.parent / "excel_templates"
EXCEL_FILES = {
    "template": ("Pembukuan-Template.xlsx", "Template Pembukuan Kosong (untuk UMKM)"),
    "contoh": ("Pembukuan-TokoMaju-Contoh.xlsx", "Contoh Pembukuan Terisi (Toko Maju)"),
    "admin": ("Rekap-Admin.xlsx", "Rekap Admin (Dashboard Gabungan)"),
    "panduan": ("Panduan-Pemakaian.md", "Panduan Pemakaian"),
}


@api.get("/excel/list", response_class=HTMLResponse)
async def excel_list():
    rows = ""
    for key, (fname, label) in EXCEL_FILES.items():
        rows += (
            f'<li style="margin:14px 0;"><a href="/api/excel/download/{key}" '
            f'style="color:#0b6b3a;font-weight:600;text-decoration:none;">⬇ {label}</a> '
            f'<span style="color:#888;font-size:13px;">({fname})</span></li>'
        )
    html = f"""<!doctype html><html lang="id"><head><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Download Template Excel KasUMKM</title></head>
    <body style="font-family:system-ui,Segoe UI,Roboto,sans-serif;max-width:640px;margin:40px auto;padding:0 20px;">
    <h1 style="color:#0b6b3a;">📊 Template Excel KasUMKM</h1>
    <p style="color:#444;">Klik untuk mengunduh file di HP atau laptop Anda. File bisa dibuka di Google Sheets atau Excel Mobile (tanpa macro).</p>
    <ul style="list-style:none;padding:0;font-size:17px;">{rows}</ul>
    </body></html>"""
    return HTMLResponse(html)


@api.get("/excel/download/{key}")
async def excel_download(key: str):
    if key not in EXCEL_FILES:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    fname = EXCEL_FILES[key][0]
    path = EXCEL_DIR / fname
    if not path.exists():
        raise HTTPException(status_code=404, detail="File belum tersedia")
    return FileResponse(path, filename=fname)


app.include_router(auth_router)
app.include_router(api)

_cors_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
# Aplikasi berjalan tanpa login (tanpa cookie/kredensial). Dengan allow_origins="*",
# allow_credentials HARUS False agar browser menerima respons untuk permintaan tulis (POST/DELETE).
_allow_credentials = "*" not in _cors_origins
app.add_middleware(
    CORSMiddleware,
    allow_credentials=_allow_credentials,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.transactions.create_index([("business_id", 1), ("date", -1)])
    await db.transactions.create_index([("status", 1)])
    await db.categories.create_index([("business_id", 1)])
    await db.audit_logs.create_index([("business_id", 1), ("created_at", -1)])
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)
    await seed_admin()
    await db.transactions.update_many(
        {"status": {"$ne": "approved"}, "is_deleted": False}, {"$set": {"status": "approved"}})
    if os.environ.get("SEED_DEMO") == "true":
        try:
            await seed_demo()
        except Exception as e:
            logger.error(f"Seed demo gagal: {e}")
    try:
        init_storage()
        logger.info("Object storage siap")
    except Exception as e:
        logger.error(f"Storage init gagal: {e}")


@app.on_event("shutdown")
async def on_shutdown():
    client.close()
