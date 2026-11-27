import React, { useEffect, useMemo, useState } from "react";
import { User, IdCard, ShieldCheck, LockKeyhole, Mail, Phone, Monitor, Users, QrCode } from "lucide-react";
import { getTerminalName, setTerminalName, getTerminalId } from "./terminalIdentity";
import { CASHIER_API_BASE as API_BASE, cashierFetch } from "./cashierApi";
import CashierGuideModal, { GuideButton } from "./CashierGuideModal";
import { Lock, MonitorCog } from "lucide-react";
import StaffLoginsPanel from "../Admin/StaffLoginsPanel.jsx";

const TERMINAL_ACCESS_GUIDE_STEPS = [
  {
    icon: MonitorCog,
    badgeClass: "bg-violet-100 text-violet-600",
    title: "Access is per-terminal, not per-login",
    text: "The Cashier login is shared across every POS machine at this store, so it can't tell devices apart. Each physical terminal below is given its own access level instead, independent of who's signed in on it.",
  },
  {
    icon: Lock,
    badgeClass: "bg-rose-100 text-rose-600",
    title: "'Cashier' is the safe default",
    text: "Every new terminal starts as Cashier — Point of Sale + Customer only. Dashboard, Finance and Reports stay hidden until you explicitly upgrade that one machine.",
  },
  {
    icon: ShieldCheck,
    badgeClass: "bg-emerald-100 text-emerald-600",
    title: "Switch a specific machine to Supervisor",
    text: "Use the dropdown next to a terminal (e.g. the manager's counter) to grant it full access. It takes effect the next time that device loads or switches tabs — no re-login needed, and it's enforced on the server too, not just hidden in the UI.",
  },
];

const cn = (...a) => a.filter(Boolean).join(" ");

const Field = ({ label, value, editable, onChange, type = "text" }) => (
  <div className="space-y-1.5">
    <label className="text-xs font-semibold text-slate-700">{label}</label>

    {editable ? (
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className="
          w-full px-3 py-2 text-sm rounded-xl
          border border-slate-200 bg-white
          outline-none
          focus:ring-2 focus:ring-violet-500/20
          focus:border-violet-500
        "
      />
    ) : (
      <div
        className="
          w-full px-3 py-2 text-sm rounded-xl
          border border-slate-200 bg-slate-50
        "
      >
        {value || <span className="text-slate-400">—</span>}
      </div>
    )}
  </div>
);

