import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  Users, PhoneCall, CheckSquare, TrendingUp, IndianRupee, Target,
  FileText, Activity, RefreshCw, Video, Award, Loader2, MessageSquare,
  Mail, Send, ChevronRight, ArrowUpRight, Clock, AlertCircle, CheckCircle2,
  Star, Hash, Circle, MoreHorizontal, PlusCircle, X,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

const api = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, opts);
  if (!r.ok) {
    let msg = `${r.status}`;
    try { const j = await r.json(); msg = j.error ?? msg; } catch { /* ignore */ }
    const err = new Error(msg) as Error & { status: number };
    err.status = r.status;
    throw err;
  }
  return r.json();
};

// ── Types ──────────────────────────────────────────────────────────────────────
interface KPIData {
  assignedLeads: number; todayFollowUps: number; pendingTasks: number;
  upcomingMeetings: number; newMessages: number; wonLeads: number;
  lostLeads: number; pendingLeads: number; revenueGenerated: number;
  conversionRate: number; calls: number; meetings: number; followups: number;
  documents: number; wonThisMonth: number; monthlyTarget: number;
  chart: Array<{ label: string; won: number; total: number }>;
}

interface Lead {
  id: number; name: string; email: string; phone: string;
  serviceInterest: string; serviceCategory: string;
  status: string; priority: string; assignedTo: string | null;
  nextFollowUp: string | null; expectedRevenue: string | null;
  createdAt: string; updatedAt: string; city: string | null; state: string | null;
}

interface Channel {
  id: number; name: string; slug: string; type: string; description: string | null;
}

interface ChatMessage {
  id: number; channelId: number; senderName: string; content: string;
  msgType: string; createdAt: string; senderColor: string;
}

interface EmailLog {
  id: number; toEmail: string; toName: string | null; subject: string; status: string;
  createdAt: string; openedAt: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmt(v: number) {
  if (v >= 10000000) return `₹${(v / 10000000).toFixed(1)}Cr`;
  if (v >= 100000) return `₹${(v / 100000).toFixed(1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(1)}K`;
  return `₹${v.toFixed(0)}`;
}

const STATUS_STYLES: Record<string, string> = {
  new: "bg-blue-100 text-blue-700",
  contacted: "bg-sky-100 text-sky-700",
  qualified: "bg-violet-100 text-violet-700",
  proposal: "bg-amber-100 text-amber-700",
  negotiation: "bg-orange-100 text-orange-700",
  won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700",
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "text-red-600", medium: "text-amber-500", low: "text-gray-400",
};

function timeSince(dateStr: string) {
  const d = new Date(dateStr);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function isOverdue(dateStr: string | null) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color, bg, accent }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; bg: string; accent?: boolean;
}) {
  return (
    <div className={`bg-white rounded-2xl border p-4 hover:shadow-md transition-all relative overflow-hidden ${accent ? "border-[#c9a227]/40 shadow-sm" : "border-gray-100"}`}>
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-[0.06] ${bg}`} />
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${bg} ${color} mb-2`}><Icon size={16} /></div>
      <div className="text-2xl font-bold text-[#0f2044] mt-1">{value}</div>
      <div className="text-xs font-medium text-gray-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-gray-400 mt-1">{sub}</div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════════════════════════
const RANGES = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "week" },
  { label: "This Month", value: "month" },
];

