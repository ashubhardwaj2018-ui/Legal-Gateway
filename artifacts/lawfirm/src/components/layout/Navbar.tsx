import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown, ChevronRight, Scale, Phone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICES_DATA } from "@/data/services";
import { cn } from "@/lib/utils";

type CategoryId = keyof typeof SERVICES_DATA;

const NAV_CATEGORIES: CategoryId[] = [
  "business-setup",
  "tax-compliance",
  "trademark-ip",
  "documentation",
  "fundraising",
  "ngo",
  "property-personal",
  "lawyers",
];

function getCols(id: CategoryId) {
  const count = SERVICES_DATA[id].services.length;
  if (count >= 20) return 3;
  if (count >= 10) return 2;
  return 1;
}

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<CategoryId | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [location] = useLocation();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setActiveMenu(null);
  }, [location]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openMenu = (id: CategoryId) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setActiveMenu(id);
  };
  const closeMenu = () => {
    closeTimer.current = setTimeout(() => setActiveMenu(null), 100);
  };

  return (
    <nav
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
        isScrolled
          ? "bg-white/97 backdrop-blur-md border-border shadow-sm"
          : "bg-white border-transparent"
      )}
    >
      <div className="container mx-auto px-4 xl:px-6">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 mr-4">
            <div className="bg-primary text-secondary p-1.5 rounded-lg group-hover:bg-secondary group-hover:text-primary transition-colors">
              <Scale size={20} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-serif font-bold text-base text-primary tracking-tight">VAKIL & CO.</span>
              <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-semibold">Legal Associates</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden xl:flex items-center gap-0 flex-1">

            <Link href="/" className="px-3 py-2 text-xs font-medium text-foreground hover:text-secondary transition-colors whitespace-nowrap shrink-0">
              Home
            </Link>

            {/* Consult an Expert */}
            <Link
              href="/services/consult-expert"
              className="px-3 py-2 text-xs font-semibold text-[#c9a227] hover:text-[#b08820] transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <MessageCircle size={12} />
              Consult an Expert
            </Link>

            {/* Category dropdowns */}
            {NAV_CATEGORIES.map((catId) => {
              const cat = SERVICES_DATA[catId];
              const cols = getCols(catId);
              const isOpen = activeMenu === catId;
              return (
                <div
                  key={catId}
                  onMouseEnter={() => openMenu(catId)}
                  onMouseLeave={closeMenu}
                  className="relative shrink-0"
                >
                  <button className={cn(
                    "px-2.5 py-2 text-xs font-medium transition-colors flex items-center gap-0.5 whitespace-nowrap",
                    isOpen ? "text-secondary" : "text-foreground hover:text-secondary"
                  )}>
                    {cat.icon} <span className="ml-1">{cat.title}</span>
                    <ChevronDown size={11} className={cn("ml-0.5 transition-transform duration-200", isOpen && "rotate-180")} />
                  </button>

                  {/* Dropdown */}
                  <div
                    className={cn(
                      "absolute top-full bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden transition-all duration-150 origin-top-left z-50",
                      cols === 3 ? "w-[580px]" : cols === 2 ? "w-[380px]" : "w-[240px]",
                      isOpen ? "opacity-100 scale-100 pointer-events-auto translate-y-0" : "opacity-0 scale-95 pointer-events-none -translate-y-1"
                    )}
                    onMouseEnter={() => openMenu(catId)}
                    onMouseLeave={closeMenu}
                  >
                    {/* Header */}
                    <div className="bg-[#0f2044] px-4 py-2.5 flex items-center justify-between">
                      <span className="text-white font-semibold text-xs flex items-center gap-1.5">
                        <span>{cat.icon}</span>
                        {cat.title}
                      </span>
                      <Link
                        href={`/services/${catId}`}
                        className="text-[#c9a227] text-[10px] font-medium hover:text-[#e8c040] transition-colors"
                      >
                        View all {cat.services.length} →
                      </Link>
                    </div>

                    {/* Services grid */}
                    <div className={cn(
                      "p-3 grid gap-0.5",
                      cols === 3 ? "grid-cols-3" : cols === 2 ? "grid-cols-2" : "grid-cols-1"
                    )}>
                      {cat.services.map(s => (
                        <Link
                          key={s.name}
                          href={`/services/${catId}`}
                          className="px-2.5 py-1.5 text-xs text-gray-600 hover:text-[#0f2044] hover:bg-gray-50 rounded-lg transition-all block"
                        >
                          {s.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="hidden xl:flex items-center gap-3 shrink-0 ml-2">
            <a href="tel:18001234567" className="flex items-center gap-1.5 text-primary font-medium text-xs hover:text-secondary transition-colors whitespace-nowrap">
              <Phone size={13} className="text-secondary" />
              1800-123-4567
            </a>
            <Button className="bg-primary hover:bg-secondary text-white font-medium h-8 px-4 text-xs transition-colors whitespace-nowrap">
              Free Consultation
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="xl:hidden p-2 text-foreground"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Menu ─────────────────────────────────────────────────────── */}
      <div className={cn(
        "xl:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg overflow-y-auto transition-all duration-300",
        mobileOpen ? "max-h-[85vh] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
      )}>
        <div className="p-4 flex flex-col divide-y divide-gray-100">
          <Link href="/" className="font-medium py-3 text-[#0f2044]" onClick={() => setMobileOpen(false)}>Home</Link>

          <Link
            href="/services/consult-expert"
            className="font-semibold py-3 text-[#c9a227] flex items-center gap-2"
            onClick={() => setMobileOpen(false)}
          >
            <MessageCircle size={15} />
            Consult an Expert
          </Link>

          {NAV_CATEGORIES.map(catId => {
            const cat = SERVICES_DATA[catId];
            return (
              <div key={catId}>
                <button
                  onClick={() => setMobileExpanded(mobileExpanded === catId ? null : catId)}
                  className="w-full flex items-center justify-between py-3 font-medium text-[#0f2044] text-sm"
                >
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    {cat.title}
                  </span>
                  <ChevronRight size={14} className={cn("transition-transform text-gray-400", mobileExpanded === catId && "rotate-90")} />
                </button>

                {mobileExpanded === catId && (
                  <div className="pb-2 pl-7 grid grid-cols-2 gap-0.5">
                    {cat.services.map(s => (
                      <Link
                        key={s.name}
                        href={`/services/${catId}`}
                        onClick={() => setMobileOpen(false)}
                        className="text-xs text-gray-500 hover:text-[#0f2044] py-1.5 pr-2"
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-4 pb-2 flex flex-col gap-3">
            <a href="tel:18001234567" className="flex items-center gap-2 text-primary font-medium justify-center text-sm">
              <Phone size={16} className="text-secondary" />
              1800-123-4567
            </a>
            <Button className="w-full bg-primary text-white hover:bg-secondary transition-colors">
              Book Free Consultation
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
