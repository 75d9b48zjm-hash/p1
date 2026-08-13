"""Backend tests for NEW features (iteration 3):
- Mode Cepat: POST /transactions with empty category -> defaults to 'Belum Dikategorikan', status=pending
- GET /categories/suggest: rule-based suggestion from user's own history
- POST /transactions/{id}/review with category -> updates status AND category, audit log
- Regression: full-mode create with category still works
- Multi-tenant isolation on suggest
"""
import os, time
import pytest, requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@kasumkm.id", "password": "admin123"}
MSME1 = {"email": "toko.maju@demo.id", "password": "demo123"}
MSME2 = {"email": "kedai.nusantara@demo.id", "password": "demo123"}
UNCAT = "Belum Dikategorikan"


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login {email}: {r.text}"
    j = r.json()
    return j["access_token"], j["user"]


def _h(t): return {"Authorization": f"Bearer {t}"}


@pytest.fixture(scope="module")
def ctx():
    a_tok, a_user = _login(**ADMIN)
    m1_tok, m1_user = _login(**MSME1)
    m2_tok, m2_user = _login(**MSME2)
    return {
        "admin": a_tok, "msme1": m1_tok, "msme2": m2_tok,
        "bid1": m1_user["business_id"], "bid2": m2_user["business_id"],
    }


class TestQuickMode:
    def test_create_transaction_empty_category_defaults(self, ctx):
        today = time.strftime("%Y-%m-%d")
        r = requests.post(f"{API}/transactions", headers=_h(ctx["msme1"]), json={
            "date": today, "type": "expense", "category": "", "amount": 15000,
            "description": "TEST_qm beli bensin motor pertamax", "payment_method": "Tunai"
        }, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["category"] == UNCAT
        assert j["status"] == "pending"
        # persistence check
        g = requests.get(f"{API}/transactions/{j['id']}"if False else f"{API}/transactions",
                         headers=_h(ctx["msme1"]), params={"status": "pending", "search": "TEST_qm beli bensin"}, timeout=15)
        assert g.status_code == 200
        assert any(t["id"] == j["id"] and t["category"] == UNCAT for t in g.json())

    def test_full_mode_create_still_works(self, ctx):
        # Ensure at least one Transportasi expense exists for suggest history
        today = time.strftime("%Y-%m-%d")
        r = requests.post(f"{API}/transactions", headers=_h(ctx["msme1"]), json={
            "date": today, "type": "expense", "category": "Transportasi", "amount": 20000,
            "description": "TEST_full beli bensin motor untuk antar barang", "payment_method": "Tunai"
        }, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["category"] == "Transportasi"
        assert j["status"] == "pending"


class TestSuggest:
    def test_suggest_too_short_returns_null(self, ctx):
        r = requests.get(f"{API}/categories/suggest", headers=_h(ctx["msme1"]),
                         params={"text": "a", "type": "expense", "business_id": ctx["bid1"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["suggestion"] is None

    def test_suggest_matching_history(self, ctx):
        # Approve the Transportasi test transaction first so suggest sees history rich
        # Suggest reads all transactions (not only approved); create ensures history exists
        r = requests.get(f"{API}/categories/suggest", headers=_h(ctx["msme1"]),
                         params={"text": "beli bensin motor", "type": "expense", "business_id": ctx["bid1"]}, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        print("suggest:", j)
        assert j["suggestion"] == "Transportasi", f"expected Transportasi, got {j['suggestion']}"
        assert j["suggestion"] != UNCAT
        assert j["confidence"] > 0

    def test_suggest_no_match_null(self, ctx):
        r = requests.get(f"{API}/categories/suggest", headers=_h(ctx["msme1"]),
                         params={"text": "xyzqqqzz nonexistent gibberish", "type": "expense",
                                 "business_id": ctx["bid1"]}, timeout=15)
        assert r.status_code == 200
        assert r.json()["suggestion"] is None

    def test_suggest_tenant_isolation(self, ctx):
        # msme2 cannot query bid1
        r = requests.get(f"{API}/categories/suggest", headers=_h(ctx["msme2"]),
                         params={"text": "bensin motor", "type": "expense", "business_id": ctx["bid1"]}, timeout=15)
        assert r.status_code == 403, f"expected 403, got {r.status_code}"


class TestReviewWithCategory:
    def test_review_approve_with_new_category(self, ctx):
        # Create an uncategorized pending tx as msme1
        today = time.strftime("%Y-%m-%d")
        c = requests.post(f"{API}/transactions", headers=_h(ctx["msme1"]), json={
            "date": today, "type": "expense", "category": "", "amount": 25000,
            "description": "TEST_rev beli bensin motor untuk reviewer", "payment_method": "Tunai"
        }, timeout=15)
        assert c.status_code == 200, c.text
        tid = c.json()["id"]
        assert c.json()["category"] == UNCAT

        # Admin approves with new category
        r = requests.post(f"{API}/transactions/{tid}/review", headers=_h(ctx["admin"]), json={
            "status": "approved", "category": "Transportasi"
        }, timeout=15)
        assert r.status_code == 200, r.text
        j = r.json()
        assert j["status"] == "approved"
        assert j["category"] == "Transportasi"

        # Audit log should include category_changed
        a = requests.get(f"{API}/audit-logs", headers=_h(ctx["admin"]),
                         params={"business_id": ctx["bid1"], "limit": 20}, timeout=15)
        assert a.status_code == 200
        logs = a.json()
        changed = [l for l in logs if l.get("action") == "category_changed" and l.get("record_id") == tid]
        assert len(changed) >= 1, f"no category_changed audit log for {tid}"

    def test_review_approve_without_category_keeps_original(self, ctx):
        today = time.strftime("%Y-%m-%d")
        c = requests.post(f"{API}/transactions", headers=_h(ctx["msme1"]), json={
            "date": today, "type": "income", "category": "Penjualan", "amount": 5000,
            "description": "TEST_rev2 penjualan biasa", "payment_method": "Tunai"
        }, timeout=15)
        tid = c.json()["id"]
        r = requests.post(f"{API}/transactions/{tid}/review", headers=_h(ctx["admin"]), json={
            "status": "approved"
        }, timeout=15)
        assert r.status_code == 200
        assert r.json()["category"] == "Penjualan"
        assert r.json()["status"] == "approved"


class TestRegression:
    def test_msme_cannot_access_other_business_transactions(self, ctx):
        r = requests.get(f"{API}/transactions", headers=_h(ctx["msme2"]),
                         params={"business_id": ctx["bid1"]}, timeout=15)
        # Either 403, or filtered to only msme2 (never returns msme1 data)
        if r.status_code == 200:
            for t in r.json():
                assert t["business_id"] == ctx["bid2"], "cross-tenant leak!"
        else:
            assert r.status_code == 403
