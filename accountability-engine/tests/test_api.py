from accountability_engine.config import DEMO_DATA_DIR


def load(client):
    r = client.post("/api/demo/load")
    assert r.status_code == 200
    return r.json()


def test_status_and_demo(client):
    s = client.get("/api/status").json()
    assert s["transactions"] == 0 and s["analysis_mode"] == "local" and s["contacts_anyone"] is False
    res = load(client)
    assert res["findings"] > 5
    again = load(client)  # idempotent
    assert all(r["skipped_duplicate_file"] for r in again["imports"])


def test_upload_import(client):
    data = (DEMO_DATA_DIR / "checking_statement.csv").read_bytes()
    r = client.post("/api/import", files=[("files", ("statement.csv", data, "text/csv"))],
                    data={"account_name": "My checking", "account_type": "checking"})
    body = r.json()
    assert body["imports"][0]["transactions"] == 82
    r = client.post("/api/import", files=[("files", ("junk.xyz", b"\x00\x01", "application/octet-stream"))])
    assert "error" in r.json()["imports"][0]


def test_transactions_findings_and_detail(client):
    load(client)
    txs = client.get("/api/transactions", params={"q": "295.98"}).json()
    assert len(txs) == 1 and txs[0]["finding_count"] >= 1 and txs[0]["has_receipt"] is False
    detail = client.get(f"/api/transactions/{txs[0]['id']}").json()
    assert detail["findings"]
    findings = client.get("/api/findings").json()
    assert all("transactions" in f and "evidence" in f for f in findings)
    assert client.get("/api/transactions/99999").status_code == 404


def test_investigation_reports_and_letters(client):
    load(client)
    tid = client.get("/api/transactions", params={"q": "295.98"}).json()[0]["id"]
    inv = client.post(f"/api/investigate/{tid}").json()
    base = f"/api/investigations/{inv['id']}"
    for path in ("/report.html", "/report.txt", "/letter.html?kind=issuer", "/letter.txt?kind=merchant"):
        r = client.get(base + path)
        assert r.status_code == 200, path
    assert client.get(base + "/letter.txt?kind=regulator").status_code == 400
    assert client.get("/api/reports/findings.html").status_code == 200
    assert client.get("/api/reports/findings.txt").status_code == 200


def test_chat_endpoint(client):
    load(client)
    r = client.post("/api/chat", json={"question": "What was this $295.98 Apple charge?"}).json()
    assert r["investigation"]["subject"]["transaction"]["amount_cents"] == -29598


def test_external_mode_requires_explicit_consent(client):
    assert client.post("/api/settings", json={"analysis_mode": "external"}).status_code == 403
    assert client.post("/api/settings", json={"external_ai_consent": True,
                                              "acknowledgement": "ok"}).status_code == 400
    text = client.get("/api/settings").json()["consent_text"]
    r = client.post("/api/settings", json={"external_ai_consent": True, "acknowledgement": text})
    assert r.json()["external_ai_consent"] is True
    assert client.post("/api/settings", json={"analysis_mode": "external"}).json()["analysis_mode"] == "external"
    r = client.post("/api/settings", json={"external_ai_consent": False}).json()
    assert r["external_ai_consent"] is False and r["analysis_mode"] == "local"
    events = [a["event"] for a in client.get("/api/audit").json()]
    assert "external_ai_consent_granted" in events and "external_ai_consent_withdrawn" in events


def test_external_mode_without_key_falls_back_to_local(client):
    load(client)
    text = client.get("/api/settings").json()["consent_text"]
    client.post("/api/settings", json={"external_ai_consent": True, "acknowledgement": text})
    client.post("/api/settings", json={"analysis_mode": "external"})
    tid = client.get("/api/transactions", params={"q": "295.98"}).json()[0]["id"]
    inv = client.post(f"/api/investigate/{tid}").json()
    assert inv["mode"] == "local" and "ANTHROPIC_API_KEY" in inv["notes"][0]


def test_actions_need_approval_and_never_send(client):
    load(client)
    tid = client.get("/api/transactions", params={"q": "295.98"}).json()[0]["id"]
    inv = client.post(f"/api/investigate/{tid}").json()
    actions = client.get("/api/actions").json()
    assert actions and all(a["status"] == "proposed" for a in actions)
    aid = [a for a in inv["next_actions"] if a.get("action_id")][0]["action_id"]
    r = client.post(f"/api/actions/{aid}", json={"decision": "approve"}).json()
    assert r["status"] == "approved" and "has not sent" in r["note"]
    assert r["letter_text"].startswith("DRAFT — NOT SENT")
    assert client.post(f"/api/actions/{aid}", json={"decision": "send"}).status_code == 400


def test_delete_requires_confirmation(client):
    load(client)
    assert client.delete("/api/data").status_code == 400
    assert client.delete("/api/data", params={"confirm": "DELETE"}).json()["deleted"]
    assert client.get("/api/status").json()["transactions"] == 0


def test_security_headers_and_index(client):
    r = client.get("/")
    assert r.status_code == 200 and "Content-Security-Policy" in r.headers
    assert "connect-src 'self'" in r.headers["Content-Security-Policy"]
