import { API_BASE_URL as APP_API_URL } from "../config/api.js";

import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

const API_BASE = APP_API_URL;

const DEPT_PATH_MAP = {
  "Cashier": "/cashier",
  "Inventory": "/inventory",
  "HR": "/hr",
  "Finance": "/finance",
  "Logistics": "/logistics",
};

const EyeOpen = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const EyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

export default function StaffLogin() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState("");

  const handleChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/staff-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail || "Login failed");
        return;
      }

      // Same localStorage keys a full admin login writes -- every existing
      // page (Cashier POS, Inventory, etc.) reads these generically and
      // does not care whether the JWT role behind them is ADMIN or STAFF.
      localStorage.setItem("admin_token", data.access_token);
      localStorage.setItem("auth_kind", "staff");
      localStorage.setItem("admin_name", data.name || "");
      localStorage.setItem("admin_scope", "store");
      localStorage.setItem("admin_active_department", data.department || "");
      localStorage.setItem("scope", "store");
      if (data.store_id) {
        localStorage.setItem("store_id", data.store_id);
        localStorage.setItem("admin_store_id", data.store_id);
      }
      if (data.store_name) {
        localStorage.setItem("store_name", data.store_name);
        localStorage.setItem("admin_store_name", data.store_name);
      }

      const path = DEPT_PATH_MAP[data.department] || "/cashier";
      navigate(path, { replace: true });
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sl-root {
          min-height: 100vh;
          display: flex;
          background: #f5f2ee;
          font-family: 'Geist', sans-serif;
        }

        .sl-left {
          display: none;
          flex: 1;
          background: #1c2b2b;
          position: relative;
          overflow: hidden;
          flex-direction: column;
          justify-content: space-between;
          padding: 52px 56px;
        }
        @media(min-width: 860px) { .sl-left { display: flex; } }

        .sl-blob {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .sl-blob-1 {
          width: 420px; height: 420px;
          background: radial-gradient(circle, #2e4a3e 0%, transparent 70%);
          top: -80px; right: -80px;
          animation: sl-float 12s ease-in-out infinite;
        }
        .sl-blob-2 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, #3d5c4a 0%, transparent 70%);
          bottom: -60px; left: -40px;
          animation: sl-float 16s ease-in-out infinite reverse;
        }
        @keyframes sl-float {
          0%,100% { transform: translateY(0px) scale(1); }
          50%      { transform: translateY(-20px) scale(1.04); }
        }

        .sl-left::before {
          content: '';
          position: absolute; inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events: none;
        }

        .sl-brand {
          position: relative; z-index: 1;
          display: flex; align-items: center; gap: 10px;
        }
        .sl-brand-mark {
          width: 32px; height: 32px; border-radius: 8px;
          background: #7aad8a;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; font-weight: 600; color: #1c2b2b;
          letter-spacing: -0.02em;
          font-family: 'Geist', sans-serif;
          flex-shrink: 0;
        }
        .sl-brand-name {
          font-size: 14px; font-weight: 500; color: #c8d8c4;
          letter-spacing: 0.01em;
        }

        .sl-copy { position: relative; z-index: 1; }

        .sl-display {
          font-family: 'Instrument Serif', serif;
          font-size: 52px; line-height: 1.05;
          color: #e8ede4;
          margin-bottom: 20px;
        }
        .sl-display em {
          font-style: italic;
          color: #7aad8a;
        }

        .sl-pills {
          position: relative; z-index: 1;
          display: flex; flex-direction: column; gap: 10px;
        }
        .sl-pill {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 16px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 10px;
          font-size: 13px; color: #7a9080; font-weight: 400;
          letter-spacing: 0.01em;
        }
        .sl-pill-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #7aad8a; flex-shrink: 0;
        }

        .sl-right {
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 40px 24px;
        }
        @media(min-width: 860px) {
          .sl-right { width: 480px; flex-shrink: 0; }
        }

        .sl-card {
          width: 100%;
          max-width: 400px;
          animation: sl-enter 0.55s cubic-bezier(0.22,1,0.36,1) both;
        }
        @keyframes sl-enter {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: none; }
        }

        .sl-card-header { margin-bottom: 40px; }

        .sl-eyebrow {
          font-size: 11px; font-weight: 500;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #7aad8a; margin-bottom: 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .sl-eyebrow::before {
          content: '';
          width: 18px; height: 1.5px;
          background: #7aad8a; border-radius: 2px;
        }

        .sl-title {
          font-family: 'Instrument Serif', serif;
          font-size: 36px; line-height: 1.1;
          color: #1c2b2b; margin-bottom: 8px;
        }

        .sl-sub {
          font-size: 13.5px; color: #8a9a90;
          line-height: 1.6; font-weight: 400;
        }

        .sl-fields { display: flex; flex-direction: column; gap: 18px; margin-bottom: 28px; }

        .sl-field { display: flex; flex-direction: column; gap: 7px; }

        .sl-label {
          font-size: 12px; font-weight: 500;
          color: #4a6155; letter-spacing: 0.03em;
        }

        .sl-input-wrap {
          position: relative;
          display: flex; align-items: center;
          border-radius: 10px;
          border: 1.5px solid #dde4dc;
          background: #fff;
          transition: border-color 0.18s, box-shadow 0.18s;
        }
        .sl-input-wrap.is-focused {
          border-color: #7aad8a;
          box-shadow: 0 0 0 3px rgba(122,173,138,0.12);
        }
        .sl-input-wrap.is-error {
          border-color: #c97a7a;
          box-shadow: 0 0 0 3px rgba(201,122,122,0.10);
        }

        .sl-input {
          flex: 1;
          padding: 12px 14px;
          background: transparent;
          border: none; outline: none;
          font-family: 'Geist', sans-serif;
          font-size: 14px; color: #1c2b2b;
          width: 100%;
          border-radius: 10px;
        }
        .sl-input::placeholder { color: #b8c8bc; }
        .sl-input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #fff inset;
          -webkit-text-fill-color: #1c2b2b;
        }

        .sl-eye {
          position: absolute; right: 12px;
          background: none; border: none; cursor: pointer;
          color: #a8bab0; padding: 4px; border-radius: 6px;
          display: flex; align-items: center;
          transition: color 0.15s, background 0.15s;
        }
        .sl-eye:hover { color: #4a6155; background: #f0f5f0; }

        .sl-error {
          font-size: 12.5px; color: #a85858;
          background: #fdf0f0;
          border: 1px solid #e8c8c8;
          border-radius: 8px;
          padding: 10px 13px;
          margin-bottom: 18px;
        }

        .sl-btn {
          width: 100%;
          padding: 13.5px;
          background: #1c2b2b;
          color: #e8ede4;
          border: none; border-radius: 10px;
          font-family: 'Geist', sans-serif;
          font-size: 14px; font-weight: 500;
          letter-spacing: 0.02em;
          cursor: pointer;
          transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
          box-shadow: 0 2px 12px rgba(28,43,43,0.18);
        }
        .sl-btn:hover:not(:disabled) {
          background: #243636;
          box-shadow: 0 4px 20px rgba(28,43,43,0.25);
          transform: translateY(-1px);
        }
        .sl-btn:active:not(:disabled) { transform: none; }
        .sl-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .sl-btn-inner { display: flex; align-items: center; justify-content: center; gap: 9px; }

        .sl-spinner {
          width: 15px; height: 15px;
          border: 1.5px solid rgba(232,237,228,0.3);
          border-top-color: #e8ede4;
          border-radius: 50%;
          animation: sl-spin 0.65s linear infinite;
        }
        @keyframes sl-spin { to { transform: rotate(360deg); } }

        .sl-footer {
          margin-top: 24px;
          text-align: center;
        }
        .sl-footer-link {
          font-size: 12.5px; color: #8a9a90;
          text-decoration: none;
          transition: color 0.15s;
          font-weight: 400;
        }
        .sl-footer-link b { color: #1c2b2b; font-weight: 600; }
        .sl-footer-link:hover { color: #4a6155; }
      `}</style>

      <div className="sl-root">

        <div className="sl-left">
          <div className="sl-blob sl-blob-1" />
          <div className="sl-blob sl-blob-2" />

          <div className="sl-brand">
            <div className="sl-brand-mark">R</div>
            <span className="sl-brand-name">RMS — Staff</span>
          </div>

          <div className="sl-copy">
            <h2 className="sl-display">
              One counter,<br />
              one <em>login.</em>
            </h2>
          </div>

          <div className="sl-pills">
            {[
              "Scoped to your store only",
              "Only the tabs your admin granted",
              "JWT-secured sessions",
            ].map((t) => (
              <div className="sl-pill" key={t}>
                <div className="sl-pill-dot" />
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="sl-right">
          <div className="sl-card">

            <div className="sl-card-header">
              <p className="sl-eyebrow">Staff Portal</p>
              <h1 className="sl-title">Sign in</h1>
              <p className="sl-sub">Use the username and password your admin set up for you.</p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="sl-fields">

                <div className="sl-field">
                  <label className="sl-label">Username</label>
                  <div className={`sl-input-wrap ${focused === "username" ? "is-focused" : ""} ${error ? "is-error" : ""}`}>
                    <input
                      className="sl-input"
                      name="username"
                      type="text"
                      value={form.username}
                      onChange={handleChange}
                      onFocus={() => setFocused("username")}
                      onBlur={() => setFocused("")}
                      required
                      autoComplete="username"
                      placeholder="priya.store2"
                    />
                  </div>
                </div>

                <div className="sl-field">
                  <label className="sl-label">Password</label>
                  <div className={`sl-input-wrap ${focused === "password" ? "is-focused" : ""} ${error ? "is-error" : ""}`}>
                    <input
                      className="sl-input"
                      name="password"
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={handleChange}
                      onFocus={() => setFocused("password")}
                      onBlur={() => setFocused("")}
                      required
                      placeholder="••••••••"
                      autoComplete="current-password"
                      style={{ paddingRight: "40px" }}
                    />
                    <button
                      type="button"
                      className="sl-eye"
                      onClick={() => setShowPass((v) => !v)}
                      tabIndex={-1}
                      aria-label={showPass ? "Hide password" : "Show password"}
                    >
                      {showPass ? <EyeOff /> : <EyeOpen />}
                    </button>
                  </div>
                </div>

              </div>

              {error && <p className="sl-error">{error}</p>}

              <button type="submit" className="sl-btn" disabled={loading}>
                <span className="sl-btn-inner">
                  {loading && <span className="sl-spinner" />}
                  {loading ? "Signing in…" : "Sign in"}
                </span>
              </button>

              <div className="sl-footer">
                <Link to="/admin/login" className="sl-footer-link">
                  Full admin? <b>Sign in here</b>
                </Link>
              </div>
            </form>

          </div>
        </div>

      </div>
    </>
  );
}
