import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useState } from "react";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .rp-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0f;
    font-family: 'DM Sans', sans-serif;
    position: relative;
    overflow: hidden;
  }

  .rp-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 80% 80%, rgba(80, 60, 200, 0.16) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 20% 20%, rgba(30, 100, 210, 0.12) 0%, transparent 60%),
      radial-gradient(ellipse 40% 60% at 50% 50%, rgba(160, 60, 130, 0.07) 0%, transparent 70%);
    pointer-events: none;
  }

  .rp-root::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }

  .rp-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
    padding: 52px 44px 44px;
    background: rgba(18, 18, 28, 0.85);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px;
    backdrop-filter: blur(20px);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 32px 64px rgba(0,0,0,0.5),
      0 0 80px rgba(80, 60, 200, 0.08);
    animation: cardIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(24px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  .rp-card::before {
    content: '';
    position: absolute;
    top: 0; left: 20%; right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(100, 120, 255, 0.6), transparent);
    border-radius: 50%;
  }

  .rp-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(100, 120, 255, 0.2), rgba(60, 80, 200, 0.1));
    border: 1px solid rgba(100, 120, 255, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 28px;
    animation: iconIn 0.6s 0.1s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes iconIn {
    from { opacity: 0; transform: scale(0.8) rotate(-10deg); }
    to   { opacity: 1; transform: scale(1) rotate(0); }
  }

  .rp-icon-wrap svg {
    width: 26px;
    height: 26px;
    stroke: rgba(130, 150, 255, 0.9);
  }

  .rp-heading {
    font-family: 'Playfair Display', serif;
    font-size: 26px;
    font-weight: 500;
    color: #f0eeff;
    letter-spacing: -0.3px;
    margin-bottom: 8px;
    animation: textIn 0.6s 0.15s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .rp-sub {
    font-size: 14px;
    color: rgba(180, 170, 210, 0.6);
    line-height: 1.6;
    margin-bottom: 36px;
    font-weight: 300;
    animation: textIn 0.6s 0.2s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes textIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .rp-field {
    position: relative;
    margin-bottom: 16px;
    animation: textIn 0.6s 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .rp-label {
    display: block;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(180, 170, 210, 0.5);
    margin-bottom: 8px;
  }

  .rp-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .rp-input-icon {
    position: absolute;
    left: 16px;
    color: rgba(120, 130, 210, 0.45);
    pointer-events: none;
    display: flex;
    transition: color 0.2s;
  }

  .rp-input-wrap:focus-within .rp-input-icon {
    color: rgba(140, 160, 255, 0.8);
  }

  .rp-input {
    width: 100%;
    padding: 14px 44px 14px 44px;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 12px;
    color: #e8e2ff;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 400;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }

  .rp-input::placeholder {
    color: rgba(180, 170, 210, 0.25);
  }

  .rp-input:focus {
    border-color: rgba(100, 120, 255, 0.5);
    background: rgba(255,255,255,0.06);
    box-shadow: 0 0 0 3px rgba(100, 120, 255, 0.1);
  }

  .rp-toggle {
    position: absolute;
    right: 14px;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(140, 130, 200, 0.4);
    display: flex;
    padding: 4px;
    transition: color 0.2s;
  }

  .rp-toggle:hover {
    color: rgba(160, 150, 230, 0.75);
  }

  /* Strength meter */
  .rp-strength {
    margin-top: 10px;
    animation: textIn 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .rp-strength-bars {
    display: flex;
    gap: 4px;
    margin-bottom: 6px;
  }

  .rp-strength-bar {
    flex: 1;
    height: 3px;
    border-radius: 99px;
    background: rgba(255,255,255,0.08);
    transition: background 0.3s;
  }

  .rp-strength-bar.active-weak   { background: #f87171; }
  .rp-strength-bar.active-fair   { background: #fb923c; }
  .rp-strength-bar.active-good   { background: #facc15; }
  .rp-strength-bar.active-strong { background: #4ade80; }

  .rp-strength-label {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.05em;
    color: rgba(180, 170, 210, 0.4);
    text-transform: uppercase;
    transition: color 0.3s;
  }

  .rp-strength-label.weak   { color: #f87171; }
  .rp-strength-label.fair   { color: #fb923c; }
  .rp-strength-label.good   { color: #facc15; }
  .rp-strength-label.strong { color: #4ade80; }

  /* Rules checklist */
  .rp-rules {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 24px;
    animation: textIn 0.6s 0.28s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .rp-rule {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 300;
    color: rgba(180, 170, 210, 0.45);
    transition: color 0.25s;
  }

  .rp-rule.met {
    color: rgba(100, 220, 150, 0.8);
  }

  .rp-rule-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1.5px solid rgba(180, 170, 210, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: border-color 0.25s, background 0.25s;
  }

  .rp-rule.met .rp-rule-dot {
    border-color: rgba(80, 200, 130, 0.6);
    background: rgba(80, 200, 130, 0.15);
  }

  .rp-rule-dot svg {
    width: 9px;
    height: 9px;
    stroke: rgba(80, 200, 130, 0.9);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .rp-rule.met .rp-rule-dot svg {
    opacity: 1;
  }

  /* Invalid token */
  .rp-invalid {
    text-align: center;
  }

  .rp-invalid-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: rgba(248, 113, 113, 0.1);
    border: 1px solid rgba(248, 113, 113, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
  }

  .rp-invalid-icon svg {
    width: 28px;
    height: 28px;
    stroke: rgba(248, 113, 113, 0.8);
  }

  .rp-invalid h3 {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    color: #f0eeff;
    margin-bottom: 10px;
  }

  .rp-invalid p {
    font-size: 14px;
    color: rgba(180, 170, 210, 0.5);
    line-height: 1.65;
    font-weight: 300;
    margin-bottom: 28px;
  }

  .rp-btn {
    width: 100%;
    padding: 15px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #5c6bc0, #3f51b5);
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.02em;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    animation: textIn 0.6s 0.32s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .rp-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .rp-btn:hover:not(:disabled)::before { opacity: 1; }

  .rp-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(92, 107, 192, 0.38);
  }

  .rp-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .rp-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .rp-btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .rp-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .rp-back {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 24px;
    font-size: 13px;
    color: rgba(180, 170, 210, 0.4);
    cursor: pointer;
    background: none;
    border: none;
    font-family: 'DM Sans', sans-serif;
    transition: color 0.2s;
    width: 100%;
    animation: textIn 0.6s 0.36s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .rp-back:hover { color: rgba(200, 190, 240, 0.75); }

  /* Success */
  .rp-success {
    text-align: center;
    animation: cardIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .rp-success-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: linear-gradient(135deg, rgba(80, 200, 140, 0.2), rgba(40, 160, 100, 0.1));
    border: 1px solid rgba(80, 200, 140, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 24px;
  }

  .rp-success-icon svg {
    width: 30px;
    height: 30px;
    stroke: rgba(80, 220, 150, 0.9);
  }

  .rp-success h3 {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    color: #f0eeff;
    margin-bottom: 10px;
  }

  .rp-success p {
    font-size: 14px;
    color: rgba(180, 170, 210, 0.55);
    line-height: 1.65;
    font-weight: 300;
    margin-bottom: 28px;
  }
`;

function getStrength(pw) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
}

const RULES = [
  { label: "At least 8 characters", test: (pw) => pw.length >= 8 },
  { label: "One uppercase letter", test: (pw) => /[A-Z]/.test(pw) },
  { label: "One number",           test: (pw) => /[0-9]/.test(pw) },
  { label: "One special character",test: (pw) => /[^A-Za-z0-9]/.test(pw) },
];

const STRENGTH_META = [
  { label: "Weak",   cls: "weak" },
  { label: "Fair",   cls: "fair" },
  { label: "Good",   cls: "good" },
  { label: "Strong", cls: "strong" },
];

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [done, setDone]         = useState(false);
  const navigate = useNavigate();

  const query = new URLSearchParams(useLocation().search);
  const token = query.get("token");

  const strength  = getStrength(password);
  const allMet    = RULES.every((r) => r.test(password));
  const canSubmit = allMet && !!token && !loading;

  const handleReset = async () => {
    if (!canSubmit) return;
    try {
      setLoading(true);
      await axios.post(`${APP_API_URL}/auth/reset-password`, {
        token,
        new_password: password,
      });
      setDone(true);
    } catch (err) {
      alert(err.response?.data?.detail || "Reset failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => { if (e.key === "Enter") handleReset(); };

  // Invalid token screen
  if (!token) {
    return (
      <>
        <style>{styles}</style>
        <div className="rp-root">
          <div className="rp-card">
            <div className="rp-invalid">
              <div className="rp-invalid-icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <h3>Invalid reset link</h3>
              <p>This link is missing a token. Please request a new password reset.</p>
              <button className="rp-btn" onClick={() => navigate("/forgot-password")}>
                <span className="rp-btn-inner">Request new link</span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Success screen
  if (done) {
    return (
      <>
        <style>{styles}</style>
        <div className="rp-root">
          <div className="rp-card">
            <div className="rp-success">
              <div className="rp-success-icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h3>Password updated</h3>
              <p>Your password has been reset successfully. You can now sign in with your new credentials.</p>
              <button className="rp-btn" onClick={() => navigate("/admin/login")}>
                <span className="rp-btn-inner">
                  Go to sign in
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  const strengthMeta = strength > 0 ? STRENGTH_META[strength - 1] : null;

  return (
    <>
      <style>{styles}</style>
      <div className="rp-root">
        <div className="rp-card">
          <div className="rp-icon-wrap">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>

          <h1 className="rp-heading">Set new password</h1>
          <p className="rp-sub">Choose something strong that you haven't used before.</p>

          <div className="rp-field">
            <label className="rp-label" htmlFor="rp-pw">New password</label>
            <div className="rp-input-wrap">
              <span className="rp-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                id="rp-pw"
                className="rp-input"
                type={showPw ? "text" : "password"}
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                autoComplete="new-password"
              />
              <button className="rp-toggle" onClick={() => setShowPw((v) => !v)} tabIndex={-1} type="button">
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Strength meter */}
            {password.length > 0 && (
              <div className="rp-strength">
                <div className="rp-strength-bars">
                  {[0,1,2,3].map((i) => (
                    <div
                      key={i}
                      className={`rp-strength-bar ${i < strength ? `active-${strengthMeta?.cls}` : ""}`}
                    />
                  ))}
                </div>
                {strengthMeta && (
                  <span className={`rp-strength-label ${strengthMeta.cls}`}>
                    {strengthMeta.label}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Requirements checklist */}
          <div className="rp-rules">
            {RULES.map((rule) => {
              const met = rule.test(password);
              return (
                <div key={rule.label} className={`rp-rule ${met ? "met" : ""}`}>
                  <span className="rp-rule-dot">
                    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 6 5 9 10 3"/>
                    </svg>
                  </span>
                  {rule.label}
                </div>
              );
            })}
          </div>

          <button className="rp-btn" onClick={handleReset} disabled={!canSubmit}>
            <span className="rp-btn-inner">
              {loading ? (
                <><div className="rp-spinner"/> Resetting…</>
              ) : (
                <>
                  Reset Password
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"/>
                    <polyline points="12 5 19 12 12 19"/>
                  </svg>
                </>
              )}
            </span>
          </button>

          <button className="rp-back" onClick={() => navigate("/admin/login")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to sign in
          </button>
        </div>
      </div>
    </>
  );
}