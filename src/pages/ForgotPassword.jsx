import { API_BASE_URL as APP_API_URL } from "../config/api.js";
import React, { useState } from "react";
import axios from "axios";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500&family=DM+Sans:wght@300;400;500&display=swap');

  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  .fp-root {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #0a0a0f;
    font-family: 'DM Sans', sans-serif;
    position: relative;
    overflow: hidden;
  }

  /* Atmospheric background */
  .fp-root::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 60% 50% at 20% 80%, rgba(99, 60, 180, 0.18) 0%, transparent 60%),
      radial-gradient(ellipse 50% 40% at 80% 20%, rgba(30, 120, 200, 0.13) 0%, transparent 60%),
      radial-gradient(ellipse 40% 60% at 50% 50%, rgba(180, 80, 120, 0.07) 0%, transparent 70%);
    pointer-events: none;
  }

  /* Subtle grid */
  .fp-root::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
    background-size: 48px 48px;
    pointer-events: none;
  }

  .fp-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 420px;
    padding: 52px 44px 44px;
    background: rgba(18, 18, 28, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 24px;
    backdrop-filter: blur(20px);
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.04) inset,
      0 32px 64px rgba(0,0,0,0.5),
      0 0 80px rgba(99, 60, 180, 0.08);
    animation: cardIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  @keyframes cardIn {
    from { opacity: 0; transform: translateY(24px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }

  /* Glowing top edge */
  .fp-card::before {
    content: '';
    position: absolute;
    top: 0; left: 20%; right: 20%;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(140, 100, 255, 0.6), transparent);
    border-radius: 50%;
  }

  .fp-icon-wrap {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: linear-gradient(135deg, rgba(140, 100, 255, 0.2), rgba(80, 140, 255, 0.1));
    border: 1px solid rgba(140, 100, 255, 0.25);
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

  .fp-icon-wrap svg {
    width: 26px;
    height: 26px;
    stroke: rgba(160, 130, 255, 0.9);
  }

  .fp-heading {
    font-family: 'Playfair Display', serif;
    font-size: 26px;
    font-weight: 500;
    color: #f0eeff;
    letter-spacing: -0.3px;
    margin-bottom: 8px;
    animation: textIn 0.6s 0.15s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .fp-sub {
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

  .fp-field {
    position: relative;
    margin-bottom: 20px;
    animation: textIn 0.6s 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .fp-label {
    display: block;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(180, 170, 210, 0.5);
    margin-bottom: 8px;
  }

  .fp-input-wrap {
    position: relative;
    display: flex;
    align-items: center;
  }

  .fp-input-icon {
    position: absolute;
    left: 16px;
    color: rgba(140, 120, 200, 0.45);
    pointer-events: none;
    transition: color 0.2s;
    display: flex;
  }

  .fp-input {
    width: 100%;
    padding: 14px 16px 14px 44px;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.09);
    border-radius: 12px;
    color: #e8e2ff;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 400;
    outline: none;
    transition: border-color 0.2s, background 0.2s, box-shadow 0.2s;
  }

  .fp-input::placeholder {
    color: rgba(180, 170, 210, 0.25);
  }

  .fp-input:focus {
    border-color: rgba(140, 100, 255, 0.5);
    background: rgba(255, 255, 255, 0.06);
    box-shadow: 0 0 0 3px rgba(140, 100, 255, 0.1);
  }

  .fp-input:focus ~ .fp-input-icon,
  .fp-input-wrap:focus-within .fp-input-icon {
    color: rgba(160, 130, 255, 0.8);
  }

  .fp-btn {
    width: 100%;
    padding: 15px;
    border: none;
    border-radius: 12px;
    background: linear-gradient(135deg, #7c4dff, #5c6bc0);
    color: #fff;
    font-family: 'DM Sans', sans-serif;
    font-size: 15px;
    font-weight: 500;
    letter-spacing: 0.02em;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: opacity 0.2s, transform 0.15s, box-shadow 0.2s;
    animation: textIn 0.6s 0.3s cubic-bezier(0.22, 1, 0.36, 1) both;
    margin-top: 4px;
  }

  .fp-btn::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
    opacity: 0;
    transition: opacity 0.2s;
  }

  .fp-btn:hover:not(:disabled)::before { opacity: 1; }

  .fp-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 8px 24px rgba(124, 77, 255, 0.35);
  }

  .fp-btn:active:not(:disabled) {
    transform: translateY(0);
  }

  .fp-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .fp-btn-inner {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .fp-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .fp-back {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    margin-top: 24px;
    font-size: 13px;
    color: rgba(180, 170, 210, 0.45);
    text-decoration: none;
    cursor: pointer;
    background: none;
    border: none;
    font-family: 'DM Sans', sans-serif;
    transition: color 0.2s;
    animation: textIn 0.6s 0.35s cubic-bezier(0.22, 1, 0.36, 1) both;
    width: 100%;
  }

  .fp-back:hover {
    color: rgba(200, 190, 240, 0.75);
  }

  /* Success state */
  .fp-success {
    text-align: center;
    animation: cardIn 0.5s cubic-bezier(0.22, 1, 0.36, 1) both;
  }

  .fp-success-icon {
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

  .fp-success-icon svg {
    width: 30px;
    height: 30px;
    stroke: rgba(80, 220, 150, 0.9);
  }

  .fp-success h3 {
    font-family: 'Playfair Display', serif;
    font-size: 22px;
    color: #f0eeff;
    margin-bottom: 10px;
  }

  .fp-success p {
    font-size: 14px;
    color: rgba(180, 170, 210, 0.55);
    line-height: 1.65;
    max-width: 280px;
    margin: 0 auto 28px;
    font-weight: 300;
  }

  .fp-success p span {
    color: rgba(160, 140, 240, 0.8);
    font-weight: 400;
  }
`;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!email) return;
    try {
      setLoading(true);
      const res = await axios.post(`${APP_API_URL}/auth/forgot-password`, { email });
      setSent(true);
    } catch (err) {
      alert(err.response?.data?.detail || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSubmit();
  };

  return (
    <>
      <style>{styles}</style>
      <div className="fp-root">
        <div className="fp-card">
          {!sent ? (
            <>
              <div className="fp-icon-wrap">
                {/* Lock icon */}
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>

              <h1 className="fp-heading">Forgot your password?</h1>
              <p className="fp-sub">
                No worries. Enter your email and we'll send you a secure reset link.
              </p>

              <div className="fp-field">
                <label className="fp-label" htmlFor="fp-email">Email address</label>
                <div className="fp-input-wrap">
                  <input
                    id="fp-email"
                    className="fp-input"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoComplete="email"
                  />
                  <span className="fp-input-icon">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </span>
                </div>
              </div>

              <button className="fp-btn" onClick={handleSubmit} disabled={loading || !email}>
                <span className="fp-btn-inner">
                  {loading ? (
                    <><div className="fp-spinner" /> Sending…</>
                  ) : (
                    <>
                      Send Reset Link
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="5" y1="12" x2="19" y2="12"/>
                        <polyline points="12 5 19 12 12 19"/>
                      </svg>
                    </>
                  )}
                </span>
              </button>

              <button className="fp-back" onClick={() => {}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back to sign in
              </button>
            </>
          ) : (
            <div className="fp-success">
              <div className="fp-success-icon">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
              </div>
              <h3>Check your inbox</h3>
              <p>
                We sent a reset link to <span>{email}</span>. It expires in 15 minutes.
              </p>
              <button className="fp-btn" onClick={() => { setSent(false); setEmail(""); }}>
                <span className="fp-btn-inner">Send again</span>
              </button>
              <button className="fp-back" onClick={() => {}}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}