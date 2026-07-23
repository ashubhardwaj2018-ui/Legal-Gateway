import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Users, MessageSquare, FileText, Search,
  Settings, Building2, Mail, User, Scale, Menu, X, ChevronRight, Briefcase, ExternalLink, MapPin, BookOpen
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/leads", label: "Leads", icon: Users },
  { href: "/admin/contacts", label: "Contacts", icon: MessageSquare },
  { href: "/admin/quotations", label: "Quotations", icon: Briefcase },
  { href: "/admin/blogs", label: "Blog Manager", icon: BookOpen },
  { href: "/admin/seo", label: "SEO Manager", icon: Search },
  { href: "/admin/services", label: "Services & Pricing", icon: FileText },
  { href: "/admin/company-data", label: "Company Data", icon: Building2 },
  { href: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { href: "/admin/lawyers", label: "Lawyer Profiles", icon: User },
  { href: "/admin/locations", label: "Locations (pSEO)", icon: MapPin },
  { href: "/admin/settings", label: "Site Settings", icon: Settings },
];

interface Props {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function AdminLayout({ children, title, subtitle, actions }: Props) {
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location === href;
    return location === href || location.startsWith(href + "/");
  };

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
        {navItems.map(item => {
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

      <div className="p-4 border-t border-white/10">
        <Link
          href="/"
          className="flex items-center gap-2 text-xs text-white/50 hover:text-white transition-colors"
        >
          <ExternalLink size={12} />
          View Public Site
        </Link>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setSidebarOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
        </div>
      )}

      {/* Sidebar - desktop */}
      <aside className="hidden lg:flex w-56 xl:w-64 bg-[#0f2044] text-white flex-col shrink-0">
        <SidebarContent />
      </aside>

      {/* Sidebar - mobile */}
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

      {/* Main */}
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
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
