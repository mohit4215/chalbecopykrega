import urllib.request
import json

base = "http://127.0.0.1:8000"

# 1. Readiness probe
ready_req = urllib.request.Request(f"{base}/api/health/ready")
with urllib.request.urlopen(ready_req) as resp:
    print("READINESS PROBE:", json.loads(resp.read().decode("utf-8")))

# 2. Login
login_req = urllib.request.Request(
    f"{base}/api/login",
    data=json.dumps({"email": "student@university.edu", "password": "password123"}).encode("utf-8"),
    headers={"Content-Type": "application/json"}
)
with urllib.request.urlopen(login_req) as resp:
    token = json.loads(resp.read().decode("utf-8"))["access_token"]
    print("AUTH SUCCESS: Logged in as student@university.edu")

# 3. Provision Developer API Key
key_req = urllib.request.Request(
    f"{base}/api/v1/keys",
    data=json.dumps({"name": "Blackboard Production Key"}).encode("utf-8"),
    headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
)
with urllib.request.urlopen(key_req) as resp:
    key_info = json.loads(resp.read().decode("utf-8"))
    api_key = key_info["api_key"]
    print("PROVISIONED API KEY:", api_key[:18] + "...", "Name:", key_info["name"])

# 4. Execute Programmatic Scan with API Key
scan_payload = {
    "text": (
        "In conclusion, it is crucial to note that modern convolutional architectures "
        "have revolutionized computer vision and deep representation learning. "
        "Furthermore, by exploring these nuances, it plays a pivotal role in automated diagnosis."
    ),
    "title": "Computer_Vision_Study.txt",
    "enable_web_search": False
}
scan_req = urllib.request.Request(
    f"{base}/api/v1/scan",
    data=json.dumps(scan_payload).encode("utf-8"),
    headers={"Content-Type": "application/json", "X-API-Key": api_key}
)
with urllib.request.urlopen(scan_req) as resp:
    report = json.loads(resp.read().decode("utf-8"))
    print("PROGRAMMATIC SCAN SUCCESS:")
    print(" - Originality Score:", report["originality_score"])
    print(" - AI Detection Probability:", report["ai_detection"]["ai_probability"])
    print(" - AI Verdict:", report["ai_detection"]["verdict"])
    print(" - Net Plagiarism (Quotes/Bib Excluded):", report["net_plagiarism_score"])
