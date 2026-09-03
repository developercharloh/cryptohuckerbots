import { useEffect, useState } from "react";
import { VixusLogo } from "@/components/VixusLogo";

const PROGRESS_RAMP_DURATION = 2_400;
const FADE_DURATION = 550;

const LOADING_MESSAGES = [
  "Syncing live market intelligence",
  "Scanning high-confidence opportunities",
  "Calibrating your trading workspace",
  "Ready for the next market move",
];

const DOLLAR_SIGNS = [
  { left: "4%", top: "12%", size: 22, delay: "-1.8s", duration: "6.6s", drift: "-18px", opacity: 0.72 },
  { left: "11%", top: "72%", size: 16, delay: "-4.7s", duration: "7.8s", drift: "22px", opacity: 0.58 },
  { left: "19%", top: "31%", size: 30, delay: "-2.4s", duration: "7.2s", drift: "-28px", opacity: 0.8 },
  { left: "28%", top: "82%", size: 14, delay: "-6.1s", duration: "8.4s", drift: "18px", opacity: 0.54 },
  { left: "35%", top: "16%", size: 18, delay: "-3.2s", duration: "7.5s", drift: "-20px", opacity: 0.64 },
  { left: "43%", top: "62%", size: 24, delay: "-7.3s", duration: "8.8s", drift: "26px", opacity: 0.78 },
  { left: "52%", top: "8%", size: 15, delay: "-5.2s", duration: "7.1s", drift: "-16px", opacity: 0.58 },
  { left: "59%", top: "85%", size: 28, delay: "-1.1s", duration: "8s", drift: "24px", opacity: 0.74 },
  { left: "67%", top: "25%", size: 17, delay: "-4.1s", duration: "6.8s", drift: "-24px", opacity: 0.62 },
  { left: "74%", top: "69%", size: 21, delay: "-6.8s", duration: "8.6s", drift: "20px", opacity: 0.72 },
  { left: "82%", top: "13%", size: 31, delay: "-2.9s", duration: "7.4s", drift: "-22px", opacity: 0.82 },
  { left: "91%", top: "49%", size: 16, delay: "-5.8s", duration: "8.2s", drift: "16px", opacity: 0.6 },
  { left: "8%", top: "46%", size: 12, delay: "-7.9s", duration: "9.2s", drift: "-14px", opacity: 0.5 },
  { left: "23%", top: "58%", size: 13, delay: "-0.9s", duration: "7.7s", drift: "16px", opacity: 0.56 },
  { left: "47%", top: "28%", size: 12, delay: "-3.9s", duration: "8.9s", drift: "-18px", opacity: 0.52 },
  { left: "88%", top: "83%", size: 25, delay: "-6.4s", duration: "7.9s", drift: "28px", opacity: 0.7 },
];

