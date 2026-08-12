"""KasUMKM backend integration tests - covers auth, isolation, transactions, reports, exports."""
import os
import io
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://keuangan-mudah-2.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN = {"email": "admin@kasumkm.id", "password": "admin123"}
MSME1 = {"email": "toko.maju@demo.id", "password": "demo123"}
MSME2 = {"email": "kedai.nusantara@demo.id", "password": "demo123"}


def _login(email, password):
    r = requests.post(f"{API}/auth/login", json={"email": email, "password": password}, timeout=30)
    assert r.status_code == 200, f"login failed for {email}: {r.status_code} {r.text}"
    return r.json()["access_token"]


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


@pytest.fixture(scope="session")
def admin_tok():
    return _login(**ADMIN)


@pytest.fixture(scope="session")
def msme1_tok():
    return _login(**MSME1)


@pytest.fixture(scope="session")
def msme2_tok():
    return _login(**MSME2)


@pytest.fixture(scope="session")
def msme1_biz(msme1_tok):
    r = requests.get(f"{API}/auth/me", headers=_h(msme1_tok), timeout=15)
    assert r.status_code == 200
    return r.json()["business"]["id"]


@pytest.fixture(scope="session")
def msme2_biz(msme2_tok):
    r = requests.get(f"{API}/auth/me", headers=_h(msme2_tok), timeout=15)
    return r.json()["business"]["id"]


# ---------------- Auth ----------------
class TestAuth:
    def test_health(self):
        r = requests.get(f"{API}/", timeout=10)
        assert r.status_code == 200

    def test_admin_login(self, admin_tok):
        assert admin_tok
        r = requests.get(f"{API}/auth/me", headers=_h(admin_tok), timeout=15)
        assert r.status_code == 200
        assert r.json()["user"]["role"] == "admin"

    def test_msme_login(self, msme1_tok):
        r = requests.get(f"{API}/auth/me", headers=_h(msme1_tok), timeout=15)
        assert r.status_code == 200
        j = r.json()
        assert j["user"]["role"] == "msme"
        assert j["business"]["id"]

    def test_invalid_login(self):
        r = requests.post(f"{API}/auth/login", json={"email": "toko.maju@demo.id", "password": "wrong"}, timeout=15)
        assert r.status_code in (401, 429)

    def test_no_token_401(self):
        r = requests.get(f"{API}/transactions", timeout=15)
        assert r.status_code == 401

    def test_forgot_reset_password(self):
        email = f"TEST_reset_{uuid.uuid4().hex[:6]}@example.com"
        # register user
        reg = requests.post(f"{API}/auth/register", json={
            "name": "Reset User", "email": email, "password": "oldpass123",
            "business_name": "TEST_ResetBiz", "business_type": "Lainnya", "phone": ""
        }, timeout=20)
        assert reg.status_code == 200
        # forgot
        f = requests.post(f"{API}/auth/forgot-password", json={"email": email}, timeout=15)
        assert f.status_code == 200
        tok = f.json().get("dev_token")
        assert tok
        # reset
        rs = requests.post(f"{API}/auth/reset-password", json={"token": tok, "password": "newpass123"}, timeout=15)
        assert rs.status_code == 200
        # login with new
        l = requests.post(f"{API}/auth/login", json={"email": email, "password": "newpass123"}, timeout=15)
        assert l.status_code == 200
        # change password
        new_tok = l.json()["access_token"]
        cp = requests.post(f"{API}/auth/change-password", headers=_h(new_tok),
                           json={"current_password": "newpass123", "new_password": "final123"}, timeout=15)
        assert cp.status_code == 200


# ---------------- Multi-tenant isolation (CRITICAL) ----------------
class TestIsolation:
    def test_msme_cannot_read_other_business(self, msme1_tok, msme2_biz):
        assert requests.get(f"{API}/transactions?business_id={msme2_biz}", headers=_h(msme1_tok)).status_code == 403
        assert requests.get(f"{API}/dashboard/business?business_id={msme2_biz}", headers=_h(msme1_tok)).status_code == 403
        assert requests.get(f"{API}/reports?business_id={msme2_biz}", headers=_h(msme1_tok)).status_code == 403
        assert requests.get(f"{API}/insights?business_id={msme2_biz}", headers=_h(msme1_tok)).status_code == 403
        assert requests.get(f"{API}/businesses/{msme2_biz}", headers=_h(msme1_tok)).status_code == 403
        assert requests.get(f"{API}/categories?business_id={msme2_biz}", headers=_h(msme1_tok)).status_code == 403

    def test_msme_forbidden_admin_endpoints(self, msme1_tok):
        assert requests.get(f"{API}/businesses", headers=_h(msme1_tok)).status_code == 403
        assert requests.get(f"{API}/dashboard/admin", headers=_h(msme1_tok)).status_code == 403
        # review requires admin
        r = requests.post(f"{API}/transactions/nonexistent/review", headers=_h(msme1_tok),
                          json={"status": "approved"})
        assert r.status_code == 403


