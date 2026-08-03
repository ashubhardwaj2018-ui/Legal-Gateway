import { useState } from "react";
import { Scale, Mail, Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const r = await fetch("/api/admin/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const d = await r.json() as { ok?: boolean; error?: string };
      if (r.ok && d.ok) {
        setSent(true);
      } else {
        setError(d.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#06111e] via-[#0f2044] to-[#1a3a6e] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#c9a227] rounded-2xl mb-4 shadow-xl">
            <Scale size={28} className="text-[#0f2044]" />
          </div>
          <h1 className="text-2xl font-bold text-white">LEGAL FILING INDIA</h1>
          <p className="text-white/40 text-sm mt-1">Admin Panel</p>
        </div>

        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-green-500/20 rounded-full border border-green-500/30 mb-2">
                <CheckCircle2 size={28} className="text-green-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Check your inbox</h2>
              <p className="text-white/50 text-sm leading-relaxed">
                If <span className="text-white/80">{email}</span> is registered, a password reset link has been sent. It expires in <strong className="text-white/80">1 hour</strong>.
              </p>
              <p className="text-white/30 text-xs mt-2">Check your spam folder if you don't see it.</p>
              <Link href="/admin/login">
                <a className="inline-flex items-center gap-2 text-[#c9a227] hover:text-[#e0b83a] text-sm font-medium mt-4 transition-colors">
                  <ArrowLeft size={14} /> Back to Sign In
                </a>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-2">
                <Mail size={16} className="text-[#c9a227]" />
                <span className="text-white/70 text-sm font-medium">Reset Password</span>
              </div>
              <p className="text-white/40 text-xs mb-6">Enter your email address and we'll send you a secure reset link.</p>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@legalfilingindia.com"
                    required
                    autoFocus
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 focus:bg-white/15 transition-all text-sm"
                  />
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
                  {loading ? <><Loader2 size={15} className="animate-spin" />Sending…</> : "Send Reset Link"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/admin/login">
                  <a className="inline-flex items-center gap-1 text-white/30 hover:text-white/50 text-xs transition-colors">
                    <ArrowLeft size={11} /> Back to Sign In
                  </a>
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
