import { Link, useLocation } from "wouter";
import { useState, useEffect, useRef } from "react";
import { Menu, X, ChevronDown, ChevronRight, Scale, Phone, LogIn } from "lucide-react";
import { SERVICES_DATA } from "@/data/services";
import { toSlug } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { useSiteSettings } from "@/hooks/useSiteSettings";

type CategoryId = keyof typeof SERVICES_DATA;

const OTHERS_CATEGORIES: CategoryId[] = ["documentation", "fundraising", "ngo", "property-personal"];

interface NavItem {
  label: string;
  categories: CategoryId[];
}

const NAV_ITEMS: NavItem[] = [
  { label: "Business Setup",    categories: ["business-setup"] },
  { label: "Tax & Compliance",  categories: ["tax-compliance"] },
  { label: "Trademark & IP",    categories: ["trademark-ip"] },
  { label: "Lawyers",           categories: ["lawyers"] },
  { label: "Others",            categories: OTHERS_CATEGORIES },
];

export function Navbar() {
  const settings = useSiteSettings();
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState<string | null>(null);
  const [location] = useLocation();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setMobileOpen(false); setActiveMenu(null); }, [location]);

  useEffect(() => {
    const fn = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const open = (id: string) => { if (closeTimer.current) clearTimeout(closeTimer.current); setActiveMenu(id); };
  const close = () => { closeTimer.current = setTimeout(() => setActiveMenu(null), 110); };

  return (
    <nav className={cn(
      "fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b",
      isScrolled ? "bg-white/97 backdrop-blur-md border-border shadow-sm" : "bg-white border-transparent"
    )}>
      <div className="container mx-auto px-4 lg:px-6">
        <div className="flex items-center h-16 gap-1">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0 mr-3">
            {settings.logo_url ? (
              <img
                src={settings.logo_url}
                alt={settings.site_name || "Logo"}
                className="h-9 max-w-[160px] object-contain"
              />
            ) : (
              <>
                <div className="bg-primary text-secondary p-1.5 rounded-lg group-hover:bg-secondary group-hover:text-primary transition-colors">
                  <Scale size={20} />
                </div>
                <div className="leading-none hidden sm:block">
                  <div className="font-serif font-bold text-base text-primary">VAKIL & CO.</div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground font-semibold">Legal Associates</div>
                </div>
              </>
            )}
          </Link>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center flex-1 min-w-0">
            <Link href="/" className="px-2.5 py-2 text-sm font-medium text-foreground hover:text-secondary hover:bg-secondary/10 rounded-lg transition-all shrink-0">
              Home
            </Link>

            {NAV_ITEMS.map(item => {
              const isOpen = activeMenu === item.label;
              const isOthers = item.label === "Others";
              return (
                <div key={item.label} onMouseEnter={() => open(item.label)} onMouseLeave={close} className="relative shrink-0">
                  <button className={cn(
                    "flex items-center gap-1 px-2.5 py-2 text-sm font-medium transition-all rounded-lg",
                    isOpen ? "text-secondary bg-secondary/10" : "text-foreground hover:text-secondary hover:bg-secondary/10"
                  )}>
                    {item.label}
                    <ChevronDown size={13} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
                  </button>

                  <div
                    onMouseEnter={() => open(item.label)}
                    onMouseLeave={close}
                    className={cn(
                      "absolute top-full bg-white border border-gray-200 shadow-2xl rounded-2xl overflow-hidden transition-all duration-150 origin-top-left z-50",
                      isOthers ? "w-[620px] -left-48" : item.categories[0] === "business-setup" || item.categories[0] === "tax-compliance" ? "w-[520px]" : "w-[380px]",
                      isOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 -translate-y-2 pointer-events-none"
                    )}
                  >
                    {/* Header */}
                    {!isOthers && (
                      <div className="bg-[#0f2044] px-5 py-3 flex items-center justify-between">
                        <span className="text-white font-semibold text-sm flex items-center gap-2">
                          <span>{SERVICES_DATA[item.categories[0]].icon}</span>
                          {SERVICES_DATA[item.categories[0]].title}
                        </span>
                        <Link href={`/services/${item.categories[0]}`} className="text-[#c9a227] text-xs hover:text-[#e8c040] transition-colors">
                          View all {SERVICES_DATA[item.categories[0]].services.length} services →
                        </Link>
                      </div>
                    )}
                    {isOthers && (
                      <div className="bg-[#0f2044] px-5 py-3">
                        <span className="text-white font-semibold text-sm">More Services</span>
                      </div>
                    )}

                    {/* Body */}
                    {!isOthers ? (
                      <div className={cn(
                        "p-3 grid gap-0.5",
                        SERVICES_DATA[item.categories[0]].services.length >= 20 ? "grid-cols-3" : "grid-cols-2"
                      )}>
                        {SERVICES_DATA[item.categories[0]].services.map(s => (
                          <Link
                            key={s.name}
                            href={`/services/${item.categories[0]}/${toSlug(s.name)}`}
                            className="px-3 py-2 text-xs text-gray-600 hover:text-[#0f2044] hover:bg-[#c9a227]/10 rounded-lg transition-all block font-medium"
                          >
                            {s.name}
                          </Link>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 grid grid-cols-2 gap-4">
                        {OTHERS_CATEGORIES.map(catId => {
                          const cat = SERVICES_DATA[catId];
                          return (
                            <div key={catId}>
                              <Link href={`/services/${catId}`} className="flex items-center gap-1.5 text-xs font-bold text-[#0f2044] hover:text-[#c9a227] transition-colors mb-1.5 uppercase tracking-wide">
                                <span>{cat.icon}</span> {cat.title}
                              </Link>
                              <div className="space-y-0.5">
                                {cat.services.slice(0, 5).map(s => (
                                  <Link
                                    key={s.name}
                                    href={`/services/${catId}/${toSlug(s.name)}`}
                                    className="block text-xs text-gray-500 hover:text-[#0f2044] hover:bg-[#c9a227]/10 py-1 pl-2 pr-1 rounded-lg transition-all"
                                  >
                                    {s.name}
                                  </Link>
                                ))}
                                {cat.services.length > 5 && (
                                  <Link href={`/services/${catId}`} className="block text-xs text-[#c9a227] hover:text-[#b08820] pl-2 pt-1">
                                    +{cat.services.length - 5} more →
                                  </Link>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right side: Phone + Login */}
          <div className="hidden lg:flex items-center gap-3 ml-auto shrink-0">
            {settings.phone_primary && (
              <a
                href={`tel:${settings.phone_primary.replace(/[^\d+]/g, "")}`}
                className="hidden xl:flex items-center gap-1.5 text-primary text-sm font-medium hover:text-secondary transition-colors whitespace-nowrap"
              >
                <Phone size={14} className="text-secondary shrink-0" />
                {settings.phone_primary}
              </a>
            )}
            <Link href="/portal" className="flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary/30 hover:border-secondary hover:text-secondary rounded-lg px-3 py-1.5 transition-all whitespace-nowrap">
              <LogIn size={14} />
              Client Login
            </Link>
          </div>

          {/* Mobile toggle */}
          <button className="lg:hidden ml-auto p-2 text-foreground" onClick={() => setMobileOpen(o => !o)}>
            {mobileOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={cn(
        "lg:hidden absolute top-full left-0 right-0 bg-white border-b shadow-lg overflow-y-auto transition-all duration-300",
        mobileOpen ? "max-h-[85vh] opacity-100" : "max-h-0 opacity-0 pointer-events-none"
      )}>
        <div className="p-4 flex flex-col divide-y divide-gray-100">
          <Link href="/" className="font-medium py-3 text-[#0f2044]" onClick={() => setMobileOpen(false)}>Home</Link>

          {NAV_ITEMS.map(item => {
            const isOthers = item.label === "Others";
            return (
              <div key={item.label}>
                <button
                  onClick={() => setMobileExpanded(mobileExpanded === item.label ? null : item.label)}
                  className="w-full flex items-center justify-between py-3 font-medium text-[#0f2044] text-sm"
                >
                  {item.label}
                  <ChevronRight size={14} className={cn("transition-transform text-gray-400", mobileExpanded === item.label && "rotate-90")} />
                </button>

                {mobileExpanded === item.label && (
                  <div className="pb-3">
                    {(isOthers ? OTHERS_CATEGORIES : item.categories).map(catId => {
                      const cat = SERVICES_DATA[catId];
                      return (
                        <div key={catId} className="mb-3">
                          {isOthers && (
                            <div className="text-xs font-bold text-[#0f2044] uppercase tracking-wide pl-3 mb-1.5 flex items-center gap-1">
                              {cat.icon} {cat.title}
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-0.5 pl-3">
                            {cat.services.map(s => (
                              <Link
                                key={s.name}
                                href={`/services/${catId}/${toSlug(s.name)}`}
                                onClick={() => setMobileOpen(false)}
                                className="text-xs text-gray-500 hover:text-[#0f2044] py-1.5 pr-2"
                              >
                                {s.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-4 pb-2 flex flex-col gap-3">
            {settings.phone_primary && (
              <a href={`tel:${settings.phone_primary.replace(/[^\d+]/g, "")}`} className="flex items-center gap-2 text-primary font-medium justify-center text-sm">
                <Phone size={16} className="text-secondary" />
                {settings.phone_primary}
              </a>
            )}
            <Link href="/portal" onClick={() => setMobileOpen(false)} className="flex items-center justify-center gap-2 border border-primary/30 text-primary font-semibold rounded-lg py-2.5 text-sm hover:border-secondary hover:text-secondary transition-all">
              <LogIn size={15} />
              Client Login
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
