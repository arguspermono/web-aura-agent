import requests
import time
import sys
import json

BASE = "http://localhost:8000"

def main():
    print("🚀 Starting End-to-End API Test (MOCK_MODE=True)")
    
    # 1. Health Check
    r = requests.get(f"{BASE}/health")
    if r.status_code != 200 or not r.json().get("mock_mode"):
        print("❌ Server not in mock mode or not running correctly.")
        return

    # 2. Upload Evidence
    fake_jpg = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9])
    files = {"file": ("test_evidence.jpg", fake_jpg, "image/jpeg")}
    r = requests.post(f"{BASE}/api/v1/upload/", files=files)
    if r.status_code != 200:
        print(f"❌ Upload failed: {r.text}")
        return
    file_id = r.json()["data"]["file_id"]
    print(f"✅ Uploaded file: {file_id}")

    # 3. Create Claim
    payload = {
        "user_id": "test-user-001",
        "order_id": "ORD-20260514-001",
        "claim_type": "product_defect",
        "file_ids": [file_id],
        "voice_description": "Damaged screen",
        "refund_amount": 150000
    }
    r = requests.post(f"{BASE}/api/v1/claims/", json=payload)
    if r.status_code != 200:
        print(f"❌ Claim creation failed: {r.text}")
        return
    claim_id = r.json()["data"]["id"]
    print(f"✅ Created claim: {claim_id}")

    # 4. Trigger Analysis
    r = requests.post(f"{BASE}/api/v1/claims/{claim_id}/analyze")
    if r.status_code != 202:
        print(f"❌ Analysis trigger failed: {r.text}")
        return
    print("✅ Analysis triggered.")

    # 5. Poll Status
    print("⏳ Polling for completion...")
    for i in range(10):
        time.sleep(2)
        r = requests.get(f"{BASE}/api/v1/claims/{claim_id}/status")
        status = r.json()["data"]["status"]
        print(f"  Status: {status}")
        if status in ["approved", "rejected", "needs_review"]:
            break
    
    # 6. Get Result
    r = requests.get(f"{BASE}/api/v1/claims/{claim_id}")
    print("\n🏁 Final Result:")
    print(json.dumps(r.json()["data"], indent=2))

if __name__ == "__main__":
    main()
