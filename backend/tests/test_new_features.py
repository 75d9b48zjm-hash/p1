"""Tests for new features: Foto Nota Pintar (OCR) + Ingatkan Otomatis (inactivity reminders)."""
import os
import io
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://keuangan-mudah-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@kasumkm.id", "password": "admin123"}
MSME1 = {"email": "toko.maju@demo.id", "password": "demo123"}
MSME2 = {"email": "kedai.nusantara@demo.id", "password": "demo123"}

RECEIPT_PATH = "/tmp/nota_test.png"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed {email}: {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="module")
def toks():
    return {
        "admin": _login(**ADMIN),
        "msme1": _login(**MSME1),
        "msme2": _login(**MSME2),
    }


# ---------------- OCR / Foto Nota Pintar ----------------
class TestOCR:
    def test_extract_amount_and_date_from_png(self, toks):
        assert os.path.exists(RECEIPT_PATH), f"test image missing: {RECEIPT_PATH}"
        with open(RECEIPT_PATH, "rb") as f:
            files = {"file": ("nota_test.png", f, "image/png")}
            u = requests.post(f"{API}/receipts", headers=_h(toks["msme1"]), files=files, timeout=30)
        assert u.status_code == 200, u.text
        rid = u.json()["id"]

        # extract
        r = requests.post(f"{API}/receipts/{rid}/extract", headers=_h(toks["msme1"]), timeout=60)
        assert r.status_code == 200, r.text
        j = r.json()
        print(f"OCR extract result: {j}")
        assert j["found"] is True
        assert j["amount"] == 144855.0, f"expected 144855.0, got {j['amount']}"
        assert j["date"] == "2026-01-15", f"expected 2026-01-15, got {j['date']}"

    def test_extract_pdf_rejected(self, toks):
        pdf_bytes = b"%PDF-1.4\n%fake pdf\n"
        files = {"file": ("test.pdf", io.BytesIO(pdf_bytes), "application/pdf")}
        u = requests.post(f"{API}/receipts", headers=_h(toks["msme1"]), files=files, timeout=20)
        assert u.status_code == 200, u.text
        rid = u.json()["id"]
        r = requests.post(f"{API}/receipts/{rid}/extract", headers=_h(toks["msme1"]), timeout=20)
        assert r.status_code == 400
        assert "JPG" in r.json().get("detail", "") or "PDF" in r.json().get("detail", "").upper() or "foto" in r.json().get("detail", "").lower()

    def test_extract_tenant_isolation(self, toks):
        # msme1 uploads
        with open(RECEIPT_PATH, "rb") as f:
            files = {"file": ("iso.png", f, "image/png")}
            u = requests.post(f"{API}/receipts", headers=_h(toks["msme1"]), files=files, timeout=30)
        assert u.status_code == 200
        rid = u.json()["id"]
        # msme2 tries to extract
        r = requests.post(f"{API}/receipts/{rid}/extract", headers=_h(toks["msme2"]), timeout=20)
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"


# ---------------- Reminders / Ingatkan Otomatis ----------------
class TestReminders:
    def test_active_business_no_reminder(self, toks):
        # ensure msme1 has recent tx
        today = time.strftime("%Y-%m-%d")
        requests.post(f"{API}/transactions", headers=_h(toks["msme1"]), json={
            "date": today, "type": "income", "category": "Penjualan", "amount": 1000,
            "description": "TEST_recent", "payment_method": "Tunai"
        }, timeout=15)
        r = requests.get(f"{API}/reminders/status", headers=_h(toks["msme1"]), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        print(f"msme1 reminder: {j}")
        assert j["remind"] is False
        assert j["inactive_days"] < 3

    def test_inactive_business_reminder_and_idempotent(self, toks):
        r = requests.get(f"{API}/reminders/status", headers=_h(toks["msme2"]), timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        print(f"msme2 reminder: {j}")
        assert j["remind"] is True
        assert j["inactive_days"] >= 3

        # Fetch notifications
        n1 = requests.get(f"{API}/notifications", headers=_h(toks["msme2"]), timeout=15)
        assert n1.status_code == 200
        notifs1 = n1.json().get("items", [])
        inactivity1 = [x for x in notifs1 if x.get("kind") == "inactivity_reminder"]
        assert len(inactivity1) >= 1, "expected at least one inactivity_reminder notification"

        # Idempotent: call again -> count unchanged
        r2 = requests.get(f"{API}/reminders/status", headers=_h(toks["msme2"]), timeout=15)
        assert r2.status_code == 200
        n2 = requests.get(f"{API}/notifications", headers=_h(toks["msme2"]), timeout=15).json().get("items", [])
        inactivity2 = [x for x in n2 if x.get("kind") == "inactivity_reminder"]
        # Filter by today
        today = time.strftime("%Y-%m-%d")
        today_inact1 = [x for x in inactivity1 if x.get("created_at", "").startswith(today)]
        today_inact2 = [x for x in inactivity2 if x.get("created_at", "").startswith(today)]
        assert len(today_inact2) == len(today_inact1), \
            f"duplicate reminder created: before={len(today_inact1)} after={len(today_inact2)}"
        assert len(today_inact2) == 1, f"expected exactly 1 today, got {len(today_inact2)}"
