import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Search, Building2, ChevronLeft, ChevronRight, Filter, X, MapPin, Calendar, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Company {
  id: number;
  cin: string;
  companyName: string;
  slug: string;
  companyType: string | null;
  companyStatus: string | null;
  state: string | null;
  district: string | null;
  city: string | null;
  industry: string | null;
  incorporationDate: string | null;
  authorizedCapital: string | null;
}

const STATUS_FILTERS = ["All", "Active", "Strike Off", "Dissolved", "Under Liquidation"];
const TYPE_FILTERS = ["All", "Private Limited", "Public Limited", "LLP", "OPC", "Government", "Foreign"];

const STATUS_COLORS: Record<string, string> = {
  "active": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "strike off": "bg-red-100 text-red-700 border-red-200",
  "dissolved": "bg-gray-100 text-gray-600 border-gray-200",
  "under liquidation": "bg-orange-100 text-orange-700 border-orange-200",
};

function statusColor(s: string | null) {
  if (!s) return "bg-gray-100 text-gray-500 border-gray-200";
  return STATUS_COLORS[s.toLowerCase()] ?? "bg-blue-100 text-blue-700 border-blue-200";
}

export default function IndianCompanies() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: Company[]; total: number; pages: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
  }, [search]);

  useEffect(() => { setPage(1); }, [statusFilter, typeFilter, stateFilter]);

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: "25" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter !== "All") params.set("status", statusFilter);
    if (typeFilter !== "All") params.set("type", typeFilter);
    if (stateFilter) params.set("state", stateFilter);

    setLoading(true);
    fetch(`/api/companies?${params}`)
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [debouncedSearch, statusFilter, typeFilter, stateFilter, page]);

  const hasFilters = debouncedSearch || statusFilter !== "All" || typeFilter !== "All" || stateFilter;
  const clearFilters = () => { setSearch(""); setStatusFilter("All"); setTypeFilter("All"); setStateFilter(""); };

  return (
    <>
      <Helmet>
        <title>Indian Companies Database — Search by CIN, Name, State | Vakil & Co.</title>
        <meta name="description" content="Search the Indian Companies Database. Find company details, CIN, incorporation date, status, capital information and more for all MCA registered companies." />
        <meta name="keywords" content="Indian companies database, CIN search, MCA company search, company registration India" />
      </Helmet>

      {/* Hero */}
      <section className="bg-[#0f2044] text-white py-16 px-4 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#c9a227] blur-3xl" />
          <div className="absolute bottom-0 left-0 w-64 h-64 rounded-full bg-white blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <div className="inline-flex items-center gap-2 bg-[#c9a227]/20 text-[#c9a227] px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <Building2 size={14} /> MCA Registered Companies
          </div>
          <h1 className="font-serif text-3xl md:text-5xl font-bold mb-3">Indian Companies Database</h1>
          <p className="text-white/70 text-lg mb-8 max-w-2xl mx-auto">Search across lakhs of MCA-registered companies. Find CIN, status, capital, and contact details instantly.</p>

          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Company Name or CIN..."
              className="w-full pl-11 pr-12 py-4 rounded-2xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#c9a227] shadow-xl"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Quick stats */}
          {data != null && typeof data.total === "number" && (
            <div className="flex justify-center gap-6 mt-6 text-sm">
              <span className="flex items-center gap-1.5 text-white/60"><BarChart3 size={13} className="text-[#c9a227]" /><strong className="text-white">{data.total.toLocaleString()}</strong> companies{hasFilters ? " found" : " in database"}</span>
            </div>
          )}
        </div>
      </section>

      {/* Filters */}
      <div className="border-b bg-white sticky top-16 z-30 shadow-sm">
        <div className="container mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium shrink-0">
            <Filter size={13} /> Status:
          </div>
          {STATUS_FILTERS.map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${statusFilter === f ? "bg-[#0f2044] text-white border-[#0f2044] shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-[#0f2044] hover:text-[#0f2044]"}`}
            >{f}</button>
          ))}

          <div className="w-px h-4 bg-gray-200 mx-1 hidden sm:block" />

          <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium shrink-0">Type:</div>
          {TYPE_FILTERS.map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${typeFilter === f ? "bg-[#c9a227] text-[#0f2044] border-[#c9a227] font-bold shadow-sm" : "bg-white text-gray-600 border-gray-200 hover:border-[#c9a227] hover:text-[#0f2044]"}`}
            >{f}</button>
          ))}

          <div className="ml-auto flex items-center gap-2">
            <Input
              placeholder="Filter by State..."
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="h-8 text-xs w-32"
            />
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters} className="h-8 text-xs gap-1 shrink-0">
                <X size={11} /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto max-w-7xl px-4 py-8">

        {loading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="w-8 h-8 border-2 border-[#0f2044] border-t-transparent rounded-full animate-spin mr-3" />
            Searching companies…
          </div>
        )}

        {!loading && data && Array.isArray(data.data) && data.data.length === 0 && (
          <div className="text-center py-24 bg-white rounded-2xl border border-gray-100">
            <Building2 size={48} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No companies found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
            <Button variant="outline" className="mt-4" onClick={clearFilters}>Clear all filters</Button>
          </div>
        )}

        {!loading && data && Array.isArray(data.data) && data.data.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <span className="text-xs text-gray-500">
                Showing <strong className="text-gray-700">{((page - 1) * 25) + 1}–{Math.min(page * 25, data.total)}</strong> of <strong className="text-gray-700">{data.total.toLocaleString()}</strong> companies
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Company</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">CIN</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Type</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Location</th>
                    <th className="text-left px-4 py-3.5 font-semibold text-gray-600 text-xs uppercase tracking-wide">Incorporated</th>
                    <th className="text-left px-4 py-3.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.data.map(c => (
                    <tr key={c.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-5 py-3.5">
                        <Link href={`/company/${c.slug}`} className="font-semibold text-[#0f2044] hover:text-[#c9a227] transition-colors line-clamp-1 group-hover:underline underline-offset-2">
                          {c.companyName}
                        </Link>
                        {c.industry && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[260px]">{c.industry}</div>}
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-500 whitespace-nowrap">{c.cin}</td>
                      <td className="px-4 py-3.5">
                        {c.companyType && (
                          <span className="text-xs bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                            {c.companyType}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.companyStatus && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap border ${statusColor(c.companyStatus)}`}>
                            {c.companyStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.state && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                            <MapPin size={10} className="text-gray-400" />{c.state}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {c.incorporationDate && (
                          <span className="flex items-center gap-1 text-xs text-gray-500 whitespace-nowrap">
                            <Calendar size={10} className="text-gray-400" />{c.incorporationDate}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        <Link
                          href={`/company/${c.slug}`}
                          className="text-xs font-semibold text-[#0f2044] hover:text-[#c9a227] whitespace-nowrap transition-colors opacity-0 group-hover:opacity-100"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {data.pages > 1 && (
              <div className="border-t border-gray-100 px-5 py-3.5 flex items-center justify-between bg-gray-50/30">
                <span className="text-xs text-gray-400">
                  Page {page} of {data.pages}
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="h-8 w-8 p-0">
                    <ChevronLeft size={14} />
                  </Button>
                  {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, data.pages - 4));
                    const p = start + i;
                    if (p > data.pages) return null;
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-8 h-8 text-xs rounded-lg font-medium transition-colors ${p === page ? "bg-[#0f2044] text-white" : "text-gray-600 hover:bg-gray-100"}`}
                      >{p}</button>
                    );
                  })}
                  <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)} className="h-8 w-8 p-0">
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !data && (
          <div className="text-center py-32">
            <div className="w-20 h-20 bg-[#0f2044]/5 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Building2 size={36} className="text-[#0f2044]/20" />
            </div>
            <p className="text-gray-400 text-lg font-medium">Search for a company above</p>
            <p className="text-gray-300 text-sm mt-1">Enter a company name or CIN to get started</p>
          </div>
        )}

        {/* SEO content */}
        <div className="mt-12 grid md:grid-cols-3 gap-6 text-sm text-gray-500">
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#0f2044] mb-2">What is CIN?</h3>
            <p>Corporate Identity Number (CIN) is a 21-digit alphanumeric code assigned by the Ministry of Corporate Affairs (MCA) to every registered company in India.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#0f2044] mb-2">Company Status</h3>
            <p>Active companies are in good standing. "Strike Off" means removed from MCA registry due to non-compliance. "Under Liquidation" indicates winding-up proceedings.</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#0f2044] mb-2">Need Legal Help?</h3>
            <p>Our corporate lawyers can help with company incorporation, compliance, NCLT matters, and due diligence. <Link href="/services/consult-expert" className="text-[#c9a227] font-medium hover:underline">Book a consultation →</Link></p>
          </div>
        </div>
      </div>
    </>
  );
}
