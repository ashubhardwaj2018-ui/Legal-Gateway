import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Scale, Eye, EyeOff, Loader2, ShieldCheck, KeyRound } from "lucide-react";

export default function AdminChangePassword() {
  const [, navigate] = useLocation();
  const [checking, setChecking] = useState(true);
  const [userType, setUserType] = useState<"admin" | "employee">("admin");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d?.user) {
          // Not authenticated — send to login
          navigate("/admin/login");
          return;
        }
        const user = d.user as { userType?: string; forcePasswordChange?: boolean };
        if (!user.forcePasswordChange) {
          // Flag not set — bounce to the dashboard
          navigate(user.userType === "employee" ? "/admin/my-dashboard" : "/admin");
          return;
        }
        setUserType(user.userType === "employee" ? "employee" : "admin");
        setChecking(false);
      })
      .catch(() => navigate("/admin/login"));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: password }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setError(d.error ?? "Failed to change password");
        return;
      }
      // Hard-redirect so the fresh session cookie is picked up
      window.location.href = userType === "employee" ? "/admin/my-dashboard" : "/admin";
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    navigate("/admin/login");
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-[#0f2044] flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-[#c9a227]" />
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
          <h1 className="text-2xl font-bold text-white">LEGAL FILING INDIA</h1>
          <p className="text-white/40 text-sm mt-1">Admin Panel</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl p-8 shadow-2xl">
          <div className="flex items-center gap-2 mb-2">
            <KeyRound size={16} className="text-[#c9a227]" />
            <span className="text-white font-semibold text-base">Set a New Password</span>
          </div>
          <p className="text-white/50 text-sm mb-6">
            Your account requires a password change before you can access the panel.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* New password */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                New Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  required
                  autoFocus
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 focus:bg-white/15 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/30 focus:outline-none focus:border-[#c9a227]/60 focus:bg-white/15 transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(s => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Password strength hint */}
            {password.length > 0 && password.length < 8 && (
              <p className="text-xs text-amber-400">
                {8 - password.length} more character{8 - password.length !== 1 ? "s" : ""} needed
              </p>
            )}
            {password.length >= 8 && confirm.length > 0 && password !== confirm && (
              <p className="text-xs text-red-400">Passwords do not match</p>
            )}
            {password.length >= 8 && confirm.length >= 8 && password === confirm && (
              <p className="text-xs text-emerald-400 flex items-center gap-1">
                <ShieldCheck size={12} /> Passwords match
              </p>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || password.length < 8 || password !== confirm}
              className="w-full bg-[#c9a227] text-[#0f2044] font-bold py-3.5 rounded-xl hover:bg-[#e0b83a] transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Loader2 size={15} className="animate-spin" />Saving…</>
              ) : (
                "Set New Password & Continue"
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/10 text-center">
            <button
              onClick={handleLogout}
              className="text-white/30 hover:text-white/50 text-xs transition-colors"
            >
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
