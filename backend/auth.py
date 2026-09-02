import os
import uuid
import secrets
import logging
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import APIRouter, HTTPException, Request, Response, Depends
from pydantic import BaseModel, EmailStr, Field

from db import db

logger = logging.getLogger(__name__)
JWT_ALGORITHM = "HS256"
router = APIRouter(prefix="/api/auth", tags=["auth"])


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none", max_age=2592000, path="/")


def public_user(user: dict) -> dict:
    return {
        "id": user["_id"],
        "email": user["email"],
        "name": user.get("name"),
        "role": user.get("role"),
        "business_id": user.get("business_id"),
        "phone": user.get("phone"),
        "can_manage_categories": user.get("can_manage_categories", True),
        "notify_email": user.get("notify_email", True),
        "notify_app": user.get("notify_app", True),
    }


async def get_current_user() -> dict:
    """Mode alat pribadi tanpa login: selalu bekerja sebagai satu akun pembukuan (admin)."""
    email = os.environ["ADMIN_EMAIL"].lower()
    user = await db.users.find_one({"email": email, "role": "admin"})
    if not user:
        await seed_admin()
        user = await db.users.find_one({"email": email, "role": "admin"})
    return user


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Hanya admin yang boleh mengakses")
    return user


def assert_business_access(user: dict, business_id: str):
    if user.get("role") == "admin":
        return
    if not business_id or user.get("business_id") != business_id:
        raise HTTPException(status_code=403, detail="Anda tidak punya akses ke data usaha ini")


class RegisterInput(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(min_length=6)
    business_name: str
    business_type: str = "Lainnya"
    phone: str = ""


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class ForgotInput(BaseModel):
    email: EmailStr


class ResetInput(BaseModel):
    token: str
    password: str = Field(min_length=6)


class ChangePasswordInput(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6)


DEFAULT_CATEGORIES = [
    ("income", "Belum Dikategorikan"),
    ("income", "Penjualan"),
    ("income", "Pendapatan Jasa"),
    ("income", "Pendapatan Lain"),
    ("income", "Suntikan Modal"),
    ("expense", "Belum Dikategorikan"),
    ("expense", "Stok / Bahan"),
    ("expense", "Gaji"),
    ("expense", "Sewa"),
    ("expense", "Listrik"),
    ("expense", "Internet"),
    ("expense", "Transportasi"),
    ("expense", "Pemasaran"),
    ("expense", "Perlengkapan"),
    ("expense", "Biaya Operasional"),
    ("expense", "Pengeluaran Lain"),
]

UNCATEGORIZED = "Belum Dikategorikan"


async def create_default_categories(business_id: str):
    now = datetime.now(timezone.utc).isoformat()
    docs = [
        {
            "_id": str(uuid.uuid4()),
            "business_id": business_id,
            "type": t,
            "name": n,
            "is_default": True,
            "is_deleted": False,
            "created_at": now,
        }
        for t, n in DEFAULT_CATEGORIES
    ]
    await db.categories.insert_many(docs)


async def create_business(name: str, owner_name: str, business_type: str, phone: str = "", email: str = "",
                          address: str = "", is_demo: bool = False) -> str:
    bid = str(uuid.uuid4())
    await db.businesses.insert_one({
        "_id": bid,
        "name": name,
        "owner_name": owner_name,
        "business_type": business_type,
        "phone": phone,
        "email": email,
        "address": address,
        "logo_url": None,
        "opening_balance": 0.0,
        "is_demo": is_demo,
        "is_deleted": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await create_default_categories(bid)
    return bid


@router.post("/register")
async def register(body: RegisterInput, response: Response):
    email = body.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    bid = await create_business(body.business_name, body.name, body.business_type, body.phone, email)
    uid = str(uuid.uuid4())
    await db.users.insert_one({
        "_id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": "msme",
        "business_id": bid,
        "phone": body.phone,
        "can_manage_categories": True,
        "notify_email": True,
        "notify_app": True,
        "is_demo": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    access = create_access_token(uid, email)
    set_auth_cookies(response, access, create_refresh_token(uid))
    user = await db.users.find_one({"_id": uid})
    return {"user": public_user(user), "access_token": access}


@router.post("/login")
async def login(body: LoginInput, request: Request, response: Response):
    email = body.email.lower().strip()
    ip = request.client.host if request.client else "unknown"
    identifier = f"{ip}:{email}"
    attempt = await db.login_attempts.find_one({"_id": identifier})
    now = datetime.now(timezone.utc)
    if attempt and attempt.get("count", 0) >= 5:
        locked_until = datetime.fromisoformat(attempt["locked_until"])
        if locked_until > now:
            raise HTTPException(status_code=429, detail="Terlalu banyak percobaan. Coba lagi dalam 15 menit.")
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        await db.login_attempts.update_one(
            {"_id": identifier},
            {"$inc": {"count": 1}, "$set": {"locked_until": (now + timedelta(minutes=15)).isoformat()}},
            upsert=True,
        )
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    await db.login_attempts.delete_one({"_id": identifier})
    access = create_access_token(user["_id"], email)
    set_auth_cookies(response, access, create_refresh_token(user["_id"]))
    return {"user": public_user(user), "access_token": access}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    business = None
    if user.get("business_id"):
        business = await db.businesses.find_one({"_id": user["business_id"]})
        if business:
            business["id"] = business.pop("_id")
    return {"user": public_user(user), "business": business}


@router.post("/forgot-password")
async def forgot_password(body: ForgotInput):
    email = body.email.lower().strip()
    user = await db.users.find_one({"email": email})
    token = secrets.token_urlsafe(32)
    if user:
        await db.password_reset_tokens.insert_one({
            "_id": token,
            "user_id": user["_id"],
            "used": False,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        })
        logger.info(f"[RESET PASSWORD] link untuk {email}: /reset-password?token={token}")
    return {"ok": True, "message": "Jika email terdaftar, tautan reset telah dikirim.", "dev_token": token if user else None}


@router.post("/reset-password")
async def reset_password(body: ResetInput):
    rec = await db.password_reset_tokens.find_one({"_id": body.token})
    if not rec or rec.get("used"):
        raise HTTPException(status_code=400, detail="Tautan reset tidak valid atau sudah dipakai")
    expires = rec["expires_at"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Tautan reset sudah kedaluwarsa")
    await db.users.update_one({"_id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    await db.password_reset_tokens.update_one({"_id": body.token}, {"$set": {"used": True}})
    return {"ok": True}


@router.post("/change-password")
async def change_password(body: ChangePasswordInput, user: dict = Depends(get_current_user)):
    if not verify_password(body.current_password, user["password_hash"]):
        raise HTTPException(status_code=400, detail="Kata sandi lama salah")
    await db.users.update_one({"_id": user["_id"]}, {"$set": {"password_hash": hash_password(body.new_password)}})
    return {"ok": True}


async def seed_admin():
    email = os.environ["ADMIN_EMAIL"].lower()
    password = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": email})
    if not existing:
        await db.users.insert_one({
            "_id": str(uuid.uuid4()),
            "email": email,
            "password_hash": hash_password(password),
            "name": "Admin Pembukuan",
            "role": "admin",
            "business_id": None,
            "phone": "",
            "notify_email": True,
            "notify_app": True,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    elif not verify_password(password, existing["password_hash"]):
        await db.users.update_one({"_id": existing["_id"]}, {"$set": {"password_hash": hash_password(password)}})
