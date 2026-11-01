"""
verify_flow.py — Verification script to exercise the full flow against a live server.
"""

import sys
import time
import httpx

BASE_URL = "http://127.0.0.1:8000"

SAMPLE_INPUTS = {
    "age_years": 34,
    "gender": "F",
    "amt_income_total": 180000,
    "amt_credit": 450000,
    "amt_annuity": 22500,
    "years_employed": 6.5,
    "name_contract_type": "Cash loans",
    "name_income_type": "Working",
    "name_education_type": "Higher education",
    "name_family_status": "Married",
    "name_housing_type": "House / apartment",
    "organization_type": "Services",
    "flag_own_car": False,
    "flag_own_realty": True,
    "cnt_children": 1,
    "cnt_fam_members": 3,
    "ext_source_2": 0.58,
    "ext_source_3": 0.42,
}

def main():
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Health
    print("1. Testing GET /health...")
    r = client.get("/health")
    assert r.status_code == 200, f"Health failed: {r.text}"
    health_data = r.json()
    assert health_data["model_loaded"] is True, f"Model not loaded: {health_data}"
    print("   Health OK:", health_data)

    # 2. Register
    email = f"user_{int(time.time())}@example.com"
    password = "password123"
    print(f"2. Testing POST /auth/register with {email}...")
    r = client.post("/auth/register", json={"email": email, "password": password, "full_name": "Asha Rao"})
    assert r.status_code == 201, f"Register failed: {r.text}"
    print("   Register OK:", r.json())

    # 3. Login
    print("3. Testing POST /auth/login...")
    r = client.post("/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {token}"}
    print("   Login OK, got token.")

    # 4. Auth Me
    print("4. Testing GET /auth/me...")
    r = client.get("/auth/me", headers=user_headers)
    assert r.status_code == 200, f"Auth me failed: {r.text}"
    print("   Me OK:", r.json())

    # 5. Consent
    print("5. Testing POST /consent...")
    r = client.post("/consent", json={"policy_version": "v1", "accepted": True}, headers=user_headers)
    assert r.status_code == 201, f"Consent failed: {r.text}"
    consent_id = r.json()["consent_id"]
    print("   Consent OK, ID:", consent_id)

    # 6. Predict
    print("6. Testing POST /predict...")
    r = client.post("/predict", json={"consent_id": consent_id, "inputs": SAMPLE_INPUTS}, headers=user_headers)
    assert r.status_code == 200, f"Predict failed: {r.text}"
    pred = r.json()
    request_id = pred["request_id"]
    prob = pred["probability_of_default"]
    band = pred["risk_band"]
    print(f"   Predict OK: req_id={request_id}, prob={prob}, band={band}")

    # 7. What-If
    print("7. Testing POST /whatif...")
    r = client.post("/whatif", json={"request_id": request_id, "changes": {"amt_credit": 300000}}, headers=user_headers)
    assert r.status_code == 200, f"Whatif failed: {r.text}"
    whatif = r.json()
    print(f"   What-if OK: delta={whatif['delta_probability']}, is_sim={whatif['is_simulation']}")

    # 8. History list
    print("8. Testing GET /history...")
    r = client.get("/history", headers=user_headers)
    assert r.status_code == 200, f"History list failed: {r.text}"
    items = r.json()["items"]
    assert len(items) >= 1
    print(f"   History OK: total={r.json()['total']}")

    # 9. History detail
    print(f"9. Testing GET /history/{request_id}...")
    r = client.get(f"/history/{request_id}", headers=user_headers)
    assert r.status_code == 200, f"History detail failed: {r.text}"
    print("   History detail OK.")

    # 10. Model Metrics
    print("10. Testing GET /model-metrics...")
    r = client.get("/model-metrics", headers=user_headers)
    assert r.status_code == 200, f"Model metrics failed: {r.text}"
    print("   Model metrics OK, model_name:", r.json()["model_name"])

    # 11. Admin Login
    print("11. Logging in as Admin...")
    r = client.post("/auth/login", json={"email": "admin@datadynamo.com", "password": "admin1234"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    admin_token = r.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    print("   Admin login OK.")

    # 12. Admin Stats
    print("12. Testing GET /admin/stats...")
    r = client.get("/admin/stats", headers=admin_headers)
    assert r.status_code == 200, f"Admin stats failed: {r.text}"
    print("   Admin stats OK:", r.json()["totals"])

    # 13. Admin Predictions
    print("13. Testing GET /admin/predictions...")
    r = client.get("/admin/predictions", headers=admin_headers)
    assert r.status_code == 200, f"Admin predictions failed: {r.text}"
    print("   Admin predictions OK: count =", len(r.json()["items"]))

    # 14. Admin Users
    print("14. Testing GET /admin/users...")
    r = client.get("/admin/users", headers=admin_headers)
    assert r.status_code == 200, f"Admin users failed: {r.text}"
    print("   Admin users OK: count =", len(r.json()["items"]))

    # 15. Admin Fairness
    print("15. Testing GET /admin/fairness...")
    r = client.get("/admin/fairness", headers=admin_headers)
    assert r.status_code == 200, f"Admin fairness failed: {r.text}"
    print("   Admin fairness OK: live total =", r.json()["live"]["total_predictions"])

    print("\nALL 15 ENDPOINTS VERIFIED SUCCESSFULLY AGAINST LIVE SERVER!")

if __name__ == "__main__":
    main()
