import { useState } from "react";
import { Bot, Eye, EyeOff, Lock, User, ShieldCheck, AlertCircle, Mail } from "lucide-react";

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);

  const triggerShake = (msg: string) => {
    setError(msg);
    setShake(true);
    setTimeout(() => setShake(false), 600);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const base = (import.meta.env.VITE_API_URL as string | undefined) ?? "";
      const res = await fetch(`${base}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), username, password }),
      });
      const data = await res.json();

      if (!res.ok) {
        triggerShake(data.error ?? "Login failed.");
        return;
      }

      // Success — store the token then grant access
      localStorage.setItem("vixus_admin_token", data.token);
      setTimeout(() => {
        onLogin();
      }, 900);
    } catch {
      triggerShake("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#08061a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow blobs */}
      <div className="absolute top-[-120px] left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-purple-700/20 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-60px] w-[300px] h-[300px] rounded-full bg-indigo-700/15 blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[-60px] left-[-40px] w-[240px] h-[240px] rounded-full bg-violet-600/10 blur-[70px] pointer-events-none" />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,1) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      {/* Card */}
      <div
        className="relative z-10 w-full max-w-[420px]"
        style={{ animation: shake ? "shake 0.4s ease" : "none" }}
      >
        {/* Logo + brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-2xl bg-purple-500/30 blur-xl scale-110" />
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-600 to-purple-800 flex items-center justify-center shadow-2xl shadow-purple-900/60 border border-purple-500/30">
              <Bot className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">VIXUS AI</h1>
          <p className="text-[11px] text-purple-300/80 mt-1 font-medium tracking-widest uppercase">
            Admin Portal
          </p>
        </div>

        {/* Card body */}
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-6 backdrop-blur-md shadow-2xl shadow-black/40">
          {/* Access badge */}
          <div className="flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-xl px-3 py-2 mb-6">
            <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
            <span className="text-[11px] text-purple-300 font-medium">Promoted admin accounts only</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Account Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Your platform email address"
                  autoComplete="email"
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  required
                />
              </div>
            </div>

            {/* Username */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Admin Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter admin username"
                  autoComplete="username"
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Admin Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter admin password"
                  autoComplete="current-password"
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  tabIndex={-1}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2.5">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="text-xs text-red-300 leading-snug">{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full relative overflow-hidden rounded-xl py-3.5 text-sm font-bold text-white transition-all duration-200 disabled:opacity-70 mt-2"
              style={{
                background: loading
                  ? "linear-gradient(135deg,#6b21a8,#4c1d95)"
                  : "linear-gradient(135deg,#8b5cf6,#7c3aed,#6d28d9)",
                boxShadow: "0 8px 32px rgba(139,92,246,0.35)",
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4" />
                    <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8v4l3-3-3-3V0a12 12 0 00-12 12h4z" />
                  </svg>
                  Verifying access…
                </span>
              ) : (
                "Sign In to Admin Panel"
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-slate-600 mt-6">
          VIXUS AI · Admin Portal · Internal Use Only
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-5px)}
          80%{transform:translateX(5px)}
        }
      `}</style>
    </div>
  );
}
