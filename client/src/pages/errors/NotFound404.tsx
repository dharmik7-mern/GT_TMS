import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const NUM_STARS = 120;
const NUM_PARTICLES = 18;

function randomBetween(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function Stars() {
  const stars = Array.from({ length: NUM_STARS }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: randomBetween(0.8, 2.8),
    delay: randomBetween(0, 6),
    dur: randomBetween(2.5, 6),
    opacity: randomBetween(0.3, 1),
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            opacity: s.opacity,
            animation: `twinkle ${s.dur}s ${s.delay}s ease-in-out infinite`,
          }}
        />
      ))}
    </div>
  );
}

function FloatingParticles() {
  const particles = Array.from({ length: NUM_PARTICLES }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    size: randomBetween(3, 10),
    delay: randomBetween(0, 8),
    dur: randomBetween(6, 14),
    color: i % 3 === 0 ? "#00ffe5" : i % 3 === 1 ? "#ff2d78" : "#a259ff",
  }));

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            bottom: "-20px",
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            animation: `floatUp ${p.dur}s ${p.delay}s linear infinite`,
            opacity: 0.7,
          }}
        />
      ))}
    </div>
  );
}

function Astronaut() {
  return (
    <div
      className="relative flex items-center justify-center"
      style={{ animation: "astronautFloat 4s ease-in-out infinite" }}
    >
      <svg
        viewBox="0 0 120 160"
        width="130"
        height="160"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Glow aura */}
        <ellipse cx="60" cy="80" rx="52" ry="68" fill="rgba(0,255,229,0.07)" />

        {/* Body suit */}
        <ellipse cx="60" cy="105" rx="32" ry="42" fill="#dde8f5" />
        <ellipse cx="60" cy="105" rx="32" ry="42" fill="url(#bodyGrad)" />

        {/* Helmet */}
        <circle cx="60" cy="58" r="30" fill="#c8d8ef" />
        <circle cx="60" cy="58" r="30" fill="url(#helmetGrad)" />
        {/* Visor */}
        <ellipse cx="60" cy="59" rx="18" ry="16" fill="#0a0f2e" opacity="0.85" />
        <ellipse cx="60" cy="59" rx="18" ry="16" fill="url(#visorReflect)" opacity="0.35" />
        {/* Visor glow */}
        <ellipse cx="60" cy="59" rx="18" ry="16" stroke="#00ffe5" strokeWidth="1.5" fill="none" opacity="0.5" />

        {/* Helmet ring */}
        <ellipse cx="60" cy="82" rx="30" ry="7" fill="#b0bfd4" />

        {/* Left arm */}
        <ellipse cx="28" cy="100" rx="9" ry="24" fill="#c8d8ef" transform="rotate(-15 28 100)" />
        {/* Right arm */}
        <ellipse cx="92" cy="100" rx="9" ry="24" fill="#c8d8ef" transform="rotate(15 92 100)" />

        {/* Gloves */}
        <circle cx="20" cy="118" r="8" fill="#a0b8cc" />
        <circle cx="100" cy="118" r="8" fill="#a0b8cc" />

        {/* Legs */}
        <rect x="38" y="138" width="14" height="20" rx="7" fill="#b0c4d8" />
        <rect x="68" y="138" width="14" height="20" rx="7" fill="#b0c4d8" />

        {/* Boots */}
        <rect x="33" y="152" width="22" height="10" rx="5" fill="#8ca0b8" />
        <rect x="63" y="152" width="22" height="10" rx="5" fill="#8ca0b8" />

        {/* Chest panel */}
        <rect x="47" y="92" width="26" height="22" rx="4" fill="#90aac5" opacity="0.6" />
        <rect x="50" y="95" width="8" height="4" rx="2" fill="#00ffe5" opacity="0.9" />
        <rect x="62" y="95" width="8" height="4" rx="2" fill="#ff2d78" opacity="0.9" />
        <circle cx="54" cy="108" r="3" fill="#a259ff" opacity="0.85" />
        <circle cx="66" cy="108" r="3" fill="#00ffe5" opacity="0.85" />

        {/* Stars inside visor */}
        <circle cx="52" cy="53" r="1" fill="white" opacity="0.7" />
        <circle cx="68" cy="65" r="0.8" fill="white" opacity="0.5" />
        <circle cx="58" cy="68" r="0.7" fill="#00ffe5" opacity="0.9" />

        <defs>
          <radialGradient id="bodyGrad" cx="40%" cy="30%">
            <stop offset="0%" stopColor="white" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#7090b0" stopOpacity="0.2" />
          </radialGradient>
          <radialGradient id="helmetGrad" cx="35%" cy="30%">
            <stop offset="0%" stopColor="white" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#6080a0" stopOpacity="0.2" />
          </radialGradient>
          <linearGradient id="visorReflect" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#00ffe5" stopOpacity="0.0" />
          </linearGradient>
        </defs>
      </svg>

      {/* Jetpack exhaust */}
      <div
        className="absolute -bottom-3 left-1/2 -translate-x-1/2"
        style={{ animation: "exhaustPulse 0.4s ease-in-out infinite alternate" }}
      >
        <div
          className="w-4 h-8 rounded-full mx-auto"
          style={{
            background: "linear-gradient(to bottom, #00ffe5, #a259ff, transparent)",
            filter: "blur(4px)",
            opacity: 0.8,
          }}
        />
      </div>
    </div>
  );
}

