import { API_BASE_URL as APP_API_URL } from "../../config/api.js";

import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Eye, EyeOff, ShieldCheck, CheckCircle2, AlertCircle } from "lucide-react";

/* ------------------------------------------------------------------
   Password strength — simple heuristic, no external dependency.
   Returns a 0-4 score plus a short label used for the meter below
   the field.
------------------------------------------------------------------ */
function getStrength(pw) {
  if (!pw) return { score: 0, label: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const clamped = Math.min(score, 4);
  const labels = ["Weak", "Weak", "Fair", "Good", "Strong"];
  return { score: clamped, label: labels[clamped] };
}

const STRENGTH_COLORS = ["#E11D48", "#E11D48", "#D97706", "#2563EB", "#0F9D6C"];

export default function VendorSetPassword() {
  const API_BASE_URL = `${APP_API_URL}`;
  const navigate = useNavigate();

  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const t = urlParams.get("token");
    if (!t) setError("This link is invalid or missing a token.");
    setToken(t);
  }, []);

  const strength = useMemo(() => getStrength(password), [password]);
  const matchState =
    confirm.length === 0 ? "idle" : confirm === password ? "match" : "mismatch";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!password || !confirm) {
      setError("Please fill in both fields.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/vendors/setup-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) throw new Error("Failed to set password");

      setSuccess(true);
      setTimeout(() => navigate("/merchandiser-seller/login"), 2200);
    } catch (err) {
      console.error(err);
      setError("Something went wrong. Please try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F4F6F9] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_1px_2px_rgba(16,24,40,0.04),0_12px_32px_-8px_rgba(16,24,40,0.12)]">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" strokeWidth={2} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">
            Password set
          </h2>
          <p className="mt-1.5 text-sm text-slate-500">
            Your account is ready. Taking you to sign in…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F6F9] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[920px] grid grid-cols-1 lg:grid-cols-[1fr_1.05fr] rounded-2xl overflow-hidden border border-slate-200 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_16px_40px_-12px_rgba(16,24,40,0.14)]">

        {/* Left panel — context / brand */}
        <div
          className="hidden lg:flex flex-col justify-between p-10 text-white relative overflow-hidden"
          style={{ background: "linear-gradient(160deg,#101A33 0%,#132244 55%,#0D1730 100%)" }}
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl"
            style={{ background: "radial-gradient(circle,#2E4A8C 0%,transparent 70%)" }}
          />
          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 border border-white/15 mb-8">
              <ShieldCheck className="h-5 w-5 text-sky-300" strokeWidth={2} />
            </div>
            <h1 className="text-[26px] leading-tight font-semibold tracking-tight">
              Secure your<br />vendor account
            </h1>
            <p className="mt-3 text-sm text-slate-300/90 leading-relaxed max-w-[280px]">
              This password protects order records, pricing, and every purchase
              order tied to your business. Choose one only you know.
            </p>
          </div>

          <div className="relative space-y-3">
            {[
              "Access purchase orders in real time",
              "Submit pricing and quantities directly",
              "Track approvals without email back-and-forth",
            ].map((line) => (
              <div key={line} className="flex items-start gap-2.5 text-[13px] text-slate-300/90">
                <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full bg-sky-400" />
                {line}
              </div>
            ))}
          </div>
        </div>

        {/* Right panel — form */}
        <div className="bg-white p-8 sm:p-10">
          <div className="mb-7">
            <div className="lg:hidden flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 mb-5">
              <Lock className="h-5 w-5 text-white" strokeWidth={2} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
              Set your password
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Create a password to activate your vendor dashboard login.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {/* New password */}
            <div>
              <label htmlFor="new-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-3.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-4 focus:ring-slate-100 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  aria-pressed={showPw}
                  tabIndex={0}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:text-slate-700"
                >
                  {showPw ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                </button>
              </div>

              {/* Strength meter */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-1 flex-1 rounded-full transition-colors duration-200"
                      style={{
                        background:
                          password.length > 0 && i < strength.score
                            ? STRENGTH_COLORS[strength.score]
                            : "#E2E8F0",
                      }}
                    />
                  ))}
                </div>
                <span
                  className="text-[11px] font-medium w-11 text-right"
                  style={{ color: password ? STRENGTH_COLORS[strength.score] : "#94A3B8" }}
                >
                  {strength.label || "—"}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Use 8+ characters with a mix of letters, numbers, and symbols.
              </p>
            </div>

            {/* Confirm password */}
            <div>
              <label htmlFor="confirm-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Re-enter password"
                  autoComplete="new-password"
                  className={[
                    "h-11 w-full rounded-lg border bg-white pl-3.5 pr-11 text-sm text-slate-900 outline-none transition focus:ring-4 placeholder:text-slate-400",
                    matchState === "mismatch"
                      ? "border-rose-300 focus:border-rose-400 focus:ring-rose-50"
                      : "border-slate-200 focus:border-slate-400 focus:ring-slate-100",
                  ].join(" ")}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  aria-pressed={showConfirm}
                  tabIndex={0}
                  className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none focus-visible:text-slate-700"
                >
                  {showConfirm ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} />}
                </button>
              </div>
              {matchState === "match" && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" strokeWidth={2.2} /> Passwords match
                </p>
              )}
              {matchState === "mismatch" && (
                <p className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-rose-500">
                  <AlertCircle className="h-3 w-3" strokeWidth={2.2} /> Passwords don't match yet
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-rose-500" strokeWidth={2} />
                <p className="text-[13px] text-rose-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Setting password…
                </>
              ) : (
                "Set password and continue"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}