export function WelcomeLoader({ ready = false }: { ready?: boolean }) {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const fadeDuration = reducedMotion ? 120 : FADE_DURATION;
    const startedAt = Date.now();
    let progressTimer: number | undefined;
    let messageTimer: number | undefined;
    let hideTimer: number | undefined;
    let finished = false;

    document.body.style.overflow = "hidden";
    progressTimer = window.setInterval(() => {
      setProgress(Math.min(((Date.now() - startedAt) / PROGRESS_RAMP_DURATION) * 92, 92));
    }, 45);
    if (!reducedMotion) {
      messageTimer = window.setInterval(() => {
        setMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
      }, 820);
    }

    if (ready) {
      finished = true;
      setProgress(100);
      setLeaving(true);
      hideTimer = window.setTimeout(() => {
        setVisible(false);
        document.body.style.overflow = previousOverflow;
      }, fadeDuration);
    }

    return () => {
      if (progressTimer) window.clearInterval(progressTimer);
      if (messageTimer) window.clearInterval(messageTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
      if (!finished) setLeaving(false);
      document.body.style.overflow = previousOverflow;
    };
  }, [ready]);

  if (!visible) return null;

  return (
    <div
      className={`welcome-loader${leaving ? " welcome-loader--leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Loading VIXUS trading intelligence"
    >
      <div className="welcome-loader__aurora welcome-loader__aurora--gold" />
      <div className="welcome-loader__aurora welcome-loader__aurora--blue" />
      <div className="welcome-loader__aurora welcome-loader__aurora--violet" />
      <div className="welcome-loader__grid" />
      <div className="welcome-loader__scanline" />

      <div className="welcome-loader__money-field" aria-hidden="true">
        {DOLLAR_SIGNS.map((sign, index) => (
          <span
            key={index}
            style={{
              left: sign.left,
              top: sign.top,
              fontSize: sign.size,
              opacity: sign.opacity,
              animationDelay: sign.delay,
              animationDuration: sign.duration,
              ["--money-drift" as string]: sign.drift,
            }}
          >
            $
          </span>
        ))}
      </div>

      <div className="welcome-loader__content">
        <div className="welcome-loader__stage" aria-hidden="true">
          <div className="welcome-loader__halo" />
          <div className="welcome-loader__ring welcome-loader__ring--outer" />
          <div className="welcome-loader__ring welcome-loader__ring--middle" />
          <div className="welcome-loader__ring welcome-loader__ring--inner" />
          <div className="welcome-loader__orbit welcome-loader__orbit--one"><span /></div>
          <div className="welcome-loader__orbit welcome-loader__orbit--two"><span /></div>
          <div className="welcome-loader__logo-shell">
            <VixusLogo className="welcome-loader__logo" />
            <div className="welcome-loader__logo-flare" />
          </div>
        </div>

        <div className="welcome-loader__eyebrow">
          <span className="welcome-loader__live-dot" />
          VIXUS / AI MARKET INTELLIGENCE
        </div>
        <h1>
          Trade with <strong>clarity.</strong>
        </h1>
        <p className="welcome-loader__message" key={messageIndex}>
          {LOADING_MESSAGES[messageIndex]}
        </p>
        <p className="welcome-loader__promise">
          High-confidence signals for sharper trading decisions.
        </p>

        <div className="welcome-loader__pill-row" aria-label="Platform features">
          <span><i /> LIVE SIGNALS</span>
          <span><i /> RISK-AWARE</span>
          <span><i /> ALWAYS ON</span>
        </div>

        <div className="welcome-loader__progress-row">
          <span>CONNECTING TO MARKETS</span>
          <strong>{Math.round(progress).toString().padStart(2, "0")}%</strong>
        </div>
        <div className="welcome-loader__progress-track" aria-hidden="true">
          <div className="welcome-loader__progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="welcome-loader__footer">
          <span>SECURE SESSION</span>
          <i />
          <span>LIVE DATA</span>
          <i />
          <span>VIXUS READY</span>
        </div>
      </div>

      <style>{`
        .welcome-loader {
          position: fixed;
          inset: 0;
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          isolation: isolate;
          color: #f8fafc;
          background:
            radial-gradient(circle at 50% 45%, rgba(26, 57, 112, 0.42), transparent 34%),
            linear-gradient(145deg, #040610 0%, #091328 50%, #050b1c 100%);
          opacity: 1;
          transition: opacity ${FADE_DURATION}ms ease, visibility ${FADE_DURATION}ms ease;
        }

        .welcome-loader--leaving {
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
        }

        .welcome-loader__aurora {
          position: absolute;
          width: 32rem;
          height: 32rem;
          border-radius: 999px;
          filter: blur(74px);
          opacity: 0.27;
          pointer-events: none;
          z-index: -3;
          animation: welcome-drift 8s ease-in-out infinite alternate;
        }

        .welcome-loader__aurora--gold {
          top: -17rem;
          left: -12rem;
          background: #f5b942;
        }

        .welcome-loader__aurora--blue {
          right: -14rem;
          bottom: -18rem;
          background: #2878ff;
          animation-delay: -3s;
        }

        .welcome-loader__aurora--violet {
          top: 40%;
          left: 45%;
          width: 18rem;
          height: 18rem;
          background: #7c3aed;
          opacity: 0.12;
          animation-delay: -5s;
        }

        .welcome-loader__grid {
          position: absolute;
          inset: 0;
          opacity: 0.2;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.055) 1px, transparent 1px);
          background-size: 42px 42px;
          mask-image: radial-gradient(ellipse at center, black 8%, transparent 80%);
          pointer-events: none;
          z-index: -2;
        }

        .welcome-loader__scanline {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: 0.18;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            transparent 48%,
            rgba(255, 216, 107, 0.16) 50%,
            transparent 52%,
            transparent 100%
          );
          background-size: 100% 8px;
          mask-image: linear-gradient(to bottom, transparent, black 20%, black 80%, transparent);
          z-index: -1;
        }

        .welcome-loader__money-field {
          position: absolute;
          inset: -14% 0;
          overflow: hidden;
          pointer-events: none;
          z-index: -1;
        }

        .welcome-loader__money-field span {
          position: absolute;
          color: #ffe58d;
          font-family: "JetBrains Mono", monospace;
          font-weight: 800;
          line-height: 1;
          text-shadow:
            0 0 5px rgba(255, 239, 166, 0.95),
            0 0 16px rgba(245, 185, 66, 0.92),
            0 0 34px rgba(245, 185, 66, 0.62),
            0 0 58px rgba(37, 117, 245, 0.28);
          filter: drop-shadow(0 0 7px rgba(255, 216, 107, 0.72));
          animation: welcome-money-flow linear infinite;
          will-change: transform, opacity;
        }

        .welcome-loader__content {
          width: min(calc(100% - 30px), 468px);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 30px 27px 25px;
          border: 1px solid rgba(255, 216, 107, 0.22);
          border-radius: 30px;
          background:
            linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.035)),
            rgba(3, 8, 22, 0.54);
          box-shadow:
            0 30px 110px rgba(0, 0, 0, 0.48),
            0 0 70px rgba(245, 185, 66, 0.09),
            inset 0 1px 0 rgba(255, 255, 255, 0.14);
          backdrop-filter: blur(24px);
          animation: welcome-rise 800ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .welcome-loader__stage {
          position: relative;
          width: 176px;
          height: 176px;
          display: grid;
          place-items: center;
          margin-bottom: 13px;
        }

        .welcome-loader__halo {
          position: absolute;
          width: 150px;
          height: 150px;
          border-radius: 50%;
          background:
            radial-gradient(circle, rgba(255, 216, 107, 0.48), rgba(37, 117, 245, 0.12) 48%, transparent 73%);
          box-shadow: 0 0 70px rgba(245, 185, 66, 0.36);
          animation: welcome-breathe 2.6s ease-in-out infinite;
        }

        .welcome-loader__ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .welcome-loader__ring--outer {
          width: 174px;
          height: 174px;
          border-top-color: #ffd86b;
          border-right-color: rgba(37, 117, 245, 0.75);
          box-shadow: 0 -2px 13px rgba(255, 216, 107, 0.4);
          animation: welcome-spin 6s linear infinite;
        }

        .welcome-loader__ring--middle {
          width: 145px;
          height: 145px;
          border-left-color: rgba(255, 216, 107, 0.92);
          border-bottom-color: rgba(37, 117, 245, 0.68);
          animation: welcome-spin-reverse 4.2s linear infinite;
        }

        .welcome-loader__ring--inner {
          width: 112px;
          height: 112px;
          border: 1px dashed rgba(255, 216, 107, 0.38);
          animation: welcome-spin 9s linear infinite;
        }

        .welcome-loader__orbit {
          position: absolute;
          width: 198px;
          height: 198px;
          border-radius: 50%;
          animation: welcome-spin 5s linear infinite;
        }

        .welcome-loader__orbit--two {
          width: 158px;
          height: 158px;
          animation: welcome-spin-reverse 3.8s linear infinite;
        }

        .welcome-loader__orbit span {
          position: absolute;
          top: 7px;
          left: 50%;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #fff1ae;
          box-shadow: 0 0 11px 4px rgba(255, 216, 107, 0.95), 0 0 28px 9px rgba(245, 185, 66, 0.45);
          transform: translateX(-50%);
        }

        .welcome-loader__orbit--two span {
          top: auto;
          right: 3px;
          bottom: 30px;
          left: auto;
          width: 5px;
          height: 5px;
          background: #8cb7ff;
          box-shadow: 0 0 13px 5px rgba(37, 117, 245, 0.8);
        }

        .welcome-loader__logo-shell {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          width: 86px;
          height: 86px;
          border-radius: 26px;
          border: 1px solid rgba(255, 230, 145, 0.68);
          background: linear-gradient(145deg, rgba(245, 185, 66, 0.42), rgba(37, 117, 245, 0.24));
          box-shadow:
            0 0 0 8px rgba(255, 255, 255, 0.035),
            0 0 30px rgba(245, 185, 66, 0.5),
            0 0 64px rgba(245, 185, 66, 0.26),
            inset 0 1px 0 rgba(255, 255, 255, 0.34);
          animation: welcome-float 2.8s ease-in-out infinite;
        }

        .welcome-loader__logo {
          width: 56px;
          height: 56px;
          filter: drop-shadow(0 0 11px rgba(255, 216, 107, 0.92)) drop-shadow(0 0 25px rgba(245, 185, 66, 0.62));
        }

        .welcome-loader__logo-flare {
          position: absolute;
          inset: -7px;
          border-radius: 30px;
          border: 1px solid rgba(255, 216, 107, 0.28);
          animation: welcome-flare 2.4s ease-in-out infinite;
        }

        .welcome-loader__eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffd86b;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 0.19em;
        }

        .welcome-loader__live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ffe9a3;
          box-shadow: 0 0 10px rgba(255, 216, 107, 1), 0 0 23px rgba(245, 185, 66, 0.72);
          animation: welcome-pulse 1.2s ease-in-out infinite;
        }

        .welcome-loader h1 {
          margin: 13px 0 0;
          font-size: clamp(30px, 8vw, 40px);
          line-height: 1.02;
          letter-spacing: -0.055em;
          font-weight: 850;
        }

        .welcome-loader h1 strong {
          color: #ffd86b;
          text-shadow: 0 0 20px rgba(245, 185, 66, 0.48);
        }

        .welcome-loader__message {
          min-height: 20px;
          margin: 13px 0 0;
          color: rgba(239, 246, 255, 0.82);
          font-size: 13px;
          letter-spacing: 0.01em;
          animation: welcome-message-in 480ms ease both;
        }

        .welcome-loader__promise {
          margin: 6px 0 0;
          color: rgba(148, 163, 184, 0.76);
          font-size: 11px;
        }

        .welcome-loader__pill-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 7px;
          margin-top: 19px;
        }

        .welcome-loader__pill-row span {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 9px;
          border: 1px solid rgba(255, 216, 107, 0.19);
          border-radius: 999px;
          background: rgba(255, 216, 107, 0.07);
          color: rgba(255, 229, 141, 0.86);
          font-size: 8px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .welcome-loader__pill-row i {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          background: #ffd86b;
          box-shadow: 0 0 7px rgba(255, 216, 107, 0.9);
        }

        .welcome-loader__progress-row {
          width: 100%;
          display: flex;
          justify-content: space-between;
          margin-top: 25px;
          color: rgba(148, 163, 184, 0.76);
          font-family: "JetBrains Mono", monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.12em;
        }

        .welcome-loader__progress-row strong {
          color: #ffd86b;
          font-weight: 800;
          text-shadow: 0 0 11px rgba(245, 185, 66, 0.62);
        }

        .welcome-loader__progress-track {
          width: 100%;
          height: 5px;
          margin-top: 9px;
          overflow: hidden;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.1);
          box-shadow: inset 0 0 7px rgba(0, 0, 0, 0.3);
        }

        .welcome-loader__progress-bar {
          position: relative;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #f5b942, #fff0ad 44%, #3988ff);
          box-shadow: 0 0 10px rgba(245, 185, 66, 0.92), 0 0 24px rgba(245, 185, 66, 0.45);
          transition: width 80ms linear;
        }

        .welcome-loader__progress-bar::after {
          position: absolute;
          top: -5px;
          right: 0;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          background: #fff5bf;
          box-shadow: 0 0 12px 4px rgba(255, 216, 107, 0.86);
          content: "";
        }

        .welcome-loader__footer {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 17px;
          color: rgba(148, 163, 184, 0.58);
          font-size: 7px;
          font-weight: 800;
          letter-spacing: 0.1em;
        }

        .welcome-loader__footer i {
          width: 3px;
          height: 3px;
          border-radius: 50%;
          background: rgba(255, 216, 107, 0.82);
          box-shadow: 0 0 5px rgba(255, 216, 107, 0.6);
        }

        @keyframes welcome-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes welcome-spin-reverse {
          to { transform: rotate(-360deg); }
        }

        @keyframes welcome-drift {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to { transform: translate3d(8vw, 6vh, 0) scale(1.13); }
        }

        @keyframes welcome-breathe {
          0%, 100% { transform: scale(0.91); opacity: 0.7; }
          50% { transform: scale(1.09); opacity: 1; }
        }

        @keyframes welcome-float {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          50% { transform: translateY(-6px) rotate(1deg); }
        }

        @keyframes welcome-flare {
          0%, 100% { opacity: 0.25; transform: scale(0.96); }
          50% { opacity: 0.9; transform: scale(1.08); }
        }

        @keyframes welcome-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.7); }
          50% { opacity: 1; transform: scale(1.18); }
        }

        @keyframes welcome-rise {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes welcome-message-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes welcome-money-flow {
          0% {
            opacity: 0;
            transform: translate3d(0, -15vh, 0) rotate(-14deg) scale(0.64);
          }
          14% { opacity: 1; }
          48% {
            opacity: 0.65;
            transform: translate3d(var(--money-drift), 45vh, 0) rotate(10deg) scale(1.05);
          }
          84% { opacity: 0.9; }
          100% {
            opacity: 0;
            transform: translate3d(calc(var(--money-drift) * -0.6), 118vh, 0) rotate(-8deg) scale(0.78);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .welcome-loader *,
          .welcome-loader *::before,
          .welcome-loader *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
          }
        }

        @media (max-width: 420px) {
          .welcome-loader__content {
            padding: 25px 18px 22px;
            border-radius: 26px;
          }
          .welcome-loader__stage {
            transform: scale(0.86);
            margin: -9px 0 1px;
          }
          .welcome-loader__eyebrow {
            font-size: 8px;
            letter-spacing: 0.14em;
          }
          .welcome-loader__footer {
            gap: 5px;
            font-size: 6px;
          }
        }
      `}</style>
    </div>
  );
}
