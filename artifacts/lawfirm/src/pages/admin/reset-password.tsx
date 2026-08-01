import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Scale, KeyRound, Eye, EyeOff, Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function ResetPassword() {
  const [location] = useLocation();
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  // Basic client-side validation
  const passwordError =
    form.password.length > 0 && form.password.length < 8
      ? "Password must be at least 8 characters"
      : form.confirm.length > 0 && form.password !== form.confirm
      ? "Passwords do not match"
      : "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordError) return;
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: form.password }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (r.ok && d.ok) {
        setDone(true);
      } else {
        setError(d.error ?? "Reset failed. The link may have expired.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#06111e] via-[#0f2044] to-[#1a3a6e] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl text-center">
            <XCircle size={40} className="text-red-400 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-white mb-2">Invalid Link</h2>
            <p className="text-white/50 text-sm mb-4">This password reset link is missing or malformed.</p>
            <Link href="/admin/forgot-password">
              <a className="text-[#c9a227] hover:text-[#e0b83a] text-sm font-medium transition-colors">Request a new link →</a>
            </Link>
          </div>
        </div>
      </div>
    );
  }

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

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
          {done ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/20 rounded-full border border-green-500/30 mb-2">
                <CheckCircle2 size={28} className="text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Password Updated</h2>
              <p className="text-white/50 text-sm">Your password has been reset successfully. You can now sign in with your new password.</p>
              <Link href="/admin/login">
                <a className="inline-block mt-4 bg-[#c9a227] text-[#0f2044] font-bold py-3 px-6 rounded-xl hover:bg-[#e0b83a] transition-all text-sm">
                  Sign In
                </a>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <KeyRound size={16} className="text-[#c9a227]" />
                <span className="text-white/70 text-sm font-medium">Set New Password</span>
              </div>
              <p className="text-white/40 text-xs mb-6">Choose a strong password. Minimum 8 characters.</p>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      placeholder="Min. 8 characters"
                      required
                      minLength={8}
                      autoFocus
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 focus:bg-white/15 transition-all text-sm"
                    />
                    <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Confirm Password</label>
                  <input
                    type={showPass ? "text" : "password"}
                    value={form.confirm}
                    onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
                    placeholder="Re-enter password"
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 focus:bg-white/15 transition-all text-sm"
                  />
                </div>

                {passwordError && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-amber-300 text-sm">
                    {passwordError}
                  </div>
                )}

                {error && (
                  <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                    {error}{" "}
                    {error.includes("expired") && (
                      <Link href="/admin/forgot-password">
                        <a className="underline text-red-200 hover:text-white">Request a new link</a>
                      </Link>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !!passwordError || form.password.length < 8}
                  className="w-full bg-[#c9a227] text-[#0f2044] font-bold py-3.5 rounded-xl hover:bg-[#e0b83a] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={15} className="animate-spin" />Updating…</> : "Update Password"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
