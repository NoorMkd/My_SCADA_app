# ============================================================
# email_alerts.py
# Sends email alerts when AI models detect critical states.
# ============================================================

import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime
from app.config import settings

# ── EMAIL CONFIG ──────────────────────────────────────────
SENDER   = settings.ALERT_EMAIL_SENDER
PASSWORD = settings.ALERT_EMAIL_PASSWORD
RECEIVER = settings.ALERT_EMAIL_RECEIVER

def send_alert_email(subject: str, body: str):
    """
    Sends one email. Called when a critical prediction is detected.
    """
    try:
        msg = MIMEMultipart()
        msg["From"]    = SENDER
        msg["To"]      = RECEIVER
        msg["Subject"] = subject

        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SENDER, PASSWORD)
            server.sendmail(SENDER, RECEIVER, msg.as_string())

        print(f"[EMAIL] Alert sent ✓ → {subject}")

    except Exception as e:
        print(f"[EMAIL] Failed to send email → {e}")


def check_and_send_alerts(anomaly: dict, rul: dict, alert: dict):
    """
    Called after every prediction run.
    Checks if any result is critical and sends email if so.
    """
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    alerts_to_send = []

    # ── check anomaly score ───────────────────────────────
    if anomaly["label"] == "CRITICAL":
        alerts_to_send.append({
            "title":   "🚨 CRITICAL ANOMALY DETECTED",
            "message": f"Anomaly score: {anomaly['score']}/100",
            "detail":  anomaly["explanation"],
            "color":   "#cd6413"
        })
    elif anomaly["label"] == "WARNING":
        alerts_to_send.append({
            "title":   "⚠️ ANOMALY WARNING",
            "message": f"Anomaly score: {anomaly['score']}/100",
            "detail":  anomaly["explanation"],
            "color":   "#d5a507"
        })

    # ── check RUL ─────────────────────────────────────────
    if rul["label"] == "CRITICAL":
        alerts_to_send.append({
            "title":   "🚨 MOTOR FAILURE IMMINENT",
            "message": f"Only {rul['days']} days remaining",
            "detail":  rul["explanation"],
            "color":   "#cd6413"
        })
    elif rul["label"] == "HIGH RISK":
        alerts_to_send.append({
            "title":   "⚠️ HIGH RISK — Maintenance Required Soon",
            "message": f"{rul['days']} days remaining",
            "detail":  rul["explanation"],
            "color":   "#d5a507"
        })

    # ── check alert forecast ──────────────────────────────
    if alert["label"] == "HIGH":
        alerts_to_send.append({
            "title":   "⚠️ HIGH ALERT ACTIVITY FORECAST",
            "message": f"Estimated {alert['count']} alerts in next 24h",
            "detail":  alert["recommendation"],
            "color":   "#d5a507"
        })

    # ── send one combined email if any alerts ─────────────
    if alerts_to_send:
        subject = f"[Conveyor SCADA] {len(alerts_to_send)} Alert(s) Detected — {now}"
        body    = _build_email_body(alerts_to_send, now)
        send_alert_email(subject, body)
    else:
        print("[EMAIL] All systems normal — no email sent.")


def _build_email_body(alerts: list, now: str) -> str:
    """
    Builds a clean HTML email with all alerts listed.
    """
    rows = ""
    for a in alerts:
        rows += f"""
        <div style="border-left: 4px solid {a['color']};
                    padding: 12px 16px;
                    margin-bottom: 16px;
                    background: #1a1a2e;
                    border-radius: 4px;">
            <h3 style="color:{a['color']}; margin:0 0 6px 0;">{a['title']}</h3>
            <p style="color:#ffffff; margin:0 0 4px 0;"><b>{a['message']}</b></p>
            <p style="color:#aaaaaa; margin:0;">{a['detail']}</p>
        </div>
        """

    return f"""
    <html>
    <body style="background:#0d0d1a; padding:24px; font-family:Arial,sans-serif;">
        <h2 style="color:#0098c2;">
            🏭 Conveyor SCADA — Alert Report
        </h2>
        <p style="color:#aaaaaa;">Generated at: {now}</p>
        <hr style="border-color:#333; margin:16px 0;">
        {rows}
        <hr style="border-color:#333; margin:16px 0;">
        <p style="color:#555; font-size:12px;">
            This is an automated message from your Conveyor SCADA system.
        </p>
    </body>
    </html>
    """