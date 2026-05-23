import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown, ChevronRight, Scale, Phone, MessageCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICES_DATA } from "@/data/services";
import { cn } from "@/lib/utils";

const MAIN_CATEGORIES = [
  "business-setup",
  "tax-compliance",
  "trademark-ip",
  "documentation",
  "fundraising",
  "ngo",
  "property-personal",
  "lawyers",
] as const;

const CONSULT_EXPERT = SERVICES_DATA["consult-expert"];

export function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [megaOpen, setMegaOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [location] = useLocation();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMobileOpen(false);
    setMegaOpen(false);
  }, [location]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const openMega = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMegaOpen(true);
  };
  const closeMega = () => {
    closeTimer.current = setTimeout(() => setMegaOpen(false), 120);
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
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between h-16 lg:h-[70px]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="bg-primary text-secondary p-1.5 rounded-lg group-hover:bg-secondary group-hover:text-primary transition-colors">
              <Scale size={22} />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-serif font-bold text-lg text-primary tracking-tight">VAKIL & CO.</span>
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Legal Associates</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-7">
            <Link href="/" className="text-sm font-medium text-foreground hover:text-secondary transition-colors">
              Home
            </Link>

            {/* Consult an Expert — top-level link */}
            <Link
              href="/services/consult-expert"
              className="text-sm font-medium text-foreground hover:text-secondary transition-colors flex items-center gap-1"
            >
              <MessageCircle size={14} className="text-secondary" />
              Consult an Expert
            </Link>

            {/* Practice Areas mega menu trigger */}
            <div
              onMouseEnter={openMega}
              onMouseLeave={closeMega}
              className="relative"
            >
              <button className={cn(
                "flex items-center gap-1.5 text-sm font-medium transition-colors py-2",
                megaOpen ? "text-secondary" : "text-foreground hover:text-secondary"
              )}>
                Practice Areas
                <ChevronDown size={14} className={cn("transition-transform duration-200", megaOpen && "rotate-180")} />
              </button>
            </div>

            <Link href="/#about" className="text-sm font-medium text-foreground hover:text-secondary transition-colors">
              About Us
            </Link>
            <Link href="/#testimonials" className="text-sm font-medium text-foreground hover:text-secondary transition-colors">
              Testimonials
            </Link>
          </div>

          {/* CTA */}
          <div className="hidden lg:flex items-center gap-4">
            <a href="tel:18001234567" className="flex items-center gap-1.5 text-primary font-medium text-sm hover:text-secondary transition-colors">
              <Phone size={16} className="text-secondary" />
              1800-123-4567
            </a>
            <Button className="bg-primary hover:bg-secondary text-white font-medium h-9 px-5 text-sm transition-colors">
              Free Consultation
            </Button>
          </div>

          {/* Mobile toggle */}
          <button
            className="lg:hidden p-2 text-foreground"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Mega Menu ──────────────────────────────────────────────────────── */}
      <div
        onMouseEnter={openMega}
        onMouseLeave={closeMega}
        className={cn(
          "absolute top-full left-0 right-0 bg-white border-b border-gray-200 shadow-2xl transition-all duration-200 origin-top overflow-hidden",
          megaOpen ? "opacity-100 max-h-[620px]" : "opacity-0 max-h-0 pointer-events-none"
        )}
      >
        <div className="container mx-auto px-4 md:px-6 py-6">
          {/* Consult an Expert — top highlight strip */}
          <div className="bg-[#0f2044] rounded-xl px-5 py-4 mb-5 flex items-center gap-8 flex-wrap">
            <div className="flex items-center gap-2 shrink-0">
              <MessageCircle size={16} className="text-[#c9a227]" />
              <span className="font-semibold text-white text-sm tracking-wide uppercase">Consult an Expert</span>
            </div>
            <div className="flex flex-wrap gap-3">
              {CONSULT_EXPERT.services.map(s => (
                <Link
                  key={s.name}
                  href={`/services/consult-expert`}
                  className="text-sm text-white/80 hover:text-[#c9a227] transition-colors flex items-center gap-1 group"
                >
                  <span className="w-1 h-1 rounded-full bg-[#c9a227]/50 group-hover:bg-[#c9a227] transition-colors" />
                  {s.name}
                </Link>
              ))}
            </div>
          </div>

          {/* Main categories grid — 4 columns × 2 rows */}
          <div className="grid grid-cols-4 gap-0 divide-x divide-gray-100">
            {MAIN_CATEGORIES.map((catId) => {
              const cat = SERVICES_DATA[catId];
              const preview = cat.services.slice(0, 6);
              return (
                <div key={catId} className="px-5 first:pl-0 last:pr-0">
                  <Link
                    href={`/services/${catId}`}
                    className="group/heading flex items-center justify-between mb-2.5"
                  >
                    <span className="font-semibold text-[#0f2044] text-sm font-serif group-hover/heading:text-[#c9a227] transition-colors flex items-center gap-1.5">
                      <span>{cat.icon}</span>
                      {cat.title}
                    </span>
                    <ArrowRight size={12} className="text-gray-300 group-hover/heading:text-[#c9a227] transition-colors" />
                  </Link>
                  <div className="space-y-1.5">
                    {preview.map(s => (
                      <Link
                        key={s.name}
                        href={`/services/${catId}`}
                        className="block text-xs text-gray-500 hover:text-[#0f2044] hover:translate-x-0.5 transition-all truncate"
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                  {cat.services.length > 6 && (
                    <Link
                      href={`/services/${catId}`}
                      className="mt-2.5 block text-xs font-medium text-[#c9a227] hover:text-[#b08820] transition-colors"
                    >
                      +{cat.services.length - 6} more →
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Mobile Menu ────────────────────────────────────────────────────── */}
      <div className={cn(
        "lg:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg overflow-y-auto transition-all duration-300",
        mobileOpen ? "max-h-[85vh] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
      )}>
        <div className="p-4 flex flex-col divide-y divide-gray-100">
          <Link href="/" className="font-medium py-3 text-[#0f2044]" onClick={() => setMobileOpen(false)}>Home</Link>

          {/* Consult an Expert */}
          <Link
            href="/services/consult-expert"
            className="font-medium py-3 text-[#0f2044] flex items-center gap-2"
            onClick={() => setMobileOpen(false)}
          >
            <MessageCircle size={15} className="text-[#c9a227]" />
            Consult an Expert
          </Link>

          {/* Practice Areas accordion */}
          <div className="py-2">
            <button
              onClick={() => setMobileExpanded(mobileExpanded === "practice" ? null : "practice")}
              className="w-full flex items-center justify-between py-2 font-medium text-[#0f2044]"
            >
              Practice Areas
              <ChevronDown size={16} className={cn("transition-transform", mobileExpanded === "practice" && "rotate-180")} />
            </button>

            {mobileExpanded === "practice" && (
              <div className="mt-1 space-y-0.5">
                {MAIN_CATEGORIES.map(catId => {
                  const cat = SERVICES_DATA[catId];
                  return (
                    <div key={catId}>
                      <button
                        onClick={() => setMobileExpanded(mobileExpanded === catId ? "practice" : catId)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 text-sm font-medium text-[#0f2044]"
                      >
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          {cat.title}
                        </span>
                        <ChevronRight size={13} className={cn("transition-transform text-gray-400", mobileExpanded === catId && "rotate-90")} />
                      </button>

                      {mobileExpanded === catId && (
                        <div className="pl-8 pb-2 space-y-1">
                          {cat.services.map(s => (
                            <Link
                              key={s.name}
                              href={`/services/${catId}`}
                              onClick={() => setMobileOpen(false)}
                              className="block text-xs text-gray-500 hover:text-[#0f2044] py-1"
                            >
                              {s.name}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <Link href="/#about" className="font-medium py-3 text-[#0f2044]" onClick={() => setMobileOpen(false)}>About Us</Link>
          <Link href="/#testimonials" className="font-medium py-3 text-[#0f2044]" onClick={() => setMobileOpen(false)}>Testimonials</Link>

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
