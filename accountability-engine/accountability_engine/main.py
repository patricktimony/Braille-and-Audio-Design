"""FastAPI application. Run with:  python -m accountability_engine

Listens on 127.0.0.1 only, so nothing on the network can reach it.
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, HTMLResponse, PlainTextResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import __version__, config, reports
from .agents import chat as chat_mod
from .agents import get_investigation, run_investigation
from .agents.narrator import CONSENT_KEY, MODE_KEY
from .analysis import run_analysis
from .db import Database, now_iso
from .demo.generate import load_demo
from .importers import import_file
from .importers.image_importer import ocr_available

MAX_UPLOAD = 25 * 1024 * 1024
CONSENT_TEXT = ("I understand that turning this on sends a redacted copy of verified "
                "investigation statements to an external AI service.")


class ChatIn(BaseModel):
    question: str


class SettingsIn(BaseModel):
    analysis_mode: str | None = None
    external_ai_consent: bool | None = None
    acknowledgement: str | None = None


class Decision(BaseModel):
    decision: str


def create_app(db_path: str | None = None) -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.db = Database(db_path or os.environ.get("AE_DB_PATH") or config.db_path())
        yield
        app.state.db.conn.close()

    app = FastAPI(title="The Accountability Engine", version=__version__, lifespan=lifespan)

    @app.middleware("http")
    async def security_headers(request: Request, call_next):
        resp = await call_next(request)
        resp.headers["Content-Security-Policy"] = (
            "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; "
            "connect-src 'self'; frame-ancestors 'none'")
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Referrer-Policy"] = "no-referrer"
        return resp

    def db(request: Request) -> Database:
        return request.app.state.db

    # ------------------------------------------------------------ status
    @app.get("/api/status")
    def status(request: Request):
        d = db(request)
        count = lambda t: d.one(f"SELECT COUNT(*) AS n FROM {t}")["n"]  # noqa: E731
        return {"version": __version__, "transactions": count("transactions"),
                "receipts": count("receipts"), "findings": count("findings"),
                "sources": d.query("SELECT id, kind, filename, account_name, imported_at "
                                   "FROM sources ORDER BY id"),
                "analysis_mode": d.get_setting(MODE_KEY, "local"),
                "external_ai_consent": d.get_setting(CONSENT_KEY) == "granted",
                "api_key_configured": bool(config.llm_api_key()),
                "ocr_available": ocr_available(),
                "contacts_anyone": False}

    # ------------------------------------------------------------ import
    @app.post("/api/demo/load")
    def demo_load(request: Request):
        d = db(request)
        results = load_demo(d, include_screenshot=ocr_available())
        findings = run_analysis(d)
        return {"imports": results, "findings": len(findings)}

    @app.post("/api/import")
    async def do_import(request: Request, files: list[UploadFile] = File(...),
                        account_name: str = Form(""), account_type: str = Form("checking"),
                        year: str = Form("")):
        d = db(request)
        results = []
        for f in files:
            data = await f.read()
            if len(data) > MAX_UPLOAD:
                results.append({"filename": f.filename, "error": "File is larger than 25 MB."})
                continue
            try:
                res = import_file(d, f.filename or "upload", data, account_name, account_type,
                                  int(year) if year.strip().isdigit() else None)
                results.append(res.as_dict())
            except Exception as exc:  # report per file, keep going
                results.append({"filename": f.filename, "error": str(exc)})
        findings = run_analysis(d)
        return {"imports": results, "findings": len(findings)}

    @app.delete("/api/data")
    def delete_data(request: Request, confirm: str = ""):
        if confirm != "DELETE":
            raise HTTPException(400, "To delete all imported data, send confirm=DELETE.")
        db(request).clear_all()
        return {"deleted": True}

    # ------------------------------------------------------------ browse
    @app.get("/api/transactions")
    def transactions(request: Request, q: str = ""):
        rows = db(request).transactions()
        matched = {m["transaction_id"] for m in db(request).query("SELECT transaction_id FROM matches")}
        flagged: dict[int, int] = {}
        for f in db(request).findings():
            if f["level"] != "info":
                for t in f["transaction_ids"]:
                    flagged[t] = flagged.get(t, 0) + 1
        if q:
            ql = q.lower()
            rows = [r for r in rows if ql in r["raw_description"].lower()
                    or ql in f"{abs(r['amount_cents']) / 100:.2f}" or ql in r["date"]]
        for r in rows:
            r["has_receipt"] = r["id"] in matched
            r["finding_count"] = flagged.get(r["id"], 0)
            r.pop("descriptor", None)
        return rows

    @app.get("/api/transactions/{tx_id}")
    def transaction(request: Request, tx_id: int):
        d = db(request)
        t = d.transaction(tx_id)
        if not t:
            raise HTTPException(404, "Transaction not found")
        t["receipts"] = [d.receipt(m["receipt_id"]) for m in d.matches_for_transaction(tx_id)]
        t["findings"] = [f for f in d.findings() if tx_id in f["transaction_ids"]]
        return t

    @app.get("/api/receipts")
    def receipts(request: Request):
        d = db(request)
        rows = d.receipts()
        links = {m["receipt_id"]: m["transaction_id"] for m in d.query("SELECT * FROM matches")}
        for r in rows:
            r["transaction_id"] = links.get(r["id"])
            r["body"] = r["body"][:1500]
        return rows

    @app.get("/api/findings")
    def findings(request: Request):
        d = db(request)
        out = []
        for f in d.findings():
            f["transactions"] = [d.transaction(t) for t in f["transaction_ids"]]
            for t in f["transactions"]:
                t.pop("descriptor", None)
            f["receipts"] = [d.receipt(r) for r in f["receipt_ids"]]
            out.append(f)
        return out

    @app.post("/api/analyze")
    def analyze(request: Request):
        return {"findings": len(run_analysis(db(request)))}

    # ------------------------------------------------------- investigation
    @app.post("/api/investigate/{tx_id}")
    def investigate(request: Request, tx_id: int, mode: str | None = None):
        d = db(request)
        if not d.transaction(tx_id):
            raise HTTPException(404, "Transaction not found")
        if mode not in (None, "local", "external"):
            raise HTTPException(400, "mode must be local or external")
        return run_investigation(d, tx_id, mode)

    def _inv(request: Request, inv_id: int) -> dict:
        inv = get_investigation(db(request), inv_id)
        if not inv:
            raise HTTPException(404, "Investigation not found")
        return inv

    @app.get("/api/investigations/{inv_id}")
    def investigation(request: Request, inv_id: int):
        return _inv(request, inv_id)

    @app.get("/api/investigations/{inv_id}/report.html", response_class=HTMLResponse)
    def inv_html(request: Request, inv_id: int):
        return reports.investigation_html(_inv(request, inv_id))

    @app.get("/api/investigations/{inv_id}/report.txt", response_class=PlainTextResponse)
    def inv_text(request: Request, inv_id: int):
        return reports.investigation_text(_inv(request, inv_id))

    def _letter_kind(kind: str) -> str:
        if kind not in ("issuer", "merchant"):
            raise HTTPException(400, "kind must be issuer or merchant")
        return kind

    @app.get("/api/investigations/{inv_id}/letter.html", response_class=HTMLResponse)
    def letter_html(request: Request, inv_id: int, kind: str = "issuer"):
        return reports.letter_html(_inv(request, inv_id), _letter_kind(kind))

    @app.get("/api/investigations/{inv_id}/letter.txt", response_class=PlainTextResponse)
    def letter_text(request: Request, inv_id: int, kind: str = "issuer"):
        return reports.letter_text(_inv(request, inv_id), _letter_kind(kind))

    @app.get("/api/reports/findings.html", response_class=HTMLResponse)
    def findings_html(request: Request):
        d = db(request)
        return reports.findings_html(d.findings(), d)

    @app.get("/api/reports/findings.txt", response_class=PlainTextResponse)
    def findings_text(request: Request):
        d = db(request)
        return reports.findings_text(d.findings(), d)

    # ---------------------------------------------------------------- chat
    @app.post("/api/chat")
    def chat(request: Request, body: ChatIn):
        return chat_mod.answer(db(request), body.question)

    # ------------------------------------------------------------ settings
    @app.get("/api/settings")
    def get_settings(request: Request):
        d = db(request)
        return {"analysis_mode": d.get_setting(MODE_KEY, "local"),
                "external_ai_consent": d.get_setting(CONSENT_KEY) == "granted",
                "consent_text": CONSENT_TEXT, "api_key_configured": bool(config.llm_api_key()),
                "model": config.llm_model()}

    @app.post("/api/settings")
    def set_settings(request: Request, body: SettingsIn):
        d = db(request)
        if body.external_ai_consent is not None:
            if body.external_ai_consent:
                if (body.acknowledgement or "").strip() != CONSENT_TEXT:
                    raise HTTPException(400, "Consent needs the exact acknowledgement text.")
                d.set_setting(CONSENT_KEY, "granted")
                d.audit("external_ai_consent_granted", {"at": now_iso()})
            else:
                d.set_setting(CONSENT_KEY, "withdrawn")
                d.set_setting(MODE_KEY, "local")
                d.audit("external_ai_consent_withdrawn", {"at": now_iso()})
        if body.analysis_mode is not None:
            if body.analysis_mode not in ("local", "external"):
                raise HTTPException(400, "analysis_mode must be local or external")
            if body.analysis_mode == "external" and d.get_setting(CONSENT_KEY) != "granted":
                raise HTTPException(403, "External AI mode needs your explicit consent first.")
            d.set_setting(MODE_KEY, body.analysis_mode)
        return get_settings(request)

    # ------------------------------------------------------------- actions
    @app.get("/api/actions")
    def actions(request: Request):
        return db(request).query("SELECT * FROM actions ORDER BY id DESC")

    @app.post("/api/actions/{action_id}")
    def decide(request: Request, action_id: int, body: Decision):
        d = db(request)
        a = d.one("SELECT * FROM actions WHERE id=?", (action_id,))
        if not a:
            raise HTTPException(404, "Action not found")
        if body.decision not in ("approve", "decline"):
            raise HTTPException(400, "decision must be approve or decline")
        status_ = "approved" if body.decision == "approve" else "declined"
        d.execute("UPDATE actions SET status=?, decided_at=? WHERE id=?",
                  (status_, now_iso(), action_id))
        d.audit("action_" + status_, {"action_id": action_id, "kind": a["kind"]})
        out = {"id": action_id, "status": status_,
               "note": "Approved for you to use. The app has not sent or submitted anything, "
                       "and cannot: print or copy the letter and send it yourself."
               if status_ == "approved" else "Declined. Nothing was done."}
        if status_ == "approved" and a["kind"].startswith("draft_letter"):
            kind = a["kind"].split(":")[1] if ":" in a["kind"] else "issuer"
            inv = get_investigation(d, a["investigation_id"])
            out["letter_text"] = reports.letter_text(inv, kind)
            out["letter_url"] = f"/api/investigations/{a['investigation_id']}/letter.html?kind={kind}"
        return out

    @app.get("/api/audit")
    def audit(request: Request):
        return db(request).query("SELECT * FROM audit_log ORDER BY id DESC LIMIT 200")

    # ------------------------------------------------------------- static
    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(config.STATIC_DIR / "index.html")

    app.mount("/static", StaticFiles(directory=config.STATIC_DIR), name="static")
    return app


app = create_app()
