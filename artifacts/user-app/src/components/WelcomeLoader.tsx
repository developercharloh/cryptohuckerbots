import { useEffect, useState } from "react";
import { VixusLogo } from "@/components/VixusLogo";

const LOADER_DURATION = 10_000;
const FADE_DURATION = 700;
const LANDING_SETTLE_DELAY = 350;

const LOADING_MESSAGES = [
  "Preparing your live market view",
  "Warming up market intelligence",
  "Bringing your trading workspace online",
  "Almost ready for the next move",
];

const DOLLAR_SIGNS = [
  { left: "7%", top: "14%", size: 18, delay: "-1.2s", duration: "7.5s", drift: "-22px" },
  { left: "18%", top: "67%", size: 12, delay: "-5.8s", duration: "9s", drift: "18px" },
  { left: "29%", top: "29%", size: 10, delay: "-3.4s", duration: "8.2s", drift: "-14px" },
  { left: "41%", top: "82%", size: 16, delay: "-7.1s", duration: "10s", drift: "24px" },
  { left: "56%", top: "12%", size: 11, delay: "-4.2s", duration: "8.8s", drift: "-18px" },
  { left: "69%", top: "75%", size: 18, delay: "-8.4s", duration: "9.6s", drift: "20px" },
  { left: "80%", top: "24%", size: 13, delay: "-2.1s", duration: "7.9s", drift: "-24px" },
  { left: "92%", top: "57%", size: 10, delay: "-6.3s", duration: "8.6s", drift: "16px" },
  { left: "12%", top: "42%", size: 9, delay: "-7.7s", duration: "10.5s", drift: "-12px" },
  { left: "87%", top: "86%", size: 14, delay: "-0.6s", duration: "9.2s", drift: "26px" },
];

