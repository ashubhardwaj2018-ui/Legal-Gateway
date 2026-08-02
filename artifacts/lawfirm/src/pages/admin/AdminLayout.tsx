import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { NotificationBell } from "../../components/admin/NotificationBell";
import { ChatSlideIn } from "../../components/admin/ChatSlideIn";
import {
  LayoutDashboard, Users, MessageSquare, FileText, Search,
  Settings, Building2, Mail, User, Scale, Menu, X, ChevronRight,
  Briefcase, ExternalLink, MapPin, BookOpen, UserCog, CheckSquare, TrendingUp,
  LogOut, ShieldCheck, Loader2, Layers, Shield, History, Activity, BarChart2, Upload,
  MessageCircle, Globe,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  exact?: boolean;
  module: string | null; // null = always visible (dashboard)
}

const navItems: NavItem[] = [
  { href: "/admin",                 label: "Dashboard",           icon: LayoutDashboard,  exact: true, module: null },
  { href: "/admin/my-dashboard",    label: "My Dashboard",        icon: BarChart2,                      module: null },
  { href: "/admin/my-leads",        label: "My Leads",            icon: Users,                         module: "leads" },
  { href: "/admin/team-performance",label: "Team Performance",    icon: TrendingUp,                    module: "team" },
  { href: "/admin/leads",           label: "CRM — Leads",         icon: Users,                         module: "leads" },
  { href: "/admin/employees",       label: "Employees",           icon: Users,                         module: "employees" },
  { href: "/admin/roles",           label: "Roles & Permissions", icon: Shield,                        module: "employees" },
  { href: "/admin/login-history",   label: "Login History",       icon: History,                       module: "employees" },
  { href: "/admin/activity-log",    label: "Activity Log",        icon: Activity,                      module: "employees" },
  { href: "/admin/team",            label: "Team & HR",           icon: UserCog,                       module: "team" },
  { href: "/admin/indian-companies",label: "Indian Companies DB", icon: Building2,                     module: "indian_companies" },
  { href: "/admin/tasks",           label: "Task Management",     icon: CheckSquare,                   module: "tasks" },
  { href: "/admin/invoices",        label: "Invoice & Finance",   icon: FileText,                      module: "invoices" },
  { href: "/admin/whatsapp",        label: "WhatsApp CRM",        icon: MessageCircle,                 module: "whatsapp" },
  { href: "/admin/chat",            label: "Team Chat",           icon: MessageSquare,                 module: "chat" },
  { href: "/admin/email",           label: "Email",               icon: Mail,                          module: "email" },
  { href: "/admin/reports",         label: "Reports",             icon: TrendingUp,                    module: "reports" },
  { href: "/admin/contacts",        label: "Contacts",            icon: MessageSquare,                 module: "contacts" },
  { href: "/admin/quotations",      label: "Quotations",          icon: Briefcase,                     module: "quotations" },
  { href: "/admin/blogs",           label: "Blog Manager",        icon: BookOpen,                      module: "seo" },
  { href: "/admin/seo",             label: "SEO Manager",         icon: Search,                        module: "seo" },
  { href: "/admin/services",        label: "Services & Pricing",  icon: FileText,                      module: "services" },
  { href: "/admin/company-data",    label: "Company Data",        icon: Building2,                     module: "company_data" },
  { href: "/admin/newsletter",      label: "Newsletter",          icon: Mail,                          module: "newsletter" },
  { href: "/admin/lawyers",         label: "Lawyer Profiles",     icon: User,                          module: "lawyers" },
  { href: "/admin/locations",       label: "Locations (pSEO)",    icon: MapPin,                        module: "locations" },
  { href: "/admin/bulk-location-upload", label: "Bulk Location Upload", icon: Upload,                   module: "locations" },
  { href: "/admin/bulk-service-upload",  label: "Bulk Service Upload",  icon: Upload,                   module: "services" },
  { href: "/admin/pseo",            label: "pSEO Manager",         icon: Globe,                         module: "locations" },
  { href: "/admin/settings",        label: "Site Settings",       icon: Settings,                      module: "settings" },
  { href: "/admin/page-editor",     label: "Page Editor",         icon: Layers,                        module: "settings" },
];

interface PermissionSet {
  all: boolean;
  map: Record<string, Record<string, boolean>>;
}

function canViewModule(perms: PermissionSet | null, module: string | null): boolean {
  if (module === null) return true; // dashboard always visible
  if (!perms) return true; // still loading — show all to avoid flicker before fetch
  if (perms.all) return true;
  const m = perms.map[module];
  return !!(m?.["view"] || m?.["manage"]);
}

interface Props {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AdminLayout({ children, title, subtitle, actions }: Props) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [adminUser, setAdminUser] = useState<{ username: string; role: string; userType?: string } | null>(null);
  const [permissions, setPermissions] = useState<PermissionSet | null>(null);
  const [forceChangePwd, setForceChangePwd] = useState(false);
  const [changePwdInput, setChangePwdInput] = useState("");
  const [changePwdError, setChangePwdError] = useState("");
  const [changePwdPending, setChangePwdPending] = useState(false);

