"""Penyimpanan berkas bukti (nota).

Provider dipilih otomatis dari environment:
  - cloudinary : jika CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET tersedia
  - mongo      : default (GridFS di MongoDB Atlas, tanpa layanan tambahan)
  - emergent   : hanya jika STORAGE_PROVIDER=emergent (khusus preview Emergent)
"""
import os
import io

import requests

APP_NAME = "kasumkm"

MIME_TYPES = {
    "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "pdf": "application/pdf",
}

STORAGE_BASE = (os.environ.get("INTEGRATION_PROXY_URL") or "").strip() or "https://integrations.emergentagent.com"
STORAGE_URL = STORAGE_BASE.rstrip("/") + "/objstore/api/v1/storage"
EMERGENT_KEY = os.environ.get("EMERGENT_LLM_KEY")

storage_key = None
_fs = None


def _has_cloudinary() -> bool:
    return all(os.environ.get(k) for k in
               ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"))


def provider() -> str:
    forced = (os.environ.get("STORAGE_PROVIDER") or "").strip().lower()
    if forced:
        return forced
    return "cloudinary" if _has_cloudinary() else "mongo"


# ---------------- cloudinary ----------------
def _cloudinary_config():
    import cloudinary
    import cloudinary.uploader  # noqa: F401
    cloudinary.config(
        cloud_name=os.environ["CLOUDINARY_CLOUD_NAME"],
        api_key=os.environ["CLOUDINARY_API_KEY"],
        api_secret=os.environ["CLOUDINARY_API_SECRET"],
        secure=True,
    )
    return cloudinary


def _cloudinary_put(path: str, data: bytes, content_type: str) -> dict:
    cloudinary = _cloudinary_config()
    public_id = path.rsplit(".", 1)[0]
    resource_type = "image" if content_type.startswith("image/") else "raw"
    res = cloudinary.uploader.upload(
        io.BytesIO(data), public_id=public_id, resource_type=resource_type,
        folder=None, overwrite=True, type="upload",
    )
    return {"path": res["secure_url"], "size": res.get("bytes", len(data))}


# ---------------- mongo gridfs ----------------
def _gridfs():
    global _fs
    if _fs is None:
        import gridfs
        from pymongo import MongoClient
        cli = MongoClient(os.environ["MONGO_URL"])
        _fs = gridfs.GridFS(cli[os.environ["DB_NAME"]], collection="receipt_files")
    return _fs


def _mongo_put(path: str, data: bytes, content_type: str) -> dict:
    fs = _gridfs()
    for old in fs.find({"filename": path}):
        fs.delete(old._id)
    fs.put(data, filename=path, content_type=content_type)
    return {"path": path, "size": len(data)}


def _mongo_get(path: str):
    fs = _gridfs()
    f = fs.find_one({"filename": path})
    if not f:
        raise FileNotFoundError(path)
    return f.read(), (f.content_type or "application/octet-stream")


def _mongo_delete(path: str):
    fs = _gridfs()
    for f in fs.find({"filename": path}):
        fs.delete(f._id)


# ---------------- emergent proxy (preview saja) ----------------
def _emergent_init(force: bool = False):
    global storage_key
    if storage_key and not force:
        return storage_key
    resp = requests.post(f"{STORAGE_URL}/init", json={"emergent_key": EMERGENT_KEY}, timeout=30)
    resp.raise_for_status()
    storage_key = resp.json()["storage_key"]
    return storage_key


def _emergent_put(path: str, data: bytes, content_type: str) -> dict:
    key = _emergent_init()
    resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                        headers={"X-Storage-Key": key, "Content-Type": content_type},
                        data=data, timeout=120)
    if resp.status_code == 404:
        key = _emergent_init(force=True)
        resp = requests.put(f"{STORAGE_URL}/objects/{path}",
                            headers={"X-Storage-Key": key, "Content-Type": content_type},
                            data=data, timeout=120)
    resp.raise_for_status()
    return resp.json()


def _emergent_get(path: str):
    key = _emergent_init()
    resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    if resp.status_code == 404:
        key = _emergent_init(force=True)
        resp = requests.get(f"{STORAGE_URL}/objects/{path}", headers={"X-Storage-Key": key}, timeout=60)
    resp.raise_for_status()
    return resp.content, resp.headers.get("Content-Type", "application/octet-stream")


# ---------------- API publik ----------------
def init_storage(force: bool = False):
    p = provider()
    if p == "emergent":
        return _emergent_init(force=force)
    if p == "cloudinary":
        _cloudinary_config()
        return "cloudinary"
    _gridfs()
    return "mongo"


def put_object(path: str, data: bytes, content_type: str) -> dict:
    p = provider()
    if p == "cloudinary":
        return _cloudinary_put(path, data, content_type)
    if p == "emergent":
        return _emergent_put(path, data, content_type)
    return _mongo_put(path, data, content_type)


def get_object(path: str):
    if path.startswith("http://") or path.startswith("https://"):
        resp = requests.get(path, timeout=60)
        resp.raise_for_status()
        return resp.content, resp.headers.get("Content-Type", "application/octet-stream")
    p = provider()
    if p == "emergent":
        return _emergent_get(path)
    return _mongo_get(path)


def delete_object(path: str):
    if path.startswith("http"):
        if not _has_cloudinary():
            return
        cloudinary = _cloudinary_config()
        public_id = path.split("/upload/", 1)[-1].rsplit(".", 1)[0]
        resource_type = "image" if "/image/upload/" in path else "raw"
        cloudinary.uploader.destroy(public_id, resource_type=resource_type, invalidate=True)
        return
    if provider() == "mongo":
        _mongo_delete(path)
