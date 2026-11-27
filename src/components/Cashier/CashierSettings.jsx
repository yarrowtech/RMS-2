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
    } catch (e) {
      setTerminalsError(e.message || "Failed to load terminals");
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
          icon={Monitor}
          title="This POS Terminal"
          subtitle="Identifies just this machine — separate from the shared login, so each terminal at this store can be told apart."
          right={
            <button
              onClick={saveTerminalName}
              disabled={!terminalName.trim()}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
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

          <div className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-amber-900">
              <ShieldCheck className="w-4 h-4 text-amber-700" />
              Admin instructions
            </div>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-amber-900">
              <li>Only a Store Ops / Finance / HQ login can change roles here — the shared Cashier login (and every other store department) can view this list, but any change it tries will be rejected by the server.</li>
              <li>Every new POS device starts as <span className="font-semibold">Cashier</span> (Point of Sale + Customer tabs only) the first time it's opened — nothing needs to be configured for that.</li>
              <li>To let one specific machine see Dashboard, Finance and Reports (e.g. the manager's counter, or a back-office terminal), find it in the list below by its terminal name and switch its dropdown to <span className="font-semibold">Supervisor</span>.</li>
              <li>If you don't recognize a terminal name, rename it first from <span className="font-semibold">that device</span> under Settings → This POS Terminal, then come back here — roles are easiest to assign once every device has a clear name (e.g. "Counter 1", "Billing Desk 2").</li>
              <li>A role change applies the moment that terminal reloads or switches tabs — no logout required on either side.</li>
            </ol>
          </div>

          {terminalsError && (
            <div className="mb-3 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
              {terminalsError}
            </div>
          )}
          {terminalsLoading ? (
            <p className="text-xs text-black-500">Loading terminals…</p>
          ) : terminals.length === 0 ? (
            <p className="text-xs text-black-500">No terminals registered yet — open the POS on a device once and it will appear here.</p>
          ) : (
            <div className="space-y-2">
              {terminals.map((t) => (
                <div
                  key={t.terminal_id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-blue-500 bg-blue-50/40 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-black-900">
                      {t.terminal_name}
                      {t.terminal_id === thisTerminalId && (
                        <span className="ml-2 rounded-full bg-blue-600/10 px-2 py-0.5 text-[10px] font-bold text-blue-700">THIS DEVICE</span>
                      )}
                    </p>
                    <p className="text-[11px] text-black-500">{t.role === "supervisor" ? "Supervisor — full access" : "Cashier — POS + Customer only"}</p>
                  </div>
                  <select
                    value={t.role}
                    disabled={savingTerminalId === t.terminal_id}
                    onChange={(e) => changeRole(t.terminal_id, e.target.value)}
                    className="rounded-xl border border-blue-500 bg-white px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500/30"
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
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              Manage Staff Logins
            </button>
          }
        >
          <p className="text-xs text-black-500">
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
              className="w-full sm:max-w-xs px-3 py-2 text-sm rounded-xl border border-blue-500 bg-white outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600"
            />
            <button
              onClick={saveUpiId}
              disabled={upiSaving}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 transition disabled:opacity-60"
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
