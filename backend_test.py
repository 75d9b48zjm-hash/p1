#!/usr/bin/env python3
"""
Backend API Test untuk KasUMKM - Verifikasi CORS Fix
Test semua endpoint tanpa Authorization (mode alat pribadi tanpa login)
"""
import requests
import json
from datetime import datetime, date

# Base URL dari frontend/.env
BASE_URL = "https://1027c997-a912-494e-9ecb-29aa40dba44d.preview.emergentagent.com/api"

def print_test(name):
    print(f"\n{'='*60}")
    print(f"TEST: {name}")
    print('='*60)

def print_result(success, message, details=None):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    if details:
        print(f"Details: {json.dumps(details, indent=2, ensure_ascii=False)}")

def test_get_businesses():
    """Test 1: GET /api/businesses - List UMKM clients"""
    print_test("GET /api/businesses - List UMKM clients")
    
    try:
        response = requests.get(f"{BASE_URL}/businesses", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            print_result(True, f"Successfully retrieved {len(data)} businesses", 
                        {"count": len(data), "sample": data[0] if data else None})
            return True, data
        else:
            print_result(False, f"Failed with status {response.status_code}", 
                        {"error": response.text})
            return False, None
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False, None

def test_post_business():
    """Test 2: POST /api/businesses - Create new UMKM client"""
    print_test("POST /api/businesses - Create new UMKM client")
    
    business_data = {
        "name": "Warung Uji CORS",
        "owner_name": "Pak Uji",
        "business_type": "Makanan & Minuman",
        "phone": "081200000000",
        "address": "Jl. Testing No. 1",
        "opening_balance": 500000
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/businesses",
            json=business_data,
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code == 200:
            data = response.json()
            if "id" in data and isinstance(data["id"], str):
                print_result(True, f"Successfully created business with ID: {data['id']}", data)
                return True, data
            else:
                print_result(False, "Response missing 'id' field", data)
                return False, None
        else:
            print_result(False, f"Failed with status {response.status_code}", 
                        {"error": response.text})
            return False, None
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False, None

def test_verify_business_in_list(business_id):
    """Test 3: Verify new business appears in GET /api/businesses"""
    print_test(f"Verify business {business_id} appears in list")
    
    try:
        response = requests.get(f"{BASE_URL}/businesses", timeout=10)
        
        if response.status_code == 200:
            businesses = response.json()
            found = any(b.get("id") == business_id for b in businesses)
            
            if found:
                print_result(True, f"Business {business_id} found in list")
                return True
            else:
                print_result(False, f"Business {business_id} NOT found in list", 
                            {"total_businesses": len(businesses)})
                return False
        else:
            print_result(False, f"Failed to get businesses list: {response.status_code}")
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_post_transaction(business_id):
    """Test 4: POST /api/transactions - Create transaction for business"""
    print_test(f"POST /api/transactions - Create transaction for business {business_id}")
    
    today = date.today().isoformat()
    transaction_data = {
        "business_id": business_id,
        "type": "income",
        "amount": 100000,
        "description": "Penjualan uji",
        "date": today,
        "category": "Penjualan",
        "payment_method": "Tunai"
    }
    
    try:
        response = requests.post(
            f"{BASE_URL}/transactions",
            json=transaction_data,
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "approved":
                print_result(True, f"Transaction created with status 'approved'", data)
                return True, data
            else:
                print_result(False, f"Transaction status is '{data.get('status')}', expected 'approved'", data)
                return False, None
        else:
            print_result(False, f"Failed with status {response.status_code}", 
                        {"error": response.text})
            return False, None
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False, None

def test_dashboard_balance(business_id):
    """Test 5: GET /api/dashboard/business - Verify balance reflects transaction"""
    print_test(f"GET /api/dashboard/business?business_id={business_id}")
    
    try:
        response = requests.get(
            f"{BASE_URL}/dashboard/business",
            params={"business_id": business_id},
            timeout=10
        )
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            balance = data.get("balance", 0)
            month_income = data.get("month_income", 0)
            
            # Opening balance was 500000, we added 100000 income
            expected_balance = 600000
            
            if balance == expected_balance and month_income >= 100000:
                print_result(True, f"Balance correct: {balance}, Month income: {month_income}", data)
                return True
            else:
                print_result(False, f"Balance mismatch. Expected: {expected_balance}, Got: {balance}", 
                            {"balance": balance, "month_income": month_income})
                return False
        else:
            print_result(False, f"Failed with status {response.status_code}", 
                        {"error": response.text})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_delete_business(business_id):
    """Test 6: DELETE /api/businesses/{id} - Soft delete business"""
    print_test(f"DELETE /api/businesses/{business_id}")
    
    try:
        response = requests.delete(f"{BASE_URL}/businesses/{business_id}", timeout=10)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok") == True:
                print_result(True, f"Business {business_id} deleted successfully", data)
                
                # Verify it's no longer in the list
                list_response = requests.get(f"{BASE_URL}/businesses", timeout=10)
                if list_response.status_code == 200:
                    businesses = list_response.json()
                    still_exists = any(b.get("id") == business_id for b in businesses)
                    
                    if not still_exists:
                        print_result(True, f"Business {business_id} no longer appears in list")
                        return True
                    else:
                        print_result(False, f"Business {business_id} still appears in list after deletion")
                        return False
                return True
            else:
                print_result(False, "Delete response missing 'ok: true'", data)
                return False
        else:
            print_result(False, f"Failed with status {response.status_code}", 
                        {"error": response.text})
            return False
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def test_cors_preflight():
    """Test 7: OPTIONS preflight - Verify CORS headers"""
    print_test("OPTIONS /api/businesses - CORS Preflight Check")
    
    try:
        headers = {
            "Origin": "https://1027c997-a912-494e-9ecb-29aa40dba44d.preview.emergentagent.com",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        }
        
        response = requests.options(f"{BASE_URL}/businesses", headers=headers, timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        cors_headers = {k.lower(): v for k, v in response.headers.items()}
        
        # Check for required CORS headers
        has_allow_origin = "access-control-allow-origin" in cors_headers
        allow_origin_value = cors_headers.get("access-control-allow-origin", "")
        has_allow_credentials = "access-control-allow-credentials" in cors_headers
        allow_credentials_value = cors_headers.get("access-control-allow-credentials", "")
        
        print(f"\nCORS Headers Analysis:")
        print(f"  access-control-allow-origin: {allow_origin_value}")
        print(f"  access-control-allow-credentials: {allow_credentials_value}")
        
        # The fix: when origin is "*", credentials should NOT be "true"
        if has_allow_origin and allow_origin_value == "*":
            if allow_credentials_value.lower() == "true":
                print_result(False, 
                    "CORS misconfigured: allow-credentials=true with allow-origin=* (browser will block)",
                    {"allow-origin": allow_origin_value, "allow-credentials": allow_credentials_value})
                return False
            else:
                print_result(True, 
                    "CORS correctly configured: allow-origin=* without allow-credentials=true",
                    {"allow-origin": allow_origin_value, "allow-credentials": allow_credentials_value})
                return True
        elif has_allow_origin:
            print_result(True, f"CORS configured with specific origin: {allow_origin_value}")
            return True
        else:
            print_result(False, "Missing access-control-allow-origin header")
            return False
            
    except Exception as e:
        print_result(False, f"Exception occurred: {str(e)}")
        return False

def main():
    print("\n" + "="*60)
    print("KasUMKM Backend API Test - CORS Fix Verification")
    print("="*60)
    
    results = {
        "passed": 0,
        "failed": 0,
        "tests": []
    }
    
    # Test 1: GET businesses
    success, businesses = test_get_businesses()
    results["tests"].append(("GET /api/businesses", success))
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 2: POST business
    success, new_business = test_post_business()
    results["tests"].append(("POST /api/businesses", success))
    if success:
        results["passed"] += 1
        business_id = new_business["id"]
    else:
        results["failed"] += 1
        print("\n⚠️  Cannot continue with remaining tests without a valid business_id")
        print_summary(results)
        return
    
    # Test 3: Verify business in list
    success = test_verify_business_in_list(business_id)
    results["tests"].append(("Verify business in list", success))
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 4: POST transaction
    success, transaction = test_post_transaction(business_id)
    results["tests"].append(("POST /api/transactions", success))
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 5: Dashboard balance
    success = test_dashboard_balance(business_id)
    results["tests"].append(("GET /api/dashboard/business", success))
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 6: DELETE business
    success = test_delete_business(business_id)
    results["tests"].append(("DELETE /api/businesses/{id}", success))
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    # Test 7: CORS preflight
    success = test_cors_preflight()
    results["tests"].append(("OPTIONS CORS preflight", success))
    if success:
        results["passed"] += 1
    else:
        results["failed"] += 1
    
    print_summary(results)

def print_summary(results):
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_name, success in results["tests"]:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print("\n" + "-"*60)
    print(f"Total Tests: {results['passed'] + results['failed']}")
    print(f"Passed: {results['passed']}")
    print(f"Failed: {results['failed']}")
    print("="*60)
    
    if results["failed"] == 0:
        print("\n🎉 All tests passed! CORS fix is working correctly.")
    else:
        print(f"\n⚠️  {results['failed']} test(s) failed. Please review the errors above.")

if __name__ == "__main__":
    main()
