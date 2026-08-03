import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  Users, TrendingUp, TrendingDown, IndianRupee, AlertCircle, CheckSquare,
  Clock, Target, ArrowRight, Phone, Calendar, Star, Activity,
  MessageSquare, FileText, Briefcase, ChevronRight,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";

interface DashStats {
  leads: { total: number; today: number; new: number; contacted: number; pending: number; won: number; lost: number; hold: number; byStatus: Record<string, number> };
  revenue: { total: string; collected: string; outstanding: string; wonRevenue: string; overdueInvoices: number; monthly: Array<{ month: string; revenue: number; collected: number }> };
  tasks: { total: number; todo: number; inProgress: number; done: number; overdue: number };
  leadSources: Array<{ name: string; value: number }>;
  leadFunnel: Array<{ status: string; count: number; color: string }>;
  conversionRate: number;
  teamCount: number;
  upcomingFollowUps: Array<{ id: number; name: string; company: string | null; serviceInterest: string; assignedTo: string | null; nextFollowUp: string; status: string; priority: string | null; phone: string }>;
  recentActivity: Array<{ id: number; leadId: number; type: string; description: string; createdAt: string }>;
}

const PIE_COLORS = ["#0f2044", "#c9a227", "#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#06b6d4", "#ef4444"];

function fmt(n: string | number) {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

function fmtFollowUpTime(dt: string) {
  const d = new Date(dt);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const hours = Math.floor(diff / 3600000);
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `In ${mins}m`;
  if (hours < 24) return `In ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "Tomorrow" : `In ${days} days`;
}

function KpiCard({ label, value, sub, icon: Icon, color, bg, trend, href }: {
  label: string; value: string | number; sub?: string; icon: React.ElementType;
  color: string; bg: string; trend?: "up" | "down" | null; href?: string;
}) {
  const inner = (
    <div className={`bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group relative overflow-hidden`}>
      <div className={`absolute top-0 right-0 w-20 h-20 rounded-full opacity-[0.07] ${bg} -translate-y-4 translate-x-4`} />
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${color}`}><Icon size={18} /></div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-medium ${trend === "up" ? "text-green-600" : "text-red-500"}`}>
            {trend === "up" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          </div>
        )}
      </div>
      <div className="text-2xl font-bold text-[#0f2044] mb-0.5">{value}</div>
      <div className="text-xs text-gray-500 font-medium">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

const ACTIVITY_ICONS: Record<string, { icon: React.ElementType; color: string }> = {
  note: { icon: MessageSquare, color: "text-blue-500" },
  call: { icon: Phone, color: "text-green-500" },
  email: { icon: FileText, color: "text-purple-500" },
  status_change: { icon: Activity, color: "text-orange-500" },
  task: { icon: CheckSquare, color: "text-indigo-500" },
  meeting: { icon: Calendar, color: "text-pink-500" },
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-200",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-green-50 text-green-700 border-green-200",
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-xs">
      <div className="font-semibold text-gray-700 mb-1.5">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-800">{typeof p.value === "number" && p.name?.includes("₹") ? fmt(p.value) : `₹${(p.value).toLocaleString("en-IN")}`}</span>
        </div>
      ))}
    </div>
  );
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then(r => {
        if (r.status === 403) {
          // Employee accounts don't have dashboard access — redirect to their own dashboard
          setForbidden(true);
          setLoading(false);
          navigate("/admin/my-dashboard");
          return null;
        }
        if (!r.ok) { setLoading(false); return null; }
        return r.json();
      })
      .then(d => { if (d) { setStats(d as DashStats); setLoading(false); } })
      .catch(() => setLoading(false));
  }, []);

  if (forbidden) return null;

  const S = stats;

  return (
    <AdminLayout title="Dashboard" subtitle="Live overview — Legal Filing India ERP">
      {/* ── KPI CARDS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3 mb-6">
        <KpiCard label="Total Leads" value={S?.leads.total ?? "—"} icon={Users} bg="bg-blue-50" color="text-blue-600" href="/admin/leads" trend="up" />
        <KpiCard label="Today's Leads" value={S?.leads.today ?? "—"} sub="New today" icon={TrendingUp} bg="bg-indigo-50" color="text-indigo-600" href="/admin/leads" />
        <KpiCard label="Won Leads" value={S?.leads.won ?? "—"} sub={S ? `${S.conversionRate}% conv.` : undefined} icon={Star} bg="bg-green-50" color="text-green-600" href="/admin/leads" trend="up" />
        <KpiCard label="Total Revenue" value={S?.revenue.total ? fmt(S.revenue.total) : "—"} sub="All invoices" icon={IndianRupee} bg="bg-yellow-50" color="text-yellow-600" href="/admin/invoices" />
        <KpiCard label="Collected" value={S?.revenue.collected ? fmt(S.revenue.collected) : "—"} sub="Payments received" icon={CheckSquare} bg="bg-emerald-50" color="text-emerald-600" href="/admin/invoices" trend="up" />
        <KpiCard label="Outstanding" value={S?.revenue.outstanding ? fmt(S.revenue.outstanding) : "—"} sub={S?.revenue.overdueInvoices ? `${S.revenue.overdueInvoices} overdue` : "All on time"} icon={AlertCircle} bg="bg-red-50" color="text-red-600" href="/admin/invoices" trend={S?.revenue.overdueInvoices ? "down" : null} />
        <KpiCard label="Tasks" value={S?.tasks.total ?? "—"} sub={S?.tasks.overdue ? `${S.tasks.overdue} overdue` : "All on track"} icon={Briefcase} bg="bg-purple-50" color="text-purple-600" href="/admin/tasks" />
        <KpiCard label="Team Size" value={S?.teamCount ?? "—"} sub="Active members" icon={Target} bg="bg-orange-50" color="text-orange-600" href="/admin/team" />
      </div>

      {/* ── ROW 2: Revenue chart + Lead Funnel ───────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-4">
        {/* Revenue Area Chart */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-[#0f2044] text-sm">Revenue Overview</h2>
              <p className="text-xs text-gray-400 mt-0.5">Last 12 months — invoiced vs collected</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#0f2044]" /><span className="text-gray-500">Invoiced</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#c9a227]" /><span className="text-gray-500">Collected</span></div>
            </div>
          </div>
          {loading ? (
            <div className="h-52 flex items-center justify-center text-gray-300 text-sm">Loading chart…</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={S?.revenue.monthly ?? []} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="navyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0f2044" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0f2044" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c9a227" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={v => v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v)} tick={{ fontSize: 10, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={40} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="revenue" name="Invoiced" stroke="#0f2044" strokeWidth={2.5} fill="url(#navyGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#0f2044" }} />
                <Area type="monotone" dataKey="collected" name="Collected" stroke="#c9a227" strokeWidth={2.5} fill="url(#goldGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#c9a227" }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Lead Funnel */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#0f2044] text-sm">Lead Pipeline</h2>
            <Link href="/admin/leads" className="text-xs text-[#c9a227] hover:underline flex items-center gap-1">View <ArrowRight size={10} /></Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-8 bg-gray-100 rounded-lg animate-pulse" />)}</div>
          ) : (S?.leadFunnel ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300 text-sm">No leads yet</div>
          ) : (
            <div className="space-y-2.5">
              {(S?.leadFunnel ?? []).map(item => {
                const max = Math.max(...(S?.leadFunnel ?? []).map(f => f.count), 1);
                const pct = Math.round((item.count / max) * 100);
                return (
                  <div key={item.status}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600 font-medium">{item.status}</span>
                      <span className="text-xs font-bold text-gray-800">{item.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Conversion Rate</span>
                <span className="text-sm font-bold text-[#0f2044]">{S?.conversionRate ?? 0}%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 3: Source Pie + Follow-ups + Activity ──────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Lead Sources Pie */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <h2 className="font-bold text-[#0f2044] text-sm mb-1">Lead Sources</h2>
          <p className="text-xs text-gray-400 mb-3">Where clients come from</p>
          {loading ? (
            <div className="h-44 bg-gray-50 rounded-xl animate-pulse" />
          ) : (S?.leadSources ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-gray-300 text-sm">No data yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={S?.leadSources ?? []} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                    {(S?.leadSources ?? []).map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={0} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, n: string) => [v, n]} contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", boxShadow: "0 4px 24px rgba(0,0,0,0.08)", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 gap-1.5 mt-1">
                {(S?.leadSources ?? []).slice(0, 6).map((src, i) => (
                  <div key={src.name} className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[10px] text-gray-500 truncate">{src.name}</span>
                    <span className="text-[10px] font-bold text-gray-700 ml-auto">{src.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Upcoming Follow-ups */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-[#0f2044] text-sm">Follow-ups Due</h2>
              <p className="text-xs text-gray-400">Next 7 days</p>
            </div>
            <Link href="/admin/leads" className="text-xs text-[#c9a227] hover:underline flex items-center gap-1">All <ArrowRight size={10} /></Link>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : (S?.upcomingFollowUps ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Calendar size={32} className="text-gray-200 mb-2" />
              <p className="text-gray-400 text-sm">No follow-ups scheduled</p>
              <p className="text-gray-300 text-xs">for the next 7 days</p>
            </div>
          ) : (
            <div className="space-y-2.5 overflow-y-auto max-h-56">
              {(S?.upcomingFollowUps ?? []).map(f => (
                <Link key={f.id} href="/admin/leads">
                  <div className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-gray-50 transition-colors cursor-pointer border border-transparent hover:border-gray-100">
                    <div className="w-8 h-8 rounded-lg bg-[#0f2044] flex items-center justify-center text-white text-[10px] font-bold shrink-0">{f.name.split(" ").map(n => n[0]).join("").slice(0,2).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-[#0f2044] truncate">{f.name}</span>
                        <span className="text-[10px] font-bold text-[#c9a227] shrink-0">{fmtFollowUpTime(f.nextFollowUp)}</span>
                      </div>
                      <div className="text-[10px] text-gray-400 truncate">{f.serviceInterest}</div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {f.priority && <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-semibold capitalize ${PRIORITY_COLORS[f.priority] ?? "bg-gray-50"}`}>{f.priority}</span>}
                        {f.assignedTo && <span className="text-[10px] text-gray-400">→ {f.assignedTo}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-[#0f2044] text-sm">Recent Activity</h2>
              <p className="text-xs text-gray-400">Latest across all leads</p>
            </div>
          </div>
          {loading ? (
            <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />)}</div>
          ) : (S?.recentActivity ?? []).length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <Activity size={32} className="text-gray-200 mb-2" />
              <p className="text-gray-400 text-sm">No activity yet</p>
              <p className="text-gray-300 text-xs">Activity will appear as you work leads</p>
            </div>
          ) : (
            <div className="space-y-0 overflow-y-auto max-h-64">
              {(S?.recentActivity ?? []).map((act, i) => {
                const cfg = ACTIVITY_ICONS[act.type] ?? { icon: Activity, color: "text-gray-400" };
                const Icon = cfg.icon;
                const isLast = i === (S?.recentActivity ?? []).length - 1;
                const timeAgo = (() => {
                  const diff = Date.now() - new Date(act.createdAt).getTime();
                  const m = Math.floor(diff / 60000);
                  const h = Math.floor(m / 60);
                  const d = Math.floor(h / 24);
                  if (m < 1) return "just now";
                  if (m < 60) return `${m}m ago`;
                  if (h < 24) return `${h}h ago`;
                  return `${d}d ago`;
                })();
                return (
                  <div key={act.id} className="flex gap-3 relative">
                    {!isLast && <div className="absolute left-3.5 top-7 bottom-0 w-px bg-gray-100" />}
                    <div className={`w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center shrink-0 mt-1 z-10 ${cfg.color}`}><Icon size={12} /></div>
                    <div className="flex-1 min-w-0 pb-3">
                      <p className="text-xs text-gray-700 leading-relaxed line-clamp-2">{act.description}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-gray-400">{timeAgo}</span>
                        <span className="text-gray-200">·</span>
                        <Link href="/admin/leads"><span className="text-[10px] text-[#c9a227] hover:underline">Lead #{act.leadId}</span></Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 4: Task breakdown + Quick actions ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Task Summary Bar Chart */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-[#0f2044] text-sm">Task Breakdown</h2>
            <Link href="/admin/tasks" className="text-xs text-[#c9a227] hover:underline flex items-center gap-1">Manage <ArrowRight size={10} /></Link>
          </div>
          {loading ? (
            <div className="h-28 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: "To Do", count: S?.tasks.todo ?? 0, color: "bg-gray-100 text-gray-600" },
                  { label: "In Progress", count: S?.tasks.inProgress ?? 0, color: "bg-blue-100 text-blue-700" },
                  { label: "Done", count: S?.tasks.done ?? 0, color: "bg-green-100 text-green-700" },
                  { label: "Overdue", count: S?.tasks.overdue ?? 0, color: "bg-red-100 text-red-700" },
                ].map(t => (
                  <div key={t.label} className={`rounded-xl p-3 text-center ${t.color}`}>
                    <div className="text-xl font-bold">{t.count}</div>
                    <div className="text-[10px] font-medium mt-0.5">{t.label}</div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={[{ name: "Tasks", todo: S?.tasks.todo ?? 0, inProgress: S?.tasks.inProgress ?? 0, done: S?.tasks.done ?? 0, overdue: S?.tasks.overdue ?? 0 }]} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" hide />
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid #e5e7eb", fontSize: "12px" }} />
                  <Bar dataKey="todo" name="To Do" stackId="a" fill="#e5e7eb" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#3b82f6" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="done" name="Done" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="overdue" name="Overdue" stackId="a" fill="#ef4444" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </>
          )}
        </div>

        {/* Quick Actions + Revenue Summary */}
        <div className="bg-gradient-to-br from-[#0f2044] to-[#1a3366] rounded-2xl p-5 text-white">
          <h2 className="font-bold text-sm mb-1 flex items-center gap-2"><TrendingUp size={14} className="text-[#c9a227]" /> Quick Actions</h2>
          <p className="text-white/40 text-xs mb-4">Jump to key tasks</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: "New Invoice", href: "/admin/invoices", icon: FileText },
              { label: "Add Lead", href: "/admin/leads", icon: Users },
              { label: "Create Task", href: "/admin/tasks", icon: CheckSquare },
              { label: "Team Chat", href: "/admin/chat", icon: MessageSquare },
              { label: "Blog Post", href: "/admin/blogs", icon: Activity },
              { label: "Update SEO", href: "/admin/seo", icon: Target },
            ].map(a => (
              <Link key={a.href} href={a.href}>
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 transition-colors cursor-pointer group">
                  <a.icon size={13} className="text-[#c9a227] shrink-0" />
                  <span className="text-white/80 group-hover:text-white text-xs font-medium transition-colors">{a.label}</span>
                  <ChevronRight size={10} className="text-white/30 ml-auto" />
                </div>
              </Link>
            ))}
          </div>
          {/* Revenue summary */}
          <div className="border-t border-white/10 pt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Total Billed", value: S?.revenue.total ? fmt(S.revenue.total) : "—" },
              { label: "Collected", value: S?.revenue.collected ? fmt(S.revenue.collected) : "—" },
              { label: "Pending", value: S?.revenue.outstanding ? fmt(S.revenue.outstanding) : "—" },
            ].map(s => (
              <div key={s.label} className="text-center">
                <div className="text-[#c9a227] font-bold text-sm">{s.value}</div>
                <div className="text-white/40 text-[10px]">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
