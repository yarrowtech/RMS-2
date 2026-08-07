
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
from typing import List
from datetime import datetime
from app.config import settings
from app.db import email_failures_collection

conf = None

if settings.smtp_host and settings.smtp_user and settings.mail_from:
    conf = ConnectionConfig(
        MAIL_USERNAME=settings.smtp_user,
        MAIL_PASSWORD=settings.smtp_password,
        MAIL_FROM=settings.mail_from,
        MAIL_PORT=settings.smtp_port or 587,
        MAIL_SERVER=settings.smtp_host,
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
        VALIDATE_CERTS=True,
    )

PRIMARY   = "#4F46E5"   # indigo  — RMS brand
SUCCESS   = "#059669"   # green   — approvals
WARNING   = "#D97706"   # amber   — alerts
DANGER    = "#DC2626"   # red     — reset / urgent

DEPT_COLORS = {
    "Finance":              "#1E88E5",
    "HR":                   "#43A047",
    "IT":                   "#8E24AA",
    "Procurement":          "#F4511E",
    "Marketing":            "#D81B60",
    "Cashier":              "#D97706",
    "Inventory":            "#0F766E",
    "Logistics":            "#0369A1",
    "Design":               "#7C3AED",
    "Third Party":          "#BE185D",
    "Merchandiser Buyer":   "#B45309",
    "Stock Planning":       "#0E7490",
    "Barcode":              "#374151",
}


# ─────────────────────────────────────────────────────────────────────────────
# SHARED HELPERS
# ─────────────────────────────────────────────────────────────────────────────
def _wrap(color: str, header_title: str, body_html: str, footer: str = "© CitiMart RMS") -> str:
    """Wrap content in the standard RMS email shell."""
    return f"""
    <html>
    <body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;
                  box-shadow:0 4px 12px rgba(0,0,0,0.1);overflow:hidden;">
        <div style="background:{color};padding:22px 30px;">
          <h1 style="color:#fff;margin:0;font-size:22px;">{header_title}</h1>
        </div>
        <div style="padding:32px 30px;">
          {body_html}
        </div>
        <div style="background:#f1f1f1;text-align:center;padding:14px;">
          <p style="color:#999;font-size:12px;margin:0;">{footer}</p>
        </div>
      </div>
    </body>
    </html>
    """

def _btn(link: str, label: str, color: str) -> str:
    # Table-based "bulletproof" button, not a styled <div><a> — Outlook's
    # desktop renderer (Word's HTML engine) ignores display:inline-block on
    # anchors and silently drops the click target, while everything else
    # (Gmail, Apple Mail, etc.) renders either fine. The plain-text link
    # below was the only thing that actually worked for those clients; this
    # makes the button itself reliable everywhere instead of relying on it.
    return f"""
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto;">
      <tr>
        <td style="border-radius:6px;background:{color};">
          <a href="{link}" target="_blank" rel="noopener"
             style="display:block;padding:12px 28px;font-size:15px;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:6px;">
            {label}
          </a>
        </td>
      </tr>
    </table>
    <p style="font-size:12px;color:#aaa;word-break:break-all;background:#f8f9fa;
              padding:10px;border-radius:6px;">{link}</p>
    """

def _divider() -> str:
    return '<hr style="border:none;border-top:1px solid #eee;margin:28px 0;">'

def _note(text: str) -> str:
    return f'<p style="font-size:12px;color:#999;text-align:center;">{text}</p>'

async def _log_email_failure(subject: str, recipients: List[str], reason: str) -> None:
    """Persist every send failure so production has something queryable —
    print() output is easy to lose once nobody is watching stdout."""
    try:
        await email_failures_collection.insert_one({
            "subject": subject, "recipients": recipients, "reason": reason,
            "resolved": False, "created_at": datetime.utcnow(),
        })
    except Exception:
        pass  # Logging the failure must never itself raise into the caller.


async def _send(subject: str, recipients: List[str], html: str) -> bool:
    if not conf:
        print("Email skipped: SMTP is not configured.")
        await _log_email_failure(subject, recipients, "SMTP is not configured.")
        return False
    try:
        fm = FastMail(conf)
        await fm.send_message(MessageSchema(
            subject=subject, recipients=recipients, body=html, subtype="html"
        ))
        print(f"Email sent: {subject} -> {', '.join(recipients)}")
        return True
    except Exception as e:
        print(f"Email failed [{subject}]: {e}")
        await _log_email_failure(subject, recipients, str(e))
        return False

