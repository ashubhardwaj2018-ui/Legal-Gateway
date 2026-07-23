import { useState, useEffect, useRef } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area, Legend,
} from "recharts";
import {
  TrendingUp, Users, IndianRupee, FileText, CheckSquare,
  Download, Printer, RefreshCw, Calendar, ChevronDown,
  ArrowUpRight, ArrowDownRight,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";

// ── Types ─────────────────────────────────────────────────────────────────────
interface LeadReport { total: number; won: number; lost: number; pending: number; contacted: number; conversionRate: string; totalExpectedRevenue: string; wonRevenue: string; byStatus: Array<{status:string;count:number}>; bySource: Array<{source:string;count:number}>; byAssignee: Array<{name:string;count:number}>; byMonth: Array<{month:string;total:number;won:number;lost:number}>; leads: Array<Record<string,string|number|null>>; }
interface RevenueReport { totalBilled: string; totalPaid: string; outstanding: string; totalGST: string; overdueAmount: string; totalInvoices: number; byType: Array<{type:string;count:number;amount:number}>; byStatus: Array<{status:string;count:number;amount:number}>; byMonth: Array<{month:string;billed:number;collected:number}>; byPaymentMode: Array<{mode:string;amount:number}>; invoices: Array<Record<string,string|null>>; }
interface GstReport { totalTaxable: string; totalGST: string; totalCGST: string; totalSGST: string; totalIGST: string; byRate: Array<{rate:string;taxable:number;gst:number;count:number}>; records: Array<Record<string,string>>; }
interface TaskReport { total: number; done: number; inProgress: number; todo: number; overdue: number; completionRate: string; byStatus: Array<{status:string;count:number}>; byPriority: Array<{priority:string;count:number}>; byAssignee: Array<{name:string;total:number;done:number;overdue:number;completionRate:number}>; }

type Tab = "overview" | "leads" | "revenue" | "gst" | "tasks";
type Preset = "today" | "week" | "month" | "quarter" | "year" | "custom";

const PIE_COLORS = ["#0f2044","#c9a227","#3b82f6","#22c55e","#f97316","#8b5cf6","#06b6d4","#ef4444","#ec4899","#84cc16"];
const STATUS_COLORS: Record<string,string> = { new:"#6366f1", contacted:"#3b82f6", pending:"#f59e0b", won:"#22c55e", lost:"#ef4444", hold:"#9ca3af", completed:"#10b981" };

function fmt(v: string|number) {
  const n = typeof v === "string" ? parseFloat(v) : v;
  if (!n) return "₹0";
  if (n >= 10000000) return `₹${(n/10000000).toFixed(2)}Cr`;
  if (n >= 100000) return `₹${(n/100000).toFixed(2)}L`;
  if (n >= 1000) return `₹${(n/1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function getPresetDates(preset: Preset): { from: string; to: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = fmt(now);
  if (preset === "today") return { from: today, to: today };
  if (preset === "week") { const d = new Date(now); d.setDate(d.getDate() - 7); return { from: fmt(d), to: today }; }
  if (preset === "month") { return { from: `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-01`, to: today }; }
  if (preset === "quarter") { const q = Math.floor(now.getMonth()/3); const startM = q*3; const d = new Date(now.getFullYear(), startM, 1); return { from: fmt(d), to: today }; }
  if (preset === "year") return { from: `${now.getFullYear()}-01-01`, to: today };
  return { from: `${now.getFullYear()}-01-01`, to: today };
}

function StatCard({ label, value, sub, icon: Icon, color, bg, delta }: { label:string; value:string|number; sub?:string; icon:React.ElementType; color:string; bg:string; delta?:"up"|"down" }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg} ${color}`}><Icon size={18} /></div>
        {delta && (delta === "up" ? <ArrowUpRight size={14} className="text-green-500" /> : <ArrowDownRight size={14} className="text-red-500" />)}
      </div>
      <div className="text-2xl font-bold text-[#0f2044]">{value}</div>
      <div className="text-xs text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: { active?:boolean; payload?:Array<{value:number;name:string;color:string}>; label?:string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-xl px-4 py-3 text-xs">
      <div className="font-semibold text-gray-700 mb-1.5">{label}</div>
      {payload.map((p, i) => <div key={i} className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor:p.color}}/><span className="text-gray-500">{p.name}:</span><span className="font-semibold">{typeof p.value === "number" && p.value > 1000 ? fmt(p.value) : p.value}</span></div>)}
    </div>
  );
};