const Section = ({ icon, title, subtitle, right, children }) => (
  <section
    id={`settings-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
    className="
      rounded-2xl
      border border-slate-200
      bg-white
      scroll-mt-5 shadow-sm
    "
  >
    <div className="flex items-start gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600">
        {React.createElement(icon, { className: "h-[18px] w-[18px]" })}
      </div>

      <div className="flex-1">
        <h2 className="text-base font-semibold tracking-tight text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-500 sm:text-sm">{subtitle}</p>}
      </div>

      {right && <div>{right}</div>}
    </div>

    <div className="p-5 sm:p-6">{children}</div>
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

  // Identifies this physical machine, not the login — a store's shared
  // cashier login is used on several POS terminals, so this name lives
  // only in this device's own storage, separate from the account.
  const [terminalName, setTerminalNameState] = useState(() => getTerminalName());
  const [terminalSaved, setTerminalSaved] = useState(false);
  const saveTerminalName = () => {
    const clean = setTerminalName(terminalName);
    setTerminalNameState(clean);
    setTerminalSaved(true);
    setTimeout(() => setTerminalSaved(false), 2000);
  };

  // Access roles for every POS terminal registered at this store — lets a
  // store/HQ admin grant a specific machine (e.g. the manager's counter)
  // full Dashboard/Finance/Reports access, while every other terminal
  // stays locked to Point of Sale + Customer, regardless of which shared
  // cashier login is used to sign in on it.
  const [terminals, setTerminals] = useState([]);
  const [canManageTerminalRoles, setCanManageTerminalRoles] = useState(false);
  const [terminalsLoading, setTerminalsLoading] = useState(true);
  const [terminalsError, setTerminalsError] = useState("");
  const [savingTerminalId, setSavingTerminalId] = useState("");
  const [showTerminalGuide, setShowTerminalGuide] = useState(false);
  const thisTerminalId = getTerminalId();

  const loadTerminals = async () => {
    setTerminalsLoading(true);
    setTerminalsError("");
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/terminals`);
      if (!res.ok) throw new Error("Failed to load terminals");
      const json = await res.json();
      setTerminals(json?.data || []);
      setCanManageTerminalRoles(json?.can_manage_roles === true);
    } catch (e) {
      setTerminalsError(e.message || "Failed to load terminals");
      setCanManageTerminalRoles(false);
    } finally {
      setTerminalsLoading(false);
    }
  };

  useEffect(() => { loadTerminals(); }, []);

  // Lets THIS store's own admin create staff logins (e.g. a cashier login
  // for one counter) without needing HQ to do it from the central Admin
  // Management page. Scoped to this admin's own store + own permissions --
  // the backend independently enforces both regardless of what's sent.
  const [showStaffLogins, setShowStaffLogins] = useState(false);
  const [ownPermissions, setOwnPermissions] = useState(null);
  const storeId = localStorage.getItem("store_id") || localStorage.getItem("admin_store_id") || "";
  const storeName = localStorage.getItem("store_name") || localStorage.getItem("admin_store_name") || "";

  useEffect(() => {
    (async () => {
      try {
        const res = await cashierFetch(`${API_BASE}/auth/me`);
        if (res.ok) {
          const data = await res.json();
          setOwnPermissions(Array.isArray(data.permissions) ? data.permissions : []);
        }
      } catch {
        setOwnPermissions([]);
      }
    })();
  }, []);

  // Store's own UPI ID -- shown as a scan-to-pay QR on the billing screen
  // whenever UPI is picked as the payment method. Blank by default; the
  // POS screen just shows a plain text instruction until this is set.
  const [upiId, setUpiId] = useState("");
  const [upiSaved, setUpiSaved] = useState(null); // null | true | false
  const [upiSaving, setUpiSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await cashierFetch(`${API_BASE}/cashier/store-upi`);
        if (res.ok) {
          const data = await res.json();
          setUpiId(data.upi_id || "");
        }
      } catch { /* leave blank -- not fatal */ }
    })();
  }, []);

  const saveUpiId = async () => {
    setUpiSaving(true);
    setUpiSaved(null);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/store-upi`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upi_id: upiId.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to save");
      }
      setUpiSaved(true);
    } catch {
      setUpiSaved(false);
    } finally {
      setUpiSaving(false);
      setTimeout(() => setUpiSaved(null), 2500);
    }
  };

  const changeRole = async (terminalId, role) => {
    setSavingTerminalId(terminalId);
    try {
      const res = await cashierFetch(`${API_BASE}/cashier/terminals/${encodeURIComponent(terminalId)}/role`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || "Failed to update role");
      }
      setTerminals((prev) => prev.map((t) => (t.terminal_id === terminalId ? { ...t, role } : t)));
    } catch (e) {
      setTerminalsError(e.message || "Failed to update role");
    } finally {
      setSavingTerminalId("");
    }
  };

  return (
    <div className="w-full bg-slate-50/70">
      <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <div className="px-1 pb-2 pt-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-violet-600">Cashier workspace</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your account, terminal and store preferences.</p>
        </div>
        <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto pb-1">
          {[["Profile", "personal-profile"], ["Account", "account-details"], ["Terminal", "this-pos-terminal"], ["Access", "pos-terminal-access"], ["Staff", "staff-logins"], ["Payments", "payments"], ["Password", "reset-password"]].map(([label, id]) => (
            <a key={id} href={`#settings-${id}`} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-violet-200 hover:text-violet-700">{label}</a>
          ))}
        </nav>

        <Section
          icon={User}
          title="Personal Profile"
          right={
            <button
              className="
              px-4 py-2 text-sm font-semibold rounded-xl
              bg-violet-600 text-white hover:bg-violet-700
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

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-700">
                <Mail className="w-4 h-4" /> Quick Contact
              </div>
              <p className="mt-2 text-xs text-slate-600">
                Keep your email & phone updated for account recovery.
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
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

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center gap-2 font-semibold text-sm text-slate-700">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                Security Tips
              </div>
              <ul className="mt-2 text-xs text-slate-600 space-y-1">
                <li>• Use a strong password</li>
                <li>• Don’t reuse passwords</li>
                <li>• Enable 2FA</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          icon={Monitor}
          title="This POS Terminal"
          subtitle="Identifies just this machine — separate from the shared login, so each terminal at this store can be told apart."
          right={
            <button
              onClick={saveTerminalName}
              disabled={!terminalName.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
            >
              {terminalSaved ? "Saved" : "Save"}
            </button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Terminal Name (e.g. Counter 1)"
              value={terminalName}
              editable
              onChange={(v) => setTerminalNameState(v)}
            />
          </div>
        </Section>

        <Section
          icon={Users}
          title="POS Terminal Access"
          subtitle="Dashboard, Finance and Reports are hidden by default on every POS terminal. Grant 'Supervisor' here to the specific machine(s) that should see them."
          right={<GuideButton onClick={() => setShowTerminalGuide(true)} />}
        >
          <CashierGuideModal
            open={showTerminalGuide}
            onClose={() => setShowTerminalGuide(false)}
            title="POS Terminal Access"
            subtitle="How per-terminal roles work"
            steps={TERMINAL_ACCESS_GUIDE_STEPS}
          />

          <div className="mb-5 flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">Access is managed per terminal</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">Store Ops and Finance can change roles here. HQ can use Admin Management → POS Terminal Access. Reload the device after changing its role.</p>
            </div>
          </div>

          {terminalsError && (
            <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {terminalsError}
            </div>
          )}
          {terminalsLoading ? (
            <p className="text-xs text-slate-500">Loading terminals…</p>
          ) : terminals.length === 0 ? (
            <p className="text-xs text-slate-500">No terminals registered yet — open the POS on a device once and it will appear here.</p>
          ) : (
            <div className="space-y-2">
              {terminals.map((t) => (
                <div
                  key={t.terminal_id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {t.terminal_name}
                      {t.terminal_id === thisTerminalId && (
                        <span className="ml-2 rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-bold text-blue-700">THIS DEVICE</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-500">{t.role === "supervisor" ? "Supervisor — full access" : "Cashier — POS + Customer only"}</p>
                  </div>
                  <select
                    value={t.role}
                    disabled={!canManageTerminalRoles || savingTerminalId === t.terminal_id}
                    aria-label={`Access for ${t.terminal_name}`}
                    title={canManageTerminalRoles ? "Change terminal access" : "Only a store manager or HQ can change terminal access"}
                    onChange={(e) => changeRole(t.terminal_id, e.target.value)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="cashier">Cashier</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          icon={Users}
          title="Staff Logins"
          subtitle="Create a username + password login for one of your counters or team members -- no email needed, limited to the tabs you choose."
          right={
            <button
              onClick={() => setShowStaffLogins(true)}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition"
            >
              Manage Staff Logins
            </button>
          }
        >
          <p className="text-xs text-slate-500">
            These logins are scoped to this store ({storeName || storeId || "your store"}) and can only be given tabs you yourself have access to.
          </p>
        </Section>

        {showStaffLogins && (
          <StaffLoginsPanel
            fixedStoreId={storeId}
            fixedStoreName={storeName}
            allowedPermissions={ownPermissions || []}
            onClose={() => setShowStaffLogins(false)}
          />
        )}

        <Section
          icon={QrCode}
          title="Payments"
          subtitle="Set this store's UPI ID so billing can show a scan-to-pay QR code whenever a customer pays by UPI."
        >
          <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              Only a Store Ops / Finance / HQ login can save this
            </div>
            <p className="mt-1 text-xs text-amber-900">
              Every other login (including the shared Cashier login) can see this field, but saving will be rejected by the server.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yourstore@okaxis"
              className="w-full sm:max-w-xs px-3 py-2 text-sm rounded-xl border border-slate-200 bg-white outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500"
            />
            <button
              onClick={saveUpiId}
              disabled={upiSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-60"
            >
              {upiSaving ? "Saving…" : "Save"}
            </button>
            {upiSaved === true && <span className="text-xs font-bold text-emerald-600">Saved ✓</span>}
            {upiSaved === false && <span className="text-xs font-bold text-rose-600">Could not save</span>}
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
                  ? "bg-violet-600 text-white hover:bg-violet-700"
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
