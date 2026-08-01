import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Helmet } from "react-helmet-async";
import { MapPin, ChevronRight, Building2, FileText, ArrowRight, Search } from "lucide-react";
import { useState } from "react";
import { ALL_SERVICES, getServicesByCategory } from "@/data/service-index";
import { Button } from "@/components/ui/button";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const SITE_URL = "https://vakil.co.in";

// Convert state name to URL-friendly slug
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Convert slug back to a displayable state name (title case)
function deslugify(s: string): string {
  return s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}

interface LocationRow {
  id: number;
  slug: string;
  city?: string | null;
  town?: string | null;
  village?: string | null;
  district?: string | null;
  state: string;
  pincode?: string | null;
  population?: number | null;
}

interface StateResponse {
  state: string;
  locations: LocationRow[];
  total: number;
  page: number;
  limit: number;
}

function primaryPlace(loc: LocationRow): string {
  return loc.city || loc.town || loc.village || loc.district || loc.state;
}

// Top 12 most-searched services for quick-link grid
const TOP_SERVICES = [
  "gst-registration", "trademark-registration", "private-limited-company",
  "individual-income-tax-filing", "fssai-registration-online", "msmessi-registration",
  "one-person-company", "gst-filing", "copyright-registration", "legal-notice",
  "property-registration", "accounting-and-book-keeping",
];

const SERVICE_CATEGORIES = [
  { id: "business-setup",    title: "Business Setup" },
  { id: "tax-compliance",    title: "Tax & Compliance" },
  { id: "trademark-ip",      title: "Trademark & IP" },
  { id: "documentation",     title: "Documentation" },
  { id: "ngo",               title: "NGO Registration" },
  { id: "property-personal", title: "Property & Personal" },
  { id: "lawyers",           title: "Hire a Lawyer" },
  { id: "consult-expert",    title: "Consult an Expert" },
];

