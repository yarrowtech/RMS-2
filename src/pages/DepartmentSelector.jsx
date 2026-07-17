import { API_BASE_URL as APP_API_URL } from "../config/api.js";

// pages/DepartmentSelector.jsx
import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuthData } from "../utils/authRedirect";

const DEPT_ROUTES = {
  "HQ":                             "/admin",
  "HR":                             "/dashboard/hr",
  "Cashier":                        "/dashboard/cashier",
  "Finance":                        "/dashboard/finance",
  "IT":                             "/dashboard/it",
  "Logistics":                      "/dashboard/logistics",
  "Design & Pattern":               "/dashboard/design",
  "Inventory":                      "/dashboard/inventory",
  "Stock Planning & Forecasting":   "/dashboard/stock-planning",
  "Third Party":                    "/dashboard/third-party",
  "Production & Job Work":          "/dashboard/production",
  "Merchandiser Buyer":             "/dashboard/merchandiser-buyer",
  "Vendor":                         "/dashboard/vendor",
};

// ─── Department metadata ───────────────────────────────────────────────────
const DEPT_META = {
  "HQ":                           { emoji: "🏢", gradient: "linear-gradient(135deg,#475569,#0f172a)", glow: "rgba(71,85,105,0.4)" },
  "HR":                           { emoji: "👥", gradient: "linear-gradient(135deg,#3b82f6,#1d4ed8)", glow: "rgba(59,130,246,0.4)" },
  "Cashier":                      { emoji: "💰", gradient: "linear-gradient(135deg,#10b981,#059669)", glow: "rgba(16,185,129,0.4)" },
  "Finance":                      { emoji: "📊", gradient: "linear-gradient(135deg,#8b5cf6,#6d28d9)", glow: "rgba(139,92,246,0.4)" },
  "IT":                           { emoji: "🖥️", gradient: "linear-gradient(135deg,#06b6d4,#0284c7)", glow: "rgba(6,182,212,0.4)"  },
  "Logistics":                    { emoji: "🚚", gradient: "linear-gradient(135deg,#f97316,#ea580c)", glow: "rgba(249,115,22,0.4)" },
  "Design & Pattern":             { emoji: "🎨", gradient: "linear-gradient(135deg,#ec4899,#db2777)", glow: "rgba(236,72,153,0.4)" },
  "Inventory":                    { emoji: "📦", gradient: "linear-gradient(135deg,#f59e0b,#d97706)", glow: "rgba(245,158,11,0.4)" },
  "Stock Planning & Forecasting": { emoji: "📈", gradient: "linear-gradient(135deg,#14b8a6,#0d9488)", glow: "rgba(20,184,166,0.4)"  },
  "Third Party":                  { emoji: "🌐", gradient: "linear-gradient(135deg,#6366f1,#4338ca)", glow: "rgba(99,102,241,0.4)" },
  "Merchandiser Buyer":           { emoji: "🛍️", gradient: "linear-gradient(135deg,#ef4444,#dc2626)", glow: "rgba(239,68,68,0.4)"  },
  "Vendor":                       { emoji: "🏪", gradient: "linear-gradient(135deg,#64748b,#475569)", glow: "rgba(100,116,139,0.4)" },
};
const DEFAULT_META = { emoji: "💼", gradient: "linear-gradient(135deg,#6b7280,#4b5563)", glow: "rgba(107,114,128,0.4)" };

function getLoginData() {
  try { return JSON.parse(localStorage.getItem("admin_login_data") || "null"); }
  catch { return null; }
}

