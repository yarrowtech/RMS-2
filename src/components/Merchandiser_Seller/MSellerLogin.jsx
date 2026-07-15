import { API_BASE_URL as APP_API_URL } from "../../config/api.js";
import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  LockKeyhole,
  LogIn,
  Mail,
  ShieldCheck,
  Store,
  UserPlus,
} from "lucide-react";

const API_BASE = APP_API_URL;

const MSellerLogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (event) => {
    setFormData((previous) => ({ ...previous, [event.target.name]: event.target.value }));
    if (error) setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_BASE}/api/vendors/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.detail || "Invalid email or password.");
        return;
      }

      localStorage.removeItem("admin_token");
      localStorage.removeItem("token");
      localStorage.removeItem("access_token");
      localStorage.setItem("vendor_token", data.access_token);
      localStorage.setItem("vendor_id", data.vendor_id);
      localStorage.setItem("role", "VENDOR");
      window.location.replace(data.redirect || "/merchandiser-seller");
    } catch {
      setError("Unable to connect to RMS. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f6f8fc] text-slate-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.14),transparent_36%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

      <header className="relative z-20 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <a href="/" className="flex items-center gap-3" aria-label="RMS home">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/15">
            <Store size={21} />
          </span>
          <span>
            <span className="block text-base font-extrabold tracking-tight text-slate-950">RMS</span>
            <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Partner Portal</span>
          </span>
        </a>
        <a href="/" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3.5 py-2 text-xs font-bold text-slate-600 shadow-sm transition hover:border-emerald-200 hover:text-emerald-700">
          <ArrowLeft size={15} />
          Back to RMS
        </a>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100vh-108px)] w-full max-w-7xl items-center gap-10 px-5 pb-12 sm:px-8 lg:grid-cols-[1.04fr_0.96fr] lg:px-10">
        <section className="hidden overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-[#102b2c] to-emerald-950 p-10 text-white shadow-2xl shadow-emerald-950/20 lg:block">
          <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-300">
            <ShieldCheck size={16} />
            Approved partners only
          </div>
          <h1 className="mt-7 max-w-lg text-4xl font-black leading-[1.1] tracking-[-0.04em]">
            Your business connection to the RMS retail network.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-emerald-50/65">
            Access retailer enquiries, maintain your catalogue, manage orders and keep communication in one secure partner workspace.
          </p>

          <div className="mt-10 grid gap-3">
            {[
              "Maintain your verified company and catalogue profile",
              "Receive and respond to retailer requirements",
              "Track purchase orders and business activity",
              "Connect through secure WhatsApp communication",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3.5 text-sm font-semibold text-emerald-50/85">
                <CheckCircle2 size={17} className="shrink-0 text-emerald-400" />
                {item}
              </div>
            ))}
          </div>

          <div className="mt-10 border-t border-white/10 pt-6">
            <p className="text-xs text-emerald-100/50">New vendor, wholesaler, exporter or manufacturer?</p>
            <a href="/merchandiser-seller/register" className="mt-3 inline-flex items-center gap-2 text-sm font-extrabold text-emerald-300 transition hover:text-white">
              Apply to join RMS <ArrowRight size={16} />
            </a>
          </div>
        </section>

        <section className="mx-auto w-full max-w-md">
          <div className="rounded-[2rem] border border-white bg-white/95 p-6 shadow-[0_24px_80px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/70 backdrop-blur-xl sm:p-8">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
              <LockKeyhole size={21} />
            </div>
            <p className="mt-6 text-[10px] font-extrabold uppercase tracking-[0.2em] text-emerald-600">Seller workspace</p>
            <h2 className="mt-2 text-3xl font-black tracking-[-0.035em] text-slate-950">Welcome back</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Sign in using the email and password linked to your approved partner account.</p>

            <form onSubmit={handleSubmit} className="mt-7 space-y-5">
              <div>
                <label htmlFor="seller-email" className="mb-2 block text-xs font-extrabold text-slate-700">Email address</label>
                <div className="relative">
                  <Mail size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="seller-email"
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="name@company.com"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label htmlFor="seller-password" className="text-xs font-extrabold text-slate-700">Password</label>
                  <a href="/forgot-password" className="text-xs font-bold text-emerald-700 transition hover:text-emerald-800">Forgot password?</a>
                </div>
                <div className="relative">
                  <LockKeyhole size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="seller-password"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    required
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-11 pr-12 text-sm font-medium text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold leading-5 text-rose-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-65"
              >
                {loading ? (
                  <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> Signing in securely...</>
                ) : (
                  <><LogIn size={18} /> Sign in to Partner Portal</>
                )}
              </button>
            </form>

            <div className="mt-7 border-t border-slate-100 pt-6 text-center">
              <p className="text-sm text-slate-500">Not registered with RMS?</p>
              <a href="/merchandiser-seller/register" className="mt-3 inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-extrabold text-emerald-700 transition hover:bg-emerald-100">
                <UserPlus size={16} /> Register as a Partner
              </a>
            </div>
          </div>

          <p className="mt-5 text-center text-[11px] font-medium text-slate-400">
            © {new Date().getFullYear()} RMS · Secure vendor access
          </p>
        </section>
      </main>
    </div>
  );
};

export default MSellerLogin;