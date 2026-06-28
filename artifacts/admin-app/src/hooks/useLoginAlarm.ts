import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

export const ALARM_KEY = "vixus_login_alarm";

export function isAlarmEnabled(): boolean {
  const v = localStorage.getItem(ALARM_KEY);
  return v === null || v === "1";
}

const API_BASE =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? "https://vixus.ai"
    : "";

// ─── Frequencies (Hz) ────────────────────────────────────────────────────────
// All four voice ranges covered
const N: Record<string, number> = {
  C3: 130.81, D3: 146.83, E3: 164.81, G3: 196.00,
  A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, Fs4: 369.99, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, G5: 783.99,
};

// ─── Reverb (same proven feedback-loop from working original) ─────────────────
function makeReverb(ctx: AudioContext) {
  const dly = ctx.createDelay(0.6);
  const fb  = ctx.createGain();
  const wet = ctx.createGain();
  dly.delayTime.value = 0.32;
  fb.gain.value       = 0.40;
  wet.gain.value      = 0.22;
  dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(ctx.destination);
  const dry = ctx.createGain();
  dry.gain.value = 0.88;
  dry.connect(ctx.destination);
  dry.connect(dly);
  return { dry };
}

// ─── VOICE INSTRUMENTS ───────────────────────────────────────────────────────
// Each voice has a distinct timbre so they stand apart in the mix.

// Soprano — trumpet (bright, 6 harmonic partials, highest voice)
function sopranoV(ctx: AudioContext, dest: AudioNode, t0: number, t: number,
                  freq: number, dur: number, vol = 1.0) {
  [{ r: 1, g: 0.22 }, { r: 2, g: 0.88 }, { r: 3, g: 0.78 },
   { r: 4, g: 0.60 }, { r: 5, g: 0.38 }, { r: 6, g: 0.18 }]
    .forEach(({ r, g }) => {
      const osc = ctx.createOscillator();
      const gn  = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * r;
      const att  = Math.min(0.08, dur * 0.16);
      const hold = Math.max(att + 0.01, dur - Math.min(0.18, dur * 0.22));
      const peak = g * vol * 0.38;
      gn.gain.setValueAtTime(0, t0 + t);
      gn.gain.linearRampToValueAtTime(peak, t0 + t + att);
      gn.gain.setValueAtTime(peak, t0 + t + hold);
      gn.gain.linearRampToValueAtTime(0, t0 + t + dur);
      osc.connect(gn); gn.connect(dest);
      osc.start(t0 + t); osc.stop(t0 + t + dur + 0.05);
    });
}

// Alto — warm flute/choir (triangle waves, 3 partials, mellow)
function altoV(ctx: AudioContext, dest: AudioNode, t0: number, t: number,
               freq: number, dur: number, vol = 1.0) {
  [{ r: 1, g: 0.80 }, { r: 2, g: 0.22 }, { r: 3, g: 0.07 }]
    .forEach(({ r, g }) => {
      const osc = ctx.createOscillator();
      const gn  = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq * r;
      const att  = Math.min(0.14, dur * 0.22);
      const hold = Math.max(att + 0.01, dur - 0.18);
      const peak = g * vol * 0.30;
      gn.gain.setValueAtTime(0, t0 + t);
      gn.gain.linearRampToValueAtTime(peak, t0 + t + att);
      gn.gain.setValueAtTime(peak, t0 + t + hold);
      gn.gain.linearRampToValueAtTime(0, t0 + t + dur);
      osc.connect(gn); gn.connect(dest);
      osc.start(t0 + t); osc.stop(t0 + t + dur + 0.05);
    });
}

// Tenor — oboe-like (sine harmonics, reedy warmth, 3 partials)
function tenorV(ctx: AudioContext, dest: AudioNode, t0: number, t: number,
                freq: number, dur: number, vol = 1.0) {
  [{ r: 1, g: 0.70 }, { r: 2, g: 0.42 }, { r: 3, g: 0.14 }]
    .forEach(({ r, g }) => {
      const osc = ctx.createOscillator();
      const gn  = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * r;
      const att  = Math.min(0.16, dur * 0.24);
      const hold = Math.max(att + 0.01, dur - 0.20);
      const peak = g * vol * 0.26;
      gn.gain.setValueAtTime(0, t0 + t);
      gn.gain.linearRampToValueAtTime(peak, t0 + t + att);
      gn.gain.setValueAtTime(peak, t0 + t + hold);
      gn.gain.linearRampToValueAtTime(0, t0 + t + dur);
      osc.connect(gn); gn.connect(dest);
      osc.start(t0 + t); osc.stop(t0 + t + dur + 0.05);
    });
}

