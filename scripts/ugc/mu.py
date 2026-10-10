import json, os, sys, time, urllib.request
BASE = "https://api.muapi.ai/api/v1"
KEY = os.environ["MUAPI_KEY"]

def _req(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
        headers={"x-api-key": KEY, "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(r, timeout=60) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise SystemExit(f"{method} {url} -> {e.code} {e.read().decode()[:500]}")

def submit(endpoint, payload):
    d = _req("POST", f"{BASE}/{endpoint}", payload)
    return d.get("request_id") or d["id"]

def wait(rid, every=8, limit=900):
    t = 0
    while t < limit:
        d = _req("GET", f"{BASE}/predictions/{rid}/result")
        s = d.get("status")
        if s == "completed" or d.get("outputs"):
            return d["outputs"][0]
        if s == "failed" or d.get("error"):
            raise SystemExit(f"{rid} failed: {d.get('error')}")
        time.sleep(every); t += every
    raise SystemExit(f"{rid} timeout")

def balance():
    return _req("GET", f"{BASE}/account/balance")["balance"]

def run_many(jobs):
    """jobs: {name: (endpoint, payload)} -> {name: output_url}, submitted in parallel."""
    ids = {n: submit(e, p) for n, (e, p) in jobs.items()}
    return {n: wait(i) for n, i in ids.items()}
