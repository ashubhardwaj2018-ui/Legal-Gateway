import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Helmet } from "react-helmet-async";
import { Search, Building2, ChevronLeft, ChevronRight, Download, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

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
  "active": "bg-green-100 text-green-800",
  "strike off": "bg-red-100 text-red-800",
  "dissolved": "bg-gray-100 text-gray-700",
  "under liquidation": "bg-orange-100 text-orange-800",
};

function statusColor(s: string | null) {
  if (!s) return "bg-gray-100 text-gray-500";
  return STATUS_COLORS[s.toLowerCase()] ?? "bg-blue-100 text-blue-800";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

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

  return (
    <>
      <Helmet>
        <title>Indian Companies Database — Search by CIN, Name, State | Vakil & Co.</title>
        <meta name="description" content="Search the Indian Companies Database. Find company details, CIN, incorporation date, status, capital information and more for all MCA registered companies." />
        <meta name="keywords" content="Indian companies database, CIN search, MCA company search, company registration India" />
      </Helmet>

      {/* Hero */}
      <section className="bg-[#0f2044] text-white py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-[#c9a227]/20 text-[#c9a227] px-4 py-1.5 rounded-full text-sm font-medium mb-5">
            <Building2 size={14} /> MCA Registered Companies
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold mb-4">Indian Companies Database</h1>
          <p className="text-white/70 text-lg mb-8">Search across lakhs of MCA-registered companies. Find CIN, status, capital, and contact details instantly.</p>

          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by Company Name or CIN..."
              className="w-full pl-11 pr-4 py-4 rounded-xl text-gray-900 text-base focus:outline-none focus:ring-2 focus:ring-[#c9a227] shadow-lg"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Filters */}
      <div className="border-b bg-white sticky top-16 z-30 shadow-sm">
        <div className="container mx-auto max-w-7xl px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium mr-1">
            <Filter size={14} /> Status:
          </div>
          {STATUS_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                statusFilter === f
                  ? "bg-[#0f2044] text-white border-[#0f2044]"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#0f2044]"
              }`}
            >
              {f}
            </button>
          ))}

          <div className="w-px h-5 bg-gray-200 mx-1" />

          <div className="flex items-center gap-1.5 text-sm text-gray-500 font-medium mr-1">Type:</div>
          {TYPE_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all border ${
                typeFilter === f
                  ? "bg-[#c9a227] text-[#0f2044] border-[#c9a227] font-bold"
                  : "bg-white text-gray-600 border-gray-200 hover:border-[#c9a227]"
              }`}
            >
              {f}
            </button>
          ))}

          <div className="ml-auto">
            <Input
              placeholder="Filter by State..."
              value={stateFilter}
              onChange={e => setStateFilter(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="container mx-auto max-w-7xl px-4 py-8">

        {/* Toolbar */}
        <div className="flex items-center justify-between mb-5">
          <div className="text-sm text-gray-600">
            {loading ? "Loading…" : data ? (
              <span><strong>{data.total.toLocaleString()}</strong> companies found{hasFilters ? " (filtered)" : ""}</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {hasFilters && (
              <Button variant="outline" size="sm" onClick={() => { setSearch(""); setStatusFilter("All"); setTypeFilter("All"); setStateFilter(""); }}>
                <X size={12} className="mr-1" /> Clear Filters
              </Button>
            )}
            <a
              href={`/api/admin/indian-companies/export?${new URLSearchParams({
                ...(debouncedSearch ? { search: debouncedSearch } : {}),
                ...(statusFilter !== "All" ? { status: statusFilter } : {}),
                ...(typeFilter !== "All" ? { type: typeFilter } : {}),
                ...(stateFilter ? { state: stateFilter } : {}),
              })}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Download size={12} /> Export CSV
            </a>
          </div>
        </div>

        {/* Table */}
        {loading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="w-8 h-8 border-2 border-[#0f2044] border-t-transparent rounded-full animate-spin mr-3" />
            Searching companies…
          </div>
        )}

        {!loading && data && data.data.length === 0 && (
          <div className="text-center py-24">
            <Building2 size={40} className="text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No companies found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your search or filters</p>
          </div>
        )}

        {!loading && data && data.data.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Company Name</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">CIN</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">State</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700">Incorporated</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-700"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.data.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <Link href={`/company/${c.slug}`} className="font-medium text-[#0f2044] hover:text-[#c9a227] transition-colors line-clamp-2">
                          {c.companyName}
                        </Link>
                        {c.industry && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[280px]">{c.industry}</div>}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">{c.cin}</td>
                      <td className="px-4 py-3">
                        {c.companyType && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                            {c.companyType}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.companyStatus && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor(c.companyStatus)}`}>
                            {c.companyStatus}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">{c.state ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{c.incorporationDate ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/company/${c.slug}`}
                          className="text-xs font-medium text-[#0f2044] hover:text-[#c9a227] whitespace-nowrap transition-colors"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {data.pages > 1 && (
              <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-gray-500">
                  Page {page} of {data.pages} · {data.total.toLocaleString()} total
                </span>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={14} />
                  </Button>
                  {Array.from({ length: Math.min(5, data.pages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, data.pages - 4));
                    const p = start + i;
                    if (p > data.pages) return null;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`w-8 h-8 text-xs rounded-md font-medium transition-colors ${p === page ? "bg-[#0f2044] text-white" : "text-gray-600 hover:bg-gray-100"}`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <Button variant="outline" size="sm" disabled={page >= data.pages} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Empty initial state */}
        {!loading && !data && (
          <div className="text-center py-24">
            <Building2 size={56} className="text-gray-200 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Search for a company above to get started</p>
          </div>
        )}
      </div>
    </>
  );
}