export default function DepartmentSelector() {
  const navigate  = useNavigate();
  const canvasRef = useRef(null);

  // ── State — start as null (not yet determined) to avoid premature redirect ──
  const [adminName,   setAdminName]   = useState(null);
  const [departments, setDepartments] = useState(null);
  const [routes,      setRoutes]      = useState({});
  const [selecting,   setSelecting]   = useState(null);
  const [mounted,     setMounted]     = useState(false);

  // ── Load data — runs once after mount ──────────────────────────────────────
  // useEffect(() => {
  //   setMounted(true);

  //   // Priority 1: react-router state (passed by handleAuthRedirect navigate)
  //   const st = location.state;
  //   if (st?.departments?.length) {
  //     setAdminName(st.name || "");
  //     setDepartments(st.departments);
  //     setRoutes(st.routes || {});
  //     return;
  //   }

  //   // Priority 2: localStorage (survives page reload)
  //   const saved = getLoginData();
  //   if (saved?.departments?.length) {
  //     setAdminName(saved.name || "");
  //     setDepartments(saved.departments);
  //     setRoutes(saved.routes || {});
  //     return;
  //   }

  //   // Priority 3: single active_department (admin with 1 dept who ended up here)
  //   const singleDept = localStorage.getItem("admin_active_department");
  //   if (singleDept) {
  //     navigate(getDeptPath(singleDept, {}), { replace: true });
  //     return;
  //   }

  //   // Nothing — send to login
  //   navigate("/admin/login", { replace: true });
  // // eslint-disable-next-line react-hooks/exhaustive-deps
  // }, []);

  useEffect(() => {
    setMounted(true);

    // Always verify assignments with the backend. Navigation state and localStorage
    // are display caches only, never authorization sources. Vendor sessions cannot
    // use this page to discover internal departments.
    // This catches the case where SuperAdmin updated departments
    // after the admin already logged in
    const token = localStorage.getItem("admin_token") ||
                  localStorage.getItem("access_token") ||
                  localStorage.getItem("token");

    if (token) {
      const API = APP_API_URL;
      fetch(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data?.managedDepartments?.length) {
            const depts  = data.managedDepartments;
            const routes = Object.fromEntries(
              depts.map(d => [d, DEPT_ROUTES[d] || `/${d.toLowerCase().replace(/\s+/g, "-")}`])
            );
            setAdminName(data.name || "");
            setDepartments(depts);
            setRoutes(routes);

            // Update localStorage so next load is also correct
            const saved = getLoginData();
            if (saved) {
              localStorage.setItem("admin_login_data", JSON.stringify({
                ...saved,
                departments: depts,
                routes,
                name: data.name || saved.name,
              }));
            }

            if (depts.length === 1) {
              navigate(routes[depts[0]], { replace: true });
            }
          } else {
            // Token invalid or expired
            navigate("/admin/login", { replace: true });
          }
        })
        .catch(() => {
          // Fail closed: do not reveal cached department assignments when
          // the authenticated profile cannot be verified.
          navigate("/admin/login", { replace: true });
        });
      return;
    }

    // No token — send to login
    navigate("/admin/login", { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const pts = Array.from({ length: 45 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.5 + 0.4, hue: Math.random() * 360,
    }));
    let t = 0;
    const draw = () => {
      raf = requestAnimationFrame(draw); t += 0.003;
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j], dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
          if (d < 120) {
            ctx.beginPath();
            ctx.strokeStyle = `hsla(${(p.hue + t * 40) % 360},75%,65%,${(1 - d / 120) * 0.25})`;
            ctx.lineWidth = 0.6;
            ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${(p.hue + t * 55) % 360},80%,68%,0.8)`;
        ctx.fill();
      }
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  const getDeptPath = (dept, r) =>
    r[dept] || `/${dept.toLowerCase().replace(/\s+/g, "-").replace("&", "and")}`;

 


const handleSelect = (dept) => {
    setSelecting(dept);
    localStorage.setItem("admin_active_department", dept);
    // Store admins use the same routes as HQ admins.
    // Store scoping is handled by localStorage.store_id read inside each module.
    const path = getDeptPath(dept, routes);
    setTimeout(() => navigate(path, { replace: true }), 200);
  };

  const handleLogout = () => {
    clearAuthData();
    navigate("/admin/login", { replace: true });
  };

  // ── Loading state (data not yet determined) ────────────────────────────────
  if (departments === null) {
    return (
      <>
        <style>{css}</style>
        <div className="ds-root">
          <div className="ds-aurora"><div className="ds-ab ds-ab1"/><div className="ds-ab ds-ab2"/><div className="ds-ab ds-ab3"/><div className="ds-ab ds-ab4"/></div>
          <canvas ref={canvasRef} className="ds-canvas"/>
          <div className="ds-overlay"/>
          <div style={{ position:"relative",zIndex:10,display:"flex",alignItems:"center",gap:12,color:"rgba(255,255,255,0.4)",fontSize:14 }}>
            <div className="ds-spinner" /> Loading your dashboard…
          </div>
        </div>
      </>
    );
  }

  const firstName = adminName ? adminName.split(" ")[0] : "";

  return (
    <>
      <style>{css}</style>
      <div className="ds-root">
        {/* Aurora */}
        <div className="ds-aurora">
          <div className="ds-ab ds-ab1"/><div className="ds-ab ds-ab2"/>
          <div className="ds-ab ds-ab3"/><div className="ds-ab ds-ab4"/>
        </div>
        <canvas ref={canvasRef} className="ds-canvas"/>
        <div className="ds-overlay"/>

        {/* Content */}
        <div className={`ds-wrap ${mounted ? "visible" : ""}`}>

          {/* Header */}
          <div className="ds-header">
            <div className="ds-crown">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 20h20M5 20V10l7-6 7 6v10"/>
                <path d="M9 20v-5h6v5"/>
              </svg>
            </div>
            <h1 className="ds-title">
              {firstName ? `Welcome back, ${firstName}!` : "Welcome back!"}
            </h1>
            <p className="ds-subtitle">
              You manage <strong style={{ color:"#a78bfa" }}>{departments.length}</strong> department{departments.length !== 1 ? "s" : ""}.
              {" "}Choose where to work today.
            </p>
          </div>

          {/* Department cards */}
          <div className="ds-grid">
            {departments.map((dept) => {
              const meta   = DEPT_META[dept] || DEFAULT_META;
              const active = selecting === dept;
              const faded  = selecting && !active;

              return (
                <button
                  key={dept}
                  className="ds-card"
                  onClick={() => handleSelect(dept)}
                  disabled={!!selecting}
                  style={{
                    opacity: faded ? 0.35 : 1,
                    transform: active ? "scale(0.97)" : "scale(1)",
                    borderColor: active ? "rgba(167,139,250,0.6)" : "rgba(255,255,255,0.08)",
                    background: active ? "rgba(167,139,250,0.08)" : "rgba(255,255,255,0.04)",
                    transition: "all 0.2s",
                  }}
                >
                  {/* Icon circle */}
                  <div className="ds-card-icon" style={{
                    background: meta.gradient,
                    boxShadow: active ? `0 0 20px ${meta.glow}` : `0 4px 14px ${meta.glow}55`,
                    transform: active ? "scale(1.12)" : "scale(1)",
                    transition: "transform 0.2s, box-shadow 0.2s",
                  }}>
                    <span style={{ fontSize: 22 }}>{meta.emoji}</span>
                  </div>

                  {/* Label */}
                  <div className="ds-card-text">
                    <p className="ds-card-name">{dept}</p>
                    <p className="ds-card-path">{getDeptPath(dept, routes)}</p>
                  </div>

                  {/* Right side */}
                  <div className="ds-card-right">
                    {active ? (
                      <div className="ds-spinner" style={{ borderColor:"rgba(167,139,250,0.3)", borderTopColor:"#a78bfa" }} />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Info */}
          <div className="ds-info">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            You can switch departments anytime from the sidebar. Your session stays active across all your dashboards.
          </div>

          {/* Logout */}
          <button className="ds-logout" onClick={handleLogout}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>

        </div>
      </div>
    </>
  );
}

// ── CSS ──────────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Cabinet+Grotesk:wght@400;500;600;700;800&family=Syne:wght@700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .ds-root {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    background: #07080f; position: relative; overflow: hidden;
    font-family: 'Cabinet Grotesk', sans-serif;
    padding: 32px 20px;
  }

  /* ── Aurora ── */
  .ds-aurora { position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; }
  .ds-ab { position: absolute; border-radius: 50%; filter: blur(90px); }
  .ds-ab1 { width: 560px; height: 560px; background: radial-gradient(circle,#4f46e5,#7c3aed); opacity:0.45; top:-160px; left:-160px; animation: ds-d1 22s ease-in-out infinite; }
  .ds-ab2 { width: 500px; height: 500px; background: radial-gradient(circle,#0ea5e9,#06b6d4); opacity:0.4; bottom:-140px; right:-140px; animation: ds-d2 26s ease-in-out infinite; }
  .ds-ab3 { width: 380px; height: 380px; background: radial-gradient(circle,#f43f5e,#ec4899); opacity:0.35; top:35%; left:60%; animation: ds-d3 18s ease-in-out infinite; }
  .ds-ab4 { width: 320px; height: 320px; background: radial-gradient(circle,#10b981,#06d6a0); opacity:0.3; bottom:15%; left:5%; animation: ds-d1 21s ease-in-out infinite reverse; }

  @keyframes ds-d1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(55px,-40px) scale(1.06)} 66%{transform:translate(-30px,50px) scale(0.95)} }
  @keyframes ds-d2 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(-50px,40px) scale(1.05)} 66%{transform:translate(40px,-30px) scale(0.97)} }
  @keyframes ds-d3 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-75px,60px) scale(1.08)} }

  .ds-canvas  { position: fixed; inset: 0; z-index: 1; pointer-events: none; }
  .ds-overlay { position: fixed; inset: 0; z-index: 2; pointer-events: none; background: rgba(7,8,15,0.5); }

  /* ── Wrap ── */
  .ds-wrap {
    position: relative; z-index: 10;
    width: 100%; max-width: 520px;
    opacity: 0; transform: translateY(20px);
    transition: opacity 0.55s cubic-bezier(0.22,1,0.36,1), transform 0.55s cubic-bezier(0.22,1,0.36,1);
  }
  .ds-wrap.visible { opacity: 1; transform: none; }

  /* ── Header ── */
  .ds-header { text-align: center; margin-bottom: 32px; }

  .ds-crown {
    width: 64px; height: 64px; border-radius: 18px; margin: 0 auto 20px;
    background: linear-gradient(135deg,#7c3aed,#a78bfa,#06b6d4);
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 28px rgba(124,58,237,0.5), 0 0 60px rgba(167,139,250,0.2);
    animation: ds-bob 4s ease-in-out infinite;
    position: relative;
  }
  .ds-crown::after {
    content: ''; position: absolute; inset: -5px; border-radius: 22px;
    background: linear-gradient(135deg,#7c3aed44,#a78bfa88,#06b6d444);
    animation: ds-glow 2.5s ease-in-out infinite; pointer-events: none;
  }
  @keyframes ds-bob  { 0%,100%{transform:translateY(0)}  50%{transform:translateY(-6px)} }
  @keyframes ds-glow { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:0.9;transform:scale(1.08)} }

  .ds-title {
    font-family: 'Syne', sans-serif; font-size: 26px; font-weight: 800;
    letter-spacing: -0.02em; margin-bottom: 8px;
    background: linear-gradient(135deg,#fff 0%,#ddd6fe 50%,#a5f3fc 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .ds-subtitle { font-size: 13.5px; color: rgba(255,255,255,0.38); line-height: 1.6; }

  /* ── Cards ── */
  .ds-grid { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }

  .ds-card {
    width: 100%; display: flex; align-items: center; gap: 14px;
    padding: 14px 16px; border-radius: 14px;
    border: 1.5px solid rgba(255,255,255,0.08);
    background: rgba(255,255,255,0.04);
    cursor: pointer; text-align: left;
    position: relative; overflow: hidden;
  }
  .ds-card:hover:not(:disabled) {
    border-color: rgba(167,139,250,0.35) !important;
    background: rgba(167,139,250,0.06) !important;
  }
  .ds-card:hover:not(:disabled) .ds-card-name { color: #fff; }

  /* Shimmer on hover */
  .ds-card::after {
    content: ''; position: absolute; top:-50%; left:-60%; width:50%; height:200%;
    background: linear-gradient(90deg,transparent,rgba(255,255,255,0.05),transparent);
    transform: skewX(-20deg); transition: left 0.5s ease; pointer-events: none;
  }
  .ds-card:hover:not(:disabled)::after { left: 120%; }

  .ds-card-icon {
    width: 46px; height: 46px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }

  .ds-card-text { flex: 1; min-width: 0; }
  .ds-card-name {
    font-size: 14px; font-weight: 700; color: rgba(255,255,255,0.9);
    margin-bottom: 2px; transition: color 0.15s;
  }
  .ds-card-path { font-size: 11.5px; color: rgba(255,255,255,0.25); font-family: monospace; }

  .ds-card-right { flex-shrink: 0; }

  /* ── Info ── */
  .ds-info {
    display: flex; align-items: flex-start; gap: 8px;
    padding: 12px 14px; border-radius: 12px;
    background: rgba(167,139,250,0.06); border: 1px solid rgba(167,139,250,0.15);
    font-size: 12px; color: rgba(255,255,255,0.35); line-height: 1.6;
    margin-bottom: 14px;
  }
  .ds-info svg { flex-shrink: 0; margin-top: 1px; }

  /* ── Logout ── */
  .ds-logout {
    width: 100%; display: flex; align-items: center; justify-content: center; gap: 7px;
    padding: 11px; border-radius: 12px; cursor: pointer;
    background: none; border: 1px solid rgba(255,255,255,0.07);
    font-family: 'Cabinet Grotesk', sans-serif; font-size: 13px; font-weight: 600;
    color: rgba(255,255,255,0.3); transition: color 0.2s, background 0.2s, border-color 0.2s;
  }
  .ds-logout:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.15); }

  /* ── Spinner ── */
  .ds-spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.15); border-top-color: rgba(255,255,255,0.7);
    animation: ds-spin 0.7s linear infinite; flex-shrink: 0;
  }
  @keyframes ds-spin { to { transform: rotate(360deg); } }
`;