function GlitchText({ text }: { text: string }) {
  const [glitching, setGlitching] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setGlitching(true);
      setTimeout(() => setGlitching(false), 300);
    }, randomBetween(2000, 4500));
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative select-none" style={{ fontFamily: "'Orbitron', monospace" }}>
      <span
        className="relative block text-center font-black"
        style={{
          fontSize: "clamp(5rem, 18vw, 10rem)",
          letterSpacing: "-0.02em",
          background: "linear-gradient(135deg, #00ffe5 0%, #a259ff 50%, #ff2d78 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          textShadow: "none",
          filter: glitching
            ? "drop-shadow(4px 0 0 #ff2d78) drop-shadow(-4px 0 0 #00ffe5)"
            : "drop-shadow(0 0 40px rgba(0,255,229,0.4))",
          transition: "filter 0.05s",
          animation: "pulse404 3s ease-in-out infinite",
        }}
      >
        {text}
      </span>
      {/* Glitch slices */}
      {glitching && (
        <>
          <span
            className="absolute inset-0 block text-center font-black overflow-hidden"
            style={{
              fontSize: "clamp(5rem, 18vw, 10rem)",
              letterSpacing: "-0.02em",
              color: "#ff2d78",
              opacity: 0.7,
              clipPath: "inset(30% 0 55% 0)",
              transform: "translateX(6px)",
              fontFamily: "'Orbitron', monospace",
              WebkitTextFillColor: "#ff2d78",
            }}
          >
            {text}
          </span>
          <span
            className="absolute inset-0 block text-center font-black overflow-hidden"
            style={{
              fontSize: "clamp(5rem, 18vw, 10rem)",
              letterSpacing: "-0.02em",
              color: "#00ffe5",
              opacity: 0.7,
              clipPath: "inset(60% 0 20% 0)",
              transform: "translateX(-6px)",
              fontFamily: "'Orbitron', monospace",
              WebkitTextFillColor: "#00ffe5",
            }}
          >
            {text}
          </span>
        </>
      )}
    </div>
  );
}

function ScanLine() {
  return (
    <div
      className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl"
      style={{ zIndex: 10 }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          height: "2px",
          background: "linear-gradient(90deg, transparent, rgba(0,255,229,0.18), transparent)",
          animation: "scanline 4s linear infinite",
        }}
      />
    </div>
  );
}

