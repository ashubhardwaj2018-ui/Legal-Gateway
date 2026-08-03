import { useState } from "react";
import { Scale, Mail, ArrowRight, CheckCircle, AlertCircle, Loader2, ExternalLink, Clock } from "lucide-react";

export default function PortalLogin() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; requested?: boolean; hint?: string; error?: string } | null>(null);

  const requestAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch("/api/portal/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const d = await r.json();
      if (r.ok) setResult({ ok: true, ...d });
      else setResult({ ok: false, error: d.error ?? "Something went wrong" });
    } catch {
      setResult({ ok: false, error: "Network error. Please try again." });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] via-[#0f2044] to-[#1a3a6e] flex flex-col">
      {/* Header */}
      <header className="px-8 py-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#c9a227] rounded-xl flex items-center justify-center">
            <Scale size={18} className="text-[#0f2044]" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">Legal Filing India</div>
            <div className="text-[#c9a227]/70 text-[10px] tracking-wider uppercase">Client Portal</div>
          </div>
        </div>
        <a href="/" className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs transition-colors">
          <ExternalLink size={12} />Main Website
        </a>
      </header>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-[#c9a227]/20 rounded-2xl mb-4">
                <Mail size={28} className="text-[#c9a227]" />
              </div>
              <h1 className="text-2xl font-bold text-white">Access Your Portal</h1>
              <p className="text-white/50 text-sm mt-2">
                Enter the email address you used when contacting us. We'll review your request and send you a secure access link.
              </p>
            </div>

            {!result?.ok ? (
              <form onSubmit={requestAccess} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-white/50 uppercase tracking-wider block mb-2">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 focus:bg-white/15 transition-all text-sm"
                  />
                </div>

                {result?.ok === false && (
                  <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-300 text-sm">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{result.error}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 bg-[#c9a227] text-[#0f2044] font-bold py-3.5 rounded-xl hover:bg-[#e0b83a] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" />Submitting…</> : <><ArrowRight size={16} />Request Portal Access</>}
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="flex flex-col items-center text-center gap-3 py-2">
                  <div className="w-14 h-14 bg-[#c9a227]/20 rounded-2xl flex items-center justify-center">
                    <Clock size={28} className="text-[#c9a227]" />
                  </div>
                  <div>
                    <div className="text-white font-bold text-lg">Request Submitted!</div>
                    <div className="text-white/50 text-sm mt-1 leading-relaxed">{result.hint}</div>
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2.5">
                  {[
                    { icon: "✉️", text: "We'll email you a secure access link once approved" },
                    { icon: "⏱️", text: "Approvals usually happen within 1 business day" },
                    { icon: "📂", text: "You'll be able to view cases, invoices & documents" },
                  ].map(item => (
                    <div key={item.text} className="flex items-start gap-2.5 text-sm text-white/60">
                      <span className="text-base leading-snug">{item.icon}</span>
                      <span>{item.text}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { setResult(null); setEmail(""); }}
                  className="w-full text-white/40 hover:text-white/60 text-sm transition-colors py-1"
                >
                  ← Try a different email
                </button>
              </div>
            )}
          </div>

          {/* Info strip */}
          <div className="mt-6 grid grid-cols-3 gap-3 text-center">
            {[
              { icon: "🔒", text: "Secure access" },
              { icon: "📋", text: "View your cases" },
              { icon: "🧾", text: "Download invoices" },
            ].map(item => (
              <div key={item.text} className="bg-white/5 rounded-2xl px-3 py-3 border border-white/10">
                <div className="text-lg mb-1">{item.icon}</div>
                <div className="text-white/40 text-[10px] font-medium">{item.text}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="text-center pb-6 text-white/20 text-xs">
        © {new Date().getFullYear()} Legal Filing India · All rights reserved
      </footer>
    </div>
  );
}