export default function StateHub() {
  const params = useParams<{ stateSlug: string }>();
  const stateSlug = params.stateSlug ?? "";
  const stateName = deslugify(stateSlug);

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const LIMIT = 120;

  const { data, isLoading, isError } = useQuery<StateResponse>({
    queryKey: ["state-locations", stateSlug, page],
    queryFn: async () => {
      const r = await fetch(`${BASE}/api/locations/state/${encodeURIComponent(stateName)}?page=${page}&limit=${LIMIT}`);
      if (!r.ok) throw new Error("Not found");
      return r.json();
    },
    enabled: !!stateSlug,
    retry: false,
  });

  const topServices = TOP_SERVICES
    .map((slug) => ALL_SERVICES.find((s) => s.slug === slug))
    .filter(Boolean) as typeof ALL_SERVICES;

  const filteredLocations = (data?.locations ?? []).filter((loc) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (loc.city ?? "").toLowerCase().includes(q) ||
      (loc.town ?? "").toLowerCase().includes(q) ||
      (loc.district ?? "").toLowerCase().includes(q) ||
      (loc.pincode ?? "").includes(q)
    );
  });

  const pageTitle = `Legal Services in ${stateName} | Vakil & Co.`;
  const pageDesc = `Find expert legal, tax, and compliance services across all cities in ${stateName}. GST registration, trademark, company registration, and more — Vakil & Co.`;
  const canonicalUrl = `${SITE_URL}/state/${stateSlug}`;

  if (isError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-gray-500">State not found or no locations in this state.</p>
        <Link href="/" className="text-[#c9a227] underline text-sm">Go Home</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta name="keywords" content={`legal services ${stateName}, CA services ${stateName}, company registration ${stateName}, GST registration ${stateName}, trademark registration ${stateName}`} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDesc} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Services", item: `${SITE_URL}/services` },
            { "@type": "ListItem", position: 3, name: stateName, item: canonicalUrl },
          ],
        })}</script>
      </Helmet>

      {/* Hero */}
      <div className="bg-[#0f2044] text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-10">
          <nav className="flex items-center gap-1.5 text-xs text-white/50 mb-6 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <ChevronRight size={12} />
            <Link href="/services" className="hover:text-white transition-colors">Services</Link>
            <ChevronRight size={12} />
            <span className="text-white/80">{stateName}</span>
          </nav>
          <div className="flex items-center gap-3 text-[#c9a227] text-xs font-semibold uppercase tracking-wider mb-3">
            <MapPin size={14} />
            India · {stateName}
          </div>
          <h1 className="text-3xl lg:text-4xl font-serif font-bold mb-3 leading-tight">
            Legal & Compliance Services in {stateName}
          </h1>
          <p className="text-white/70 text-base max-w-2xl leading-relaxed mb-6">
            Vakil & Co. provides expert CA, legal, and compliance services across all cities and towns in {stateName}. 
            Choose your city below to find services near you.
          </p>
          <div className="flex flex-wrap gap-3 text-sm">
            <div className="bg-white/10 rounded-lg px-4 py-2 flex items-center gap-2">
              <MapPin size={14} className="text-[#c9a227]" />
              <span><strong className="text-[#c9a227]">{data?.total ?? "—"}</strong> locations covered</span>
            </div>
            <div className="bg-white/10 rounded-lg px-4 py-2 flex items-center gap-2">
              <FileText size={14} className="text-[#c9a227]" />
              <span><strong className="text-[#c9a227]">{ALL_SERVICES.length}</strong> services available</span>
            </div>
            <div className="bg-white/10 rounded-lg px-4 py-2 flex items-center gap-2">
              <Building2 size={14} className="text-[#c9a227]" />
              <span>10,000+ clients in {stateName}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">

        {/* Top Services for this state */}
        <section>
          <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-2">Most Popular Services in {stateName}</h2>
          <p className="text-sm text-gray-500 mb-5">Click any service + city combination to view details and pricing.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {topServices.map((svc) => (
              <div key={svc.slug} className="border border-gray-200 rounded-xl p-4 bg-white hover:border-[#c9a227]/40 hover:shadow-sm transition-all group">
                <div className="font-semibold text-[#0f2044] text-sm mb-1 group-hover:text-[#c9a227] transition-colors">{svc.name}</div>
                <div className="text-xs text-gray-400 mb-3">from {svc.price}</div>
                <Link
                  href={`/services/${svc.categoryId}/${svc.slug}`}
                  className="flex items-center gap-1 text-xs text-[#c9a227] font-medium hover:underline"
                >
                  Learn more <ArrowRight size={11} />
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* Service Categories */}
        <section>
          <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-5">Service Categories</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {SERVICE_CATEGORIES.map((cat) => (
              <Link
                key={cat.id}
                href={`/services/${cat.id}`}
                className="flex items-center justify-between p-4 rounded-xl border border-gray-200 hover:border-[#c9a227] hover:bg-[#c9a227]/5 transition-all group"
              >
                <span className="font-medium text-[#0f2044] text-sm group-hover:text-[#c9a227] transition-colors">{cat.title}</span>
                <ArrowRight size={14} className="text-gray-300 group-hover:text-[#c9a227] transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        </section>

        {/* Cities in this state */}
        <section>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-2xl font-serif font-bold text-[#0f2044]">
                Cities & Towns in {stateName}
                {data && <span className="text-base font-normal text-gray-500 ml-2">({data.total} locations)</span>}
              </h2>
              <p className="text-sm text-gray-500 mt-1">Select your city to explore available services and pricing.</p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search city or pincode…"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
              />
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {filteredLocations.map((loc) => {
                  const place = primaryPlace(loc);
                  return (
                    <Link
                      key={loc.slug}
                      href={`/gst-registration/${loc.slug}`}
                      className="px-3 py-2 rounded-lg border border-gray-200 text-xs text-[#0f2044] hover:border-[#c9a227] hover:text-[#c9a227] hover:bg-[#c9a227]/5 transition-all text-center leading-snug"
                    >
                      {place}
                      {loc.district && loc.district !== place && (
                        <span className="block text-gray-400 text-[10px] mt-0.5">{loc.district}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
              {filteredLocations.length === 0 && (
                <p className="text-gray-400 text-sm text-center py-8">No locations match your search.</p>
              )}
            </>
          )}

          {/* Pagination */}
          {data && data.total > LIMIT && !search && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <Button
                variant="outline" size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >Previous</Button>
              <span className="text-sm text-gray-500">Page {page} of {Math.ceil(data.total / LIMIT)}</span>
              <Button
                variant="outline" size="sm"
                disabled={page >= Math.ceil(data.total / LIMIT)}
                onClick={() => setPage((p) => p + 1)}
              >Next</Button>
            </div>
          )}
        </section>

        {/* Top service × city combinations for SEO */}
        {data && data.locations.length > 0 && (
          <section>
            <h2 className="text-2xl font-serif font-bold text-[#0f2044] mb-5">Popular Service × City Combinations in {stateName}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {topServices.slice(0, 6).flatMap((svc) =>
                data.locations.slice(0, 4).map((loc) => {
                  const place = primaryPlace(loc);
                  return (
                    <Link
                      key={`${svc.slug}-${loc.slug}`}
                      href={`/${svc.slug}/${loc.slug}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:border-[#c9a227]/40 hover:bg-[#c9a227]/5 transition-all group"
                    >
                      <div>
                        <div className="text-sm font-medium text-[#0f2044] group-hover:text-[#c9a227] transition-colors">
                          {svc.name} in {place}
                        </div>
                        <div className="text-xs text-gray-400">from {svc.price}</div>
                      </div>
                      <ArrowRight size={12} className="text-gray-300 group-hover:text-[#c9a227] shrink-0" />
                    </Link>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* CTA */}
        <section className="bg-[#0f2044] rounded-2xl p-8 text-white text-center">
          <h2 className="text-2xl font-serif font-bold mb-3">
            Get Expert Legal Help Anywhere in {stateName}
          </h2>
          <p className="text-white/70 mb-5 max-w-xl mx-auto text-sm">
            Our team of CAs, Company Secretaries, and Advocates serves all districts in {stateName}. 100% online. Free consultation.
          </p>
          <Link href="/contact">
            <Button className="bg-[#c9a227] hover:bg-[#b8911f] text-[#0f2044] font-bold px-8">
              Book Free Consultation
            </Button>
          </Link>
        </section>

      </div>
    </>
  );
}