export default function NotFound404() {
  const navigate = useNavigate();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&family=Space+Mono:wght@400;700&display=swap');

        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.4); }
        }

        @keyframes floatUp {
          0% { transform: translateY(0) scale(1); opacity: 0.7; }
          80% { opacity: 0.5; }
          100% { transform: translateY(-110vh) scale(0.3); opacity: 0; }
        }

        @keyframes astronautFloat {
          0%, 100% { transform: translateY(0px) rotate(-3deg); }
          50% { transform: translateY(-22px) rotate(3deg); }
        }

        @keyframes exhaustPulse {
          from { transform: translateX(-50%) scaleY(0.7); opacity: 0.5; }
          to { transform: translateX(-50%) scaleY(1.2); opacity: 1; }
        }

        @keyframes scanline {
          0% { top: -2px; }
          100% { top: 100%; }
        }

        @keyframes pulse404 {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.88; }
        }

        @keyframes orbitSpin {
          from { transform: rotate(0deg) translateX(90px) rotate(0deg); }
          to { transform: rotate(360deg) translateX(90px) rotate(-360deg); }
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes ringPulse {
          0%, 100% { opacity: 0.25; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.04); }
        }

        .btn-glow:hover {
          box-shadow: 0 0 30px rgba(0, 255, 229, 0.7), 0 0 60px rgba(0, 255, 229, 0.3) !important;
          transform: translateY(-2px) scale(1.04);
        }

        .btn-ghost:hover {
          background: rgba(255,255,255,0.08) !important;
          border-color: rgba(255,255,255,0.4) !important;
          transform: translateY(-2px);
        }
      `}</style>

      <div
        className="relative min-h-screen flex items-center justify-center overflow-hidden"
        style={{
          background: "radial-gradient(ellipse at 60% 40%, #0d1b3e 0%, #050a1a 55%, #000510 100%)",
          fontFamily: "'Space Mono', monospace",
        }}
      >
        {/* Nebula blobs */}
        <div
          className="absolute pointer-events-none"
          style={{
            top: "5%", left: "5%", width: "420px", height: "420px",
            background: "radial-gradient(ellipse, rgba(162,89,255,0.13) 0%, transparent 70%)",
            filter: "blur(30px)", borderRadius: "50%",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            bottom: "5%", right: "5%", width: "380px", height: "380px",
            background: "radial-gradient(ellipse, rgba(0,255,229,0.10) 0%, transparent 70%)",
            filter: "blur(30px)", borderRadius: "50%",
          }}
        />
        <div
          className="absolute pointer-events-none"
          style={{
            top: "40%", right: "15%", width: "260px", height: "260px",
            background: "radial-gradient(ellipse, rgba(255,45,120,0.09) 0%, transparent 70%)",
            filter: "blur(24px)", borderRadius: "50%",
          }}
        />

        <Stars />
        <FloatingParticles />

        {/* Main card */}
        <div
          className="relative z-10 flex flex-col items-center text-center px-6 py-12 max-w-2xl w-full mx-4 rounded-3xl"
          style={{
            background: "rgba(10,15,40,0.55)",
            border: "1px solid rgba(0,255,229,0.15)",
            boxShadow: "0 0 80px rgba(0,255,229,0.06), inset 0 1px 0 rgba(255,255,255,0.06)",
            backdropFilter: "blur(20px)",
            animation: "fadeInUp 0.9s ease both",
          }}
        >
          <ScanLine />

          {/* Orbit ring + Astronaut */}
          <div className="relative flex items-center justify-center mb-2" style={{ width: 200, height: 200 }}>
            {/* Pulsing rings */}
            {[1, 0.6, 0.3].map((o, i) => (
              <div
                key={i}
                className="absolute rounded-full"
                style={{
                  width: 180 + i * 20, height: 180 + i * 20,
                  border: "1px solid rgba(0,255,229,0.25)",
                  animation: `ringPulse ${2.5 + i * 0.7}s ${i * 0.4}s ease-in-out infinite`,
                  opacity: o * 0.4,
                }}
              />
            ))}
            {/* Orbiting dot */}
            <div
              className="absolute"
              style={{
                width: 10, height: 10,
                top: "50%", left: "50%",
                marginTop: -5, marginLeft: -5,
                animation: "orbitSpin 6s linear infinite",
              }}
            >
              <div
                className="w-full h-full rounded-full"
                style={{
                  background: "#00ffe5",
                  boxShadow: "0 0 12px #00ffe5, 0 0 24px #00ffe5",
                }}
              />
            </div>
            <Astronaut />
          </div>

          {/* 404 Glitch */}
          <GlitchText text="404" />

          {/* Subtitle */}
          <p
            className="mt-1 mb-2 font-bold tracking-widest uppercase text-xs"
            style={{
              color: "#00ffe5",
              letterSpacing: "0.35em",
              animation: "fadeInUp 1.1s 0.3s ease both",
            }}
          >
            ⬡ Signal Lost ⬡
          </p>

          {/* Description */}
          <p
            className="text-base leading-relaxed mb-8 max-w-sm"
            style={{
              color: "rgba(180,200,230,0.75)",
              animation: "fadeInUp 1.1s 0.5s ease both",
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.82rem",
            }}
          >
            Houston, we have a problem. The page you're looking for has drifted into the void — lost among the stars, far beyond our reach.
          </p>

          {/* Coordinate display */}
          <div
            className="flex gap-6 mb-8 text-xs"
            style={{
              color: "rgba(0,255,229,0.5)",
              fontFamily: "'Orbitron', monospace",
              animation: "fadeInUp 1.1s 0.6s ease both",
              letterSpacing: "0.08em",
            }}
          >
            <span>LAT: 404.00°N</span>
            <span>·</span>
            <span>LON: 000.00°E</span>
            <span>·</span>
            <span>ALT: ∞ km</span>
          </div>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row gap-4 w-full max-w-xs"
            style={{ animation: "fadeInUp 1.1s 0.75s ease both" }}
          >
            <button
              className="btn-glow flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all duration-300"
              style={{
                background: "linear-gradient(135deg, #00ffe5, #a259ff)",
                color: "#000510",
                border: "none",
                fontFamily: "'Orbitron', monospace",
                letterSpacing: "0.08em",
                cursor: "pointer",
                boxShadow: "0 0 20px rgba(0, 255, 229, 0.35)",
              }}
              onClick={() => navigate(-1)}
            >
              ← Go Back
            </button>
            <button
              className="btn-ghost flex-1 py-3 px-6 rounded-xl font-bold text-sm transition-all duration-300"
              style={{
                background: "transparent",
                color: "rgba(200,220,255,0.85)",
                border: "1px solid rgba(255,255,255,0.18)",
                fontFamily: "'Orbitron', monospace",
                letterSpacing: "0.08em",
                cursor: "pointer",
              }}
              onClick={() => navigate("/")}
            >
              Home Base
            </button>
          </div>

          {/* Error code footer */}
          <p
            className="mt-8 text-xs"
            style={{
              color: "rgba(100,120,160,0.5)",
              fontFamily: "'Space Mono', monospace",
              fontSize: "0.68rem",
            }}
          >
            ERR_PAGE_NOT_FOUND · CODE 0x404 · DEEP SPACE DIVISION
          </p>
        </div>
      </div>
    </>
  );
}