# 1. ADMIN — Password setup (existing, unchanged behaviour)
# ─────────────────────────────────────────────────────────────────────────────
async def send_password_setup_email(
    email: EmailStr, name: str, department: str, link: str
):
    """Admin invited → set up password for their single department."""
    color = DEPT_COLORS.get(department, PRIMARY)
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Welcome, {name}!</h2>
      <p style="font-size:15px;color:#444;">
        You have been added as an <strong>Admin</strong> for the
        <strong style="color:{color};">{department}</strong> department at CitiMart RMS.
      </p>
      <p style="font-size:14px;color:#555;margin-top:16px;">
        Click below to set your password and activate your account.
      </p>
      {_btn(link, "🔐 Set Up Password", color)}
      {_divider()}
      {_note("This link expires in 24 hours. If you didn't expect this, ignore it.")}
    """
    await _send(
        subject=f"Set up your {department} Admin Account — CitiMart RMS",
        recipients=[email],
        html=_wrap(color, "Admin Access Invitation", body,
                   f"© CitiMart RMS · {department} Department"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1b. RETAILER - approved onboarding payment link
async def send_retailer_payment_email(
    email: EmailStr,
    name: str,
    company_name: str,
    plan_label: str,
    amount_inr: int,
    payment_link: str,
    expires_in_days: int = 7,
) -> bool:
    """Send the retailer-controlled checkout link after Super Admin approval."""
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hello, {name}!</h2>
      <p style="font-size:15px;color:#444;">
        Your RMS onboarding request for <strong style="color:{PRIMARY};">{company_name}</strong> has been approved.
      </p>
      <div style="margin:20px 0;padding:16px;border:1px solid #dbeafe;background:#eff6ff;border-radius:10px;">
        <p style="margin:0;color:#1e3a8a;font-size:13px;font-weight:700;">Selected RMS plan</p>
        <p style="margin:6px 0 0;color:#172554;font-size:20px;font-weight:800;">{plan_label} - Rs. {amount_inr:,.0f}/month</p>
      </div>
      <p style="font-size:14px;color:#555;line-height:1.6;">
        Complete payment on the Razorpay-hosted checkout below to activate your RMS workspace. RMS never asks you to email card, UPI, bank, or payment details. Your tenant and first administrator account are created only after Razorpay confirms the payment.
      </p>
      {_btn(payment_link, "Pay securely on Razorpay", PRIMARY)}
      {_divider()}
      {_note(f"This secure payment link expires in {expires_in_days} days. If you did not request RMS onboarding, you can ignore this email.")}
    """
    return await _send(
        subject=f"Complete payment to activate {company_name} on RMS",
        recipients=[email],
        html=_wrap(PRIMARY, "Your RMS onboarding is approved", body, "RMS Platform"),
    )