  useEffect(() => {
    fetch("/api/admin/auth/me")
      .then(r => {
        if (!r.ok) { navigate("/admin/login"); return null; }
        return r.json();
      })
      .then(d => {
        if (d?.user) {
          const user = d.user as { username: string; role: string; userType?: string; forcePasswordChange?: boolean };
          setAdminUser(user);
          if (user.forcePasswordChange === true) {
            setForceChangePwd(true);
            setAuthChecked(true);
            return;
          }
          // Redirect employees away from the admin-only main dashboard
          if (user.userType === "employee" && (window.location.pathname === "/admin" || window.location.pathname === "/admin/")) {
            navigate("/admin/my-dashboard");
            return;
          }
          fetch("/api/admin/auth/permissions")
            .then(r2 => r2.ok ? r2.json() : null)
            .then(p => { if (p) setPermissions(p as PermissionSet); })
            .catch(() => {});
        }
        setAuthChecked(true);
      })
      .catch(() => navigate("/admin/login"));
  }, []);

  async function handleForceChangePwd() {
    if (changePwdInput.length < 8) { setChangePwdError("Password must be at least 8 characters"); return; }
    setChangePwdPending(true);
    setChangePwdError("");
    try {
      const res = await fetch("/api/admin/auth/change-password", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword: changePwdInput }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        setChangePwdError(d.error ?? "Failed"); return;
      }
      setForceChangePwd(false);
      setChangePwdInput("");
      // Re-load permissions after password change
      fetch("/api/admin/auth/permissions")
        .then(r2 => r2.ok ? r2.json() : null)
        .then(p => { if (p) setPermissions(p as PermissionSet); })
        .catch(() => {});
    } finally {
      setChangePwdPending(false);
    }
  }

  const handleLogout = async () => {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    navigate("/admin/login");
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location === href;
    return location === href || location.startsWith(href + "/");
  };

  const isEmployee = adminUser?.userType === "employee";
  const visibleNav = navItems.filter(item => {
    // Hide main admin Dashboard from employees — they have My Dashboard instead
    if (isEmployee && item.href === "/admin" && item.exact) return false;
    // Hide My Dashboard from admins — it's the employee personal view
    if (!isEmployee && item.href === "/admin/my-dashboard") return false;
    return canViewModule(permissions, item.module);
  });

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0f2044] flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={28} className="animate-spin text-[#c9a227] mx-auto mb-3" />
          <p className="text-white/40 text-sm">Verifying session…</p>
        </div>
      </div>
    );
  }

  if (forceChangePwd) {
    return (
      <div className="min-h-screen bg-[#0f2044] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-[#c9a227] text-[#0f2044] p-2 rounded-lg"><Scale size={20} /></div>
            <div>
              <div className="font-bold text-[#0f2044]">Change Your Password</div>
              <div className="text-xs text-gray-500">Required before accessing the panel</div>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Your account requires a password change. Please set a new password to continue.
          </p>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-700 block mb-1">New Password (min 8 characters)</label>
              <input
                type="password"
                value={changePwdInput}
                onChange={e => setChangePwdInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleForceChangePwd(); }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c9a227]"
                placeholder="Enter new password"
              />
            </div>
            {changePwdError && <p className="text-xs text-red-600">{changePwdError}</p>}
            <button
              onClick={handleForceChangePwd}
              disabled={changePwdPending || changePwdInput.length < 8}
              className="w-full bg-[#c9a227] hover:bg-[#b8911e] disabled:opacity-50 text-[#0f2044] font-semibold py-2.5 rounded-lg text-sm transition-colors"
            >
              {changePwdPending ? "Saving…" : "Set New Password & Continue"}
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
            >
              Sign out instead
            </button>
          </div>
        </div>
      </div>
    );
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-white/10 flex items-center gap-3">
        <div className="bg-[#c9a227] text-[#0f2044] p-1.5 rounded-lg">
          <Scale size={18} />
        </div>
        <div>
          <div className="font-serif font-bold text-white text-sm leading-tight">VAKIL & CO.</div>
          <div className="text-[10px] text-[#c9a227] uppercase tracking-widest font-medium">Admin Panel</div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
        {visibleNav.map(item => {
          const active = isActive(item.href, item.exact);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                active
                  ? "bg-[#c9a227] text-[#0f2044]"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon size={16} className="shrink-0" />
              {item.label}
              {active && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-2">
        {adminUser && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/5">
            <ShieldCheck size={13} className="text-[#c9a227] shrink-0" />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{adminUser.username}</div>
              <div className="text-[10px] text-white/40 capitalize">
                {adminUser.userType === "employee" ? "Employee" : adminUser.role}
              </div>
            </div>
          </div>
        )}
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors px-2 py-1.5"
        >
          <ExternalLink size={12} />
          View Public Site
        </Link>
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 text-xs text-white/50 hover:text-red-400 transition-colors w-full px-2 py-1.5"
        >
          <LogOut size={12} />
          Sign Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      <aside className="hidden lg:flex w-56 xl:w-64 bg-[#0f2044] text-white flex-col shrink-0">
        <SidebarContent />
      </aside>

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#0f2044] text-white flex-col lg:hidden transition-transform duration-300 flex ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="absolute top-3 right-3">
          <button onClick={() => setSidebarOpen(false)} className="p-1 text-white/60 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <SidebarContent />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center gap-4 shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 rounded-md hover:bg-gray-100 text-gray-600"
          >
            <Menu size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-[#0f2044] truncate">{title}</h1>
            {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {actions}
            <NotificationBell />
            <button
              onClick={() => setChatOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
              title="Team Chat"
            >
              <MessageSquare size={18} />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>

      <ChatSlideIn
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        currentUser={adminUser?.username ?? "User"}
      />
    </div>
  );
}
