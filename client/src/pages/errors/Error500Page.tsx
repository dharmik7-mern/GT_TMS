import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const glitchKeyframes = `
  @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&display=swap');

  @keyframes glitch {
    0% { clip-path: inset(40% 0 61% 0); transform: translate(-4px, 0) skew(0.5deg); }
    10% { clip-path: inset(92% 0 1% 0); transform: translate(4px, 0) skew(0.8deg); }
    20% { clip-path: inset(43% 0 1% 0); transform: translate(-4px, 0) skew(-0.5deg); }
    30% { clip-path: inset(25% 0 58% 0); transform: translate(0, 0) skew(0.1deg); }
    40% { clip-path: inset(54% 0 7% 0); transform: translate(4px, 0) skew(1deg); }
    50% { clip-path: inset(10% 0 85% 0); transform: translate(-2px, 0) skew(-0.5deg); }
    60% { clip-path: inset(58% 0 43% 0); transform: translate(4px, 0) skew(0.5deg); }
    70% { clip-path: inset(20% 0 75% 0); transform: translate(-4px, 0) skew(0.8deg); }
    80% { clip-path: inset(64% 0 12% 0); transform: translate(2px, 0); }
    90% { clip-path: inset(90% 0 1% 0); transform: translate(-2px, 0) skew(-0.1deg); }
    100% { clip-path: inset(40% 0 61% 0); transform: translate(4px, 0) skew(0.5deg); }
  }

  @keyframes scanline {
    0% { transform: translateY(-100%); }
    100% { transform: translateY(100vh); }
  }

  @keyframes flicker {
    0%, 19%, 21%, 23%, 25%, 54%, 56%, 100% { opacity: 1; }
    20%, 24%, 55% { opacity: 0.4; }
  }

  @keyframes noise {
    0%, 100% { background-position: 0 0; }
    10% { background-position: -5% -10%; }
    20% { background-position: -15% 5%; }
    30% { background-position: 7% -25%; }
    40% { background-position: 20% 25%; }
    50% { background-position: -25% 10%; }
    60% { background-position: 15% 5%; }
    70% { background-position: 0% 15%; }
    80% { background-position: 25% 35%; }
    90% { background-position: -10% 10%; }
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse-red {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
    50% { box-shadow: 0 0 0 12px rgba(239, 68, 68, 0); }
  }

  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-3px); }
    20%, 40%, 60%, 80% { transform: translateX(3px); }
  }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  @keyframes progress-bar {
    0% { width: 100%; }
    100% { width: 0%; }
  }

  @keyframes ember {
    0% { transform: translateY(0) translateX(0) scale(1); opacity: 1; }
    100% { transform: translateY(-120px) translateX(var(--drift)) scale(0); opacity: 0; }
  }

  @keyframes rotate-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @keyframes rgb-shift {
    0% { text-shadow: 2px 0 0 #ff0040, -2px 0 0 #00ffff; }
    25% { text-shadow: -2px 0 0 #ff0040, 2px 0 0 #00ffff; }
    50% { text-shadow: 2px 2px 0 #ff0040, -2px -2px 0 #00ffff; }
    75% { text-shadow: -2px -2px 0 #ff0040, 2px 2px 0 #00ffff; }
    100% { text-shadow: 2px 0 0 #ff0040, -2px 0 0 #00ffff; }
  }
`;

