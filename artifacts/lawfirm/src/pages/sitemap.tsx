import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import {
  ChevronDown, ChevronRight, MapPin, FileText, BookOpen,
  Building2, Scale, Briefcase, Home, Users, Globe, ChevronUp,
} from "lucide-react";
import { SERVICES_DATA } from "@/data/services";
import { toSlug } from "@/lib/slug";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SITE_URL = "https://legalfilingindia.com";

// State name → URL slug (consistent with state-hub.tsx)
function slugifyState(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Top-traffic service slug used as the representative pSEO entry point for each city
const TOP_SERVICE_SLUG = toSlug("Private Limited Company");

interface LocationRow {
  id: number;
  slug: string;
  city?: string | null;
  town?: string | null;
  village?: string | null;
  state: string;
}
interface BlogPost {
  id: number;
  title: string;
  slug: string;
  category: string;
  publishedAt: string | null;
}

// ── Static site sections ──────────────────────────────────────────────────────
const MAIN_PAGES = [
  { href: "/", label: "Home", icon: Home },
  { href: "/about", label: "About Us", icon: Scale },
  { href: "/our-lawyers", label: "Our Lawyers", icon: Users },
  { href: "/blog", label: "Legal Blog", icon: BookOpen },
  { href: "/careers", label: "Careers", icon: Briefcase },
  { href: "/indian-companies", label: "Indian Companies Database", icon: Building2 },
  { href: "/privacy-policy", label: "Privacy Policy", icon: FileText },
  { href: "/terms-of-use", label: "Terms of Use", icon: FileText },
];

const SERVICE_CATEGORIES = Object.values(SERVICES_DATA);

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ id, icon: Icon, title, count }: { id: string; icon: React.ElementType; title: string; count?: number }) {
  return (
    <div id={id} className="flex items-center gap-3 mb-6 pt-4">
      <div className="w-10 h-10 bg-[#0f2044] rounded-xl flex items-center justify-center shrink-0">
        <Icon size={18} className="text-[#c9a227]" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-[#0f2044] font-serif">{title}</h2>
        {count !== undefined && <p className="text-xs text-gray-500 mt-0.5">{count.toLocaleString()} links</p>}
      </div>
    </div>
  );
}

// ── Service category accordion ────────────────────────────────────────────────
function ServiceAccordion({ cat }: { cat: typeof SERVICE_CATEGORIES[number] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5 bg-white hover:bg-gray-50 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{cat.icon}</span>
          <div>
            <span className="font-semibold text-[#0f2044] text-sm">{cat.title}</span>
            <span className="ml-2 text-xs text-gray-400">{cat.services.length} services</span>
          </div>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
            {cat.services.map(svc => (
              <Link
                key={svc.name}
                href={`${BASE}/services/${cat.id}/${toSlug(svc.name)}`}
                className="flex items-center gap-1.5 text-sm text-[#0f2044] hover:text-[#c9a227] transition-colors py-1 group"
              >
                <ChevronRight size={12} className="text-gray-300 group-hover:text-[#c9a227] shrink-0" />
                {svc.name}
                <span className="text-xs text-gray-400 ml-auto shrink-0">{svc.price}</span>
              </Link>
            ))}
          </div>
          <div className="mt-3 pt-2 border-t border-gray-200">
            <Link href={`${BASE}/services/${cat.id}`} className="text-xs font-semibold text-[#0f2044] hover:text-[#c9a227] transition-colors">
              Browse all {cat.title} services →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

// ── State accordion (lazy loads cities on expand) ─────────────────────────────
function StateAccordion({ state }: { state: string }) {
  const [open, setOpen] = useState(false);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchCities = useCallback(async () => {
    if (locations.length > 0 || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/locations/state/${encodeURIComponent(state)}?limit=50`);
      if (res.ok) {
        const data = await res.json();
        setLocations(Array.isArray(data.locations) ? data.locations : []);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [state, locations.length, loading]);

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchCities();
  };

  const stateSlug = slugifyState(state);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <MapPin size={14} className="text-[#c9a227] shrink-0" />
          <span className="font-medium text-[#0f2044] text-sm">{state}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-400 shrink-0" /> : <ChevronDown size={14} className="text-gray-400 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          {loading ? (
            <div className="text-xs text-gray-400 py-2">Loading cities…</div>
          ) : locations.length === 0 ? (
            <div className="text-xs text-gray-400 py-2">No locations found.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
                {locations.map(loc => {
                  const name = loc.city || loc.town || loc.village || loc.slug;
                  return (
                    <Link
                      key={loc.id}
                      href={`${BASE}/${TOP_SERVICE_SLUG}/${loc.slug}`}
                      className="text-xs text-[#0f2044] hover:text-[#c9a227] transition-colors py-0.5 truncate"
                      title={`Private Limited Company in ${name}`}
                    >
                      {name}
                    </Link>
                  );
                })}
              </div>
              <div className="mt-3 pt-2 border-t border-gray-200">
                <Link href={`${BASE}/state/${stateSlug}`} className="text-xs font-semibold text-[#0f2044] hover:text-[#c9a227] transition-colors">
                  View all locations in {state} →
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Sitemap Page ─────────────────────────────────────────────────────────
export default function Sitemap() {
  const [states, setStates] = useState<string[]>([]);
  const [blogs, setBlogs] = useState<BlogPost[]>([]);
  const [statesLoading, setStatesLoading] = useState(true);
  const [blogsLoading, setBlogsLoading] = useState(true);
  const [blogPage, setBlogPage] = useState(1);
  const [blogTotal, setBlogTotal] = useState(0);

  // Total service count
  const totalServices = SERVICE_CATEGORIES.reduce((s, c) => s + c.services.length, 0);

  useEffect(() => {
    fetch("/api/location-states")
      .then(r => r.json())
      .then(d => { setStates(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setStatesLoading(false));
  }, []);

  const loadBlogs = useCallback(async (page: number) => {
    setBlogsLoading(true);
    try {
      const res = await fetch(`/api/blogs?limit=50&page=${page}`);
      if (res.ok) {
        const d = await res.json();
        setBlogs(Array.isArray(d.data) ? d.data : []);
        setBlogTotal(Number(d.total) || 0);
        setBlogPage(page);
      }
    } catch { /* ignore */ }
    finally { setBlogsLoading(false); }
  }, []);

  useEffect(() => { loadBlogs(1); }, [loadBlogs]);

  const totalBlogPages = Math.ceil(blogTotal / 50);

  return (
    <>
      <Helmet>
        <title>Sitemap — Legal Filing India India's Trusted Filing Platform</title>
        <meta name="description" content="Browse all legal services, states, cities, and blog posts available on Legal Filing India — India's premier online legal services platform." />
        <link rel="canonical" href={`${SITE_URL}/sitemap`} />
        <meta name="robots" content="index, follow" />
      </Helmet>

      {/* Hero */}
      <section className="bg-[#0f2044] py-14">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex items-center gap-2 text-white/50 text-sm mb-4">
            <Link href={`${BASE}/`} className="hover:text-white transition-colors">Home</Link>
            <ChevronRight size={14} />
            <span className="text-white">Sitemap</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white font-serif mb-3">Site Map</h1>
          <p className="text-white/70 max-w-2xl text-sm leading-relaxed">
            A complete directory of all pages, services, and locations on Legal Filing India
            — {totalServices} legal services across {states.length || "28+"} states and union territories.
          </p>

          {/* Jump links */}
          <div className="flex flex-wrap gap-2 mt-6">
            {[
              { id: "main-pages", label: "Main Pages" },
              { id: "services", label: "Legal Services" },
              { id: "locations", label: "Browse by State" },
              { id: "blog", label: "Blog Posts" },
            ].map(l => (
              <a
                key={l.id}
                href={`#${l.id}`}
                className="px-4 py-1.5 bg-white/10 hover:bg-[#c9a227] hover:text-[#0f2044] text-white rounded-full text-xs font-medium transition-all"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Body */}
      <div className="container mx-auto px-4 md:px-6 py-12 max-w-5xl">

        {/* ── Main Pages ── */}
        <section className="mb-12">
          <SectionHeading id="main-pages" icon={Globe} title="Main Pages" count={MAIN_PAGES.length} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {MAIN_PAGES.map(p => (
              <Link
                key={p.href}
                href={`${BASE}${p.href}`}
                className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-[#c9a227] hover:bg-[#c9a227]/5 transition-all group"
              >
                <p.icon size={15} className="text-[#0f2044] group-hover:text-[#c9a227] shrink-0" />
                <span className="text-sm font-medium text-[#0f2044]">{p.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* ── Legal Services ── */}
        <section className="mb-12">
          <SectionHeading id="services" icon={Scale} title="Legal Services" count={totalServices} />
          <p className="text-sm text-gray-500 mb-4">
            {SERVICE_CATEGORIES.length} practice areas — expand any category to browse individual services.
          </p>
          <div className="space-y-2">
            {SERVICE_CATEGORIES.map(cat => (
              <ServiceAccordion key={cat.id} cat={cat} />
            ))}
          </div>
        </section>

        {/* ── Browse by Location ── */}
        <section className="mb-12">
          <SectionHeading id="locations" icon={MapPin} title="Browse by State / UT" count={states.length} />
          <p className="text-sm text-gray-500 mb-4">
            Expand any state to browse the top cities and locations. Each location has dedicated pages for all {totalServices} legal services.
          </p>
          {statesLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {states.map(state => (
                <StateAccordion key={state} state={state} />
              ))}
            </div>
          )}
        </section>

        {/* ── Blog Posts ── */}
        <section className="mb-8">
          <SectionHeading id="blog" icon={BookOpen} title="Legal Blog" count={blogTotal} />
          {blogsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : blogs.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">No blog posts published yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {blogs.map(post => (
                  <Link
                    key={post.id}
                    href={`${BASE}/blog/${post.slug}`}
                    className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <ChevronRight size={12} className="text-gray-300 group-hover:text-[#c9a227] shrink-0" />
                    <span className="text-sm text-[#0f2044] group-hover:text-[#c9a227] transition-colors flex-1 min-w-0 truncate">{post.title}</span>
                    {post.category && (
                      <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">{post.category}</span>
                    )}
                  </Link>
                ))}
              </div>
              {totalBlogPages > 1 && (
                <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100">
                  <span className="text-xs text-gray-400">Page {blogPage} of {totalBlogPages}</span>
                  <div className="flex gap-1 ml-auto">
                    {blogPage > 1 && (
                      <button onClick={() => loadBlogs(blogPage - 1)} className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-[#0f2044]">
                        ← Prev
                      </button>
                    )}
                    {blogPage < totalBlogPages && (
                      <button onClick={() => loadBlogs(blogPage + 1)} className="px-3 py-1.5 text-xs bg-[#0f2044] text-white rounded-lg hover:bg-[#c9a227] hover:text-[#0f2044] transition-colors">
                        Next →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Footer note */}
        <div className="border-t border-gray-100 pt-8 text-center">
          <p className="text-xs text-gray-400 leading-relaxed">
            For search engines, a full <a href="/api/sitemap.xml" className="text-[#0f2044] hover:text-[#c9a227] underline">XML sitemap index</a> is available
            covering all {(totalServices * 150000).toLocaleString()}+ service–location pages.
          </p>
        </div>
      </div>
    </>
  );
}