function OverviewTab() {
  const [range, setRange] = useState("month");
  const { data: kpi, isLoading } = useQuery<KPIData>({
    queryKey: ["perf-me", range],
    queryFn: () => api(`/admin/performance/me?range=${range}`),
  });
  const targetPct = kpi ? Math.min(100, Math.round((kpi.wonThisMonth / kpi.monthlyTarget) * 100)) : 0;

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {RANGES.map(r => (
          <button key={r.value} onClick={() => setRange(r.value)}
            className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${range === r.value ? "bg-[#0f2044] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#0f2044]"}`}>
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
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mb-6">
            <KpiCard label="Assigned Leads" value={kpi.assignedLeads} icon={Users} color="text-[#0f2044]" bg="bg-[#0f2044]" accent />
            <KpiCard label="Today's Follow-ups" value={kpi.todayFollowUps} icon={RefreshCw} color="text-[#c9a227]" bg="bg-[#c9a227]" />
            <KpiCard label="Pending Tasks" value={kpi.pendingTasks} icon={CheckSquare} color="text-orange-600" bg="bg-orange-100" />
            <KpiCard label="Upcoming Meetings" value={kpi.upcomingMeetings} icon={Video} color="text-purple-600" bg="bg-purple-100" sub="Last 30 days" />
            <KpiCard label="New Messages" value={kpi.newMessages} icon={MessageSquare} color="text-sky-600" bg="bg-sky-100" sub="Today" />
            <KpiCard label="Revenue Generated" value={fmt(kpi.revenueGenerated)} icon={IndianRupee} color="text-green-600" bg="bg-green-100" sub="From won leads" accent />
            <KpiCard label="Conversion Rate" value={`${kpi.conversionRate}%`} icon={TrendingUp} color="text-indigo-600" bg="bg-indigo-100" />
            <KpiCard label="Leads Won" value={kpi.wonLeads} icon={Award} color="text-green-700" bg="bg-green-100" sub="Total" />
            <KpiCard label="Pending Leads" value={kpi.pendingLeads} icon={Activity} color="text-yellow-700" bg="bg-yellow-100" />
            <KpiCard label="Documents" value={kpi.documents} icon={FileText} color="text-teal-600" bg="bg-teal-100" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
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
                <div className={`h-full rounded-full transition-all duration-500 ${targetPct >= 100 ? "bg-green-500" : targetPct >= 60 ? "bg-[#c9a227]" : "bg-[#0f2044]"}`}
                  style={{ width: `${targetPct}%` }} />
              </div>
              <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                <span>{targetPct}% complete</span>
                <span>{kpi.monthlyTarget - kpi.wonThisMonth > 0 ? `${kpi.monthlyTarget - kpi.wonThisMonth} to go` : "Target hit! 🎉"}</span>
              </div>
            </div>

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
                  <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                    formatter={(v: number, name: string) => [v, name === "won" ? "Won" : "Activities"]} />
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
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MY LEADS TAB
// ═══════════════════════════════════════════════════════════════════════════════
const STATUS_FLOW = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost"];

function LeadsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");

  const { data: leads = [], isLoading, error: leadsError } = useQuery<Lead[]>({
    queryKey: ["my-leads", statusFilter, search],
    queryFn: () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      return api(`/admin/leads?${params}`);
    },
    refetchInterval: 30000,
    retry: (count, err) => (err as { status?: number }).status !== 403 && count < 2,
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-leads"] }); toast({ title: "Lead status updated" }); },
  });

  const setFollowUp = useMutation({
    mutationFn: ({ id, date }: { id: number; date: string }) =>
      api(`/admin/leads/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nextFollowUp: date }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-leads"] }); toast({ title: "Follow-up date set" }); },
  });

  async function addNote(leadId: number) {
    if (!noteText.trim()) return;
    setSubmittingNote(true);
    try {
      await api(`/admin/leads/${leadId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim() }),
      });
      setNoteText("");
      toast({ title: "Note added" });
    } catch { toast({ title: "Failed to add note", variant: "destructive" }); }
    finally { setSubmittingNote(false); }
  }

  const filtered = leads.filter(l =>
    (statusFilter === "all" || l.status === statusFilter) &&
    (!search || l.name.toLowerCase().includes(search.toLowerCase()) || l.serviceInterest.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-40">
          <Input
            placeholder="Search leads…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-9 pl-3"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 flex-wrap">
          {["all", ...STATUS_FLOW].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${statusFilter === s ? "bg-white text-[#0f2044] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 size={24} className="animate-spin text-[#c9a227]" /></div>
      ) : leadsError ? (
        <div className="text-center py-16 text-gray-400">
          <AlertCircle size={32} className="mx-auto mb-2 text-red-300" />
          <p className="text-sm font-medium text-red-500">
            {(leadsError as { status?: number }).status === 403
              ? "You don't have permission to view leads. Ask your admin to enable the Leads module for your role."
              : `Failed to load leads: ${(leadsError as Error).message}`}
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={32} className="mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No leads assigned to you yet.{statusFilter !== "all" ? " Try clearing the status filter." : ""}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(lead => {
            const expanded = expandedId === lead.id;
            const overdue = isOverdue(lead.nextFollowUp);
            return (
              <div key={lead.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Lead row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : lead.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#0f2044] text-sm">{lead.name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {lead.status}
                      </span>
                      <Star size={11} className={PRIORITY_STYLES[lead.priority] ?? "text-gray-400"} fill="currentColor" />
                    </div>
                    <div className="flex gap-3 mt-0.5 text-xs text-gray-400 flex-wrap">
                      <span>{lead.serviceInterest}</span>
                      {lead.city && <span>{lead.city}{lead.state ? `, ${lead.state}` : ""}</span>}
                      {lead.expectedRevenue && <span className="text-green-600">₹{Number(lead.expectedRevenue).toLocaleString("en-IN")}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {lead.nextFollowUp ? (
                      <div className={`flex items-center gap-1 text-xs ${overdue ? "text-red-500" : "text-gray-500"}`}>
                        <Clock size={11} />
                        {new Date(lead.nextFollowUp).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                        {overdue && " (overdue)"}
                      </div>
                    ) : (
                      <span className="text-[10px] text-gray-300">No follow-up set</span>
                    )}
                    <div className="text-[10px] text-gray-300 mt-0.5">{timeSince(lead.updatedAt)}</div>
                  </div>
                  <ChevronRight size={14} className={`text-gray-400 transition-transform ${expanded ? "rotate-90" : ""}`} />
                </div>

                {/* Expanded actions */}
                {expanded && (
                  <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-4">
                    {/* Quick status update */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Update Status</p>
                      <div className="flex gap-1.5 flex-wrap">
                        {STATUS_FLOW.map(s => (
                          <button
                            key={s}
                            onClick={() => updateStatus.mutate({ id: lead.id, status: s })}
                            disabled={updateStatus.isPending}
                            className={`text-xs px-3 py-1 rounded-full border transition-all capitalize ${lead.status === s ? "bg-[#0f2044] text-white border-[#0f2044]" : "border-gray-200 text-gray-600 hover:border-[#0f2044] hover:text-[#0f2044]"}`}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Follow-up date */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Set Follow-up Date</p>
                      <div className="flex gap-2">
                        <input
                          type="date"
                          value={followUpDate || (lead.nextFollowUp ? lead.nextFollowUp.substring(0, 10) : "")}
                          onChange={e => setFollowUpDate(e.target.value)}
                          className="h-8 border border-gray-200 rounded-lg px-3 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
                        />
                        <Button
                          size="sm"
                          onClick={() => { setFollowUp.mutate({ id: lead.id, date: followUpDate }); }}
                          disabled={!followUpDate || setFollowUp.isPending}
                          className="h-8 bg-[#0f2044] text-white hover:bg-[#1a3060] text-xs"
                        >
                          Set
                        </Button>
                      </div>
                    </div>

                    {/* Add note */}
                    <div>
                      <p className="text-xs font-semibold text-gray-500 mb-2">Add Note</p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Write a quick note…"
                          value={noteText}
                          onChange={e => setNoteText(e.target.value)}
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(lead.id); } }}
                          className="h-8 text-xs flex-1"
                        />
                        <Button size="sm" onClick={() => addNote(lead.id)} disabled={!noteText.trim() || submittingNote} className="h-8 bg-[#0f2044] text-white hover:bg-[#1a3060] text-xs gap-1">
                          <PlusCircle size={12} /> Note
                        </Button>
                      </div>
                    </div>

                    {/* Quick links */}
                    <div className="flex gap-2 pt-1">
                      <a href={`/admin/leads`} className="text-xs flex items-center gap-1 text-[#0f2044] hover:text-[#c9a227] transition-colors">
                        <ArrowUpRight size={12} /> View in Leads
                      </a>
                      <a href={`tel:${lead.phone}`} className="text-xs flex items-center gap-1 text-gray-500 hover:text-[#0f2044] transition-colors">
                        <PhoneCall size={12} /> {lead.phone}
                      </a>
                      <a href={`mailto:${lead.email}`} className="text-xs flex items-center gap-1 text-gray-500 hover:text-[#0f2044] transition-colors">
                        <Mail size={12} /> {lead.email}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT TAB
// ═══════════════════════════════════════════════════════════════════════════════
function ChatTab() {
  const { toast } = useToast();
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: channels = [], isLoading: channelsLoading, error: channelsError } = useQuery<Channel[]>({
    queryKey: ["chat-channels"],
    queryFn: () => api("/admin/chat/channels"),
    retry: (count, err) => (err as { status?: number }).status !== 403 && count < 2,
  });

  const { data: messages = [], refetch: refetchMessages } = useQuery<ChatMessage[]>({
    queryKey: ["chat-messages", activeChannel?.id],
    queryFn: () => api(`/admin/chat/channels/${activeChannel!.id}/messages?limit=50`),
    enabled: !!activeChannel,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (channels.length > 0 && !activeChannel) setActiveChannel(channels[0]);
  }, [channels, activeChannel]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!message.trim() || !activeChannel) return;
    setSending(true);
    try {
      await api(`/admin/chat/channels/${activeChannel.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: message.trim(), msgType: "text" }),
      });
      setMessage("");
      refetchMessages();
    } catch { toast({ title: "Failed to send message", variant: "destructive" }); }
    finally { setSending(false); }
  }

  const channelTypeIcon = (type: string) => {
    if (type === "dm") return <Circle size={12} className="text-green-500" fill="currentColor" />;
    if (type === "private") return <Star size={12} className="text-amber-500" />;
    return <Hash size={12} className="text-gray-400" />;
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden" style={{ height: 520 }}>
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-52 border-r border-gray-100 flex flex-col bg-gray-50/60">
          <div className="px-3 py-3 border-b border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Channels</p>
          </div>
          {channelsLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={16} className="animate-spin text-gray-400" /></div>
          ) : channelsError ? (
            <div className="px-3 py-6 text-center">
              <AlertCircle size={20} className="mx-auto mb-1 text-red-300" />
              <p className="text-[10px] text-red-400">
                {(channelsError as { status?: number }).status === 403
                  ? "No chat permission. Ask admin to enable Chat for your role."
                  : "Failed to load channels"}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto py-1">
              {channels.map(ch => (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch)}
                  className={`w-full text-left flex items-center gap-2 px-3 py-2 text-sm transition-colors ${activeChannel?.id === ch.id ? "bg-[#0f2044] text-white" : "text-gray-700 hover:bg-gray-100"}`}
                >
                  {channelTypeIcon(ch.type)}
                  <span className="truncate font-medium">{ch.name}</span>
                </button>
              ))}
              {channels.length === 0 && <p className="text-xs text-gray-400 text-center py-6">No channels yet</p>}
            </div>
          )}
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeChannel ? (
            <>
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                {channelTypeIcon(activeChannel.type)}
                <span className="font-semibold text-[#0f2044] text-sm">{activeChannel.name}</span>
                {activeChannel.description && <span className="text-xs text-gray-400 truncate">— {activeChannel.description}</span>}
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-gray-400 text-sm">No messages yet. Say something!</div>
                ) : (
                  messages.slice().reverse().map(msg => (
                    <div key={msg.id} className="flex gap-2.5">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: msg.senderColor }}>
                        {msg.senderName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs font-semibold text-[#0f2044]">{msg.senderName}</span>
                          <span className="text-[10px] text-gray-400">{timeSince(msg.createdAt)}</span>
                        </div>
                        {msg.msgType === "file" ? (
                          <a href={msg.content} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 underline break-all">
                            📎 {msg.content}
                          </a>
                        ) : (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">{msg.content}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-gray-100 px-3 py-2 flex gap-2">
                <Input
                  placeholder={`Message #${activeChannel.name}…`}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  className="h-9 text-sm"
                />
                <Button size="sm" onClick={sendMessage} disabled={!message.trim() || sending} className="h-9 bg-[#0f2044] hover:bg-[#1a3060] text-white px-3">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a channel to start chatting
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL TAB
// ═══════════════════════════════════════════════════════════════════════════════
function EmailTab() {
  const { toast } = useToast();
  const [view, setView] = useState<"log" | "compose">("log");
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const { data: logs = [], isLoading, refetch } = useQuery<EmailLog[]>({
    queryKey: ["email-logs"],
    queryFn: () => api("/admin/email/logs"),
    refetchInterval: 30000,
  });

  const { data: templates = [] } = useQuery<{ id: number; name: string; subject: string; htmlBody: string }[]>({
    queryKey: ["email-templates"],
    queryFn: () => api("/admin/email/templates"),
  });

  async function sendEmail() {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      await api("/admin/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toEmail: to.trim(), subject: subject.trim(), htmlBody: body, type: "custom" }),
      });
      toast({ title: "Email sent successfully" });
      setTo(""); setSubject(""); setBody("");
      setView("log");
      refetch();
    } catch { toast({ title: "Failed to send email", variant: "destructive" }); }
    finally { setSending(false); }
  }

  function loadTemplate(tmpl: { subject: string; htmlBody: string }) {
    setSubject(tmpl.subject);
    setBody(tmpl.htmlBody);
  }

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="flex gap-2">
        {[
          { key: "log", label: "Email History", icon: Mail },
          { key: "compose", label: "Compose Email", icon: PlusCircle },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setView(key as "log" | "compose")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === key ? "bg-[#0f2044] text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-[#0f2044]"}`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Log view */}
      {view === "log" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-[#c9a227]" /></div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Mail size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm">No emails sent yet.</p>
              <button onClick={() => setView("compose")} className="mt-3 text-sm text-[#0f2044] underline">Compose your first email</button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              <div className="px-4 py-2 bg-gray-50 grid grid-cols-12 text-xs font-semibold text-gray-500">
                <span className="col-span-3">To</span>
                <span className="col-span-5">Subject</span>
                <span className="col-span-2">Status</span>
                <span className="col-span-2 text-right">Sent</span>
              </div>
              {logs.map(log => (
                <div key={log.id} className="px-4 py-3 grid grid-cols-12 text-sm items-center hover:bg-gray-50 transition-colors">
                  <span className="col-span-3 text-gray-600 truncate text-xs">{log.toName ?? log.toEmail}</span>
                  <span className="col-span-5 font-medium text-[#0f2044] truncate">{log.subject}</span>
                  <span className="col-span-2">
                    {log.status === "sent" ? (
                      <span className={`flex items-center gap-1 text-xs ${log.openedAt ? "text-green-600" : "text-gray-500"}`}>
                        {log.openedAt ? <><CheckCircle2 size={11} /> Opened</> : <><Send size={11} /> Sent</>}
                      </span>
                    ) : (
                      <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} /> Failed</span>
                    )}
                  </span>
                  <span className="col-span-2 text-right text-xs text-gray-400">{timeSince(log.createdAt)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Compose view */}
      {view === "compose" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[#0f2044]">Compose Email</h3>
              <button onClick={() => setView("log")} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">To</label>
              <Input
                placeholder="recipient@example.com"
                value={to}
                onChange={e => setTo(e.target.value)}
                type="email"
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Subject</label>
              <Input
                placeholder="Email subject"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 mb-1.5 block">Message</label>
              <Textarea
                placeholder="Write your message… You can use {{client_name}}, {{service}}, {{firm_name}} as placeholders."
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={8}
                className="resize-none text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setTo(""); setSubject(""); setBody(""); }}>Clear</Button>
              <Button onClick={sendEmail} disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                className="bg-[#0f2044] hover:bg-[#1a3060] text-white gap-2">
                {sending ? <><Loader2 size={14} className="animate-spin" /> Sending…</> : <><Send size={14} /> Send Email</>}
              </Button>
            </div>
          </div>

          {/* Templates */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-[#0f2044] mb-3 text-sm">Email Templates</h3>
            {templates.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">No templates yet. Ask your admin to create some.</p>
            ) : (
              <div className="space-y-2">
                {templates.map(t => (
                  <button
                    key={t.id}
                    onClick={() => loadTemplate(t)}
                    className="w-full text-left p-3 rounded-lg border border-gray-100 hover:border-[#0f2044]/30 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-[#0f2044] text-xs">{t.name}</div>
                    <div className="text-[10px] text-gray-400 mt-0.5 truncate">{t.subject}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOLLOW-UPS TAB
// ═══════════════════════════════════════════════════════════════════════════════

interface FollowUpLead {
  id: number; name: string; phone: string; serviceInterest: string;
  status: string; nextFollowUp: string | null; isOverdue: boolean;
  priority: string | null; assignedTo: string | null;
}

function FollowUpsTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newDate, setNewDate] = useState("");

  const { data: followUps = [], isLoading } = useQuery<FollowUpLead[]>({
    queryKey: ["follow-ups"],
    queryFn: () => api("/admin/leads/follow-ups"),
    refetchInterval: 5 * 60 * 1000, // refresh every 5 min
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, nextFollowUp }: { id: number; nextFollowUp: string | null }) =>
      api(`/admin/leads/${id}`, { method: "PATCH", body: JSON.stringify({ nextFollowUp }), headers: { "Content-Type": "application/json" } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow-ups"] });
      setEditingId(null);
      setNewDate("");
      toast({ title: "Follow-up reminder updated" });
    },
  });

  const overdue = followUps.filter(f => f.isOverdue);
  const upcoming = followUps.filter(f => !f.isOverdue);

  const fmtDate = (d: string | null) => {
    if (!d) return "—";
    const date = new Date(d);
    return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) +
      " " + date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  };

  function LeadCard({ lead }: { lead: FollowUpLead }) {
    const isEditing = editingId === lead.id;
    return (
      <div className={`bg-white rounded-xl border p-4 ${lead.isOverdue ? "border-red-200 bg-red-50/30" : "border-gray-100"}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <p className="font-semibold text-[#0f2044] text-sm truncate">{lead.name}</p>
              {lead.priority && lead.priority !== "medium" && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize shrink-0 ${lead.priority === "urgent" ? "bg-red-100 text-red-700" : lead.priority === "high" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-600"}`}>{lead.priority}</span>
              )}
            </div>
            <p className="text-xs text-gray-500 mb-1.5 truncate">{lead.serviceInterest}</p>
            <div className="flex items-center gap-2">
              <span className={`flex items-center gap-1 text-xs font-medium ${lead.isOverdue ? "text-red-600" : "text-amber-600"}`}>
                <Clock size={11} /> {lead.isOverdue ? "Overdue: " : "Due: "}{fmtDate(lead.nextFollowUp)}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 shrink-0">
            {!isEditing ? (
              <button
                onClick={() => { setEditingId(lead.id); setNewDate(lead.nextFollowUp ? lead.nextFollowUp.slice(0, 16) : ""); }}
                className="text-[10px] px-2.5 py-1 rounded-lg bg-[#0f2044] text-white hover:bg-[#1a3060] transition-colors"
              >
                Reschedule
              </button>
            ) : null}
            <button
              onClick={() => updateMutation.mutate({ id: lead.id, nextFollowUp: null })}
              className="text-[10px] px-2.5 py-1 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
        {isEditing && (
          <div className="mt-3 flex gap-2">
            <input
              type="datetime-local"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              className="flex-1 text-xs h-8 border border-gray-200 rounded-lg px-2 focus:outline-none focus:border-[#c9a227]"
            />
            <button
              onClick={() => updateMutation.mutate({ id: lead.id, nextFollowUp: newDate || null })}
              disabled={updateMutation.isPending}
              className="text-[10px] px-3 py-1 rounded-lg bg-[#c9a227] text-white hover:bg-[#c9a227]/90 font-medium disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditingId(null)} className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 text-gray-600">Cancel</button>
          </div>
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 size={24} className="animate-spin text-[#c9a227]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Set new follow-up */}
      <div className="bg-gradient-to-r from-[#0f2044] to-[#1a3060] rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <RefreshCw size={16} className="text-[#c9a227]" />
          <h3 className="font-semibold text-sm">Follow-up Reminders</h3>
        </div>
        <p className="text-white/60 text-xs">
          {followUps.length === 0
            ? "No follow-ups scheduled in the next 48 hours."
            : `${overdue.length} overdue · ${upcoming.length} upcoming`}
        </p>
      </div>

      {overdue.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle size={14} className="text-red-500" />
            <h4 className="text-sm font-semibold text-red-600">Overdue ({overdue.length})</h4>
          </div>
          <div className="space-y-3">
            {overdue.map(f => <LeadCard key={f.id} lead={f} />)}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-amber-500" />
            <h4 className="text-sm font-semibold text-[#0f2044]">Upcoming — Next 48 Hours ({upcoming.length})</h4>
          </div>
          <div className="space-y-3">
            {upcoming.map(f => <LeadCard key={f.id} lead={f} />)}
          </div>
        </div>
      )}

      {followUps.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <CheckCircle2 size={36} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">All caught up!</p>
          <p className="text-xs mt-1">No follow-ups due in the next 48 hours.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { key: "overview", label: "Overview", icon: TrendingUp },
  { key: "leads", label: "My Leads", icon: Users },
  { key: "followups", label: "Follow-ups", icon: RefreshCw },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "email", label: "Email", icon: Mail },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function EmployeeDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  const { data: kpi } = useQuery<KPIData>({
    queryKey: ["perf-me", "month"],
    queryFn: () => api("/admin/performance/me?range=month"),
  });

  return (
    <AdminLayout title="My Dashboard" subtitle="Your personal performance and work hub">
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === key ? "bg-white text-[#0f2044] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            <Icon size={14} />
            {label}
            {key === "leads" && kpi && kpi.pendingTasks > 0 && (
              <span className="bg-orange-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ml-1">
                {kpi.pendingTasks}
              </span>
            )}
            {key === "followups" && kpi && kpi.todayFollowUps > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ml-1">
                {kpi.todayFollowUps}
              </span>
            )}
            {key === "chat" && kpi && kpi.newMessages > 0 && (
              <span className="bg-[#c9a227] text-white text-[10px] font-bold rounded-full px-1.5 py-0.5 leading-none ml-1">
                {kpi.newMessages}
              </span>
            )}
          </button>
        ))}
      </div>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "leads" && <LeadsTab />}
      {activeTab === "followups" && <FollowUpsTab />}
      {activeTab === "chat" && <ChatTab />}
      {activeTab === "email" && <EmailTab />}
    </AdminLayout>
  );
}