const LOG_LINES = [
  { delay: 0, level: "FATAL", msg: "Unhandled exception in production. God help us." },
  { delay: 400, level: "ERROR", msg: "NullPointerException at line 1337 — classic." },
  { delay: 800, level: "ERROR", msg: "Database connection pool exhausted. Every. Last. One." },
  { delay: 1200, level: "WARN", msg: "Memory heap exceeded. Swapping to tears." },
  { delay: 1600, level: "ERROR", msg: "Redis cache: ECONNREFUSED. Redis said no." },
  { delay: 2000, level: "FATAL", msg: "Stack overflow detected in recursion handler." },
  { delay: 2400, level: "ERROR", msg: "SSL certificate expired 3 days ago. Oops." },
  { delay: 2800, level: "WARN", msg: "Rate limiter bypassed. RIP bandwidth." },
  { delay: 3200, level: "ERROR", msg: "Kubernetes pod CrashLoopBackOff #47 today." },
  { delay: 3600, level: "FATAL", msg: "Core dumped. Core has left the building." },
  { delay: 4000, level: "ERROR", msg: "Someone pushed to main. No tests. Of course." },
  { delay: 4400, level: "INFO", msg: "Attempting graceful restart... LOL no." },
];

const STATS = [
  // { label: "Panic Level", value: "MAXIMUM", color: "#ef4444" },
  // { label: "Coffee Consumed", value: "∞ cups", color: "#f97316" },
  // { label: "Uptime", value: "F", color: "#ef4444" },
  // { label: "Blame Assigned", value: "Not me™", color: "#22c55e" },
];

function Ember({ style }: { style: React.CSSProperties }) {
  return (
    <div
      style={{
        position: "absolute",
        width: Math.random() * 4 + 2 + "px",
        height: Math.random() * 4 + 2 + "px",
        borderRadius: "50%",
        background: `hsl(${Math.random() * 30 + 10}, 100%, 60%)`,
        animation: `ember ${Math.random() * 1.5 + 1}s ease-out infinite`,
        animationDelay: Math.random() * 2 + "s",
        ["--drift" as any]: (Math.random() - 0.5) * 60 + "px",
        ...style,
      }}
    />
  );
}

function ServerIcon() {
  return (
    <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
      {[...Array(8)].map((_, i) => (
        <Ember
          key={i}
          style={{
            bottom: Math.random() * 20 + "px",
            left: Math.random() * 80 + 20 + "px",
          }}
        />
      ))}
      <svg viewBox="0 0 80 80" width="80" height="80" fill="none">
        <rect x="8" y="8" width="64" height="18" rx="3" fill="#1f1f1f" stroke="#ef4444" strokeWidth="1.5" />
        <circle cx="62" cy="17" r="3" fill="#ef4444" style={{ animation: "blink 0.6s infinite" }} />
        <circle cx="52" cy="17" r="3" fill="#ef4444" opacity="0.5" />
        <rect x="12" y="13" width="20" height="4" rx="1" fill="#333" />

        <rect x="8" y="31" width="64" height="18" rx="3" fill="#1a1a1a" stroke="#f97316" strokeWidth="1.5" />
        <circle cx="62" cy="40" r="3" fill="#f97316" style={{ animation: "blink 0.9s infinite" }} />
        <circle cx="52" cy="40" r="3" fill="#f97316" opacity="0.3" />
        <rect x="12" y="36" width="16" height="4" rx="1" fill="#2a2a2a" />

        <rect x="8" y="54" width="64" height="18" rx="3" fill="#111" stroke="#dc2626" strokeWidth="1.5" />
        <rect x="10" y="56" width="60" height="14" rx="2" fill="url(#fire)" opacity="0.4" />
        <defs>
          <linearGradient id="fire" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4500" />
            <stop offset="100%" stopColor="#ff0000" stopOpacity="0" />
          </linearGradient>
        </defs>

        <line x1="20" y1="26" x2="30" y2="31" stroke="#ef4444" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
        <line x1="50" y1="49" x2="60" y2="54" stroke="#f97316" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
      </svg>
    </div>
  );
}

