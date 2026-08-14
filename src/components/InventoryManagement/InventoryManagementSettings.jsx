import { useEffect, useMemo, useState } from "react";
import { User, IdCard, ShieldCheck, LockKeyhole, Mail, Phone } from "lucide-react";
import { API, getAdminToken } from "./reportUtils.js";

const cn = (...a) => a.filter(Boolean).join(" ");

async function adminFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${getAdminToken()}`, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || "Request failed.");
  return body;
}

const Field = ({ label, value, editable, onChange, type = "text" }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-700">{label}</label>
    {editable ? (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border border-blue-500 bg-white px-3 py-2 text-sm outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-500/30"
      />
    ) : (
      <div className="w-full rounded-xl border border-blue-500 bg-blue-50/40 px-3 py-2 text-sm text-slate-700">
        {value || <span className="text-slate-300">—</span>}
      </div>
    )}
  </div>
);

const Toggle = ({ label, checked, onChange }) => (
  <label className="flex items-center justify-between rounded-xl border border-blue-500 bg-white px-3 py-2.5 text-sm">
    <span className="font-semibold text-slate-700">{label}</span>
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-blue-600" />
  </label>
);

const Section = ({ icon: Icon, title, subtitle, right, children }) => (
  <section className="rounded-3xl border border-blue-500 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.10)]">
    <div className="flex items-start gap-3 border-b border-blue-500 px-5 py-4">
      <div className="mt-0.5 grid h-10 w-10 place-items-center rounded-2xl bg-blue-600/10 text-slate-700">
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <h2 className="text-sm font-bold text-slate-900 sm:text-base">{title}</h2>
        {subtitle && <p className="text-xs text-slate-600 sm:text-sm">{subtitle}</p>}
      </div>
      {right && <div>{right}</div>}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

export default function SettingsProfilePage() {
  const [profile, setProfile] = useState({ name: "", email: "", phone: "", city: "", notification_email: true, notification_whatsapp: false });
  const [access, setAccess] = useState({ department: "", scope: "", store_name: "", managed_departments: [], permissions: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [profileErr, setProfileErr] = useState("");

  const [pwd, setPwd] = useState({ current: "", next: "", confirm: "" });
  const [savingPwd, setSavingPwd] = useState(false);
  const [pwdMsg, setPwdMsg] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true); setLoadError("");
      try {
        const body = await adminFetch("/admin/settings");
        if (cancelled) return;
        setProfile((p) => ({ ...p, ...body.profile }));
        setAccess(body.access || {});
      } catch (err) {
        if (!cancelled) setLoadError(err.message || "Could not load your settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const saveProfile = async () => {
    setSavingProfile(true); setProfileMsg(""); setProfileErr("");
    try {
      await adminFetch("/admin/settings/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profile.name, phone: profile.phone, city: profile.city,
          notification_email: profile.notification_email, notification_whatsapp: profile.notification_whatsapp,
        }),
      });
      setProfileMsg("Profile saved.");
    } catch (err) {
      setProfileErr(err.message || "Could not save profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const pwdOk = useMemo(() => pwd.current && pwd.next.length >= 8 && pwd.next === pwd.confirm, [pwd]);

  const updatePassword = async () => {
    if (!pwdOk) return;
    setSavingPwd(true); setPwdMsg(""); setPwdErr("");
    try {
      await adminFetch("/admin/settings/password", {
        method: "PATCH",
        body: JSON.stringify({ current_password: pwd.current, new_password: pwd.next }),
      });
      setPwdMsg("Password updated.");
      setPwd({ current: "", next: "", confirm: "" });
    } catch (err) {
      setPwdErr(err.message || "Could not update password.");
    } finally {
      setSavingPwd(false);
    }
  };

  return (
    <div className="w-full bg-slate-50">
      <div className="w-full space-y-6 px-6 py-6">
        {loading && <p className="text-sm text-slate-500">Loading your settings…</p>}
        {loadError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{loadError}</div>}

        {!loading && !loadError && (
          <>
            <Section
              icon={User}
              title="Personal Profile"
              right={
                <button onClick={saveProfile} disabled={savingProfile} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                  {savingProfile ? "Saving…" : "Save"}
                </button>
              }
            >
              {profileMsg && <p className="mb-3 text-xs font-bold text-emerald-700">{profileMsg}</p>}
              {profileErr && <p className="mb-3 text-xs font-bold text-rose-700">{profileErr}</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Full Name" value={profile.name} editable onChange={(v) => setProfile((p) => ({ ...p, name: v }))} />
                <Field label="Email" value={profile.email} />
                <Field label="Phone" value={profile.phone} editable onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} />
                <Field label="City" value={profile.city} editable onChange={(v) => setProfile((p) => ({ ...p, city: v }))} />
                <Toggle label="Email notifications" checked={profile.notification_email} onChange={(v) => setProfile((p) => ({ ...p, notification_email: v }))} />
                <Toggle label="WhatsApp notifications" checked={profile.notification_whatsapp} onChange={(v) => setProfile((p) => ({ ...p, notification_whatsapp: v }))} />

                <div className="rounded-2xl border border-blue-500 bg-blue-50/40 p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Mail className="h-4 w-4" /> Quick Contact
                  </div>
                  <p className="mt-2 text-xs text-slate-600">Keep your email & phone updated for account recovery.</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                    <Phone className="h-4 w-4" /> {profile.phone || "No phone on file yet"}
                  </div>
                </div>
              </div>
            </Section>

            <Section icon={IdCard} title="Account Details">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Department" value={access.department} />
                <Field label="Scope" value={access.scope === "hq" ? "HQ (all stores)" : access.store_name ? `Store — ${access.store_name}` : "Store"} />
                <Field label="Managed departments" value={(access.managed_departments || []).join(", ") || "—"} />
                <Field label="Permissions" value={(access.permissions || []).length ? `${access.permissions.length} granted` : "—"} />

                <div className="rounded-2xl border border-blue-500 bg-white p-4 sm:col-span-2">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" /> Security Tips
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-slate-600">
                    <li>• Use a strong password</li>
                    <li>• Don't reuse passwords across accounts</li>
                    <li>• Log out on shared devices</li>
                  </ul>
                </div>
              </div>
            </Section>

            <Section
              icon={LockKeyhole}
              title="Reset Password"
              right={
                <button
                  onClick={updatePassword}
                  disabled={!pwdOk || savingPwd}
                  className={cn("rounded-xl px-4 py-2 text-sm font-semibold", pwdOk && !savingPwd ? "bg-blue-600 text-white hover:bg-blue-700" : "cursor-not-allowed bg-blue-200 text-blue-700")}
                >
                  {savingPwd ? "Updating…" : "Update Password"}
                </button>
              }
            >
              {pwdMsg && <p className="mb-3 text-xs font-bold text-emerald-700">{pwdMsg}</p>}
              {pwdErr && <p className="mb-3 text-xs font-bold text-rose-700">{pwdErr}</p>}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Current Password" type="password" value={pwd.current} editable onChange={(v) => setPwd((p) => ({ ...p, current: v }))} />
                <div className="hidden sm:block" />
                <Field label="New Password" type="password" value={pwd.next} editable onChange={(v) => setPwd((p) => ({ ...p, next: v }))} />
                <Field label="Confirm New Password" type="password" value={pwd.confirm} editable onChange={(v) => setPwd((p) => ({ ...p, confirm: v }))} />
              </div>
              {pwd.next && pwd.next.length < 8 && <p className="mt-2 text-[11px] font-semibold text-amber-700">New password must be at least 8 characters.</p>}
              {pwd.confirm && pwd.next !== pwd.confirm && <p className="mt-2 text-[11px] font-semibold text-rose-700">Passwords don't match.</p>}
            </Section>
          </>
        )}
      </div>
    </div>
  );
}
