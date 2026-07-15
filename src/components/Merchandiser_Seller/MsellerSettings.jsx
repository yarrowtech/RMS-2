import React, { useMemo, useState } from "react";
import { User, IdCard, ShieldCheck, LockKeyhole, Mail, Phone } from "lucide-react";

const cn = (...a) => a.filter(Boolean).join(" ");

const Field = ({ label, value, editable, onChange, type = "text" }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-black-700">{label}</label>

    {editable ? (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="
          w-full px-3 py-2 text-sm rounded-xl
          border border-blue-500 bg-white
          outline-none
          focus:ring-2 focus:ring-blue-500/30
          focus:border-blue-600
        "
      />
    ) : (
      <div
        className="
          w-full px-3 py-2 text-sm rounded-xl
          border border-blue-500 bg-blue-50/40
        "
      >
        {value || <span className="text-black-300">—</span>}
      </div>
    )}
  </div>
);

const Section = ({ icon: Icon, title, subtitle, right, children }) => (
  <section
    className="
      rounded-3xl
      border border-blue-500
      bg-white
      shadow-[0_30px_90px_rgba(15,23,42,0.10)]
    "
  >
    <div className="px-5 py-4 flex items-start gap-3 border-b border-blue-500">
      <div className="mt-0.5 w-10 h-10 rounded-2xl bg-blue-600/10 text-black-700 grid place-items-center">
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1">
        <h2 className="text-sm sm:text-base font-bold text-black-900">{title}</h2>
        {subtitle && <p className="text-xs sm:text-sm text-black-600">{subtitle}</p>}
      </div>

      {right && <div>{right}</div>}
    </div>

    <div className="p-5">{children}</div>
  </section>
);

export default function SettingsProfilePage() {
  const [profile, setProfile] = useState({
    fullName: "Your Name",
    email: "you@example.com",
    phone: "+91 00000 00000",
    gender: "—",
    city: "—",
  });

  const [account] = useState({
    userName: "Your Username",
    role: "Manager",
    status: "Active",
    createdAt: "—",
    lastLogin: "—",
  });

  const [pwd, setPwd] = useState({
    current: "",
    next: "",
    confirm: "",
  });

  const pwdOk = useMemo(() => {
    return pwd.current && pwd.next.length >= 8 && pwd.next === pwd.confirm;
  }, [pwd]);

  return (
    <div className="w-full bg-black-50">
      <div className="w-full px-6 py-6 space-y-6">
        <div></div>

        <Section
          icon={User}
          title="Personal Profile"
          right={
            <button
              className="
              px-4 py-2 text-sm font-semibold rounded-xl
              bg-blue-600 text-white hover:bg-blue-700
            "
            >
              Save
            </button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Full Name"
              value={profile.fullName}
              editable
              onChange={(v) => setProfile((p) => ({ ...p, fullName: v }))}
            />
            <Field
              label="Email"
              value={profile.email}
              editable
              onChange={(v) => setProfile((p) => ({ ...p, email: v }))}
            />
            <Field
              label="Phone"
              value={profile.phone}
              editable
              onChange={(v) => setProfile((p) => ({ ...p, phone: v }))}
            />
            <Field
              label="City"
              value={profile.city}
              editable
              onChange={(v) => setProfile((p) => ({ ...p, city: v }))}
            />
            <Field
              label="Gender"
              value={profile.gender}
              editable
              onChange={(v) => setProfile((p) => ({ ...p, gender: v }))}
            />

            <div className="rounded-2xl border border-blue-500 bg-blue-50/40 p-4">
              <div className="flex items-center gap-2 font-semibold text-sm text-black-700">
                <Mail className="w-4 h-4" /> Quick Contact
              </div>
              <p className="mt-2 text-xs text-black-600">
                Keep your email & phone updated for account recovery.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-black-600">
                <Phone className="w-4 h-4" /> OTP / 2FA support
              </div>
            </div>
          </div>
        </Section>

        <Section icon={IdCard} title="Account Details">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="User Name" value={account.userName} />
            <Field label="Role" value={account.role} />
            <Field label="Account Status" value={account.status} />
            <Field label="Created At" value={account.createdAt} />
            <Field label="Last Login" value={account.lastLogin} />

            <div className="rounded-2xl border border-blue-500 bg-white p-4">
              <div className="flex items-center gap-2 font-semibold text-sm text-black-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Security Tips
              </div>
              <ul className="mt-2 text-xs text-black-600 space-y-1">
                <li>• Use a strong password</li>
                <li>• Don’t reuse passwords</li>
                <li>• Enable 2FA</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          icon={LockKeyhole}
          title="Reset Password"
          right={
            <button
              disabled={!pwdOk}
              className={cn(
                "px-4 py-2 text-sm font-semibold rounded-xl",
                pwdOk
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-blue-200 text-blue-700 cursor-not-allowed"
              )}
            >
              Update Password
            </button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Current Password"
              type="password"
              value={pwd.current}
              editable
              onChange={(v) => setPwd((p) => ({ ...p, current: v }))}
            />
            <div className="hidden sm:block" />
            <Field
              label="New Password"
              type="password"
              value={pwd.next}
              editable
              onChange={(v) => setPwd((p) => ({ ...p, next: v }))}
            />
            <Field
              label="Confirm New Password"
              type="password"
              value={pwd.confirm}
              editable
              onChange={(v) => setPwd((p) => ({ ...p, confirm: v }))}
            />
          </div>
        </Section>
      </div>
    </div>
  );
}
