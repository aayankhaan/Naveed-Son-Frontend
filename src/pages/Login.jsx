// ========================================
// Login.jsx
// Sign-in screen. On success, stores the session via AuthContext and
// redirects to the Overview dashboard. Rendered only for signed-out
// visitors (see PublicRoute in App.jsx).
// ========================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FONT, LOGIN_COLORS as COLORS } from "../constants/theme";
import { useAuth } from "../context/AuthContext";

function SeamDivider() {
  const stitches = Array.from({ length: 28 });
  return (
    <div className="relative hidden md:flex flex-col items-center justify-center w-6 shrink-0" style={{ background: COLORS.ink }}>
      <div className="flex flex-col gap-1.75">
        {stitches.map((_, i) => (
          <span
            key={i}
            style={{
              width: 2,
              height: 10,
              background: i % 5 === 0 ? COLORS.gold : COLORS.boneDim,
              opacity: i % 5 === 0 ? 1 : 0.35,
              borderRadius: 1,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function Logo({ size = 44 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="46" height="46" rx="10" fill={COLORS.ink} />
      <rect x="1" y="1" width="46" height="46" rx="10" stroke={COLORS.gold} strokeWidth="1.2" />

      <rect x="12" y="27" width="24" height="6" rx="2" fill={COLORS.graphiteLight} opacity="0.35" />
      <rect x="12.5" y="21.5" width="23" height="6" rx="2" fill={COLORS.boneDim} opacity="0.55" />
      <rect x="13" y="16" width="22" height="6.5" rx="2" fill={COLORS.bone} />

      <line x1="16" y1="19.2" x2="32" y2="19.2" stroke={COLORS.gold} strokeWidth="1.1" strokeDasharray="1.6 1.8" strokeLinecap="round" />

      <path d="M30 16 L35 16 L35 21" stroke={COLORS.gold} strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.8" />
    </svg>
  );
}

const SLIDES = [
  {
    title: "One place to run the floor.",
    body: "Cutting, stitching, checking, packing — logged as work happens.",
  },
  {
    title: "Wages, calculated automatically.",
    body: "Daily entries turn into pay and installments, without spreadsheets.",
  },
  {
    title: "Orders, tracked to invoice.",
    body: "Bedsheets, cushions, and pillows — followed from order to delivery.",
  },
];

function TaglineSlider() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % SLIDES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-37.5">
      {SLIDES.map((slide, i) => (
        <div
          key={i}
          style={{
            display: i === index ? "block" : "none",
            animation: i === index ? "slide-in 0.5s ease" : "none",
          }}
        >
          <h1
            className="text-3xl md:text-4xl leading-tight font-semibold mb-4"
            style={{ color: COLORS.bone, fontFamily: FONT }}
          >
            {slide.title}
          </h1>
          <p className="text-sm leading-relaxed max-w-xs" style={{ color: COLORS.graphiteLight, fontFamily: FONT }}>
            {slide.body}
          </p>
        </div>
      ))}

      <div className="flex items-center gap-1.5 mt-6">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Show slide ${i + 1}`}
            onClick={() => setIndex(i)}
            className="dot-btn"
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 3,
              background: i === index ? COLORS.gold : COLORS.graphite,
              opacity: i === index ? 1 : 0.6,
              transition: "all 0.35s ease",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function FieldIcon({ variant }) {
  if (variant === "user") {
    return (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="8" cy="5.2" r="2.6" stroke={COLORS.graphite} strokeWidth="1.3" />
        <path d="M2.8 14c.6-3 2.7-4.6 5.2-4.6s4.6 1.6 5.2 4.6" stroke={COLORS.graphite} strokeWidth="1.3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3.2" y="7" width="9.6" height="6.4" rx="1.4" stroke={COLORS.graphite} strokeWidth="1.3" />
      <path d="M5.2 7V5a2.8 2.8 0 0 1 5.6 0v2" stroke={COLORS.graphite} strokeWidth="1.3" />
    </svg>
  );
}

export default function LoginPanel() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Enter your username and password to continue.");
      setShake(true);
      setTimeout(() => setShake(false), 420);
      return;
    }
    setError("");
    setSubmitting(true);

    try {
      await login(username, password);
      navigate("/overview", { replace: true });
    } catch (err) {
      setError(err.message || "Can't reach the server. Is it running?");
      setShake(true);
      setTimeout(() => setShake(false), 420);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row" style={{ fontFamily: FONT }}>
      <div
        className="flex md:w-[42%] flex-col justify-between p-6 sm:p-10 md:p-12 relative overflow-hidden fade-in"
        style={{ background: `linear-gradient(160deg, ${COLORS.ink} 0%, ${COLORS.inkSoft} 100%)` }}
      >
        <div className="flex items-center gap-3.5">
          <Logo />
          <div>
            <div className="text-[15px] font-semibold leading-tight" style={{ color: COLORS.bone, fontFamily: FONT }}>
              Naveed &amp; Sons
            </div>
            <div className="text-[11px] tracking-widest uppercase" style={{ color: COLORS.graphiteLight }}>
              Management Application
            </div>
          </div>
        </div>

        <div className="py-10 md:py-0">
          <TaglineSlider />
        </div>

        <div className="text-[11px]" style={{ color: COLORS.graphiteLight, fontFamily: FONT }}>
          © {new Date().getFullYear()} Naveed &amp; Sons
        </div>
      </div>

      <SeamDivider />

      <div className="flex-1 flex items-center justify-center p-6 sm:p-8" style={{ background: COLORS.bone }}>
        <div className="w-full max-w-sm fade-in-up">
          <h2 className="text-2xl font-semibold mb-1" style={{ color: COLORS.ink, fontFamily: FONT }}>
            Sign in
          </h2>
          <p className="text-sm mb-8" style={{ color: COLORS.graphite }}>
            Enter your admin credentials to open the dashboard.
          </p>

          <form onSubmit={handleSubmit} className={`space-y-5 ${shake ? "shake" : ""}`}>
            <div>
              <label htmlFor="username" className="block text-[11px] font-medium tracking-wide mb-1.5" style={{ color: COLORS.graphite }}>
                USERNAME
              </label>
              <div className="field-wrap">
                <span className="field-icon"><FieldIcon variant="user" /></span>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. admin"
                  className="field-input"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-[11px] font-medium tracking-wide" style={{ color: COLORS.graphite }}>
                  PASSWORD
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="text-[11px] font-medium toggle-link"
                  style={{ color: COLORS.goldDim }}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
              <div className="field-wrap">
                <span className="field-icon"><FieldIcon variant="lock" /></span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="field-input"
                />
              </div>
            </div>

            {error && (
              <div className="text-[12px] rounded-md px-3 py-2 flex items-center gap-2 error-in" style={{ background: "#F1E1DB", color: COLORS.rust }}>
                <span className="mt-0.75 w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLORS.rust }} />
                {error}
              </div>
            )}

            <button type="submit" disabled={submitting} className="signin-btn">
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <div className="mt-8 pt-5 text-[11px] text-center" style={{ borderTop: `1px solid ${COLORS.boneDim}`, color: COLORS.graphiteLight }}>
            Trouble signing in? Contact your administrator.
          </div>

          <div className="mt-4 text-[10px] text-center tracking-wide" style={{ color: COLORS.graphiteLight }}>
            Built by ALB Studio
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slide-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fade-in-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shake {
          10%, 90% { transform: translateX(-1px); }
          20%, 80% { transform: translateX(2px); }
          30%, 50%, 70% { transform: translateX(-4px); }
          40%, 60% { transform: translateX(4px); }
        }
        .fade-in { animation: fade-in 0.6s ease both; }
        .fade-in-up { animation: fade-in-up 0.6s ease 0.1s both; }
        .shake { animation: shake 0.4s ease; }
        .error-in { animation: fade-in-up 0.3s ease both; }

        .field-wrap {
          display: flex;
          align-items: center;
          gap: 10px;
          background: ${COLORS.boneDim};
          border: 1.5px solid ${COLORS.boneBorder};
          border-radius: 10px;
          padding: 0 12px;
          transition: border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .field-wrap:hover { border-color: ${COLORS.goldSoft}; }
        .field-wrap:focus-within {
          border-color: ${COLORS.gold};
          box-shadow: 0 0 0 3px rgba(184,135,61,0.15);
          background: ${COLORS.white};
        }
        .field-icon { display: flex; align-items: center; flex-shrink: 0; }
        .field-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          padding: 11px 0;
          font-size: 14px;
          color: ${COLORS.ink};
        }
        .field-input::placeholder { color: ${COLORS.graphiteLight}; }

        .toggle-link { transition: color 0.2s ease; }
        .toggle-link:hover { color: ${COLORS.gold}; }

        .signin-btn {
          width: 100%;
          padding: 12px 0;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.02em;
          color: ${COLORS.bone};
          background: ${COLORS.ink};
          border: none;
          cursor: pointer;
          transition: transform 0.15s ease, box-shadow 0.2s ease, background 0.2s ease, opacity 0.2s ease;
        }
        .signin-btn:hover:not(:disabled) {
          background: ${COLORS.inkSoft};
          box-shadow: 0 6px 16px rgba(28,25,23,0.25);
          transform: translateY(-1px);
        }
        .signin-btn:active:not(:disabled) { transform: translateY(0); }
        .signin-btn:disabled { opacity: 0.7; cursor: default; }

        .dot-btn:hover { opacity: 1 !important; }

        @media (prefers-reduced-motion: reduce) {
          .fade-in, .fade-in-up, .shake, .error-in, [style*="slide-in"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}