import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download, TrendingUp, Users, IndianRupee, ChevronUp, ChevronDown, Loader2,
  PhoneCall, Video, RefreshCw, FileText,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";

const api = async (path: string) => {
  const r = await fetch(`/api${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

interface MemberRow {
  id: number;
  name: string;
  designation: string;
  leadsAssigned: number;
  leadsWon: number;
  leadsLost: number;
  leadsPending: number;
  revenueGenerated: number;
  conversionRate: number;
  calls: number;
  meetings: number;
  followups: number;
  documents: number;
}

interface TeamData {
  rows: MemberRow[];
  range: { start: string; end: string };
}

function fmt(v: number) {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

const RANGES = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
  { label: "Custom", value: "custom" },
];

type SortKey = keyof MemberRow;
type SortDir = "asc" | "desc";

const COLS: Array<{ key: SortKey; label: string; fmt?: (v: number) => string }> = [
  { key: "name", label: "Employee" },
  { key: "leadsAssigned", label: "Assigned" },
  { key: "leadsWon", label: "Won" },
  { key: "leadsLost", label: "Lost" },
  { key: "leadsPending", label: "Pending" },
  { key: "revenueGenerated", label: "Revenue", fmt },
  { key: "conversionRate", label: "Conv. %" },
  { key: "calls", label: "Calls" },
  { key: "meetings", label: "Meetings" },
  { key: "followups", label: "Follow-ups" },
  { key: "documents", label: "Docs" },
];

export default function TeamPerformance() {
  const [range, setRange] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("leadsWon");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const queryParam = range === "custom" && customFrom && customTo
    ? `range=custom&from=${customFrom}&to=${customTo}`
    : `range=${range}`;

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ["team-perf", queryParam],
    queryFn: () => api(`/admin/performance/team?${queryParam}`),
    enabled: range !== "custom" || !!(customFrom && customTo),
  });

  const sorted = useMemo(() => {
    if (!data?.rows) return [];
    return [...data.rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  function exportCsv() {
    if (!sorted.length) return;
    const headers = COLS.map(c => c.label);
    const rows = sorted.map(r => [
      r.name, r.leadsAssigned, r.leadsWon, r.leadsLost, r.leadsPending,
      r.revenueGenerated.toFixed(0), r.conversionRate, r.calls,
      r.meetings, r.followups, r.documents,
    ].map(String));
    const csv = [headers.join(","), ...rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `team-performance-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Summary totals
  const totals = sorted.reduce((acc, r) => ({
    leadsAssigned: acc.leadsAssigned + r.leadsAssigned,
    leadsWon: acc.leadsWon + r.leadsWon,
    revenue: acc.revenue + r.revenueGenerated,
    calls: acc.calls + r.calls,
    meetings: acc.meetings + r.meetings,
  }), { leadsAssigned: 0, leadsWon: 0, revenue: 0, calls: 0, meetings: 0 });

  return (
    <AdminLayout
      title="Team Performance"
      subtitle="Track your team's KPIs and activity"
      actions={
        <Button
          onClick={exportCsv}
          disabled={!sorted.length}
          className="h-8 text-xs bg-[#0f2044] text-white hover:bg-[#0f2044]/90 flex items-center gap-1.5"
        >
          <Download size={13} /> Export CSV
        </Button>
      }
    >
      {/* Range selector */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${range === r.value ? "bg-[#0f2044] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#0f2044]"}`}
          >
            {r.label}
          </button>
        ))}
        {range === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={customFrom}
              onChange={e => setCustomFrom(e.target.value)}
              className="h-7 text-xs border border-gray-200 rounded-lg px-2"
            />
            <span className="text-xs text-gray-400">to</span>
            <input
              type="date"
              value={customTo}
              onChange={e => setCustomTo(e.target.value)}
              className="h-7 text-xs border border-gray-200 rounded-lg px-2"
            />
          </div>
        )}
      </div>

      {/* Summary Cards */}
      {!isLoading && data && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
          {[
            { label: "Total Assigned", value: totals.leadsAssigned, icon: Users, color: "text-[#0f2044]", bg: "bg-[#0f2044]/10" },
            { label: "Total Won", value: totals.leadsWon, icon: TrendingUp, color: "text-green-600", bg: "bg-green-100" },
            { label: "Revenue", value: fmt(totals.revenue), icon: IndianRupee, color: "text-[#c9a227]", bg: "bg-[#c9a227]/10" },
            { label: "Calls", value: totals.calls, icon: PhoneCall, color: "text-blue-600", bg: "bg-blue-100" },
            { label: "Meetings", value: totals.meetings, icon: Video, color: "text-purple-600", bg: "bg-purple-100" },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}>
                <s.icon size={15} />
              </div>
              <div className="min-w-0">
                <div className="text-base font-bold text-[#0f2044]">{s.value}</div>
                <div className="text-[10px] text-gray-400">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={22} className="animate-spin text-[#c9a227]" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400">
            <Users size={28} className="mb-2 opacity-30" />
            <p className="text-sm">No team members found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0f2044] text-white">
                  {COLS.map(col => (
                    <th
                      key={String(col.key)}
                      onClick={() => toggleSort(col.key)}
                      className="px-3 py-3 text-left text-xs font-semibold cursor-pointer hover:bg-white/10 whitespace-nowrap select-none"
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {sortKey === col.key ? (
                          sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
                        ) : null}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((row, idx) => (
                  <tr key={row.id} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? "" : "bg-gray-50/40"}`}>
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[#0f2044] text-sm">{row.name}</div>
                      {row.designation && <div className="text-[10px] text-gray-400">{row.designation}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-gray-700 font-medium">{row.leadsAssigned}</td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{row.leadsWon}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{row.leadsLost}</span>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{row.leadsPending}</td>
                    <td className="px-3 py-2.5 font-semibold text-[#c9a227]">{fmt(row.revenueGenerated)}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 max-w-[60px] h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#c9a227] rounded-full" style={{ width: `${row.conversionRate}%` }} />
                        </div>
                        <span className="text-xs text-gray-600">{row.conversionRate}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-gray-600">{row.calls}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.meetings}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.followups}</td>
                    <td className="px-3 py-2.5 text-gray-600">{row.documents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
