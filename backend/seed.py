import os
import uuid
import random
from datetime import datetime, timezone, timedelta

from db import db
from auth import hash_password, create_business

DEMO_BUSINESSES = [
    ("Toko Maju", "Budi Santoso", "Retail", "toko.maju@demo.id", "081234567801", "Jl. Merdeka No. 12, Bandung"),
    ("Kedai Nusantara", "Siti Rahayu", "Makanan & Minuman", "kedai.nusantara@demo.id", "081234567802", "Jl. Diponegoro 45, Yogyakarta"),
    ("Laundry Bersih", "Agus Wijaya", "Jasa", "laundry.bersih@demo.id", "081234567803", "Jl. Kaliurang 8, Semarang"),
    ("Sinar Jaya Online", "Dewi Lestari", "Toko Online", "sinar.jaya@demo.id", "081234567804", "Jl. Sudirman 90, Jakarta"),
    ("Kreatif Digital", "Rizky Pratama", "Freelance", "kreatif.digital@demo.id", "081234567805", "Jl. Gatot Subroto 3, Surabaya"),
]

INCOME_DESCS = ["Penjualan harian", "Pesanan pelanggan", "Penjualan online", "Jasa tambahan", "Penjualan grosir"]
EXPENSE_DESCS = ["Belanja stok", "Bayar listrik", "Bayar gaji karyawan", "Iklan media sosial", "Ongkos kirim", "Beli perlengkapan"]
PAYMENTS = ["Tunai", "Transfer Bank", "QRIS", "E-wallet", "Lainnya"]


async def seed_demo():
    if await db.businesses.find_one({"is_demo": True}):
        return
    random.seed(7)
    now = datetime.now(timezone.utc)
    for name, owner, btype, email, phone, address in DEMO_BUSINESSES:
        bid = await create_business(name, owner, btype, phone, email, address, is_demo=True)
        await db.businesses.update_one({"_id": bid}, {"$set": {"opening_balance": random.choice([1000000, 2500000, 5000000])}})
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "_id": uid,
            "email": email,
            "password_hash": hash_password("demo123"),
            "name": owner,
            "role": "msme",
            "business_id": bid,
            "phone": phone,
            "can_manage_categories": True,
            "notify_email": True,
            "notify_app": True,
            "is_demo": True,
            "created_at": now.isoformat(),
        })
        cats = await db.categories.find({"business_id": bid}).to_list(100)
        inc = [c["name"] for c in cats if c["type"] == "income"]
        exp = [c["name"] for c in cats if c["type"] == "expense"]
        docs = []
        for days_ago in range(0, 120):
            day = now - timedelta(days=days_ago)
            for _ in range(random.randint(0, 2)):
                is_income = random.random() < 0.55
                status = "approved"
                if days_ago < 6 and random.random() < 0.5:
                    status = random.choice(["pending", "pending", "needs_correction"])
                amount = random.choice([50000, 75000, 120000, 250000, 400000, 750000, 1200000, 2000000])
                if not is_income:
                    amount = round(amount * 0.6 / 1000) * 1000
                docs.append({
                    "_id": str(uuid.uuid4()),
                    "business_id": bid,
                    "date": day.strftime("%Y-%m-%d"),
                    "type": "income" if is_income else "expense",
                    "category": random.choice(inc if is_income else exp),
                    "amount": float(amount),
                    "description": random.choice(INCOME_DESCS if is_income else EXPENSE_DESCS),
                    "payment_method": random.choice(PAYMENTS),
                    "receipt_id": None,
                    "status": status,
                    "review_note": "Mohon lampirkan bukti nota." if status == "needs_correction" else None,
                    "created_by": uid,
                    "created_by_name": owner,
                    "created_at": day.isoformat(),
                    "updated_at": day.isoformat(),
                    "reviewed_by": None,
                    "reviewed_by_name": None,
                    "reviewed_at": day.isoformat() if status == "approved" else None,
                    "is_deleted": False,
                    "is_demo": True,
                })
        if docs:
            await db.transactions.insert_many(docs)