export default function AdminReports() {
  const [tab, setTab] = useState<Tab>("overview");
  const [preset, setPreset] = useState<Preset>("month");
  const [dates, setDates] = useState(getPresetDates("month"));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [leadData, setLeadData] = useState<LeadReport | null>(null);
  const [revData, setRevData] = useState<RevenueReport | null>(null);
  const [gstData, setGstData] = useState<GstReport | null>(null);
  const [taskData, setTaskData] = useState<TaskReport | null>(null);
  const [loading, setLoading] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  const fetchAll = async (from: string, to: string) => {
    setLoading(true);
    const qs = `?from=${from}&to=${to}`;
    const [ld, rd, gd, td] = await Promise.all([
      fetch(`/api/admin/reports/leads${qs}`).then(r => r.json()),
      fetch(`/api/admin/reports/revenue${qs}`).then(r => r.json()),
      fetch(`/api/admin/reports/gst${qs}`).then(r => r.json()),
      fetch(`/api/admin/reports/tasks${qs}`).then(r => r.json()),
    ]);
    setLeadData(ld); setRevData(rd); setGstData(gd); setTaskData(td);
    setLoading(false);
  };

  useEffect(() => { fetchAll(dates.from, dates.to); }, [dates]);

  const applyPreset = (p: Preset) => {
    setPreset(p);
    if (p !== "custom") { const d = getPresetDates(p); setDates(d); }
    setShowDatePicker(false);
  };

  const exportCsv = (mod: string) => {
    const url = `/api/admin/reports/export?module=${mod}&from=${dates.from}&to=${dates.to}`;
    const a = document.createElement("a"); a.href = url; a.download = `${mod}-report.csv`; a.click();
  };

  const printReport = () => window.print();

  const PRESETS: Array<{value:Preset; label:string}> = [
    {value:"today",label:"Today"},{value:"week",label:"Last 7 Days"},{value:"month",label:"This Month"},
    {value:"quarter",label:"This Quarter"},{value:"year",label:"This Year"},{value:"custom",label:"Custom Range"},
  ];

  return (
    <AdminLayout title="Reports" subtitle="Analytics, insights and exports for all modules">
      {/* ── Toolbar ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Tab pills */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {([["overview","Overview"],["leads","Leads"],["revenue","Revenue"],["gst","GST"],["tasks","Tasks"]] as [Tab,string][]).map(([t, l]) => (
            <button key={t} onClick={() => setTab(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab===t?"bg-white shadow text-[#0f2044]":"text-gray-500 hover:text-gray-700"}`}>{l}</button>
          ))}
        </div>

        {/* Date range */}
        <div className="relative ml-auto">
          <button onClick={() => setShowDatePicker(s => !s)} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-700 hover:border-[#0f2044] transition-colors">
            <Calendar size={14} className="text-gray-400" />
            <span>{PRESETS.find(p => p.value === preset)?.label ?? "Custom"}</span>
            <span className="text-gray-400 text-xs">({dates.from} → {dates.to})</span>
            <ChevronDown size={13} className="text-gray-400" />
          </button>
          {showDatePicker && (
            <div className="absolute right-0 top-11 bg-white border border-gray-200 rounded-2xl shadow-2xl p-4 z-20 w-72">
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {PRESETS.map(p => (
                  <button key={p.value} onClick={() => applyPreset(p.value)} className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors ${preset===p.value?"bg-[#0f2044] text-white":"bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>{p.label}</button>
                ))}
              </div>
              {preset === "custom" && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <div><label className="text-[10px] font-semibold text-gray-500 block mb-1">FROM</label><input type="date" value={dates.from} onChange={e => setDates(d => ({...d,from:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" /></div>
                  <div><label className="text-[10px] font-semibold text-gray-500 block mb-1">TO</label><input type="date" value={dates.to} onChange={e => setDates(d => ({...d,to:e.target.value}))} className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none" /></div>
                  <button onClick={() => { setShowDatePicker(false); fetchAll(dates.from, dates.to); }} className="w-full py-2 bg-[#0f2044] text-white text-sm rounded-lg font-semibold">Apply</button>
                </div>
              )}
            </div>
          )}
        </div>

        <button onClick={printReport} className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"><Printer size={14} />Print</button>
        {loading && <RefreshCw size={15} className="text-gray-400 animate-spin" />}
      </div>

      <div ref={printRef}>
        {/* ── OVERVIEW ──────────────────────────────────────────────── */}
        {tab === "overview" && (
          <div className="space-y-5">
            {/* KPIs */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Total Leads" value={leadData?.total ?? "—"} icon={Users} bg="bg-blue-50" color="text-blue-600" delta="up" />
              <StatCard label="Conversion Rate" value={leadData ? `${leadData.conversionRate}%` : "—"} sub={`${leadData?.won ?? 0} won`} icon={TrendingUp} bg="bg-green-50" color="text-green-600" delta="up" />
              <StatCard label="Total Billed" value={revData ? fmt(revData.totalBilled) : "—"} icon={IndianRupee} bg="bg-yellow-50" color="text-yellow-600" />
              <StatCard label="Collected" value={revData ? fmt(revData.totalPaid) : "—"} icon={IndianRupee} bg="bg-emerald-50" color="text-emerald-600" delta="up" />
              <StatCard label="Outstanding" value={revData ? fmt(revData.outstanding) : "—"} icon={IndianRupee} bg="bg-red-50" color="text-red-600" delta="down" />
              <StatCard label="GST Collected" value={gstData ? fmt(gstData.totalGST) : "—"} sub={`CGST+SGST+IGST`} icon={FileText} bg="bg-purple-50" color="text-purple-600" />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              {/* Revenue trend */}
              <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-[#0f2044] text-sm">Revenue Trend</h3>
                  <button onClick={() => exportCsv("revenue")} className="text-xs text-[#c9a227] flex items-center gap-1 hover:underline"><Download size={11} />Export CSV</button>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revData?.byMonth ?? []}>
                    <defs>
                      <linearGradient id="billed" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f2044" stopOpacity={0.15}/><stop offset="95%" stopColor="#0f2044" stopOpacity={0}/></linearGradient>
                      <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c9a227" stopOpacity={0.2}/><stop offset="95%" stopColor="#c9a227" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                    <XAxis dataKey="month" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}K`:String(v)} tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} width={40}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Area type="monotone" dataKey="billed" name="Billed" stroke="#0f2044" strokeWidth={2.5} fill="url(#billed)" dot={false}/>
                    <Area type="monotone" dataKey="collected" name="Collected" stroke="#c9a227" strokeWidth={2.5} fill="url(#collected)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Lead sources */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-3">Lead Sources</h3>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart><Pie data={leadData?.bySource ?? []} dataKey="value" nameKey="source" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                    {(leadData?.bySource ?? []).map((_,i) => <Cell key={i} fill={PIE_COLORS[i%PIE_COLORS.length]} strokeWidth={0}/>)}
                  </Pie><Tooltip contentStyle={{borderRadius:"12px",fontSize:"12px"}}/></PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-1 mt-1">
                  {(leadData?.bySource ?? []).slice(0,6).map((s,i) => (
                    <div key={s.source} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:PIE_COLORS[i%PIE_COLORS.length]}}/>
                      <span className="text-[10px] text-gray-500 truncate capitalize">{s.source}</span>
                      <span className="text-[10px] font-bold ml-auto">{s.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Lead funnel + Task breakdown */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">Lead Funnel by Status</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={leadData?.byStatus ?? []} layout="vertical" margin={{top:0,right:20,left:40,bottom:0}}>
                    <XAxis type="number" hide/>
                    <YAxis type="category" dataKey="status" tick={{fontSize:10,fill:"#6b7280"}} axisLine={false} tickLine={false}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="count" name="Leads" radius={[0,6,6,0]} maxBarSize={20}>
                      {(leadData?.byStatus ?? []).map((s,i) => <Cell key={i} fill={STATUS_COLORS[s.status]??PIE_COLORS[i%PIE_COLORS.length]}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">Task Completion by Assignee</h3>
                {(taskData?.byAssignee ?? []).slice(0,6).length === 0 ? (
                  <div className="text-center text-gray-300 py-12 text-sm">No task data</div>
                ) : (
                  <div className="space-y-3">
                    {(taskData?.byAssignee ?? []).slice(0,6).map(a => (
                      <div key={a.name}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="font-medium text-gray-700 truncate max-w-[140px]">{a.name}</span>
                          <span className="text-gray-500">{a.done}/{a.total} · <span className="font-bold text-[#0f2044]">{a.completionRate}%</span></span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-[#0f2044] rounded-full transition-all" style={{width:`${a.completionRate}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── LEAD REPORT ───────────────────────────────────────────── */}
        {tab === "leads" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Leads" value={leadData?.total ?? "—"} icon={Users} bg="bg-blue-50" color="text-blue-600"/>
              <StatCard label="Won" value={leadData?.won ?? "—"} icon={TrendingUp} bg="bg-green-50" color="text-green-600" delta="up"/>
              <StatCard label="Lost" value={leadData?.lost ?? "—"} icon={TrendingUp} bg="bg-red-50" color="text-red-600" delta="down"/>
              <StatCard label="Conversion" value={leadData ? `${leadData.conversionRate}%` : "—"} sub={`Won Revenue: ${leadData ? fmt(leadData.wonRevenue) : "—"}`} icon={TrendingUp} bg="bg-purple-50" color="text-purple-600"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Monthly trend */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">Monthly Lead Trend</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={leadData?.byMonth ?? []} margin={{top:0,right:0,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                    <XAxis dataKey="month" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} width={25}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="total" name="Total" fill="#e0e7ff" radius={[4,4,0,0]} maxBarSize={28}/>
                    <Bar dataKey="won" name="Won" fill="#22c55e" radius={[4,4,0,0]} maxBarSize={28}/>
                    <Bar dataKey="lost" name="Lost" fill="#ef4444" radius={[4,4,0,0]} maxBarSize={28}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* By Assignee */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">Leads by Assignee</h3>
                <div className="space-y-2">
                  {(leadData?.byAssignee ?? []).slice(0,8).map((a,i) => (
                    <div key={a.name} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{backgroundColor:PIE_COLORS[i%PIE_COLORS.length]}}>{a.name.charAt(0)}</div>
                      <span className="text-xs text-gray-600 flex-1 truncate">{a.name}</span>
                      <span className="text-xs font-bold text-[#0f2044]">{a.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-[#0f2044] text-sm">Lead Details ({leadData?.leads.length ?? 0})</h3>
                <button onClick={() => exportCsv("leads")} className="flex items-center gap-2 px-4 py-2 bg-[#0f2044] text-white text-xs rounded-xl hover:bg-[#c9a227] hover:text-[#0f2044] transition-all font-semibold"><Download size={12}/>Export CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>{["Name","Email","Service","Status","Source","Priority","Assigned To","Expected ₹","Date"].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {(leadData?.leads ?? []).slice(0,50).map((l,i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-medium text-[#0f2044]">{String(l.name)}</td>
                        <td className="px-3 py-2.5 text-gray-500">{String(l.email)}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[140px] truncate">{String(l.service)}</td>
                        <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium capitalize" style={{backgroundColor:(STATUS_COLORS[String(l.status)]??"#6b7280")+"20",color:STATUS_COLORS[String(l.status)]??"#6b7280"}}>{String(l.status)}</span></td>
                        <td className="px-3 py-2.5 capitalize text-gray-500">{String(l.source ?? "—")}</td>
                        <td className="px-3 py-2.5 capitalize text-gray-500">{String(l.priority ?? "—")}</td>
                        <td className="px-3 py-2.5 text-gray-500 truncate max-w-[100px]">{String(l.assignedTo ?? "—")}</td>
                        <td className="px-3 py-2.5 text-gray-700">{l.expectedRevenue ? fmt(String(l.expectedRevenue)) : "—"}</td>
                        <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{String(l.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── REVENUE REPORT ────────────────────────────────────────── */}
        {tab === "revenue" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total Billed" value={revData ? fmt(revData.totalBilled) : "—"} icon={IndianRupee} bg="bg-blue-50" color="text-blue-600"/>
              <StatCard label="Collected" value={revData ? fmt(revData.totalPaid) : "—"} icon={IndianRupee} bg="bg-green-50" color="text-green-600" delta="up"/>
              <StatCard label="Outstanding" value={revData ? fmt(revData.outstanding) : "—"} sub={revData?.overdueAmount ? `${fmt(revData.overdueAmount)} overdue` : undefined} icon={IndianRupee} bg="bg-red-50" color="text-red-600" delta="down"/>
              <StatCard label="Total GST" value={revData ? fmt(revData.totalGST) : "—"} sub={`${revData?.totalInvoices ?? 0} invoices`} icon={FileText} bg="bg-purple-50" color="text-purple-600"/>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">Monthly Revenue</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={revData?.byMonth ?? []}>
                    <defs>
                      <linearGradient id="b2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0f2044" stopOpacity={0.15}/><stop offset="95%" stopColor="#0f2044" stopOpacity={0}/></linearGradient>
                      <linearGradient id="c2" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#c9a227" stopOpacity={0.2}/><stop offset="95%" stopColor="#c9a227" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                    <XAxis dataKey="month" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
                    <YAxis tickFormatter={v=>v>=1000?`${(v/1000).toFixed(0)}K`:String(v)} tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false} width={40}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Area type="monotone" dataKey="billed" name="Billed" stroke="#0f2044" strokeWidth={2.5} fill="url(#b2)" dot={false}/>
                    <Area type="monotone" dataKey="collected" name="Collected" stroke="#c9a227" strokeWidth={2.5} fill="url(#c2)" dot={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h3 className="font-bold text-[#0f2044] text-sm mb-3">By Document Type</h3>
                  {(revData?.byType ?? []).map((t,i) => (
                    <div key={t.type} className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:PIE_COLORS[i%PIE_COLORS.length]}}/>
                      <span className="text-xs text-gray-600 capitalize flex-1">{t.type}</span>
                      <span className="text-xs font-bold text-gray-800">{t.count}</span>
                      <span className="text-xs text-gray-400">{fmt(t.amount)}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 p-5">
                  <h3 className="font-bold text-[#0f2044] text-sm mb-3">Payment Modes</h3>
                  {(revData?.byPaymentMode ?? []).map((m,i) => (
                    <div key={m.mode} className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{backgroundColor:PIE_COLORS[i%PIE_COLORS.length]}}/>
                      <span className="text-xs text-gray-600 capitalize flex-1">{m.mode}</span>
                      <span className="text-xs font-bold text-gray-800">{fmt(m.amount)}</span>
                    </div>
                  ))}
                  {(revData?.byPaymentMode ?? []).length === 0 && <div className="text-xs text-gray-300 text-center py-4">No payment data</div>}
                </div>
              </div>
            </div>

            {/* Invoice table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-[#0f2044] text-sm">Invoice Details ({revData?.invoices.length ?? 0})</h3>
                <button onClick={() => exportCsv("revenue")} className="flex items-center gap-2 px-4 py-2 bg-[#0f2044] text-white text-xs rounded-xl hover:bg-[#c9a227] hover:text-[#0f2044] transition-all font-semibold"><Download size={12}/>Export CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>{["Invoice No","Client","Date","Subtotal","GST","Total","Paid","Outstanding","Status"].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {(revData?.invoices ?? []).slice(0,50).map((inv,i) => {
                      const outstanding = (parseFloat(String(inv.total??0))-parseFloat(String(inv.paidAmount??0)));
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5 font-mono font-medium text-[#0f2044]">{inv.number}</td>
                          <td className="px-3 py-2.5 text-gray-600 max-w-[120px] truncate">{inv.clientName}</td>
                          <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">{inv.createdAt}</td>
                          <td className="px-3 py-2.5 text-gray-700">{fmt(String(inv.subtotal??0))}</td>
                          <td className="px-3 py-2.5 text-gray-500">{fmt(String(inv.gstAmount??0))}</td>
                          <td className="px-3 py-2.5 font-semibold text-[#0f2044]">{fmt(String(inv.total??0))}</td>
                          <td className="px-3 py-2.5 text-green-600">{fmt(String(inv.paidAmount??0))}</td>
                          <td className={`px-3 py-2.5 font-semibold ${outstanding>0?"text-red-600":"text-green-600"}`}>{fmt(outstanding)}</td>
                          <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-600 capitalize">{inv.status}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── GST REPORT ────────────────────────────────────────────── */}
        {tab === "gst" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                {label:"Taxable Amount",value:gstData?fmt(gstData.totalTaxable):"—"},
                {label:"Total GST",value:gstData?fmt(gstData.totalGST):"—"},
                {label:"CGST",value:gstData?fmt(gstData.totalCGST):"—"},
                {label:"SGST",value:gstData?fmt(gstData.totalSGST):"—"},
                {label:"IGST",value:gstData?fmt(gstData.totalIGST):"—"},
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                  <div className="text-xl font-bold text-[#0f2044]">{s.value}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* By GST rate */}
            {(gstData?.byRate ?? []).length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">GST by Rate Slab</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>{["GST Rate","Taxable Amount","GST Amount","No. of Items"].map(h=><th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">{h}</th>)}</tr></thead>
                    <tbody className="divide-y divide-gray-50">
                      {(gstData?.byRate ?? []).map(r => (
                        <tr key={r.rate} className="hover:bg-gray-50">
                          <td className="px-4 py-3"><span className="font-semibold text-[#0f2044] bg-[#0f2044]/10 px-2 py-0.5 rounded-lg text-xs">{r.rate}</span></td>
                          <td className="px-4 py-3 font-medium">{fmt(r.taxable)}</td>
                          <td className="px-4 py-3 text-[#c9a227] font-semibold">{fmt(r.gst)}</td>
                          <td className="px-4 py-3 text-gray-500">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* GSTR-1 style table */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                <h3 className="font-bold text-[#0f2044] text-sm">GSTR-1 Style Summary ({gstData?.records.length ?? 0} records)</h3>
                <button onClick={() => exportCsv("gst")} className="flex items-center gap-2 px-4 py-2 bg-[#0f2044] text-white text-xs rounded-xl hover:bg-[#c9a227] hover:text-[#0f2044] transition-all font-semibold"><Download size={12}/>Export CSV</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50"><tr>{["Invoice No","Date","Client","GSTIN","Taxable","CGST","SGST","IGST","Total GST","Invoice Total"].map(h=><th key={h} className="px-3 py-2.5 text-left font-semibold text-gray-500 whitespace-nowrap">{h}</th>)}</tr></thead>
                  <tbody className="divide-y divide-gray-50">
                    {(gstData?.records ?? []).slice(0,100).map((r,i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 font-mono text-[#0f2044] font-medium">{r.number}</td>
                        <td className="px-3 py-2.5 text-gray-400">{r.date}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[100px] truncate">{r.clientName}</td>
                        <td className="px-3 py-2.5 font-mono text-gray-500 text-[10px]">{r.clientGST}</td>
                        <td className="px-3 py-2.5">{fmt(r.taxable)}</td>
                        <td className="px-3 py-2.5 text-blue-600">{fmt(r.cgst)}</td>
                        <td className="px-3 py-2.5 text-green-600">{fmt(r.sgst)}</td>
                        <td className="px-3 py-2.5 text-orange-600">{fmt(r.igst)}</td>
                        <td className="px-3 py-2.5 font-semibold">{fmt(r.gst)}</td>
                        <td className="px-3 py-2.5 font-bold text-[#0f2044]">{fmt(r.total)}</td>
                      </tr>
                    ))}
                    {(gstData?.records ?? []).length === 0 && <tr><td colSpan={10} className="px-4 py-10 text-center text-gray-300">No GST records in this period</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TASK REPORT ───────────────────────────────────────────── */}
        {tab === "tasks" && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {[
                {label:"Total Tasks",value:taskData?.total??0,color:"bg-blue-50 text-blue-600"},
                {label:"Done",value:taskData?.done??0,color:"bg-green-50 text-green-600"},
                {label:"In Progress",value:taskData?.inProgress??0,color:"bg-purple-50 text-purple-600"},
                {label:"To Do",value:taskData?.todo??0,color:"bg-gray-50 text-gray-600"},
                {label:"Overdue",value:taskData?.overdue??0,color:"bg-red-50 text-red-600"},
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-4 text-center ${s.color}`}>
                  <div className="text-2xl font-bold">{s.value}</div>
                  <div className="text-xs font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* By Priority */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">Tasks by Priority</h3>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={taskData?.byPriority ?? []} margin={{top:0,right:0,left:0,bottom:0}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
                    <XAxis dataKey="priority" tick={{fontSize:10,fill:"#9ca3af"}} axisLine={false} tickLine={false}/>
                    <YAxis tick={{fontSize:10}} axisLine={false} tickLine={false} width={25}/>
                    <Tooltip content={<CustomTooltip/>}/>
                    <Bar dataKey="count" name="Tasks" radius={[6,6,0,0]} maxBarSize={40}>
                      {(taskData?.byPriority??[]).map((p,i) => {
                        const c = p.priority==="high"?"#ef4444":p.priority==="medium"?"#f59e0b":"#22c55e";
                        return <Cell key={i} fill={c}/>;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Completion rate */}
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">Team Task Performance</h3>
                <div className="space-y-3">
                  {(taskData?.byAssignee ?? []).slice(0,8).map(a => (
                    <div key={a.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-gray-700 truncate max-w-[160px]">{a.name}</span>
                        <span className="text-gray-500">{a.done}/{a.total}{a.overdue>0?<span className="text-red-500 ml-1">({a.overdue} overdue)</span>:null} · <span className="font-bold text-[#0f2044]">{a.completionRate}%</span></span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{width:`${a.completionRate}%`,backgroundColor:a.completionRate>=80?"#22c55e":a.completionRate>=50?"#f59e0b":"#ef4444"}}/>
                      </div>
                    </div>
                  ))}
                  {(taskData?.byAssignee ?? []).length === 0 && <div className="text-center text-gray-300 py-8 text-sm">No task data in this period</div>}
                </div>
              </div>
            </div>

            {/* Export */}
            <div className="flex justify-end">
              <button onClick={() => exportCsv("tasks")} className="flex items-center gap-2 px-5 py-2.5 bg-[#0f2044] text-white text-sm rounded-xl hover:bg-[#c9a227] hover:text-[#0f2044] transition-all font-semibold"><Download size={14}/>Export Tasks CSV</button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
    </AdminLayout>
  );
}
