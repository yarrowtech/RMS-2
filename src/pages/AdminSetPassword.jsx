import { API_BASE_URL as APP_API_URL } from "../config/api.js";

// pages/AdminSetPassword.jsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { handleAuthRedirect } from "../utils/authRedirect";

const API_BASE = APP_API_URL;

// ── Eye icons ──────────────────────────────────────────────────────────────
const EyeOpen = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);
const EyeOff = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
    <line x1="1" y1="1" x2="23" y2="23"/>
  </svg>
);

// ── Password strength ──────────────────────────────────────────────────────
function getStrength(pw) {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak",   color: "#ff4d6d" };
  if (score <= 3) return { score, label: "Medium",  color: "#f9a826" };
  return              { score, label: "Strong",  color: "#06d6a0" };
}

export default function AdminSetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token          = searchParams.get("token") || "";

  const [form, setForm]       = useState({ new_password: "", confirm: "" });
  const [show, setShow]       = useState({ new_password: false, confirm: false });
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);
  const [tokenOk, setTokenOk] = useState(true);
  const [mounted, setMounted] = useState(false);
  const canvasRef             = useRef(null);

  useEffect(() => { if (!token) setTokenOk(false); }, [token]);
  useEffect(() => { setMounted(true); }, []);

  // ── Particle canvas ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let raf;

    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", resize);

    const pts = Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      r: Math.random() * 1.6 + 0.5, hue: Math.random() * 360,
    }));

    let t = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.003;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j];
          const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.strokeStyle = `hsla(${(p.hue + t * 40) % 360},80%,65%,${(1 - d / 130) * 0.3})`;
            ctx.lineWidth = 0.7;
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(p.hue + t * 60) % 360},80%,70%,0.85)`;
        ctx.fill();
      }
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (form.new_password !== form.confirm) { setError("Passwords do not match."); return; }
    if (form.new_password.length < 8)       { setError("Password must be at least 8 characters."); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/auth/set-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: form.new_password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.detail || "Failed to set password."); return; }

      // Save store context — same as login
      localStorage.setItem("store_id",   data.store_id   || "");
      localStorage.setItem("store_name", data.store_name || "");
      localStorage.setItem("store_type", data.store_type || "");
      localStorage.setItem("scope",      data.scope      || "hq");

      handleAuthRedirect(data, navigate);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const strength = getStrength(form.new_password);

  // ── Invalid token screen ───────────────────────────────────────────────────
  if (!tokenOk) {
    return (
      <>
        <style>{pageCSS}</style>
        <div className="sp-root">
          <div className="sp-aurora">
            <div className="sp-ab sp-ab1" /><div className="sp-ab sp-ab2" />
            <div className="sp-ab sp-ab3" /><div className="sp-ab sp-ab4" />
          </div>
          <canvas ref={canvasRef} className="sp-canvas" />
          <div className="sp-overlay" />
          <div className="sp-card visible">
            <div className="sp-card-inner">
              <div className="sp-icon-wrap">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ff4d6d" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <h2 className="sp-heading">Invalid Link</h2>
              <p className="sp-sub">This setup link is missing or expired.<br/>Please contact your Super Admin.</p>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{pageCSS}</style>
      <div className="sp-root">
        {/* Aurora blobs */}
        <div className="sp-aurora">
          <div className="sp-ab sp-ab1" /><div className="sp-ab sp-ab2" />
          <div className="sp-ab sp-ab3" /><div className="sp-ab sp-ab4" />
        </div>
        <canvas ref={canvasRef} className="sp-canvas" />
        <div className="sp-overlay" />

        {/* Card */}
        <div className={`sp-card ${mounted ? "visible" : ""}`}>
          <div className="sp-card-inner">

            {/* Icon */}
            <div className="sp-icon-wrap">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>

            <h1 className="sp-heading">Set Your Password</h1>
            <p className="sp-sub">Create a secure password to activate your admin account.</p>

            <form onSubmit={handleSubmit} className="sp-form">

              {/* New Password */}
              <div className="sp-field">
                <label className="sp-label">New Password</label>
                <div className="sp-input-wrap">
                  <input
                    className="sp-input"
                    name="new_password"
                    type={show.new_password ? "text" : "password"}
                    value={form.new_password}
                    onChange={handleChange}
                    required minLength={8}
                    placeholder="Minimum 8 characters"
                    style={{ paddingRight: "42px" }}
                  />
                  <button type="button" className="sp-eye" tabIndex={-1}
                    onClick={() => setShow(s => ({ ...s, new_password: !s.new_password }))}>
                    {show.new_password ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>

                {/* Strength bar */}
                {form.new_password && (
                  <div className="sp-strength">
                    <div className="sp-bars">
                      {[1,2,3,4,5].map(i => (
                        <div key={i} className="sp-bar"
                          style={{ background: i <= strength.score ? strength.color : "rgba(255,255,255,0.1)", transition: "background 0.3s" }}
                        />
                      ))}
                    </div>
                    <span className="sp-strength-label" style={{ color: strength.color }}>{strength.label}</span>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div className="sp-field">
                <label className="sp-label">Confirm Password</label>
                <div className="sp-input-wrap">
                  <input
                    className="sp-input"
                    name="confirm"
                    type={show.confirm ? "text" : "password"}
                    value={form.confirm}
                    onChange={handleChange}
                    required
                    placeholder="Repeat your password"
                    style={{ paddingRight: "42px" }}
                  />
                  <button type="button" className="sp-eye" tabIndex={-1}
                    onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}>
                    {show.confirm ? <EyeOff /> : <EyeOpen />}
                  </button>
                </div>

                {/* Match indicator */}
                {form.confirm && (
                  <p className="sp-match" style={{ color: form.new_password === form.confirm ? "#06d6a0" : "#ff4d6d" }}>
                    {form.new_password === form.confirm ? "✓ Passwords match" : "✗ Passwords do not match"}
                  </p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="sp-error-box">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="sp-btn" disabled={loading || !token}>
                <span className="sp-btn-inner">
                  {loading && <span className="sp-spinner" />}
                  {loading ? "Saving…" : "Set Password & Continue"}
                </span>
              </button>

            </form>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────
const pageCSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;600;700;800&family=Syne:wght@600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .sp-root {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    position: relative; overflow: hidden;
    background: #07080f;
    font-family: 'Cabinet Grotesk', sans-serif;
  }

  /* ── Aurora ── */
  .sp-aurora { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .sp-ab { position: absolute; border-radius: 50%; filter: blur(88px); opacity: 0.5; }
  .sp-ab1 { width: 600px; height: 600px; background: radial-gradient(circle,#7c3aed,#4f46e5); top:-180px; left:-180px; animation: sp-d1 20s ease-in-out infinite; }
  .sp-ab2 { width: 550px; height: 550px; background: radial-gradient(circle,#06b6d4,#0ea5e9); bottom:-150px; right:-150px; animation: sp-d2 24s ease-in-out infinite; }
  .sp-ab3 { width: 420px; height: 420px; background: radial-gradient(circle,#ec4899,#f43f5e); top:40%; left:58%; animation: sp-d3 17s ease-in-out infinite; }
  .sp-ab4 { width: 350px; height: 350px; background: radial-gradient(circle,#10b981,#06d6a0); bottom:20%; left:5%; animation: sp-d1 19s ease-in-out infinite reverse; }

  @keyframes sp-d1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(50px,-35px) scale(1.07)} 66%{transform:translate(-25px,45px) scale(0.96)} }
  @keyframes sp-d2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-45px,35px) scale(1.05)} 66%{transform:translate(35px,-25px) scale(0.97)} }
  @keyframes sp-d3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-70px,55px) scale(1.09)} }

  .sp-canvas  { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
  .sp-overlay { position: fixed; inset: 0; z-index: 2; pointer-events: none; background: rgba(7,8,15,0.52); }

  /* ── Card ── */
  .sp-card {
    position: relative; z-index: 10;
    width: 100%; max-width: 420px; padding: 0 20px;
    opacity: 0; transform: translateY(22px);
    transition: opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1);
  }
  .sp-card.visible { opacity: 1; transform: none; }

  .sp-card-inner {
    background: rgba(10,12,24,0.78);
    backdrop-filter: blur(40px);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 24px; padding: 44px 40px;
    position: relative; overflow: hidden;
    box-shadow: 0 32px 80px rgba(0,0,0,0.65), 0 0 80px rgba(124,58,237,0.08), 0 0 120px rgba(6,182,212,0.07);
  }

  /* Rainbow shimmer border */
  .sp-card-inner::before {
    content: ''; position: absolute; inset: 0; border-radius: 24px; padding: 1.5px;
    background: linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4,#10b981,#f9a826,#7c3aed);
    background-size: 300% 300%;
    -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
    -webkit-mask-composite: xor; mask-composite: exclude;
    animation: sp-border 7s linear infinite; pointer-events: none;
  }
  @keyframes sp-border { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }

  /* ── Icon ── */
  .sp-icon-wrap {
    width: 64px; height: 64px; border-radius: 18px; margin: 0 auto 24px;
    background: linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 28px rgba(124,58,237,0.45), 0 0 60px rgba(236,72,153,0.2);
    animation: sp-bob 4s ease-in-out infinite;
    position: relative;
  }
  .sp-icon-wrap::after {
    content: ''; position: absolute; inset: -5px; border-radius: 22px;
    background: linear-gradient(135deg,#7c3aed44,#ec4899aa,#06b6d444);
    animation: sp-glow 2.5s ease-in-out infinite; pointer-events: none;
  }
  @keyframes sp-bob  { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  @keyframes sp-glow { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.08)} }

  /* ── Text ── */
  .sp-heading {
    font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800;
    text-align: center; letter-spacing: -0.02em; margin-bottom: 7px;
    background: linear-gradient(135deg,#fff 0%,#d8c4ff 50%,#a5f3fc 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .sp-sub { text-align: center; font-size: 13px; color: rgba(255,255,255,0.36); line-height: 1.6; margin-bottom: 34px; }

  /* ── Form ── */
  .sp-form  { display: flex; flex-direction: column; gap: 20px; }
  .sp-field { display: flex; flex-direction: column; gap: 7px; }
  .sp-label { font-size: 11.5px; font-weight: 600; letter-spacing: 0.07em; text-transform: uppercase; color: rgba(255,255,255,0.4); }

  .sp-input-wrap {
    position: relative; display: flex; align-items: center;
    background: rgba(255,255,255,0.05); border: 1.5px solid rgba(255,255,255,0.1); border-radius: 12px;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .sp-input-wrap:focus-within {
    border-color: rgba(124,58,237,0.7); background: rgba(255,255,255,0.07);
    box-shadow: 0 0 0 3px rgba(124,58,237,0.14), 0 0 20px rgba(124,58,237,0.08);
  }
  .sp-input {
    flex: 1; padding: 13px 14px; background: transparent; border: none; outline: none;
    font-family: 'Cabinet Grotesk', sans-serif; font-size: 14px; color: #fff; border-radius: 12px;
  }
  .sp-input::placeholder { color: rgba(255,255,255,0.18); }
  .sp-input:-webkit-autofill { -webkit-box-shadow: 0 0 0 100px #0a0c18 inset; -webkit-text-fill-color:#fff; }

  .sp-eye {
    position: absolute; right: 12px; background: none; border: none; cursor: pointer;
    color: rgba(255,255,255,0.25); padding: 5px; border-radius: 6px;
    display: flex; align-items: center; transition: color 0.2s, background 0.2s;
  }
  .sp-eye:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.08); }

  /* Strength bar */
  .sp-strength { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
  .sp-bars { display: flex; gap: 4px; flex: 1; }
  .sp-bar  { height: 4px; flex: 1; border-radius: 4px; }
  .sp-strength-label { font-size: 11px; font-weight: 600; letter-spacing: 0.05em; white-space: nowrap; }

  .sp-match { font-size: 12px; font-weight: 500; margin-top: 5px; }

  /* Error */
  .sp-error-box {
    display: flex; align-items: center; gap: 8px;
    padding: 11px 14px; border-radius: 10px; font-size: 13px;
    color: #ff8a9a; background: rgba(255,77,109,0.1); border: 1px solid rgba(255,77,109,0.25);
    animation: sp-shake 0.4s ease;
  }
  @keyframes sp-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }

  /* Button */
  .sp-btn {
    width: 100%; padding: 14px; border: none; border-radius: 12px; cursor: pointer; margin-top: 4px;
    font-family: 'Syne', sans-serif; font-size: 14px; font-weight: 700; color: #fff; letter-spacing: 0.02em;
    background: linear-gradient(135deg,#7c3aed,#ec4899,#06b6d4);
    background-size: 200% 200%; animation: sp-btn-shift 5s ease infinite;
    box-shadow: 0 4px 24px rgba(124,58,237,0.35), 0 0 40px rgba(236,72,153,0.15);
    transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
    position: relative; overflow: hidden;
  }
  @keyframes sp-btn-shift { 0%{background-position:0% 50%} 50%{background-position:100% 50%} 100%{background-position:0% 50%} }
  .sp-btn::after {
    content: ''; position: absolute; top:-50%; left:-60%; width:50%; height:200%;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,0.14),transparent);
    transform: skewX(-20deg); transition: left 0.5s ease;
  }
  .sp-btn:hover:not(:disabled)::after { left: 120%; }
  .sp-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(124,58,237,0.45), 0 0 60px rgba(236,72,153,0.2); }
  .sp-btn:active:not(:disabled) { transform: none; }
  .sp-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .sp-btn-inner { display: flex; align-items: center; justify-content: center; gap: 9px; position: relative; z-index: 1; }
  .sp-spinner { width: 15px; height: 15px; border: 2px solid rgba(255,255,255,0.3); border-top-color:#fff; border-radius:50%; animation: sp-spin 0.65s linear infinite; }
  @keyframes sp-spin { to{transform:rotate(360deg)} }
`;