# 2. ADMIN — Assigned to additional department
# ─────────────────────────────────────────────────────────────────────────────
async def send_department_added_email(
    email: EmailStr,
    name: str,
    new_department: str,
    all_departments: List[str],
    dashboard_link: str,
):
    """
    Sent when SuperAdmin assigns an existing admin to a new (additional) department.
    The admin already has a password — no setup link needed.
    all_departments = full list of departments they now manage.
    """
    color = DEPT_COLORS.get(new_department, PRIMARY)
    dept_list = "".join(
        f'<li style="margin:4px 0;color:#374151;">{d}</li>'
        for d in all_departments
    )
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;">
        You have been assigned to the
        <strong style="color:{color};">{new_department}</strong> department.
      </p>
      <p style="font-size:14px;color:#555;margin-top:12px;">
        You now manage the following departments:
      </p>
      <ul style="font-size:14px;padding-left:20px;margin:10px 0 20px;">
        {dept_list}
      </ul>
      <p style="font-size:14px;color:#555;">
        When you log in, you will be shown a department selector to choose which
        dashboard to open. You can switch between departments anytime.
      </p>
      {_btn(dashboard_link, "🏠 Go to Dashboard", color)}
      {_divider()}
      {_note("If you have any questions, contact your system administrator.")}
    """
    await _send(
        subject=f"New department assigned: {new_department} — CitiMart RMS",
        recipients=[email],
        html=_wrap(color, f"Department Added: {new_department}", body),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. ADMIN — Multi-department welcome (when created with 2+ departments at once)
# ─────────────────────────────────────────────────────────────────────────────
async def send_multi_department_setup_email(
    email: EmailStr,
    name: str,
    departments: List[str],
    link: str,
):
    """
    Admin created with multiple departments from the start.
    One email covers all — setup link + department list.
    """
    dept_list = "".join(
        f'<li style="margin:4px 0;color:#374151;">{d}</li>'
        for d in departments
    )
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Welcome, {name}!</h2>
      <p style="font-size:15px;color:#444;">
        You have been added as an Admin with access to <strong>{len(departments)} departments</strong>:
      </p>
      <ul style="font-size:14px;padding-left:20px;margin:12px 0 20px;">
        {dept_list}
      </ul>
      <p style="font-size:14px;color:#555;">
        After setting your password, you will be presented with a department selector
        each time you log in to choose which dashboard to open.
      </p>
      {_btn(link, "🔐 Set Up Password", PRIMARY)}
      {_divider()}
      {_note("This link expires in 24 hours. If you didn't expect this, ignore it.")}
    """
    await _send(
        subject="Set up your CitiMart RMS Admin Account",
        recipients=[email],
        html=_wrap(PRIMARY, "Multi-Department Admin Invitation", body),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. SUPERADMIN — New store created confirmation
# ─────────────────────────────────────────────────────────────────────────────
async def send_store_created_email(
    email: EmailStr,
    superadmin_name: str,
    store_name: str,
    store_type: str,
    store_id: str,
    store_city: str,
):
    """
    Sent to SuperAdmin when a new store/branch is successfully created.
    Confirms store details and store_id for reference.
    """
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {superadmin_name},</h2>
      <p style="font-size:15px;color:#444;">
        A new store has been created successfully in CitiMart RMS.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr style="background:#f8f9fa;">
          <td style="padding:10px 14px;color:#6b7280;font-weight:600;width:40%;">Store Name</td>
          <td style="padding:10px 14px;color:#111827;font-weight:600;">{store_name}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#6b7280;font-weight:600;">Store Type</td>
          <td style="padding:10px 14px;color:#111827;">{store_type}</td>
        </tr>
        <tr style="background:#f8f9fa;">
          <td style="padding:10px 14px;color:#6b7280;font-weight:600;">City</td>
          <td style="padding:10px 14px;color:#111827;">{store_city}</td>
        </tr>
        <tr>
          <td style="padding:10px 14px;color:#6b7280;font-weight:600;">Store ID</td>
          <td style="padding:10px 14px;font-family:monospace;font-size:13px;
                     color:#4F46E5;background:#ede9fe;border-radius:4px;">{store_id}</td>
        </tr>
      </table>
      <p style="font-size:14px;color:#555;">
        You can now assign admins to this store from the SuperAdmin dashboard.
        Admins assigned to this store will only see inventory, sales and reports
        for <strong>{store_name}</strong>.
      </p>
      {_divider()}
      {_note("This is an automated confirmation from CitiMart RMS.")}
    """
    await _send(
        subject=f"New store created: {store_name} — CitiMart RMS",
        recipients=[email],
        html=_wrap(PRIMARY, f"Store Created: {store_name}", body,
                   "© CitiMart RMS · SuperAdmin Notification"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. VENDOR — Approval confirmation + password setup (existing, unchanged)
# ─────────────────────────────────────────────────────────────────────────────
async def send_vendor_confirmation_email(
    email: EmailStr, name: str, brand_name: str, link: str
):
    """Vendor approved by M-Buyer → set password and access portal."""
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hello, {name}!</h2>
      <p style="font-size:15px;color:#444;">
        Great news! Your brand <strong style="color:{SUCCESS};">{brand_name}</strong>
        has been approved as a vendor in the CitiMart RMS system.
      </p>
      <p style="font-size:14px;color:#555;margin-top:16px;">
        Click below to set your password and access your vendor dashboard.
      </p>
      {_btn(link, "🚀 Set Up Password", SUCCESS)}
      <p style="font-size:14px;color:#666;line-height:1.6;">
        Once logged in you can manage your products, view purchase orders,
        submit order responses and track payments.
      </p>
      {_divider()}
      {_note("This link expires in 7 days. If you didn't expect this, ignore it.")}
    """
    await _send(
        subject="Your CitiMart Vendor Account is Approved 🎉",
        recipients=[email],
        html=_wrap(SUCCESS, "Vendor Account Approved ✅", body,
                   "© CitiMart RMS · Vendor Management"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. VENDOR — Invite link email (from M-Buyer "Add Vendor" flow)
# ─────────────────────────────────────────────────────────────────────────────
async def send_vendor_invite_email(
    email: EmailStr,
    contact_name: str,
    company_name: str,
    invite_link: str,
):
    """
    M-Buyer generates an invite link → backend sends this email.
    Link goes to /vendor/register?token=xxx with pre-filled fields.
    """
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {contact_name},</h2>
      <p style="font-size:15px;color:#444;">
        CitiMart is pleased to invite <strong style="color:{PRIMARY};">{company_name}</strong>
        to join our vendor network.
      </p>
      <p style="font-size:14px;color:#555;margin-top:16px;">
        Please complete your vendor registration using the button below.
        This link is valid for <strong>7 days</strong>.
      </p>
      {_btn(invite_link, "Complete Registration →", PRIMARY)}
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-top:8px;">
        <p style="font-size:13px;color:#166534;margin:0;font-weight:600;">What happens after registration?</p>
        <ul style="font-size:13px;color:#166534;margin:8px 0 0;padding-left:18px;">
          <li>Our Merchandising team reviews your profile</li>
          <li>You receive an approval email with login credentials</li>
          <li>You get access to your vendor dashboard for POs and products</li>
        </ul>
      </div>
      {_divider()}
      {_note("If you have questions, reply to this email. If you didn't expect this, ignore it.")}
    """
    await _send(
        subject=f"CitiMart Vendor Registration Invite — {company_name}",
        recipients=[email],
        html=_wrap(PRIMARY, "Vendor Network Invitation", body,
                   "© CitiMart RMS · Merchandising Team"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 7. VENDOR — Questionnaire received acknowledgement
# ─────────────────────────────────────────────────────────────────────────────
async def send_questionnaire_received_email(
    email: EmailStr,
    vendor_name: str,
    contact_name: str,
):
    """
    Auto-sent when a vendor submits the /vendor/questionnaire form.
    Tells them we received it and will be in touch.
    """
    if not email:
        return
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {contact_name},</h2>
      <p style="font-size:15px;color:#444;">
        Thank you for your interest in partnering with CitiMart!
      </p>
      <p style="font-size:14px;color:#555;margin-top:12px;">
        We have received the questionnaire for
        <strong style="color:{PRIMARY};">{vendor_name}</strong>.
        Our Merchandising team will review your submission and reach out
        within <strong>2–3 business days</strong>.
      </p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
                  padding:16px;margin:24px 0;">
        <p style="font-size:13px;color:#1e40af;margin:0;font-weight:600;">What to expect next</p>
        <ul style="font-size:13px;color:#1e40af;margin:8px 0 0;padding-left:18px;">
          <li>Our buyer reviews your product details and images</li>
          <li>If there's a fit, you'll receive a personal registration invite</li>
          <li>You complete your profile and get vendor portal access</li>
        </ul>
      </div>
      {_divider()}
      {_note("If you have questions, contact us at our support email.")}
    """
    await _send(
        subject="We received your CitiMart vendor questionnaire ✅",
        recipients=[email],
        html=_wrap(PRIMARY, "Questionnaire Received", body,
                   "© CitiMart RMS · Vendor Onboarding"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 8. ADMIN — Password reset (existing, unchanged)
# ─────────────────────────────────────────────────────────────────────────────
async def send_reset_password_email(
    email: EmailStr, name: str, link: str,
    role: str = "admin",
    account_type: str = "department_retailer",
    store_name: str = "",
):
    """
    Password reset link — copy branches by who's resetting, since the blast
    radius differs a lot: a vendor reset only affects their own portal, a
    single-store retailer reset only affects their one store, but an HQ
    (department_retailer) reset affects every department and store that
    admin manages. role/account_type come straight from what forgot_password
    already has on hand (admins_collection.account_type / vendor lookup),
    so this doesn't need any new data to be collected.
    """
    if role == "vendor":
        context_line = "We received a request to reset your CitiMart Vendor Portal password."
        warning = "If you didn't request this, you can safely ignore this email. The link expires in 1 hour."
        subject = "Reset your CitiMart Vendor Portal password"
    elif account_type == "single_store":
        store_phrase = f" for <strong>{store_name}</strong>" if store_name else ""
        context_line = f"We received a request to reset your CitiMart RMS password{store_phrase}."
        warning = "If you didn't request this, you can safely ignore this email. The link expires in 1 hour."
        subject = "Reset your CitiMart RMS password"
    else:
        context_line = "We received a request to reset your CitiMart RMS password."
        warning = (
            "This reset applies to your HQ account — it controls access across every "
            "department and store you manage. If you didn't request this, contact your "
            "Super Admin immediately rather than ignoring it. The link expires in 1 hour."
        )
        subject = "Reset your CitiMart RMS HQ account password"

    body = f"""
      <h2 style="color:#222;">Hello, {name}</h2>
      <p style="font-size:15px;color:#444;">
        {context_line}
      </p>
      {_btn(link, "🔐 Reset Password", DANGER)}
      {_divider()}
      {_note(warning)}
    """
    return await _send(
        subject=subject,
        recipients=[email],
        html=_wrap(DANGER, "Password Reset Request", body),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 9. ANY USER — Password changed confirmation
# ─────────────────────────────────────────────────────────────────────────────
async def send_password_changed_email(email: EmailStr, name: str) -> bool:
    """Sent right after a password reset actually completes — the reset-link
    email only proves someone requested a reset, not that it succeeded. This
    is what lets the real account owner notice a reset they didn't ask for."""
    body = f"""
      <h2 style="color:#222;">Hello, {name}</h2>
      <p style="font-size:15px;color:#444;">
        Your CitiMart RMS password was just changed.
      </p>
      <p style="font-size:14px;color:#555;margin-top:12px;">
        If this was you, no action is needed.
      </p>
      {_divider()}
      {_note("If you did not make this change, contact your administrator immediately — someone else may have access to your account.")}
    """
    return await _send(
        subject="Your CitiMart RMS password was changed",
        recipients=[email],
        html=_wrap(DANGER, "Password Changed", body),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 10. ONBOARDING — Application received / declined
# ─────────────────────────────────────────────────────────────────────────────
async def send_onboarding_received_email(email: EmailStr, contact_name: str, business_name: str) -> bool:
    """Sent the moment a public onboarding request is submitted — until now
    the applicant only saw a JSON success response, nothing in their inbox."""
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {contact_name},</h2>
      <p style="font-size:15px;color:#444;">
        Thanks for applying to bring <strong style="color:{PRIMARY};">{business_name}</strong> onto RMS.
      </p>
      <p style="font-size:14px;color:#555;margin-top:12px;">
        Our team will review your business details and follow up by email. There is nothing further you need to do right now.
      </p>
      {_divider()}
      {_note("If you did not submit this request, you can ignore this email.")}
    """
    return await _send(
        subject=f"We received your RMS application — {business_name}",
        recipients=[email],
        html=_wrap(PRIMARY, "Application Received", body, "RMS Platform"),
    )


async def send_onboarding_declined_email(email: EmailStr, contact_name: str, business_name: str, review_note: str = "") -> bool:
    """Sent when Super Admin declines an onboarding request — until now a
    decline only changed a status label the applicant could never see."""
    note_block = (
        f'<div style="margin:16px 0;padding:14px;border:1px solid #fecaca;background:#fef2f2;border-radius:8px;">'
        f'<p style="margin:0;color:#7f1d1d;font-size:13px;">{review_note}</p></div>'
    ) if review_note else ""
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {contact_name},</h2>
      <p style="font-size:15px;color:#444;">
        Thank you for your interest in bringing <strong>{business_name}</strong> onto RMS. After review, we are not able to proceed with this application at this time.
      </p>
      {note_block}
      {_divider()}
      {_note("If you believe this was a mistake, reply to this email and our team will take another look.")}
    """
    return await _send(
        subject=f"Update on your RMS application — {business_name}",
        recipients=[email],
        html=_wrap(WARNING, "Application Update", body, "RMS Platform"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 11. SUPERADMIN — Tenant suspended / reactivated
# ─────────────────────────────────────────────────────────────────────────────
async def send_tenant_status_email(email: EmailStr, name: str, company_name: str, status: str) -> bool:
    """Sent when Super Admin flips a tenant between active/suspended — until
    now this happened silently with no notice to the retailer."""
    suspended = status == "suspended"
    color = DANGER if suspended else SUCCESS
    headline = "Your RMS account has been suspended" if suspended else "Your RMS account is active again"
    detail = (
        "All logins for your team are temporarily disabled. Contact RMS support to resolve this."
        if suspended else
        "Your team can sign in and resume normal operations."
    )
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;">
        <strong style="color:{color};">{headline}</strong> for <strong>{company_name}</strong>.
      </p>
      <p style="font-size:14px;color:#555;margin-top:12px;">{detail}</p>
      {_divider()}
      {_note("This is an automated notice from CitiMart RMS.")}
    """
    return await _send(
        subject=f"{'Account suspended' if suspended else 'Account reactivated'} — {company_name}",
        recipients=[email],
        html=_wrap(color, headline, body, "RMS Platform"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 12. VENDOR — Subscription payment receipt
# ─────────────────────────────────────────────────────────────────────────────
async def send_subscription_receipt_email(email: EmailStr, name: str, tier_label: str, price_inr: int, expires_at) -> bool:
    """Sent right after a vendor's Razorpay subscription payment is captured
    and activated — confirms the charge and when it renews."""
    expiry_text = expires_at.strftime("%d %b %Y") if hasattr(expires_at, "strftime") else str(expires_at)
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;">
        Your payment for the <strong style="color:{SUCCESS};">{tier_label}</strong> vendor plan was received.
      </p>
      <div style="margin:20px 0;padding:16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;">
        <p style="margin:0;color:#166534;font-size:13px;font-weight:700;">Amount charged</p>
        <p style="margin:6px 0 0;color:#052e16;font-size:20px;font-weight:800;">Rs. {price_inr:,.0f}</p>
        <p style="margin:10px 0 0;color:#166534;font-size:13px;">Active until {expiry_text}</p>
      </div>
      {_divider()}
      {_note("This is an automated payment receipt from CitiMart RMS.")}
    """
    return await _send(
        subject=f"Payment received — {tier_label} plan activated",
        recipients=[email],
        html=_wrap(SUCCESS, "Payment Received", body, "© CitiMart RMS · Vendor Subscriptions"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 13. VENDOR — Subscription expiring / lapsed reminder
# ─────────────────────────────────────────────────────────────────────────────
async def send_subscription_expiring_email(email: EmailStr, name: str, tier_label: str, days_until_expiry: int, lapsed: bool) -> bool:
    """Email counterpart to the in-app renewal banner — reaches vendors who
    aren't actively logged in when their plan is about to lapse or already
    has. Triggered by a scheduled sweep, not a single user action."""
    if lapsed:
        headline = f"Your {tier_label} plan has lapsed"
        detail = "Your catalogue is now running on Free plan limits. Renew to restore your previous visibility and limits."
        color = DANGER
    else:
        headline = f"Your {tier_label} plan renews in {days_until_expiry} day{'s' if days_until_expiry != 1 else ''}"
        detail = "Renew before it expires to avoid dropping back to Free plan limits."
        color = WARNING
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;"><strong style="color:{color};">{headline}</strong></p>
      <p style="font-size:14px;color:#555;margin-top:12px;">{detail}</p>
      {_divider()}
      {_note("This is an automated reminder from CitiMart RMS.")}
    """
    return await _send(
        subject=headline,
        recipients=[email],
        html=_wrap(color, "Subscription Reminder", body, "© CitiMart RMS · Vendor Subscriptions"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 14. VENDOR — Proactive demand signal from a retailer's rising forecast
# ─────────────────────────────────────────────────────────────────────────────
async def send_demand_signal_email(email: EmailStr, vendor_name: str, tenant_label: str, division: str) -> bool:
    """Reaches vendors who aren't actively logged in when a retailer they
    already supply shows rising demand in a category they list. Deliberately
    an aggregated trend only — no quantities, revenue, or specific SKUs —
    see _send_vendor_demand_signals() in forecast_analytics_routes.py."""
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {vendor_name},</h2>
      <p style="font-size:15px;color:#444;">
        <strong style="color:{PRIMARY};">{tenant_label}</strong> is showing rising demand in
        <strong>{division}</strong> — a category you supply.
      </p>
      <p style="font-size:14px;color:#555;margin-top:12px;">
        This may be a good time to check in, confirm your current pricing, or send an updated quote.
      </p>
      {_divider()}
      {_note("This is an automated signal from CitiMart RMS, based on the retailer's own sales trend — not a guaranteed order.")}
    """
    return await _send(
        subject=f"Rising demand for {division} at {tenant_label}",
        recipients=[email],
        html=_wrap(PRIMARY, "Demand Signal", body, "© CitiMart RMS · Vendor Network"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 14. SUPPORT TICKETS — new ticket (to ops) / new reply (to requester)
#
# Shared across the vendor AND retailer support surfaces (support_routes.py)
# — the ticket system itself has no email hooks otherwise, so a ticket sitting
# untouched is invisible to anyone not actively watching the inbox UI.
# ─────────────────────────────────────────────────────────────────────────────
async def send_support_ticket_created_email(
    ops_email: EmailStr, requester_label: str, category: str, subject: str, description: str
) -> bool:
    """Sent to the ops/Super Admin inbox the moment ANY new ticket (vendor or
    retailer) is submitted — the Support Inbox UI only updates for someone
    already looking at it."""
    snippet = (description or "")[:280]
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">New support ticket</h2>
      <p style="font-size:14px;color:#444;">
        From <strong>{requester_label}</strong> &middot; {category}
      </p>
      <div style="margin:16px 0;padding:14px;border:1px solid #e5e7eb;background:#f8fafc;border-radius:8px;">
        <p style="margin:0 0 6px;color:#111;font-size:14px;font-weight:700;">{subject}</p>
        <p style="margin:0;color:#555;font-size:13px;">{snippet}{'…' if len(description or '') > 280 else ''}</p>
      </div>
      {_divider()}
      {_note("Reply from the RMS Support Inbox.")}
    """
    return await _send(
        subject=f"New support ticket — {subject}",
        recipients=[ops_email],
        html=_wrap(PRIMARY, "New Support Ticket", body, "RMS Support"),
    )


async def send_support_ticket_reply_email(
    email: EmailStr, name: str, subject: str, replier_label: str, message: str
) -> bool:
    """Sent to a ticket's original requester whenever someone else (RMS
    support, or — for retailer tickets — an HQ/store admin) adds a reply, so
    they don't have to keep the portal open to notice a response."""
    snippet = (message or "")[:280]
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;">
        <strong style="color:{PRIMARY};">{replier_label}</strong> replied to your support ticket:
      </p>
      <p style="margin:8px 0 16px;color:#111;font-size:14px;font-weight:700;">{subject}</p>
      <div style="margin:0 0 16px;padding:14px;border:1px solid #e5e7eb;background:#f8fafc;border-radius:8px;">
        <p style="margin:0;color:#555;font-size:13px;white-space:pre-wrap;">{snippet}{'…' if len(message or '') > 280 else ''}</p>
      </div>
      {_divider()}
      {_note("Sign in to your RMS portal to view the full conversation and reply.")}
    """
    return await _send(
        subject=f"New reply on your support ticket — {subject}",
        recipients=[email],
        html=_wrap(PRIMARY, "New Support Reply", body, "RMS Support"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 15. RETAILER — Admin seat add-on payment receipt
# ─────────────────────────────────────────────────────────────────────────────
async def send_seat_addon_receipt_email(
    email: EmailStr, name: str, quantity: int, price_inr: int, new_total_seats,
) -> bool:
    """Sent right after an HQ Admin's Razorpay payment for extra admin seats
    is captured — see retailer_seat_addon_routes.py. Confirms the charge and
    the tenant's new effective seat count (or "Unlimited" for Enterprise,
    where an add-on purchase can't actually happen, but kept generic)."""
    seats_text = f"{quantity} extra admin seat{'s' if quantity != 1 else ''}"
    total_text = "Unlimited" if new_total_seats is None else str(new_total_seats)
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;">
        Your payment for <strong style="color:{SUCCESS};">{seats_text}</strong> was received and applied immediately.
      </p>
      <div style="margin:20px 0;padding:16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;">
        <p style="margin:0;color:#166534;font-size:13px;font-weight:700;">Amount charged</p>
        <p style="margin:6px 0 0;color:#052e16;font-size:20px;font-weight:800;">Rs. {price_inr:,.0f}</p>
        <p style="margin:10px 0 0;color:#166534;font-size:13px;">New total admin seats: {total_text}</p>
      </div>
      {_divider()}
      {_note("This is an automated payment receipt from CitiMart RMS.")}
    """
    return await _send(
        subject=f"Payment received — {seats_text} added",
        recipients=[email],
        html=_wrap(SUCCESS, "Payment Received", body, "© CitiMart RMS · Retailer Admin Seats"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 16. RETAILER — Extra store/branch add-on payment receipt (recurring)
# ─────────────────────────────────────────────────────────────────────────────
async def send_store_addon_receipt_email(
    email: EmailStr, name: str, quantity: int, price_inr: int, total_addon_stores: int, expires_at,
) -> bool:
    """Sent right after an HQ Admin's Razorpay payment for extra store/branch
    slots is captured — see retailer_store_addon_routes.py. Unlike the admin
    seat add-on this is a RECURRING monthly charge, so the receipt is
    explicit about the renewal date instead of implying a permanent unlock."""
    stores_text = f"{quantity} extra store/branch slot{'s' if quantity != 1 else ''}"
    expiry_text = expires_at.strftime("%d %b %Y") if hasattr(expires_at, "strftime") else str(expires_at)
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;">
        Your payment for <strong style="color:{SUCCESS};">{stores_text}</strong> was received and applied immediately.
      </p>
      <div style="margin:20px 0;padding:16px;border:1px solid #bbf7d0;background:#f0fdf4;border-radius:10px;">
        <p style="margin:0;color:#166534;font-size:13px;font-weight:700;">Amount charged</p>
        <p style="margin:6px 0 0;color:#052e16;font-size:20px;font-weight:800;">Rs. {price_inr:,.0f}</p>
        <p style="margin:10px 0 0;color:#166534;font-size:13px;">Total add-on stores: {total_addon_stores}</p>
        <p style="margin:2px 0 0;color:#166534;font-size:13px;">Renews on {expiry_text}</p>
      </div>
      <p style="font-size:13px;color:#666;margin-top:12px;">
        This is a recurring monthly charge. If it isn't renewed by the date above, stores added under this
        add-on will be deactivated automatically to bring you back within your plan's included store count.
      </p>
      {_divider()}
      {_note("This is an automated payment receipt from CitiMart RMS.")}
    """
    return await _send(
        subject=f"Payment received — {stores_text} added",
        recipients=[email],
        html=_wrap(SUCCESS, "Payment Received", body, "© CitiMart RMS · Retailer Store Add-ons"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 17. RETAILER — Store/branch add-on lapsed (auto-deactivation notice)
# ─────────────────────────────────────────────────────────────────────────────
async def send_store_addon_lapsed_email(email: EmailStr, name: str, deactivated_store_names: List[str]) -> bool:
    """Sent when sweep_lapsed_store_addons() (retailer_store_addon_routes.py)
    deactivates stores because a monthly store add-on wasn't renewed in time —
    the in-app store list only reaches an HQ Admin actively logged in, so
    this is what actually reaches someone who isn't."""
    store_list = "".join(f"<li style='margin:2px 0;'>{n}</li>" for n in deactivated_store_names)
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;">
        Your extra store/branch add-on was not renewed in time, so the following
        {'location has' if len(deactivated_store_names) == 1 else 'locations have'} been deactivated:
      </p>
      <ul style="margin:12px 0;padding-left:20px;color:#444;font-size:14px;">{store_list}</ul>
      <p style="font-size:14px;color:#555;">
        No data was deleted — sign in and purchase the add-on again to reactivate them.
      </p>
      {_divider()}
      {_note("This is an automated notice from CitiMart RMS.")}
    """
    return await _send(
        subject="Store add-on lapsed — locations deactivated",
        recipients=[email],
        html=_wrap(DANGER, "Store Add-on Lapsed", body, "© CitiMart RMS · Retailer Store Add-ons"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 18. RETAILER — Plan subscription expiring / lapsed reminder (single- and
#     multi-store alike — see retailer_subscription_routes.py)
# ─────────────────────────────────────────────────────────────────────────────
async def send_retailer_subscription_expiring_email(
    email: EmailStr, name: str, plan_label: str, days_until_expiry: int, lapsed: bool,
) -> bool:
    """Email counterpart to the in-app renewal banner — reaches an HQ/Store
    Owner who isn't actively logged in when their RMS plan is about to lapse
    or already has. Sent 14 days out (retailers get more runway than the
    7-day vendor tier reminder, since losing RMS access is more disruptive
    than losing catalogue visibility)."""
    if lapsed:
        headline = f"Your {plan_label} plan has lapsed"
        detail = "Renew now to avoid losing access to your RMS dashboard."
        color = DANGER
    else:
        headline = f"Your {plan_label} plan renews in {days_until_expiry} day{'s' if days_until_expiry != 1 else ''}"
        detail = "Renew before it expires to keep your RMS dashboard running without interruption."
        color = WARNING
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;"><strong style="color:{color};">{headline}</strong></p>
      <p style="font-size:14px;color:#555;margin-top:12px;">{detail}</p>
      {_divider()}
      {_note("This is an automated reminder from CitiMart RMS.")}
    """
    return await _send(
        subject=headline,
        recipients=[email],
        html=_wrap(color, "Subscription Reminder", body, "© CitiMart RMS · Retailer Plans"),
    )


# ─────────────────────────────────────────────────────────────────────────────
# 19. VENDOR — Subscription payment failed (Razorpay payment.failed webhook)
# ─────────────────────────────────────────────────────────────────────────────
async def send_payment_failed_email(email: EmailStr, name: str, tier_label: str, reason: str) -> bool:
    """Sent from the razorpay_webhook payment.failed branch (subscription_routes.py)
    — previously that event only updated the payment record silently, so a
    vendor whose card was declined mid-checkout never found out unless they
    happened to still be on the checkout page watching it fail live."""
    body = f"""
      <h2 style="color:#222;margin-bottom:8px;">Hi {name},</h2>
      <p style="font-size:15px;color:#444;">
        Your payment for the <strong style="color:{DANGER};">{tier_label}</strong> plan could not be completed.
      </p>
      <div style="margin:20px 0;padding:16px;border:1px solid #fecaca;background:#fef2f2;border-radius:10px;">
        <p style="margin:0;color:#991b1b;font-size:13px;font-weight:700;">Reason</p>
        <p style="margin:6px 0 0;color:#7f1d1d;font-size:14px;">{reason}</p>
      </div>
      <p style="font-size:14px;color:#555;margin-top:12px;">No charge was made. You can try again anytime from your subscription page.</p>
      {_divider()}
      {_note("This is an automated payment notice from CitiMart RMS.")}
    """
    return await _send(
        subject=f"Payment failed — {tier_label} plan",
        recipients=[email],
        html=_wrap(DANGER, "Payment Failed", body, "© CitiMart RMS · Vendor Subscriptions"),
    )