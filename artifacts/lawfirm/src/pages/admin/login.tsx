import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Scale, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

export default function AdminLogin() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ username: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.user) navigate(d.user.userType === "employee" ? "/admin/my-dashboard" : "/admin"); })
      .finally(() => setChecking(false));
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const r = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await r.json() as { error?: string; user?: { userType?: string } };
    setLoading(false);
    if (r.ok) {
      const user = d.user as { userType?: string; forcePasswordChange?: boolean } | undefined;
      if (user?.forcePasswordChange) navigate("/admin/my-dashboard"); // AdminLayout shows force-change screen
      else navigate(user?.userType === "employee" ? "/admin/my-dashboard" : "/admin");
    }
    else setError(d.error ?? "Login failed");
  };

  if (checking) return (
    <div className="min-h-screen bg-[#0f2044] flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-[#c9a227]" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#06111e] via-[#0f2044] to-[#1a3a6e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#c9a227] rounded-2xl mb-4 shadow-xl">
            <Scale size={28} className="text-[#0f2044]" />
          </div>
          <h1 className="text-2xl font-bold text-white">VAKIL & CO.</h1>
          <p className="text-white/40 text-sm mt-1">Admin Panel</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck size={16} className="text-[#c9a227]" />
            <span className="text-white/70 text-sm font-medium">Secure Sign In</span>
          </div>

          <form onSubmit={login} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Username or Email</label>
              <input
                type="text"
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                placeholder="admin"
                required
                autoFocus
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 focus:bg-white/15 transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 focus:bg-white/15 transition-all text-sm"
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#c9a227] text-[#0f2044] font-bold py-3.5 rounded-xl hover:bg-[#e0b83a] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 size={15} className="animate-spin" />Signing in…</> : "Sign In"}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-white/10 space-y-2">
            <div className="text-center">
              <a href="/admin/forgot-password" className="text-[#c9a227]/70 hover:text-[#c9a227] text-xs transition-colors font-medium">
                Forgot your password?
              </a>
            </div>
            <p className="text-white/25 text-xs text-center">
              Default: <code className="text-white/40">admin</code> / <code className="text-white/40">Admin@2026</code>
            </p>
            <p className="text-white/20 text-[10px] text-center">Change password in Admin → Settings after first login</p>
          </div>
        </div>

        <div className="text-center mt-6">
          <a href="/" className="text-white/30 hover:text-white/50 text-xs transition-colors">← Back to main website</a>
        </div>
      </div>
    </div>
  );
}
