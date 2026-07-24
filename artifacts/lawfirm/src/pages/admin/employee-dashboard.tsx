import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, PhoneCall, CheckSquare, TrendingUp,
  IndianRupee, Target, FileText, Activity, RefreshCw, Video,
  Award, Loader2, MessageSquare,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";

const api = async (path: string) => {
  const r = await fetch(`/api${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json();
};

interface KPIData {
  assignedLeads: number;
  todayFollowUps: number;
  pendingTasks: number;
  upcomingMeetings: number;
  newMessages: number;
  wonLeads: number;
  lostLeads: number;
  pendingLeads: number;
  revenueGenerated: number;
  conversionRate: number;
  calls: number;
  meetings: number;
  followups: number;
  documents: number;
  wonThisMonth: number;
  monthlyTarget: number;
  chart: Array<{ label: string; won: number; total: number }>;
}

function fmt(v: number) {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

function KpiCard({
  label, value, sub, icon: Icon, color, bg, accent,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string; accent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 hover:shadow-md transition-all relative overflow-hidden ${accent ? "border-[#c9a227]/40 shadow-sm" : "border-gray-100"}`}>
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-[0.06] ${bg}`} />
      <div className="flex items-start justify-between mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} ${color}`}>
          <Icon size={16} />
        </div>
      </div>
      <div className="text-2xl font-bold text-[#0f2044] mt-1">{value}</div>
      <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

const RANGES = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

export default function EmployeeDashboard() {
  const [range, setRange] = useState("month");

  const { data: kpi, isLoading } = useQuery<KPIData>({
    queryKey: ["perf-me", range],
    queryFn: () => api(`/admin/performance/me?range=${range}`),
  });

  const targetPct = kpi ? Math.min(100, Math.round((kpi.wonThisMonth / kpi.monthlyTarget) * 100)) : 0;

  return (
    <AdminLayout title="My Dashboard" subtitle="Your personal performance overview">
      {/* Range selector */}
      <div className="flex gap-2 mb-6">
        {RANGES.map(r => (
          <button
            key={r.value}
            onClick={() => setRange(r.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${range === r.value ? "bg-[#0f2044] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#0f2044]"}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 size={24} className="animate-spin text-[#c9a227]" />
        </div>
      ) : kpi ? (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
            <KpiCard label="Assigned Leads" value={kpi.assignedLeads} icon={Users} color="text-[#0f2044]" bg="bg-[#0f2044]" accent />
            <KpiCard label="Today's Follow-ups" value={kpi.todayFollowUps} icon={RefreshCw} color="text-[#c9a227]" bg="bg-[#c9a227]" />
            <KpiCard label="Pending Tasks" value={kpi.pendingTasks} icon={CheckSquare} color="text-orange-600" bg="bg-orange-100" />
            <KpiCard label="Upcoming Meetings" value={kpi.upcomingMeetings} icon={Video} color="text-purple-600" bg="bg-purple-100" sub="Last 30 days" />
            <KpiCard label="New Messages" value={kpi.newMessages} icon={MessageSquare} color="text-sky-600" bg="bg-sky-100" sub="Today" />
            <KpiCard
              label="Revenue Generated"
              value={fmt(kpi.revenueGenerated)}
              icon={IndianRupee}
              color="text-green-600"
              bg="bg-green-100"
              sub="From won leads"
              accent
            />
            <KpiCard label="Conversion Rate" value={`${kpi.conversionRate}%`} icon={TrendingUp} color="text-indigo-600" bg="bg-indigo-100" />
            <KpiCard label="Leads Won" value={kpi.wonLeads} icon={Award} color="text-green-700" bg="bg-green-100" sub="Total" />
            <KpiCard label="Pending Leads" value={kpi.pendingLeads} icon={Activity} color="text-yellow-700" bg="bg-yellow-100" />
            <KpiCard label="Calls Logged" value={kpi.calls} icon={PhoneCall} color="text-blue-600" bg="bg-blue-100" />
          </div>

          {/* Monthly Target + Activity Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
            {/* Monthly target card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <div className="flex items-center gap-2 mb-3">
                <Target size={16} className="text-[#c9a227]" />
                <span className="text-sm font-semibold text-[#0f2044]">Monthly Target</span>
              </div>
              <div className="flex items-end gap-2 mb-3">
                <span className="text-3xl font-bold text-[#0f2044]">{kpi.wonThisMonth}</span>
                <span className="text-sm text-gray-400 mb-0.5">/ {kpi.monthlyTarget} leads closed</span>
              </div>
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${targetPct >= 100 ? "bg-green-500" : targetPct >= 60 ? "bg-[#c9a227]" : "bg-[#0f2044]"}`}
                  style={{ width: `${targetPct}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                <span>{targetPct}% complete</span>
                <span>{kpi.monthlyTarget - kpi.wonThisMonth > 0 ? `${kpi.monthlyTarget - kpi.wonThisMonth} to go` : "Target hit!"}</span>
              </div>
            </div>

            {/* Activity breakdown */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 col-span-1 lg:col-span-2">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={16} className="text-[#c9a227]" />
                <span className="text-sm font-semibold text-[#0f2044]">Activity Breakdown</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Calls", value: kpi.calls, icon: PhoneCall, color: "text-blue-600" },
                  { label: "Meetings", value: kpi.meetings, icon: Video, color: "text-purple-600" },
                  { label: "Follow-ups", value: kpi.followups, icon: RefreshCw, color: "text-orange-500" },
                  { label: "Documents", value: kpi.documents, icon: FileText, color: "text-teal-600" },
                ].map(a => (
                  <div key={a.label} className="text-center p-3 bg-gray-50 rounded-xl">
                    <a.icon size={18} className={`mx-auto mb-1 ${a.color}`} />
                    <div className="text-xl font-bold text-[#0f2044]">{a.value}</div>
                    <div className="text-[10px] text-gray-500">{a.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Performance Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-[#c9a227]" />
              <span className="text-sm font-semibold text-[#0f2044]">Leads Closed per Week (Last 8 Weeks)</span>
            </div>
            {kpi.chart.length > 0 ? (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={kpi.chart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9ca3af" }} />
                  <YAxis tick={{ fontSize: 10, fill: "#9ca3af" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(v: number, name: string) => [v, name === "won" ? "Won" : "Activities"]}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="won" name="Won" fill="#c9a227" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="Activities" fill="#0f2044" radius={[4, 4, 0, 0]} opacity={0.5} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet.</div>
            )}
          </div>
        </>
      ) : null}
    </AdminLayout>
  );
}
