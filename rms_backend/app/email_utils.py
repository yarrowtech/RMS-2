
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
from pydantic import EmailStr
from typing import List
from app.config import settings

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
    return f"""
    <div style="text-align:center;margin:28px 0;">
      <a href="{link}" style="background:{color};color:#fff;text-decoration:none;
         padding:12px 28px;font-size:15px;border-radius:6px;display:inline-block;">
        {label}
      </a>
    </div>
    <p style="font-size:12px;color:#aaa;word-break:break-all;background:#f8f9fa;
              padding:10px;border-radius:6px;">{link}</p>
    """

def _divider() -> str:
    return '<hr style="border:none;border-top:1px solid #eee;margin:28px 0;">'

def _note(text: str) -> str:
    return f'<p style="font-size:12px;color:#999;text-align:center;">{text}</p>'

async def _send(subject: str, recipients: List[str], html: str):
    if not conf:
        print("⚠️  Skipping email — SMTP not configured.")
        return
    try:
        fm = FastMail(conf)
        await fm.send_message(MessageSchema(
            subject=subject, recipients=recipients, body=html, subtype="html"
        ))
        print(f"📧 Sent: {subject} → {', '.join(recipients)}")
    except Exception as e:
        print(f"❌ Email failed [{subject}]: {e}")


# ─────────────────────────────────────────────────────────────────────────────
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
    email: EmailStr, name: str, link: str
):
    """Password reset link for any admin user."""
    body = f"""
      <h2 style="color:#222;">Hello, {name}</h2>
      <p style="font-size:15px;color:#444;">
        We received a request to reset your CitiMart RMS password.
      </p>
      {_btn(link, "🔐 Reset Password", DANGER)}
      {_divider()}
      {_note("If you didn't request this, you can safely ignore this email. The link expires in 1 hour.")}
    """
    await _send(
        subject="Reset your CitiMart RMS password",
        recipients=[email],
        html=_wrap(DANGER, "Password Reset Request", body),
    )