export default function Error500Page() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<any[]>([]);
  const [glitching, setGlitching] = useState(false);
  const [shaking, setShaking] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    LOG_LINES.forEach(({ delay, level, msg }) => {
      setTimeout(() => {
        setLogs((prev) => [...prev, { level, msg, id: Date.now() + Math.random() }]);
      }, delay);
    });

    const glitchInterval = setInterval(() => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 300);
    }, 3000);

    const shakeInterval = setInterval(() => {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }, 7000);

    return () => {
      clearInterval(glitchInterval);
      clearInterval(shakeInterval);
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const levelColor: Record<string, string> = {
    FATAL: "#ef4444",
    ERROR: "#f97316",
    WARN: "#eab308",
    INFO: "#6b7280",
  };

  return (
    <>
      <style>{glitchKeyframes}</style>

      <div
        className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
        style={{
          background: "#080808",
          fontFamily: "'Share Tech Mono', 'Courier New', monospace",
          animation: shaking ? "shake 0.5s ease-in-out" : "none",
        }}
      >
        {/* Scanline */}
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            height: "3px",
            background: "rgba(255,255,255,0.03)",
            zIndex: 100,
            animation: "scanline 4s linear infinite",
            pointerEvents: "none",
          }}
        />

        {/* Noise overlay */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            opacity: 0.03,
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            animation: "noise 0.3s steps(1) infinite",
            pointerEvents: "none",
            zIndex: 99,
          }}
        />

        {/* Red vignette */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "radial-gradient(ellipse at center, transparent 60%, rgba(180,0,0,0.18) 100%)",
            pointerEvents: "none",
            zIndex: 98,
          }}
        />

        {/* Grid lines */}
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(239,68,68,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(239,68,68,0.04) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            pointerEvents: "none",
          }}
        />

        <div
          className="relative z-10 w-full max-w-4xl px-6 py-12 flex flex-col items-center gap-10"
          style={{ animation: "fadeInUp 0.6s ease-out both" }}
        >
          {/* Top bar */}
          <div className="w-full flex items-center justify-between" style={{ opacity: 0.5 }}>
            <span style={{ fontSize: 11, color: "#ef4444", letterSpacing: "0.2em" }}>
              ██ SYSTEM_FAILURE_DETECTED ██
            </span>
            <span style={{ fontSize: 11, color: "#6b7280", letterSpacing: "0.1em" }}>
              {new Date().toISOString()}
            </span>
          </div>

          {/* Giant 500 */}
          <div className="relative flex flex-col items-center select-none">
            <div style={{ position: "relative", display: "inline-block" }}>
              <div
                style={{
                  fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                  fontSize: "clamp(120px, 22vw, 260px)",
                  lineHeight: 1,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                  animation: "rgb-shift 2s infinite, flicker 5s linear infinite",
                  userSelect: "none",
                }}
              >
                500
              </div>

              {/* Glitch layers */}
              {glitching && (
                <>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                      fontSize: "clamp(120px, 22vw, 260px)",
                      lineHeight: 1,
                      color: "#ff0040",
                      letterSpacing: "-0.02em",
                      animation: "glitch 0.3s infinite",
                      opacity: 0.8,
                    }}
                  >
                    500
                  </div>
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      fontFamily: "'Bebas Neue', 'Impact', sans-serif",
                      fontSize: "clamp(120px, 22vw, 260px)",
                      lineHeight: 1,
                      color: "#00ffff",
                      letterSpacing: "-0.02em",
                      animation: "glitch 0.3s infinite reverse",
                      opacity: 0.5,
                    }}
                  >
                    500
                  </div>
                </>
              )}
            </div>

            {/* Server icon below 500 */}
            <div style={{ marginTop: -16 }}>
              <ServerIcon />
            </div>

            <div
              style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: "clamp(18px, 4vw, 32px)",
                color: "#ef4444",
                letterSpacing: "0.3em",
                marginTop: 4,
              }}
            >
              INTERNAL SERVER ERROR
            </div>
            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                letterSpacing: "0.15em",
                marginTop: 8,
                textAlign: "center",
              }}
            >
              Something exploded on our end. It&apos;s not you, it&apos;s definitely us.
            </div>
          </div>

          {/* Stats row */}
          {/* <div className="w-full grid grid-cols-2 gap-3 sm:grid-cols-4">
            {STATS.map(({ label, value, color }) => (
              <div
                key={label}
                style={{
                  background: "#0f0f0f",
                  border: "1px solid #1f1f1f",
                  borderTop: `2px solid ${color}`,
                  borderRadius: 4,
                  padding: "12px 16px",
                  animation: "fadeInUp 0.6s ease-out both",
                }}
              >
                <div style={{ fontSize: 10, color: "#4b4b4b", letterSpacing: "0.15em", marginBottom: 6 }}>
                  {label.toUpperCase()}
                </div>
                <div style={{ fontSize: 16, color, fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div> */}

          {/* Terminal log */}
          <div className="w-full">
            <div
              style={{
                fontSize: 11,
                color: "#4b4b4b",
                letterSpacing: "0.15em",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#ef4444",
                  animation: "pulse-red 1.5s infinite",
                }}
              />
              LIVE_ERROR_STREAM
            </div>
            <div
              ref={logRef}
              style={{
                background: "#050505",
                border: "1px solid #1a1a1a",
                borderRadius: 4,
                padding: "16px",
                height: 200,
                overflowY: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "#1f1f1f #050505",
              }}
            >
              {logs.map((log) => (
                <div
                  key={log.id}
                  style={{
                    display: "flex",
                    gap: 12,
                    marginBottom: 6,
                    fontSize: 12,
                    animation: "fadeInUp 0.3s ease-out both",
                  }}
                >
                  <span
                    style={{
                      color: levelColor[log.level] || "#6b7280",
                      minWidth: 44,
                      fontSize: 10,
                      letterSpacing: "0.05em",
                      opacity: 0.9,
                    }}
                  >
                    [{log.level}]
                  </span>
                  <span style={{ color: "#555", fontSize: 12 }}>{log.msg}</span>
                </div>
              ))}
              {logs.length > 0 && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 14,
                    background: "#ef4444",
                    animation: "blink 1s infinite",
                    verticalAlign: "middle",
                  }}
                />
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <button
              onClick={() => window.location.reload()}
              style={{
                background: "#ef4444",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                padding: "12px 32px",
                fontSize: 13,
                letterSpacing: "0.2em",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s",
                animation: "pulse-red 2s infinite",
              }}
              onMouseEnter={(e) => ((e.target as HTMLButtonElement).style.background = "#dc2626")}
              onMouseLeave={(e) => ((e.target as HTMLButtonElement).style.background = "#ef4444")}
            >
              RETRY (PROBABLY WON&apos;T HELP)
            </button>

            <button
              onClick={() => navigate("/")}
              style={{
                background: "transparent",
                color: "#6b7280",
                border: "1px solid #1f1f1f",
                borderRadius: 4,
                padding: "12px 32px",
                fontSize: 13,
                letterSpacing: "0.2em",
                cursor: "pointer",
                fontFamily: "inherit",
                transition: "all 0.2s",
              }}
              onMouseEnter={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.borderColor = "#4b4b4b";
                target.style.color = "#9ca3af";
              }}
              onMouseLeave={(e) => {
                const target = e.target as HTMLButtonElement;
                target.style.borderColor = "#1f1f1f";
                target.style.color = "#6b7280";
              }}
            >
              GO HOME
            </button>
          </div>

          {/* Footer */}
          <div
            style={{
              fontSize: 11,
              color: "#2a2a2a",
              letterSpacing: "0.1em",
              textAlign: "center",
            }}
          >
            ERR_CODE: 0x{Math.floor(Math.random() * 0xffffff)
              .toString(16)
              .toUpperCase()
              .padStart(6, "0")}{" "}
            &nbsp;|&nbsp; INCIDENT_ID: SKILL-ISSUE-
            {Math.floor(Math.random() * 9000) + 1000} &nbsp;|&nbsp; ON-CALL: GOOD_LUCK
          </div>
        </div>
      </div>
    </>
  );
}
