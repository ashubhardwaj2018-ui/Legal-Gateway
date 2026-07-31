import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Download, TrendingUp, Users, IndianRupee, ChevronUp, ChevronDown, Loader2,
  PhoneCall, Video, RefreshCw, FileText, X, ArrowRight, AlertCircle,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";

const api = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(`${r.status}`);
  if (r.status === 204) return null;
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
  quotationsSent: number;
}

interface TeamData {
  rows: MemberRow[];
  teamQuotationsSent: number;
  range: { start: string; end: string };
}

interface WorkloadMember {
  id: number;
  name: string;
  designation: string;
  department: string;
  totalLeads: number;
  activeLeads: number;
  wonLeads: number;
  leads: Array<{ id: number; name: string; status: string; priority: string | null; serviceInterest: string }>;
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
  { key: "quotationsSent", label: "Quotations" },
];

export default function TeamPerformance() {
  const qc = useQueryClient();
  const [range, setRange] = useState("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("leadsWon");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [activeTab, setActiveTab] = useState<"performance" | "workload">("performance");

  // Reassignment panel state
  const [reassignEmployee, setReassignEmployee] = useState<WorkloadMember | null>(null);
  const [reassignTargets, setReassignTargets] = useState<Record<number, number>>({}); // leadId → targetEmployeeId
  const [reassigning, setReassigning] = useState(false);

  const queryParam = range === "custom" && customFrom && customTo
    ? `range=custom&from=${customFrom}&to=${customTo}`
    : `range=${range}`;

  const { data, isLoading } = useQuery<TeamData>({
    queryKey: ["team-perf", queryParam],
    queryFn: () => api(`/admin/performance/team?${queryParam}`),
    enabled: range !== "custom" || !!(customFrom && customTo),
  });

  const { data: workload = [], isLoading: workloadLoading } = useQuery<WorkloadMember[]>({
    queryKey: ["team-workload"],
    queryFn: () => api("/admin/performance/workload"),
    enabled: activeTab === "workload",
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
      r.meetings, r.followups, r.documents, r.quotationsSent,
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
  const teamQuotationsSent = data?.teamQuotationsSent ?? 0;

  async function handleReassign() {
    if (!reassignEmployee) return;
    const entries = Object.entries(reassignTargets);
    if (!entries.length) return;
    setReassigning(true);
    try {
      for (const [leadId, targetId] of entries) {
        await api(`/admin/leads/${leadId}/assign`, {
          method: "POST",
          body: JSON.stringify({ method: "individual", employeeIds: [targetId], replaceExisting: true }),
        });
      }
      qc.invalidateQueries({ queryKey: ["team-workload"] });
      qc.invalidateQueries({ queryKey: ["team-perf"] });
      setReassignEmployee(null);
      setReassignTargets({});
    } finally {
      setReassigning(false);
    }
  }

  return (
    <AdminLayout
      title="Team Performance"
      subtitle="Track your team's KPIs and activity"
      actions={
        <div className="flex gap-2">
          <Button
            onClick={exportCsv}
            disabled={!sorted.length}
            className="h-8 text-xs bg-[#0f2044] text-white hover:bg-[#0f2044]/90 flex items-center gap-1.5"
          >
            <Download size={13} /> Export CSV
          </Button>
        </div>
      }
    >
      {/* Reassignment slide-in panel */}
      {reassignEmployee && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40" onClick={() => { setReassignEmployee(null); setReassignTargets({}); }} />
          <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl">
            <div className="px-5 py-4 border-b bg-[#0f2044] flex items-center justify-between">
              <div>
                <h2 className="text-white font-semibold">Reassign Leads</h2>
                <p className="text-[#c9a227] text-xs mt-0.5">From: {reassignEmployee.name} · {reassignEmployee.activeLeads} active leads</p>
              </div>
              <button onClick={() => { setReassignEmployee(null); setReassignTargets({}); }} className="text-white/70 hover:text-white">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {reassignEmployee.leads.filter(l => !["won", "lost"].includes(l.status)).length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <AlertCircle size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No active leads to reassign.</p>
                </div>
              ) : reassignEmployee.leads
                  .filter(l => !["won", "lost"].includes(l.status))
                  .map(lead => (
                    <div key={lead.id} className="bg-gray-50 rounded-xl border border-gray-200 p-3">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="min-w-0">
                          <p className="font-medium text-[#0f2044] text-sm truncate">{lead.name}</p>
                          <p className="text-xs text-gray-500 truncate">{lead.serviceInterest}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize shrink-0 ${lead.status === "new" ? "bg-blue-100 text-blue-700" : lead.status === "won" ? "bg-green-100 text-green-700" : lead.status === "lost" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                          {lead.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ArrowRight size={11} className="text-gray-400 shrink-0" />
                        <select
                          value={reassignTargets[lead.id] ?? ""}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            setReassignTargets(prev => val ? { ...prev, [lead.id]: val } : Object.fromEntries(Object.entries(prev).filter(([k]) => k !== String(lead.id))));
                          }}
                          className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#c9a227]"
                        >
                          <option value="">— Keep with {reassignEmployee.name} —</option>
                          {workload.filter(m => m.id !== reassignEmployee.id).map(m => (
                            <option key={m.id} value={m.id}>{m.name} ({m.activeLeads} active)</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))}
            </div>
            <div className="p-4 border-t flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setReassignEmployee(null); setReassignTargets({}); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-[#c9a227] hover:bg-[#c9a227]/90 text-[#0f2044] font-semibold"
                disabled={!Object.keys(reassignTargets).length || reassigning}
                onClick={handleReassign}
              >
                {reassigning ? <><Loader2 size={14} className="animate-spin mr-2" />Reassigning…</> : `Reassign ${Object.keys(reassignTargets).length} Lead${Object.keys(reassignTargets).length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Tab toggle */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1 w-fit">
        {[
          { key: "performance", label: "Performance" },
          { key: "workload", label: "Workload & Reassign" },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as typeof activeTab)}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${activeTab === t.key ? "bg-white text-[#0f2044] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── PERFORMANCE TAB ── */}
      {activeTab === "performance" && (
        <>
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
                <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-7 text-xs border border-gray-200 rounded-lg px-2" />
                <span className="text-xs text-gray-400">to</span>
                <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-7 text-xs border border-gray-200 rounded-lg px-2" />
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
                { label: "Quotations", value: teamQuotationsSent, icon: FileText, color: "text-purple-600", bg: "bg-purple-100" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.bg} ${s.color} shrink-0`}><s.icon size={15} /></div>
                  <div className="min-w-0">
                    <div className="text-base font-bold text-[#0f2044]">{s.value}</div>
                    <div className="text-[10px] text-gray-400">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Performance Table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {isLoading ? (
              <div className="flex items-center justify-center h-40"><Loader2 size={22} className="animate-spin text-[#c9a227]" /></div>
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
                        <th key={String(col.key)} onClick={() => toggleSort(col.key)}
                          className="px-3 py-3 text-left text-xs font-semibold cursor-pointer hover:bg-white/10 whitespace-nowrap select-none">
                          <span className="flex items-center gap-1">
                            {col.label}
                            {sortKey === col.key ? (sortDir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />) : null}
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
                        <td className="px-3 py-2.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">{row.leadsWon}</span></td>
                        <td className="px-3 py-2.5"><span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">{row.leadsLost}</span></td>
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
                        <td className="px-3 py-2.5 text-gray-600">{row.quotationsSent}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── WORKLOAD & REASSIGN TAB ── */}
      {activeTab === "workload" && (
        <div>
          {workloadLoading ? (
            <div className="flex items-center justify-center h-40"><Loader2 size={22} className="animate-spin text-[#c9a227]" /></div>
          ) : workload.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <Users size={28} className="mb-2 opacity-30" />
              <p className="text-sm">No active team members.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-4">Click "Reassign" next to any employee to move their leads to someone else.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {workload.map(m => (
                  <div key={m.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-[#0f2044]">{m.name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{m.designation || m.department || "—"}</p>
                      </div>
                      <button
                        onClick={() => { setReassignEmployee(m); setReassignTargets({}); }}
                        className="text-[11px] px-3 py-1.5 rounded-lg bg-[#0f2044] text-white hover:bg-[#1a3060] transition-colors font-medium"
                      >
                        Reassign
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Active", value: m.activeLeads, color: "text-[#0f2044]", bg: "bg-[#0f2044]/5" },
                        { label: "Won", value: m.wonLeads, color: "text-green-600", bg: "bg-green-50" },
                        { label: "Total", value: m.totalLeads, color: "text-gray-600", bg: "bg-gray-50" },
                      ].map(s => (
                        <div key={s.label} className={`${s.bg} rounded-xl p-2 text-center`}>
                          <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                          <div className="text-[10px] text-gray-400">{s.label}</div>
                        </div>
                      ))}
                    </div>
                    {/* Mini bar: active leads relative to team max */}
                    <div className="mt-3">
                      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${m.activeLeads > 10 ? "bg-orange-500" : m.activeLeads > 5 ? "bg-[#c9a227]" : "bg-green-500"}`}
                          style={{ width: `${Math.min(100, (m.activeLeads / Math.max(1, ...workload.map(x => x.activeLeads))) * 100)}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1">{m.activeLeads} active leads</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