export function WelcomeLoader() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [started, setStarted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    let progressTimer: number | undefined;
    let messageTimer: number | undefined;
    let fadeTimer: number | undefined;
    let hideTimer: number | undefined;

    const launchTimer = window.setTimeout(() => {
      setStarted(true);
      setVisible(true);
      document.body.style.overflow = "hidden";
      const startedAt = Date.now();
      progressTimer = window.setInterval(() => {
        setProgress(Math.min(((Date.now() - startedAt) / LOADER_DURATION) * 100, 100));
      }, 80);
      messageTimer = window.setInterval(() => {
        setMessageIndex((current) => (current + 1) % LOADING_MESSAGES.length);
      }, 2400);
      fadeTimer = window.setTimeout(() => {
        setProgress(100);
        setLeaving(true);
        hideTimer = window.setTimeout(() => {
          setVisible(false);
          document.body.style.overflow = previousOverflow;
        }, FADE_DURATION);
      }, LOADER_DURATION - FADE_DURATION);
    }, LANDING_SETTLE_DELAY);

    return () => {
      window.clearTimeout(launchTimer);
      if (progressTimer) window.clearInterval(progressTimer);
      if (messageTimer) window.clearInterval(messageTimer);
      if (fadeTimer) window.clearTimeout(fadeTimer);
      if (hideTimer) window.clearTimeout(hideTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  if (!started || !visible) return null;

  return (
    <div
      className={`welcome-loader${leaving ? " welcome-loader--leaving" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Welcome to VIXUS"
    >
      <div className="welcome-loader__aurora welcome-loader__aurora--gold" />
      <div className="welcome-loader__aurora welcome-loader__aurora--blue" />
      <div className="welcome-loader__grid" />
      <div className="welcome-loader__money-field" aria-hidden="true">
        {DOLLAR_SIGNS.map((sign, index) => (
          <span
            key={index}
            style={{
              left: sign.left,
              top: sign.top,
              fontSize: sign.size,
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
          <div className="welcome-loader__ring welcome-loader__ring--inner" />
          <div className="welcome-loader__orbit">
            <span />
          </div>
          <div className="welcome-loader__logo-shell">
            <VixusLogo className="welcome-loader__logo" />
          </div>
        </div>

        <div className="welcome-loader__eyebrow">
          <span className="welcome-loader__live-dot" />
          VIXUS INTELLIGENCE
        </div>
        <h1>Welcome to VIXUS</h1>
        <p className="welcome-loader__message" key={messageIndex}>
          {LOADING_MESSAGES[messageIndex]}
        </p>

        <div className="welcome-loader__progress-row">
          <span>INITIALIZING</span>
          <strong>{Math.round(progress).toString().padStart(2, "0")}%</strong>
        </div>
        <div className="welcome-loader__progress-track" aria-hidden="true">
          <div className="welcome-loader__progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="welcome-loader__footer">
          <span>LIVE MARKETS</span>
          <i />
          <span>SECURE SESSION</span>
          <i />
          <span>AI READY</span>
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
            radial-gradient(circle at 50% 45%, rgba(30, 53, 104, 0.34), transparent 34%),
            linear-gradient(145deg, #050814 0%, #0a1022 52%, #071326 100%);
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
          width: 36rem;
          height: 36rem;
          border-radius: 999px;
          filter: blur(70px);
          opacity: 0.24;
          pointer-events: none;
          z-index: -2;
          animation: welcome-drift 9s ease-in-out infinite alternate;
        }

        .welcome-loader__aurora--gold {
          top: -18rem;
          left: -12rem;
          background: #f5b942;
        }

        .welcome-loader__aurora--blue {
          right: -15rem;
          bottom: -18rem;
          background: #2575f5;
          animation-delay: -4s;
        }

        .welcome-loader__grid {
          position: absolute;
          inset: 0;
          opacity: 0.18;
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
          background-size: 44px 44px;
          mask-image: radial-gradient(ellipse at center, black 10%, transparent 78%);
          pointer-events: none;
          z-index: -1;
        }

        .welcome-loader__money-field {
          position: absolute;
          inset: -12% 0;
          overflow: hidden;
          pointer-events: none;
          z-index: -1;
        }

        .welcome-loader__money-field span {
          position: absolute;
          color: rgba(255, 216, 107, 0.42);
          font-family: "JetBrains Mono", monospace;
          font-weight: 700;
          line-height: 1;
          text-shadow: 0 0 18px rgba(245, 185, 66, 0.4);
          animation: welcome-money-flow linear infinite;
          will-change: transform, opacity;
        }

        .welcome-loader__content {
          width: min(100% - 40px, 430px);
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 34px 28px 28px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 30px;
          background: linear-gradient(145deg, rgba(255, 255, 255, 0.105), rgba(255, 255, 255, 0.035));
          box-shadow:
            0 30px 100px rgba(0, 0, 0, 0.36),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(24px);
          animation: welcome-rise 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }

        .welcome-loader__stage {
          position: relative;
          width: 178px;
          height: 178px;
          display: grid;
          place-items: center;
          margin-bottom: 20px;
        }

        .welcome-loader__halo {
          position: absolute;
          width: 148px;
          height: 148px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(245, 185, 66, 0.26), rgba(37, 117, 245, 0.04) 58%, transparent 72%);
          animation: welcome-breathe 3.4s ease-in-out infinite;
        }

        .welcome-loader__ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .welcome-loader__ring--outer {
          width: 172px;
          height: 172px;
          border-top-color: rgba(245, 185, 66, 0.95);
          border-right-color: rgba(37, 117, 245, 0.58);
          animation: welcome-spin 7s linear infinite;
        }

        .welcome-loader__ring--inner {
          width: 134px;
          height: 134px;
          border-left-color: rgba(245, 185, 66, 0.9);
          border-bottom-color: rgba(37, 117, 245, 0.7);
          animation: welcome-spin-reverse 4.5s linear infinite;
        }

        .welcome-loader__orbit {
          position: absolute;
          width: 194px;
          height: 194px;
          border-radius: 50%;
          animation: welcome-spin 5.5s linear infinite;
        }

        .welcome-loader__orbit span {
          position: absolute;
          top: 10px;
          left: 50%;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #ffd86b;
          box-shadow: 0 0 14px 4px rgba(245, 185, 66, 0.72);
          transform: translateX(-50%);
        }

        .welcome-loader__logo-shell {
          position: relative;
          z-index: 1;
          display: grid;
          place-items: center;
          width: 84px;
          height: 84px;
          border-radius: 25px;
          border: 1px solid rgba(255, 216, 107, 0.5);
          background: linear-gradient(145deg, rgba(245, 185, 66, 0.3), rgba(37, 117, 245, 0.2));
          box-shadow:
            0 0 0 8px rgba(255, 255, 255, 0.035),
            0 0 34px rgba(245, 185, 66, 0.24),
            inset 0 1px 0 rgba(255, 255, 255, 0.25);
          animation: welcome-float 3s ease-in-out infinite;
        }

        .welcome-loader__logo {
          width: 54px;
          height: 54px;
          filter: drop-shadow(0 0 16px rgba(255, 216, 107, 0.72));
        }

        .welcome-loader__eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #ffd86b;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.2em;
        }

        .welcome-loader__live-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ffd86b;
          box-shadow: 0 0 10px rgba(255, 216, 107, 0.9);
          animation: welcome-pulse 1.5s ease-in-out infinite;
        }

        .welcome-loader h1 {
          margin: 13px 0 0;
          font-size: clamp(27px, 7vw, 36px);
          line-height: 1.05;
          letter-spacing: -0.045em;
          font-weight: 850;
        }

        .welcome-loader__message {
          min-height: 21px;
          margin: 12px 0 0;
          color: rgba(226, 232, 240, 0.68);
          font-size: 13px;
          letter-spacing: 0.01em;
          animation: welcome-message-in 500ms ease both;
        }

        .welcome-loader__progress-row {
          width: 100%;
          display: flex;
          justify-content: space-between;
          margin-top: 30px;
          color: rgba(148, 163, 184, 0.8);
          font-family: "JetBrains Mono", monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.12em;
        }

        .welcome-loader__progress-row strong {
          color: #ffd86b;
          font-weight: 700;
        }

        .welcome-loader__progress-track {
          width: 100%;
          height: 5px;
          margin-top: 9px;
          overflow: hidden;
          border-radius: 99px;
          background: rgba(255, 255, 255, 0.1);
        }

        .welcome-loader__progress-bar {
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #f5b942, #ffd86b 44%, #3988ff);
          box-shadow: 0 0 14px rgba(245, 185, 66, 0.55);
          transition: width 120ms linear;
        }

        .welcome-loader__footer {
          display: flex;
          align-items: center;
          gap: 9px;
          margin-top: 19px;
          color: rgba(148, 163, 184, 0.6);
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.09em;
        }

        .welcome-loader__footer i {
          width: 2px;
          height: 2px;
          border-radius: 50%;
          background: rgba(255, 216, 107, 0.7);
        }

        @keyframes welcome-spin {
          to { transform: rotate(360deg); }
        }

        @keyframes welcome-spin-reverse {
          to { transform: rotate(-360deg); }
        }

        @keyframes welcome-drift {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to { transform: translate3d(7vw, 5vh, 0) scale(1.12); }
        }

        @keyframes welcome-breathe {
          0%, 100% { transform: scale(0.94); opacity: 0.7; }
          50% { transform: scale(1.08); opacity: 1; }
        }

        @keyframes welcome-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }

        @keyframes welcome-pulse {
          0%, 100% { opacity: 0.45; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.15); }
        }

        @keyframes welcome-rise {
          from { opacity: 0; transform: translateY(18px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        @keyframes welcome-message-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes welcome-money-flow {
          0% {
            opacity: 0;
            transform: translate3d(0, -14vh, 0) rotate(-12deg) scale(0.72);
          }
          14% { opacity: 0.72; }
          50% {
            opacity: 0.3;
            transform: translate3d(var(--money-drift), 44vh, 0) rotate(10deg) scale(1);
          }
          84% { opacity: 0.58; }
          100% {
            opacity: 0;
            transform: translate3d(calc(var(--money-drift) * -0.6), 116vh, 0) rotate(-8deg) scale(0.78);
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
            padding: 28px 20px 23px;
            border-radius: 26px;
          }
          .welcome-loader__stage {
            transform: scale(0.88);
            margin: -6px 0 8px;
          }
          .welcome-loader__footer {
            gap: 6px;
            font-size: 7px;
          }
        }
      `}</style>
    </div>
  );
}