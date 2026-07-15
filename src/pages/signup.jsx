import { API_BASE_URL as APP_API_URL } from "../config/api.js";

import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Crown, Mail, Lock, Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle } from "lucide-react";

export default function SuperAdminAuth() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const next = state?.next || "/superadmin";

  const [form, setForm]           = useState({ identifier: "", password: "", rememberMe: false });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [success, setSuccess]     = useState("");
  const [mounted, setMounted]     = useState(false);
  const canvasRef                 = useRef(null);

  useEffect(() => { setMounted(true); }, []);

  // ── Mesh / particle canvas ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let W = canvas.width  = window.innerWidth;
    let H = canvas.height = window.innerHeight;
    let raf;

    const resize = () => {
      W = canvas.width  = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", resize);

    // Particles
    const N = 60;
    const pts = Array.from({ length: N }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      r: Math.random() * 1.8 + 0.6,
      hue: Math.random() * 360,
    }));

    let t = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw);
      t += 0.003;

      ctx.clearRect(0, 0, W, H);

      // Connect nearby particles
      for (let i = 0; i < N; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;

        for (let j = i + 1; j < N; j++) {
          const q = pts[j];
          const dx = p.x - q.x, dy = p.y - q.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 140) {
            const alpha = (1 - d / 140) * 0.35;
            ctx.beginPath();
            ctx.strokeStyle = `hsla(${(p.hue + t * 30) % 360}, 80%, 70%, ${alpha})`;
            ctx.lineWidth = 0.8;
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }

        // Dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(p.hue + t * 50) % 360}, 85%, 72%, 0.9)`;
        ctx.fill();
      }
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    setError("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(""); setSuccess("");
    if (!form.identifier.trim() || !form.password.trim()) { setError("Please fill in all fields"); return; }
    setLoading(true);
    try {
      const payload = { email: form.identifier.trim(), password: form.password };
      console.log("➡️ Sending login request:", payload);
      const res = await fetch(`${APP_API_URL}/superadmin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("⬅️ Raw response:", res.status, res.statusText);
      const text = await res.text();
      console.log("⬅️ Response body:", text);
      let data = {};
      try { data = text ? JSON.parse(text) : {}; } catch { throw new Error("Invalid JSON response from server"); }
      if (!res.ok) throw new Error(data.detail || `Login failed (${res.status})`);
      const sessionData = { ...data, createdAt: Date.now(), expiresIn: form.rememberMe ? 30*24*60*60*1000 : 24*60*60*1000 };
      localStorage.setItem("auth_session", JSON.stringify(sessionData));
      if (data.access_token) localStorage.setItem("superadmin_token", data.access_token);
      setSuccess("Authentication successful! Redirecting...");
      setTimeout(() => navigate("/superadmin", { replace: true }), 1000);
    } catch (err) {
      console.error("❌ Login error:", err);
      setError(err.message || "Unable to connect to server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;700;800&family=Syne:wght@600;700;800&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .sa-root {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: 'Cabinet Grotesk', sans-serif;
          background: #07080f;
        }

        /* ── Aurora background ── */
        .sa-aurora {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          overflow: hidden;
        }
        .sa-aurora-blob {
          position: absolute; border-radius: 50%; filter: blur(90px); opacity: 0.55;
        }
        .sa-ab1 {
          width: 700px; height: 700px;
          background: radial-gradient(circle, #ff6b6b, #ee00b4);
          top: -200px; left: -200px;
          animation: sa-drift1 18s ease-in-out infinite;
        }
        .sa-ab2 {
          width: 600px; height: 600px;
          background: radial-gradient(circle, #00d4ff, #0038ff);
          bottom: -150px; right: -150px;
          animation: sa-drift2 22s ease-in-out infinite;
        }
        .sa-ab3 {
          width: 500px; height: 500px;
          background: radial-gradient(circle, #ffe600, #ff8a00);
          top: 30%; left: 55%;
          animation: sa-drift3 16s ease-in-out infinite;
        }
        .sa-ab4 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, #00ffaa, #0070ff);
          top: 60%; left: 10%;
          animation: sa-drift1 20s ease-in-out infinite reverse;
        }

        @keyframes sa-drift1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(60px,-40px) scale(1.08)} 66%{transform:translate(-30px,50px) scale(0.95)} }
        @keyframes sa-drift2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,40px) scale(1.06)} 66%{transform:translate(40px,-30px) scale(0.97)} }
        @keyframes sa-drift3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-80px,60px) scale(1.1)} }

        /* Particle canvas */
        .sa-canvas { position: fixed; inset: 0; z-index: 1; pointer-events: none; }

        /* Overlay darkener so card pops */
        .sa-overlay {
          position: fixed; inset: 0; z-index: 2; pointer-events: none;
          background: rgba(7,8,15,0.45);
        }

        /* ── Back button ── */
        .sa-back {
          position: fixed; top: 24px; left: 24px; z-index: 20;
          display: flex; align-items: center; gap: 7px;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 8px 16px;
          color: rgba(255,255,255,0.6);
          font-size: 13px; font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
          backdrop-filter: blur(12px);
        }
        .sa-back:hover { background: rgba(255,255,255,0.12); color: #fff; }
        .sa-back svg { transition: transform 0.2s; }
        .sa-back:hover svg { transform: translateX(-3px); }

        /* ── Card ── */
        .sa-card-wrap {
          position: relative; z-index: 10;
          width: 100%; max-width: 440px;
          padding: 0 20px;
          opacity: 0; transform: translateY(24px);
          transition: opacity 0.6s cubic-bezier(0.22,1,0.36,1), transform 0.6s cubic-bezier(0.22,1,0.36,1);
        }
        .sa-card-wrap.visible { opacity: 1; transform: none; }

        .sa-card {
          background: rgba(12,14,26,0.75);
          backdrop-filter: blur(40px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 24px;
          padding: 44px 40px;
          box-shadow:
            0 0 0 1px rgba(255,255,255,0.04),
            0 32px 80px rgba(0,0,0,0.6),
            0 0 80px rgba(255,107,107,0.06),
            0 0 120px rgba(0,212,255,0.06);
          position: relative; overflow: hidden;
        }

        /* Rainbow border shimmer */
        .sa-card::before {
          content: '';
          position: absolute; inset: 0;
          border-radius: 24px;
          padding: 1.5px;
          background: linear-gradient(135deg, #ff6b6b, #ee00b4, #0038ff, #00d4ff, #00ffaa, #ffe600, #ff6b6b);
          background-size: 300% 300%;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor; mask-composite: exclude;
          animation: sa-border-spin 6s linear infinite;
          pointer-events: none;
        }
        @keyframes sa-border-spin {
          0%   { background-position: 0% 50%; }
          50%  { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        /* ── Icon crown ── */
        .sa-crown-wrap {
          display: flex; justify-content: center; margin-bottom: 28px;
        }
        .sa-crown-ring {
          width: 72px; height: 72px; border-radius: 20px;
          background: linear-gradient(135deg, #ff6b6b, #ee00b4, #ff8a00);
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 30px rgba(255,107,107,0.45), 0 0 60px rgba(238,0,180,0.2);
          animation: sa-crown-bob 4s ease-in-out infinite;
          position: relative;
        }
        .sa-crown-ring::after {
          content: '';
          position: absolute; inset: -4px; border-radius: 24px;
          background: linear-gradient(135deg, #ff6b6b44, #ee00b444, #ff8a0044);
          animation: sa-crown-glow 2s ease-in-out infinite;
        }
        @keyframes sa-crown-bob { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        @keyframes sa-crown-glow { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }

        /* ── Heading ── */
        .sa-heading {
          font-family: 'Syne', sans-serif;
          font-size: 30px; font-weight: 800;
          text-align: center; margin-bottom: 6px;
          background: linear-gradient(135deg, #ffffff 0%, #ffd6d6 50%, #d6eeff 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          letter-spacing: -0.02em;
        }
        .sa-sub {
          text-align: center; font-size: 13px;
          color: rgba(255,255,255,0.38);
          margin-bottom: 36px;
          font-weight: 400;
        }

        /* ── Fields ── */
        .sa-field { margin-bottom: 18px; }
        .sa-label {
          display: block; font-size: 12px; font-weight: 600;
          color: rgba(255,255,255,0.45); letter-spacing: 0.06em;
          text-transform: uppercase; margin-bottom: 8px;
        }
        .sa-input-wrap {
          position: relative; display: flex; align-items: center;
          background: rgba(255,255,255,0.05);
          border: 1.5px solid rgba(255,255,255,0.1);
          border-radius: 12px;
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
        }
        .sa-input-wrap:focus-within {
          border-color: rgba(255,107,107,0.6);
          background: rgba(255,255,255,0.07);
          box-shadow: 0 0 0 3px rgba(255,107,107,0.12), 0 0 20px rgba(255,107,107,0.08);
        }
        .sa-input-wrap.has-error {
          border-color: rgba(255,80,80,0.5);
          box-shadow: 0 0 0 3px rgba(255,80,80,0.1);
        }
        .sa-icon {
          position: absolute; left: 14px;
          color: rgba(255,255,255,0.25); pointer-events: none;
          display: flex; align-items: center;
          transition: color 0.2s;
        }
        .sa-input-wrap:focus-within .sa-icon { color: rgba(255,107,107,0.8); }
        .sa-input {
          flex: 1; padding: 13px 14px 13px 44px;
          background: transparent; border: none; outline: none;
          font-family: 'Cabinet Grotesk', sans-serif;
          font-size: 14px; color: #fff;
        }
        .sa-input::placeholder { color: rgba(255,255,255,0.2); }
        .sa-input:-webkit-autofill {
          -webkit-box-shadow: 0 0 0 100px #0c0e1a inset;
          -webkit-text-fill-color: #fff;
        }
        .sa-eye {
          position: absolute; right: 12px;
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.25); padding: 5px; border-radius: 7px;
          display: flex; align-items: center;
          transition: color 0.2s, background 0.2s;
        }
        .sa-eye:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.08); }

        /* ── Alerts ── */
        .sa-alert {
          display: flex; align-items: flex-start; gap: 10px;
          padding: 12px 14px; border-radius: 10px;
          font-size: 13px; font-weight: 500;
          margin-bottom: 18px;
          animation: sa-shake 0.4s ease;
        }
        .sa-alert-err { background: rgba(255,60,60,0.1); border: 1px solid rgba(255,60,60,0.25); color: #ff9090; }
        .sa-alert-ok  { background: rgba(0,255,150,0.08); border: 1px solid rgba(0,255,150,0.2); color: #70ffb8; }
        @keyframes sa-shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-5px)} 75%{transform:translateX(5px)} }

        /* ── Submit ── */
        .sa-btn {
          width: 100%; padding: 14px;
          background: linear-gradient(135deg, #ff6b6b, #ee00b4, #7c3aed);
          background-size: 200% 200%;
          border: none; border-radius: 12px;
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700;
          color: #fff; cursor: pointer; letter-spacing: 0.01em;
          transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
          box-shadow: 0 4px 24px rgba(255,107,107,0.3), 0 0 40px rgba(238,0,180,0.15);
          animation: sa-btn-shimmer 4s ease infinite;
          position: relative; overflow: hidden;
          margin-top: 8px;
        }
        @keyframes sa-btn-shimmer {
          0%  { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100%{ background-position: 0% 50%; }
        }
        .sa-btn::after {
          content: '';
          position: absolute; top: -50%; left: -60%;
          width: 50%; height: 200%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
          transform: skewX(-20deg);
          transition: left 0.5s ease;
        }
        .sa-btn:hover:not(:disabled)::after { left: 120%; }
        .sa-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(255,107,107,0.4), 0 0 60px rgba(238,0,180,0.2); }
        .sa-btn:active:not(:disabled) { transform: none; }
        .sa-btn:disabled { opacity: 0.45; cursor: not-allowed; }

        .sa-btn-inner { display: flex; align-items: center; justify-content: center; gap: 9px; position: relative; z-index: 1; }
        .sa-spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: sa-spin 0.7s linear infinite; }
        @keyframes sa-spin { to{transform:rotate(360deg)} }
      `}</style>

      <div className="sa-root">
        {/* Aurora blobs */}
        <div className="sa-aurora">
          <div className="sa-aurora-blob sa-ab1" />
          <div className="sa-aurora-blob sa-ab2" />
          <div className="sa-aurora-blob sa-ab3" />
          <div className="sa-aurora-blob sa-ab4" />
        </div>

        {/* Particle mesh canvas */}
        <canvas ref={canvasRef} className="sa-canvas" />

        {/* Dark overlay */}
        <div className="sa-overlay" />

        {/* Back button */}
        <button className="sa-back" onClick={() => navigate("/")}>
          <ArrowLeft size={15} />
          Back
        </button>

        {/* Card */}
        <div className={`sa-card-wrap ${mounted ? "visible" : ""}`}>
          <div className="sa-card">

            {/* Crown icon */}
            <div className="sa-crown-wrap">
              <div className="sa-crown-ring">
                <Crown size={32} color="#fff" />
              </div>
            </div>

            <h1 className="sa-heading">Super Admin</h1>
            <p className="sa-sub">Sign in to access the control center</p>

            <form onSubmit={onSubmit}>

              {/* Email */}
              <div className="sa-field">
                <label className="sa-label">Email</label>
                <div className={`sa-input-wrap ${error ? "has-error" : ""}`}>
                  <span className="sa-icon"><Mail size={16} /></span>
                  <input
                    className="sa-input"
                    type="email"
                    name="identifier"
                    value={form.identifier}
                    onChange={onChange}
                    required
                    placeholder="superadmin@company.com"
                    autoComplete="off"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="sa-field">
                <label className="sa-label">Password</label>
                <div className={`sa-input-wrap ${error ? "has-error" : ""}`}>
                  <span className="sa-icon"><Lock size={16} /></span>
                  <input
                    className="sa-input"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={form.password}
                    onChange={onChange}
                    required
                    placeholder="••••••••••"
                  />
                  <button
                    type="button"
                    className="sa-eye"
                    onClick={() => setShowPassword(v => !v)}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Alerts */}
              {success && (
                <div className="sa-alert sa-alert-ok">
                  <CheckCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  {success}
                </div>
              )}
              {error && (
                <div className="sa-alert sa-alert-err">
                  <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                  {error}
                </div>
              )}

              {/* Submit */}
              <button type="submit" className="sa-btn" disabled={loading}>
                <span className="sa-btn-inner">
                  {loading ? (
                    <><span className="sa-spinner" /> Authenticating…</>
                  ) : (
                    <><Crown size={17} /> Sign In to Control Center</>
                  )}
                </span>
              </button>

            </form>
          </div>
        </div>
      </div>
    </>
  );
}