// Bass — tuba (deep sine, 2 partials, foundation)
function bassV(ctx: AudioContext, dest: AudioNode, t0: number, t: number,
               freq: number, dur: number, vol = 1.0) {
  [{ r: 1, g: 0.88 }, { r: 2, g: 0.30 }]
    .forEach(({ r, g }) => {
      const osc = ctx.createOscillator();
      const gn  = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq * r;
      const att  = Math.min(0.22, dur * 0.26);
      const hold = Math.max(att + 0.01, dur - 0.24);
      const peak = g * vol * 0.32;
      gn.gain.setValueAtTime(0, t0 + t);
      gn.gain.linearRampToValueAtTime(peak, t0 + t + att);
      gn.gain.setValueAtTime(peak, t0 + t + hold);
      gn.gain.linearRampToValueAtTime(0, t0 + t + dur);
      osc.connect(gn); gn.connect(dest);
      osc.start(t0 + t); osc.stop(t0 + t + dur + 0.05);
    });
}

// ─── Silent Night — full SATB chorus, BPM 72 ─────────────────────────────────
// Soprano carries melody. Alto = 3rd below in G major. Tenor = 6th below soprano.
// Bass = chord roots (G, C, D, Em alternating). All four sound simultaneously.
// Oscillator budget: ~710 total — well within mobile limits.
async function playSilentNight(ctx: AudioContext) {
  if (ctx.state === "suspended") {
    try { await ctx.resume(); } catch { return; }
  }
  if (ctx.state !== "running") return;

  const { dry } = makeReverb(ctx);
  const t0 = ctx.currentTime + 0.05;
  const b  = 60 / 72; // BPM 72

  // Fade out last 8 beats
  dry.gain.setValueAtTime(0.88, t0 + 72 * b);
  dry.gain.linearRampToValueAtTime(0,  t0 + 80 * b);

  // Voice shorthand helpers (beat-time, frequency, beat-duration, volume)
  const S = (bt: number, f: number, bd: number, v = 0.90) =>
    sopranoV(ctx, dry, t0, bt * b, f, bd * b, v);
  const A = (bt: number, f: number, bd: number, v = 0.80) =>
    altoV   (ctx, dry, t0, bt * b, f, bd * b, v);
  const T = (bt: number, f: number, bd: number, v = 0.72) =>
    tenorV  (ctx, dry, t0, bt * b, f, bd * b, v);
  const B = (bt: number, f: number, bd: number, v = 0.78) =>
    bassV   (ctx, dry, t0, bt * b, f, bd * b, v);

  const { C3, D3, E3, G3, A3, B3,
          C4, D4, E4, Fs4, G4, A4, B4,
          C5, D5, E5, G5 } = N;

  // ── VERSE 1 ──────────────────────────────────────────────────────────────
  // ● "Silent night"   beats 0-5   — G major
  S(0,G4,1.5); S(1.5,A4,0.5); S(2,G4,1); S(3,E4,3);
  A(0,E4,1.5); A(1.5,Fs4,0.5);A(2,E4,1); A(3,C4,3);
  T(0,B3,1.5); T(1.5,C4,0.5); T(2,B3,1); T(3,G3,3);
  B(0,G3,6);

  // ● "Holy night"   beats 6-11   — G major
  S(6,G4,1.5);  S(7.5,A4,0.5);  S(8,G4,1);  S(9,E4,3);
  A(6,E4,1.5);  A(7.5,Fs4,0.5); A(8,E4,1);  A(9,C4,3);
  T(6,B3,1.5);  T(7.5,C4,0.5);  T(8,B3,1);  T(9,G3,3);
  B(6,G3,6);

  // ● "Round yon Virgin, Mother and Child"   beats 12-20   — G → Em
  S(12,D5,3);    S(15,D5,1.5);   S(16.5,B4,0.5); S(17,G4,1);  S(18,G4,3);
  A(12,B4,3);    A(15,B4,1.5);   A(16.5,G4,0.5); A(17,E4,1);  A(18,E4,3);
  T(12,Fs4,3);   T(15,Fs4,1.5);  T(16.5,D4,0.5); T(17,B3,1);  T(18,B3,3);
  B(12,G3,3);    B(15,G3,3);     B(18,E3,3);

  // ● "Holy Infant so tender and mild"   beats 21-29   — C major
  S(21,C5,3);    S(24,C5,1.5);   S(25.5,G4,0.5); S(26,E4,1);  S(27,E4,3);
  A(21,A4,3);    A(24,A4,1.5);   A(25.5,E4,0.5); A(26,C4,1);  A(27,C4,3);
  T(21,E4,3);    T(24,E4,1.5);   T(25.5,C4,0.5); T(26,G3,1);  T(27,G3,3);
  B(21,C3,3);    B(24,C3,3);     B(27,G3,3);

  // ● "Sleep in heavenly peace"   beats 30-38   — D → G
  S(30,D5,2);    S(32,D5,1);     S(33,C5,1.5);   S(34.5,A4,0.5); S(35,G4,1); S(36,G4,3);
  A(30,B4,2);    A(32,B4,1);     A(33,A4,1.5);   A(34.5,Fs4,0.5);A(35,E4,1); A(36,E4,3);
  T(30,Fs4,2);   T(32,Fs4,1);    T(33,E4,1.5);   T(34.5,C4,0.5); T(35,B3,1); T(36,B3,3);
  B(30,D3,3);    B(33,D3,3);     B(36,G3,3);

  // ● "Sleep in heavenly peace" — climactic repeat   beats 39-53   — G → C
  S(39,G4,1.5);  S(40.5,A4,0.5); S(41,G4,1);
  S(42,D5,2);    S(44,E5,1);
  S(45,D5,1.5);  S(46.5,B4,0.5); S(47,G4,1);
  S(48,E5,5,1.00);

  A(39,E4,1.5);  A(40.5,Fs4,0.5);A(41,E4,1);
  A(42,B4,2);    A(44,C5,1);
  A(45,B4,1.5);  A(46.5,G4,0.5); A(47,E4,1);
  A(48,C5,5,0.90);

  T(39,B3,1.5);  T(40.5,C4,0.5); T(41,B3,1);
  T(42,Fs4,2);   T(44,G4,1);
  T(45,Fs4,1.5); T(46.5,D4,0.5); T(47,B3,1);
  T(48,G4,5,0.82);

  B(39,G3,3);    B(42,G3,3);     B(45,G3,3);     B(48,C3,5);

  // ── VERSE 2 — fuller, triumphant ─────────────────────────────────────────
  const v = 54;

  // ● Verse 2 phrase 1 (same harmony as v1 p1)
  S(v+0,G4,1.5,0.95); S(v+1.5,A4,0.5,0.95); S(v+2,G4,1,0.95); S(v+3,E4,3,0.95);
  A(v+0,E4,1.5,0.88); A(v+1.5,Fs4,0.5,0.88);A(v+2,E4,1,0.88); A(v+3,C4,3,0.88);
  T(v+0,B3,1.5,0.82); T(v+1.5,C4,0.5,0.82); T(v+2,B3,1,0.82); T(v+3,G3,3,0.82);
  B(v+0,G3,6,0.85);

  // ● Verse 2 phrase 2
  S(v+6,G4,1.5,0.95); S(v+7.5,A4,0.5,0.95); S(v+8,G4,1,0.95); S(v+9,E4,3,0.95);
  A(v+6,E4,1.5,0.88); A(v+7.5,Fs4,0.5,0.88);A(v+8,E4,1,0.88); A(v+9,C4,3,0.88);
  T(v+6,B3,1.5,0.82); T(v+7.5,C4,0.5,0.82); T(v+8,B3,1,0.82); T(v+9,G3,3,0.82);
  B(v+6,G3,6,0.85);

  // ● Triumphant close — soaring to G5
  S(v+12,D5,3,1.00); S(v+15,E5,3,1.00); S(v+18,G5,4,1.00);
  S(v+22,E5,2.5,0.94); S(v+24.5,C5,5,0.84);

  A(v+12,B4,3,0.92); A(v+15,C5,3,0.92); A(v+18,E5,4,0.92);
  A(v+22,C5,2.5,0.88); A(v+24.5,A4,5,0.80);

  T(v+12,Fs4,3,0.84); T(v+15,G4,3,0.84); T(v+18,B4,4,0.84);
  T(v+22,G4,2.5,0.80); T(v+24.5,E4,5,0.74);

  B(v+12,G3,3,0.88); B(v+15,C3,3,0.88); B(v+18,G3,4,0.88);
  B(v+22,C3,2.5,0.84); B(v+24.5,C3,5,0.80);
}