# ---------------- Dashboards ----------------
class TestDashboards:
    def test_admin_dashboard(self, admin_tok):
        r = requests.get(f"{API}/dashboard/admin", headers=_h(admin_tok), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert j["total_businesses"] >= 5
        for k in ("total_income", "total_expense", "net_profit", "pending_count", "needs_correction_count"):
            assert k in j

    def test_admin_list_businesses(self, admin_tok):
        r = requests.get(f"{API}/businesses", headers=_h(admin_tok), timeout=20)
        assert r.status_code == 200
        assert len(r.json()) >= 5

    def test_msme_dashboard(self, msme1_tok):
        r = requests.get(f"{API}/dashboard/business", headers=_h(msme1_tok), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert "balance" in j and "monthly" in j and len(j["monthly"]) == 6
        assert "recent" in j


# ---------------- Transactions + Review + Pending isolation from reports ----------------
class TestTransactionFlow:
    def test_validation(self, msme1_tok):
        # amount 0
        r = requests.post(f"{API}/transactions", headers=_h(msme1_tok), json={
            "date": "2026-01-15", "type": "income", "category": "Penjualan", "amount": 0
        })
        assert r.status_code == 400
        # missing category
        r = requests.post(f"{API}/transactions", headers=_h(msme1_tok), json={
            "date": "2026-01-15", "type": "income", "category": "", "amount": 100
        })
        assert r.status_code == 400

    def test_pending_excluded_then_approved_included(self, msme1_tok, admin_tok):
        # baseline report
        today = time.strftime("%Y-%m-%d")
        start = today[:8] + "01"
        r0 = requests.get(f"{API}/reports?start_date={start}&end_date={today}", headers=_h(msme1_tok), timeout=20)
        assert r0.status_code == 200
        base_income = r0.json()["total_income"]

        # create pending tx
        AMOUNT = 123456.0
        c = requests.post(f"{API}/transactions", headers=_h(msme1_tok), json={
            "date": today, "type": "income", "category": "Penjualan", "amount": AMOUNT,
            "description": "TEST_pending", "payment_method": "Tunai"
        }, timeout=15)
        assert c.status_code == 200
        tx = c.json()
        assert tx["status"] == "pending"
        tx_id = tx["id"]

        # report unchanged (pending excluded)
        r1 = requests.get(f"{API}/reports?start_date={start}&end_date={today}", headers=_h(msme1_tok), timeout=20)
        assert abs(r1.json()["total_income"] - base_income) < 0.01, "pending tx must not affect reports"

        # admin approves
        a = requests.post(f"{API}/transactions/{tx_id}/review", headers=_h(admin_tok),
                          json={"status": "approved"}, timeout=15)
        assert a.status_code == 200
        assert a.json()["status"] == "approved"

        # report now includes
        r2 = requests.get(f"{API}/reports?start_date={start}&end_date={today}", headers=_h(msme1_tok), timeout=20)
        assert abs(r2.json()["total_income"] - base_income - AMOUNT) < 0.01

        # cleanup: admin delete
        requests.delete(f"{API}/transactions/{tx_id}", headers=_h(admin_tok))

    def test_admin_edit_and_needs_correction(self, msme1_tok, admin_tok, msme1_biz):
        today = time.strftime("%Y-%m-%d")
        c = requests.post(f"{API}/transactions", headers=_h(msme1_tok), json={
            "date": today, "type": "expense", "category": "Listrik", "amount": 50000,
            "description": "TEST_edit", "payment_method": "Tunai"
        }, timeout=15)
        tid = c.json()["id"]
        # admin marks needs_correction
        r = requests.post(f"{API}/transactions/{tid}/review", headers=_h(admin_tok),
                          json={"status": "needs_correction", "note": "Mohon periksa"}, timeout=15)
        assert r.status_code == 200 and r.json()["status"] == "needs_correction"
        assert r.json()["review_note"] == "Mohon periksa"
        # admin edits category -> triggers category_changed audit
        u = requests.put(f"{API}/transactions/{tid}", headers=_h(admin_tok), json={
            "date": today, "type": "expense", "category": "Internet", "amount": 60000,
            "description": "TEST_edit", "payment_method": "Tunai"
        }, timeout=15)
        assert u.status_code == 200 and u.json()["category"] == "Internet"
        # audit log has category_changed
        al = requests.get(f"{API}/audit-logs?business_id={msme1_biz}", headers=_h(admin_tok), timeout=15)
        assert al.status_code == 200
        actions = [x["action"] for x in al.json()]
        assert "category_changed" in actions
        # cleanup
        requests.delete(f"{API}/transactions/{tid}", headers=_h(admin_tok))

    def test_filters_and_sort(self, msme1_tok):
        r = requests.get(f"{API}/transactions?type=income&sort=oldest&limit=5", headers=_h(msme1_tok), timeout=15)
        assert r.status_code == 200
        rows = r.json()
        for x in rows:
            assert x["type"] == "income"

    def test_soft_delete(self, msme1_tok):
        today = time.strftime("%Y-%m-%d")
        c = requests.post(f"{API}/transactions", headers=_h(msme1_tok), json={
            "date": today, "type": "expense", "category": "Listrik", "amount": 1000,
            "description": "TEST_del", "payment_method": "Tunai"
        }, timeout=15)
        tid = c.json()["id"]
        d = requests.delete(f"{API}/transactions/{tid}", headers=_h(msme1_tok), timeout=15)
        assert d.status_code == 200
        # not in list
        lst = requests.get(f"{API}/transactions?search=TEST_del", headers=_h(msme1_tok), timeout=15).json()
        assert not any(x["id"] == tid for x in lst)


# ---------------- Receipts ----------------
class TestReceipts:
    def test_upload_and_download(self, msme1_tok, msme2_tok):
        png = (b"\x89PNG\r\n\x1a\n" + b"\x00" * 100)
        files = {"file": ("test.png", io.BytesIO(png), "image/png")}
        u = requests.post(f"{API}/receipts", headers=_h(msme1_tok), files=files, timeout=20)
        assert u.status_code == 200, u.text
        rid = u.json()["id"]
        # owner can fetch
        g = requests.get(f"{API}/receipts/{rid}", headers=_h(msme1_tok), timeout=20)
        assert g.status_code == 200
        # via query param token
        g2 = requests.get(f"{API}/receipts/{rid}?auth_token={msme1_tok}", timeout=20)
        assert g2.status_code == 200
        # other MSME forbidden
        g3 = requests.get(f"{API}/receipts/{rid}", headers=_h(msme2_tok), timeout=20)
        assert g3.status_code == 403


# ---------------- Reports / Insights / Exports ----------------
class TestReports:
    def test_reports_math(self, msme1_tok):
        r = requests.get(f"{API}/reports", headers=_h(msme1_tok), timeout=20)
        assert r.status_code == 200
        j = r.json()
        assert abs(j["net_profit"] - (j["total_income"] - j["total_expense"])) < 0.01
        assert abs(j["closing_balance"] - (j["opening_balance"] + j["total_income"] - j["total_expense"])) < 0.01
        if j["total_income"]:
            expected_margin = j["net_profit"] / j["total_income"] * 100
            assert abs(j["profit_margin"] - expected_margin) < 0.01

    def test_insights(self, msme1_tok):
        r = requests.get(f"{API}/insights", headers=_h(msme1_tok), timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json()["insights"], list)

    @pytest.mark.parametrize("kind", ["transactions", "pnl", "cashflow", "income", "expense"])
    @pytest.mark.parametrize("fmt", ["csv", "pdf"])
    def test_exports(self, msme1_tok, kind, fmt):
        r = requests.get(f"{API}/export/{kind}?format={fmt}", headers=_h(msme1_tok), timeout=30)
        assert r.status_code == 200, f"{kind}/{fmt} failed: {r.status_code}"
        assert len(r.content) > 50, f"{kind}/{fmt} empty"


# ---------------- Admin creates UMKM + categories ----------------
class TestAdminUmkm:
    def test_create_business_and_login(self, admin_tok):
        email = f"TEST_new_{uuid.uuid4().hex[:6]}@demo.id"
        payload = {
            "name": "TEST_UMKM_New", "owner_name": "Test Owner", "business_type": "Lainnya",
            "phone": "", "email": "", "address": "", "opening_balance": 1000,
            "user_email": email, "user_password": "newpass123"
        }
        c = requests.post(f"{API}/businesses", headers=_h(admin_tok), json=payload, timeout=20)
        assert c.status_code == 200, c.text
        bid = c.json()["id"]
        # login as new owner
        newtok = _login(email, "newpass123")
        me = requests.get(f"{API}/auth/me", headers=_h(newtok)).json()
        assert me["business"]["id"] == bid
        # default categories exist
        cats = requests.get(f"{API}/categories", headers=_h(newtok), timeout=15).json()
        assert len(cats) >= 10
        # dashboard empty
        d = requests.get(f"{API}/dashboard/business", headers=_h(newtok)).json()
        assert d["month_income"] == 0 and d["month_expense"] == 0

    def test_category_crud(self, msme1_tok):
        name = f"TEST_Cat_{uuid.uuid4().hex[:4]}"
        c = requests.post(f"{API}/categories", headers=_h(msme1_tok),
                          json={"name": name, "type": "expense"}, timeout=15)
        assert c.status_code == 200
        cid = c.json()["id"]
        d = requests.delete(f"{API}/categories/{cid}", headers=_h(msme1_tok), timeout=15)
        assert d.status_code == 200