// ─── Shared AudioContext ──────────────────────────────────────────────────────
let sharedCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext | null {
  if (!sharedCtx || sharedCtx.state === "closed") {
    try { sharedCtx = new AudioContext(); } catch { return null; }
  }
  return sharedCtx;
}

export function unlockAudio(): void {
  const ctx = getAudioContext();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
}

export function playTestAlarm(): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  ctx.resume().then(() => playSilentNight(ctx)).catch(() => {});
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLoginAlarm() {
  const { toast }  = useToast();
  const toastRef   = useRef(toast);
  const esRef      = useRef<EventSource | null>(null);
  const enabledRef = useRef(isAlarmEnabled());

  useEffect(() => { toastRef.current = toast; }, [toast]);

  // Unlock AudioContext on first user interaction
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      document.removeEventListener("click",       unlock, true);
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown",     unlock, true);
      document.removeEventListener("touchstart",  unlock, true);
    };
    document.addEventListener("click",       unlock, true);
    document.addEventListener("pointerdown", unlock, true);
    document.addEventListener("keydown",     unlock, true);
    document.addEventListener("touchstart",  unlock, true);
    return () => {
      document.removeEventListener("click",       unlock, true);
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown",     unlock, true);
      document.removeEventListener("touchstart",  unlock, true);
    };
  }, []);

  function ring() {
    if (!enabledRef.current) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    ctx.resume().then(() => playSilentNight(ctx)).catch(() => {});
  }

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onSwMsg = (e: MessageEvent) => {
      if (e.data?.type === "QFX_PLAY_SOUND") ring();
    };
    navigator.serviceWorker.addEventListener("message", onSwMsg);
    return () => navigator.serviceWorker.removeEventListener("message", onSwMsg);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function connect() {
    if (esRef.current) return;
    const token = localStorage.getItem("vixus_admin_token") ?? "";
    const es = new EventSource(`${API_BASE}/api/admin/login-events?token=${encodeURIComponent(token)}`);

    es.onmessage = (e) => {
      try {
        const p = JSON.parse(e.data) as {
          type?: string; name: string; email: string;
          userId: number; country?: string;
          amount?: string; paymentMethod?: string;
        };
        ring();
        if (!p.type || p.type === "login") {
          window.dispatchEvent(new CustomEvent("vixusLoginNotification", { detail: p }));
          toastRef.current({ title: "🔔 User Logged In",
            description: `${p.name} (${p.email}) · ${p.country ?? ""}`, duration: 10000 });
        } else if (p.type === "deposit") {
          toastRef.current({ title: "💰 Deposit Request",
            description: `${p.name} · $${p.amount} via ${p.paymentMethod}`, duration: 12000 });
        } else if (p.type === "withdrawal") {
          toastRef.current({ title: "💸 Withdrawal Request",
            description: `${p.name} · $${p.amount} via ${p.paymentMethod}`, duration: 12000 });
        }
      } catch { /* malformed */ }
    };

    es.onerror = () => { es.close(); esRef.current = null; setTimeout(connect, 6000); };
    esRef.current = es;
  }

  useEffect(() => {
    connect();
    const onAlarmChange = (e: Event) => {
      const on = (e as CustomEvent<boolean>).detail;
      enabledRef.current = on;
      if (on) unlockAudio();
    };
    window.addEventListener("vixusAlarmChange", onAlarmChange);
    return () => {
      window.removeEventListener("vixusAlarmChange", onAlarmChange);
      esRef.current?.close(); esRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
}
