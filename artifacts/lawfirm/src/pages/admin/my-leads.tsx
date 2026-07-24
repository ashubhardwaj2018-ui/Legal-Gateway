import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Search, X, PhoneCall, MessageSquare, RefreshCw,
  Video, FileText, Clock, User, Building2, Tag,
  Activity, Plus, CheckCircle2, Circle, ChevronRight
} from "lucide-react";

const api = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(`${r.status}`);
  if (r.status === 204) return null;
  return r.json();
};

// ── Types ──────────────────────────────────────────────────────────────────────

interface Lead {
  id: number; name: string; email: string; phone: string;
  serviceCategory?: string; serviceInterest?: string; company?: string;
  status: string; priority?: string; source?: string; assignedTo?: string;
  message?: string; city?: string; state?: string; tags?: string;
  expectedRevenue?: string; probability?: number; expectedClosingDate?: string;
  createdAt: string; updatedAt: string;
}

interface LeadNote { id: number; leadId: number; content: string; createdBy?: string; createdAt: string; }
interface LeadTask { id: number; leadId: number; title: string; dueDate?: string; status: string; priority?: string; createdAt: string; }
interface LeadTimelineEntry { id: number; leadId: number; actorId?: number; actorName: string; actionType: string; description: string; createdAt: string; }
interface LeadDetail extends Lead { notes: LeadNote[]; tasks: LeadTask[]; activities: { id: number; leadId: number; type: string; description: string; createdAt: string }[]; }

const PIPELINE_STATUSES = ["new", "contacted", "qualified", "proposal", "negotiation", "won", "lost", "on_hold"];
const PRIORITIES: Record<string, string> = { low: "bg-gray-100 text-gray-600", medium: "bg-yellow-100 text-yellow-700", high: "bg-orange-100 text-orange-700", urgent: "bg-red-100 text-red-700" };
const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-700", contacted: "bg-indigo-100 text-indigo-700",
  qualified: "bg-purple-100 text-purple-700", proposal: "bg-yellow-100 text-yellow-700",
  negotiation: "bg-orange-100 text-orange-700", won: "bg-green-100 text-green-700",
  lost: "bg-red-100 text-red-700", on_hold: "bg-gray-100 text-gray-600",
};

const TIMELINE_ICONS: Record<string, React.ReactElement> = {
  created: <Plus size={11} />, assigned: <User size={11} />,
  status_changed: <Activity size={11} />, note_added: <MessageSquare size={11} />,
  task_created: <CheckCircle2 size={11} />, call_recorded: <PhoneCall size={11} />,
  meeting_scheduled: <Video size={11} />, followup_added: <RefreshCw size={11} />,
  document_uploaded: <FileText size={11} />,
};

const TIMELINE_COLORS: Record<string, string> = {
  created: "bg-[#0f2044] text-white", assigned: "bg-[#c9a227] text-[#0f2044]",
  status_changed: "bg-indigo-100 text-indigo-700", note_added: "bg-yellow-100 text-yellow-700",
  task_created: "bg-green-100 text-green-700", call_recorded: "bg-blue-100 text-blue-700",
  meeting_scheduled: "bg-purple-100 text-purple-700", followup_added: "bg-orange-100 text-orange-700",
  document_uploaded: "bg-teal-100 text-teal-700",
};

// ── Mini Lead Card ─────────────────────────────────────────────────────────────

function LeadCard({ lead, selected, onClick }: { lead: Lead; selected: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${selected ? "border-[#c9a227] bg-[#c9a227]/5 shadow-sm" : "border-gray-200 bg-white hover:border-gray-300"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <p className="text-sm font-semibold text-[#0f2044] truncate">{lead.name}</p>
            {lead.priority && lead.priority !== "medium" && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded capitalize shrink-0 ${PRIORITIES[lead.priority] ?? ""}`}>{lead.priority}</span>
            )}
          </div>
          {lead.company && <p className="text-xs text-gray-400 flex items-center gap-1"><Building2 size={9} />{lead.company}</p>}
          <p className="text-xs text-gray-500 mt-0.5 truncate">{lead.serviceInterest}</p>
        </div>
        <div className="shrink-0 text-right">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"}`}>
            {lead.status.replace("_", " ")}
          </span>
          {lead.expectedRevenue && (
            <p className="text-xs font-semibold text-[#0f2044] mt-1">₹{lead.expectedRevenue}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-2">
        <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock size={9} /> {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        {lead.tags && lead.tags.split(",").slice(0, 2).map(t => t.trim()).filter(Boolean).map(t => (
          <span key={t} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
        ))}
      </div>
    </div>
  );
}

// ── Lead Detail Panel ──────────────────────────────────────────────────────────

function LeadDetailPanel({ leadId, onUpdated }: { leadId: number; onUpdated: () => void }) {
  const [tab, setTab] = useState<"info" | "notes" | "tasks" | "timeline">("info");
  const [noteText, setNoteText] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", priority: "medium" });
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [quickActionNote, setQuickActionNote] = useState("");
  const qc = useQueryClient();

  const { data: lead, isLoading } = useQuery<LeadDetail>({
    queryKey: ["my-lead", leadId],
    queryFn: () => api(`/admin/leads/${leadId}`),
  });

  const { data: timeline = [] } = useQuery<LeadTimelineEntry[]>({
    queryKey: ["my-lead-timeline", leadId],
    queryFn: () => api(`/admin/leads/${leadId}/timeline`),
    enabled: tab === "timeline",
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api(`/admin/leads/${leadId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-lead", leadId] }); qc.invalidateQueries({ queryKey: ["my-leads"] }); onUpdated(); },
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => api(`/admin/leads/${leadId}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-lead", leadId] }); qc.invalidateQueries({ queryKey: ["my-lead-timeline", leadId] }); setNoteText(""); },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => api(`/admin/leads/${leadId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-lead", leadId] }),
  });

  const addTaskMutation = useMutation({
    mutationFn: (data: typeof taskForm) => api(`/admin/leads/${leadId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-lead", leadId] }); qc.invalidateQueries({ queryKey: ["my-lead-timeline", leadId] }); setTaskForm({ title: "", dueDate: "", priority: "medium" }); },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Record<string, unknown> }) =>
      api(`/admin/leads/${leadId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-lead", leadId] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => api(`/admin/leads/${leadId}/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-lead", leadId] }),
  });

  const addTimelineMutation = useMutation({
    mutationFn: (data: { actionType: string; description: string }) =>
      api(`/admin/leads/${leadId}/timeline`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["my-lead-timeline", leadId] }); setQuickAction(null); setQuickActionNote(""); },
  });

  if (isLoading) return <div className="flex-1 flex items-center justify-center"><div className="w-6 h-6 border-2 border-[#c9a227] border-t-transparent rounded-full animate-spin" /></div>;
  if (!lead) return <div className="flex-1 flex items-center justify-center text-sm text-gray-400">Lead not found</div>;

  const handleQuickAction = (type: string) => {
    if (!quickActionNote.trim()) return;
    const labels: Record<string, string> = {
      call_recorded: "Call recorded", meeting_scheduled: "Meeting scheduled",
      followup_added: "Follow-up added", document_uploaded: "Document noted",
    };
    addTimelineMutation.mutate({ actionType: type, description: `${labels[type] ?? type}: ${quickActionNote.trim()}` });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b bg-[#0f2044]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-white text-lg leading-tight truncate">{lead.name}</h2>
            {lead.company && <p className="text-sm text-white/70 flex items-center gap-1 mt-0.5"><Building2 size={11} />{lead.company}</p>}
          </div>
          <Select value={lead.status} onValueChange={v => updateMutation.mutate({ status: v })}>
            <SelectTrigger className="h-7 text-xs w-36 bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PIPELINE_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs capitalize">{s.replace("_", " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs text-white/70">
          <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
            <PhoneCall size={11} /> {lead.phone}
          </a>
          <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-white transition-colors">
            <MessageSquare size={11} /> {lead.email}
          </a>
        </div>
      </div>

      {/* Quick CRM Actions bar */}
      <div className="flex gap-1 p-2 bg-gray-50 border-b overflow-x-auto">
        {[
          { type: "call_recorded", label: "Log Call", icon: <PhoneCall size={11} /> },
          { type: "meeting_scheduled", label: "Meeting", icon: <Video size={11} /> },
          { type: "followup_added", label: "Follow-up", icon: <RefreshCw size={11} /> },
          { type: "document_uploaded", label: "Document", icon: <FileText size={11} /> },
        ].map(qa => (
          <button
            key={qa.type}
            onClick={() => { setQuickAction(quickAction === qa.type ? null : qa.type); setTab("timeline"); }}
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border whitespace-nowrap transition-all ${quickAction === qa.type ? "bg-[#0f2044] text-white border-[#0f2044]" : "bg-white text-gray-600 border-gray-200 hover:border-[#0f2044]"}`}
          >
            {qa.icon} {qa.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b bg-white overflow-x-auto">
        {(["info", "notes", "tasks", "timeline"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-medium capitalize whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-[#c9a227] text-[#0f2044]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t}
            {t === "notes" && lead.notes.length ? ` (${lead.notes.length})` : ""}
            {t === "tasks" && lead.tasks.length ? ` (${lead.tasks.length})` : ""}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">

        {/* INFO TAB */}
        {tab === "info" && (
          <div className="space-y-3">
            {[
              { icon: <PhoneCall size={12} />, label: "Phone", value: lead.phone },
              { icon: <MessageSquare size={12} />, label: "Email", value: lead.email },
              { icon: <Tag size={12} />, label: "Service", value: lead.serviceInterest },
              { icon: <User size={12} />, label: "Source", value: lead.source },
              { icon: <Building2 size={12} />, label: "City", value: [lead.city, lead.state].filter(Boolean).join(", ") || null },
              { icon: <Clock size={12} />, label: "Revenue", value: lead.expectedRevenue ? `₹ ${lead.expectedRevenue}` : null },
            ].filter(r => r.value).map(row => (
              <div key={row.label} className="flex items-start gap-2">
                <span className="text-[#c9a227] mt-0.5 shrink-0">{row.icon}</span>
                <div>
                  <p className="text-[10px] text-gray-400">{row.label}</p>
                  <p className="text-sm text-gray-800">{row.value}</p>
                </div>
              </div>
            ))}

            {/* Editable CRM fields: Probability & Expected Closing Date */}
            <div className="mt-3 p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
              <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">CRM Updates</p>

              {/* Probability */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] text-gray-500">Win Probability</label>
                  <span className="text-xs font-semibold text-[#0f2044]">{lead.probability ?? 0}%</span>
                </div>
                <input
                  type="range" min={0} max={100} step={5}
                  value={lead.probability ?? 0}
                  onChange={e => updateMutation.mutate({ probability: parseInt(e.target.value, 10) })}
                  className="w-full h-1.5 accent-[#c9a227] cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
                  <span>0%</span><span>50%</span><span>100%</span>
                </div>
              </div>

              {/* Expected Closing Date */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Expected Closing Date</label>
                <Input
                  type="date"
                  className="h-7 text-xs"
                  value={lead.expectedClosingDate ?? ""}
                  onChange={e => updateMutation.mutate({ expectedClosingDate: e.target.value || null })}
                />
              </div>

              {/* Quotation / Invoice action hook */}
              <div>
                <label className="text-[10px] text-gray-500 block mb-1">Quick Action</label>
                <Button
                  variant="outline"
                  className="w-full h-7 text-xs border-[#0f2044]/20 text-[#0f2044] hover:bg-[#0f2044]/5"
                  onClick={() => {
                    addTimelineMutation.mutate({ actionType: "document_uploaded", description: "Quotation / invoice shared with client" });
                    setTab("timeline");
                  }}
                >
                  <FileText size={11} className="mr-1" /> Log Quotation / Invoice Sent
                </Button>
              </div>
            </div>

            {lead.message && (
              <div className="mt-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
                <p className="text-[10px] text-gray-400 mb-1">Remarks</p>
                <p className="text-sm text-gray-700 whitespace-pre-line">{lead.message}</p>
              </div>
            )}
          </div>
        )}

        {/* NOTES TAB */}
        {tab === "notes" && (
          <div className="space-y-3">
            <div className="space-y-2">
              <Textarea
                className="text-sm"
                rows={3}
                placeholder="Add a note…"
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <Button
                onClick={() => addNoteMutation.mutate(noteText)}
                disabled={!noteText.trim() || addNoteMutation.isPending}
                className="w-full h-8 bg-[#0f2044] text-white text-xs"
              >
                {addNoteMutation.isPending ? "Saving…" : "Add Note"}
              </Button>
            </div>

            {lead.notes.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No notes yet.</div>
            ) : (
              <div className="space-y-2">
                {lead.notes.slice().reverse().map(note => (
                  <div key={note.id} className="p-3 rounded-lg bg-yellow-50 border border-yellow-100 group">
                    <div className="flex justify-between items-start">
                      <p className="text-sm text-gray-800 leading-snug">{note.content}</p>
                      <button
                        onClick={() => deleteNoteMutation.mutate(note.id)}
                        className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-2 shrink-0 transition-opacity"
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      {note.createdBy ?? "Admin"} · {new Date(note.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TASKS TAB */}
        {tab === "tasks" && (
          <div className="space-y-3">
            <div className="space-y-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <Input
                className="h-8 text-sm"
                placeholder="Task title…"
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              />
              <div className="flex gap-2">
                <Input
                  type="date"
                  className="h-8 text-xs flex-1"
                  value={taskForm.dueDate}
                  onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                />
                <Select value={taskForm.priority} onValueChange={v => setTaskForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="h-8 text-xs w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.keys(PRIORITIES).map(p => <SelectItem key={p} value={p} className="capitalize text-xs">{p}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => addTaskMutation.mutate(taskForm)}
                  disabled={!taskForm.title.trim() || addTaskMutation.isPending}
                  className="h-8 bg-[#0f2044] text-white text-xs px-3"
                >Add</Button>
              </div>
            </div>

            {lead.tasks.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No tasks yet.</div>
            ) : (
              <div className="space-y-2">
                {lead.tasks.map(task => (
                  <div key={task.id} className={`flex items-start gap-3 p-2.5 rounded-lg border group ${task.status === "done" ? "bg-green-50 border-green-100" : "bg-white border-gray-100"}`}>
                    <button
                      onClick={() => updateTaskMutation.mutate({ taskId: task.id, data: { status: task.status === "done" ? "pending" : "done" } })}
                      className={task.status === "done" ? "text-green-500 mt-0.5" : "text-gray-300 hover:text-gray-400 mt-0.5"}
                    >
                      {task.status === "done" ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>{task.title}</p>
                      <div className="flex gap-2 mt-0.5">
                        {task.dueDate && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock size={9} />{task.dueDate}</span>}
                        {task.priority && <span className={`text-[10px] px-1.5 rounded capitalize ${PRIORITIES[task.priority] ?? ""}`}>{task.priority}</span>}
                      </div>
                    </div>
                    <button onClick={() => deleteTaskMutation.mutate(task.id)} className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TIMELINE TAB */}
        {tab === "timeline" && (
          <div className="space-y-3">
            {quickAction && (
              <div className="bg-gray-50 rounded-lg border border-gray-200 p-3 space-y-2">
                <p className="text-xs font-medium text-gray-700 capitalize">{quickAction.replace("_", " ")}</p>
                <Textarea
                  rows={2}
                  className="text-sm"
                  placeholder="Add details…"
                  value={quickActionNote}
                  onChange={e => setQuickActionNote(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleQuickAction(quickAction)}
                    disabled={!quickActionNote.trim() || addTimelineMutation.isPending}
                    className="h-7 text-xs bg-[#0f2044] text-white px-3"
                  >Save</Button>
                  <Button variant="outline" onClick={() => { setQuickAction(null); setQuickActionNote(""); }} className="h-7 text-xs px-3">Cancel</Button>
                </div>
              </div>
            )}

            {timeline.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">No timeline entries yet. Use the quick actions above.</div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-200" />
                <div className="space-y-3">
                  {timeline.map(entry => (
                    <div key={entry.id} className="flex gap-3 relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 border-2 border-white shadow-sm ${TIMELINE_COLORS[entry.actionType] ?? "bg-gray-100 text-gray-600"}`}>
                        {TIMELINE_ICONS[entry.actionType] ?? <Activity size={11} />}
                      </div>
                      <div className="flex-1 pb-2 pt-1">
                        <p className="text-sm text-gray-800 leading-snug">{entry.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-[#c9a227] font-medium">{entry.actorName}</span>
                          <span className="text-[10px] text-gray-400">
                            {new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function MyLeads() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const qc = useQueryClient();

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["my-leads"],
    queryFn: () => api(`/admin/leads/my`),
  });

  const filtered = leads.filter(l => {
    const matchStatus = statusFilter === "all" || l.status === statusFilter;
    const q = search.toLowerCase();
    const matchSearch = !q || l.name.toLowerCase().includes(q) || l.email.toLowerCase().includes(q) || (l.company ?? "").toLowerCase().includes(q) || (l.serviceInterest ?? "").toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const selectedLead = filtered.find(l => l.id === selectedId) ?? null;

  const statCounts = PIPELINE_STATUSES.reduce((acc, s) => ({ ...acc, [s]: leads.filter(l => l.status === s).length }), {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-[#0f2044] px-6 py-4 shrink-0">
        <h1 className="text-xl font-bold text-white">My Leads</h1>
        <p className="text-sm text-white/60 mt-0.5">Leads assigned to you</p>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 px-6 py-3 bg-white border-b overflow-x-auto shrink-0">
        <button
          onClick={() => setStatusFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${statusFilter === "all" ? "bg-[#0f2044] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
        >
          All ({leads.length})
        </button>
        {PIPELINE_STATUSES.filter(s => statCounts[s] > 0).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full capitalize whitespace-nowrap transition-all ${statusFilter === s ? "bg-[#0f2044] text-white" : `${STATUS_COLORS[s] ?? "bg-gray-100 text-gray-600"} hover:opacity-80`}`}
          >
            {s.replace("_", " ")} ({statCounts[s]})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-6 py-3 bg-white border-b shrink-0">
        <div className="relative max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8 h-8 text-sm"
            placeholder="Search leads…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
        </div>
      </div>

      {/* Main content — two-pane layout */}
      <div className="flex-1 flex min-h-0 p-4 gap-4">
        {/* Lead list */}
        <div className={`flex flex-col min-h-0 ${selectedLead ? "w-80 shrink-0" : "flex-1"}`}>
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-[#c9a227] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-2 text-gray-400">
              <User size={32} strokeWidth={1} />
              <p className="text-sm">No leads assigned to you</p>
              <p className="text-xs text-gray-300">Contact admin to get leads assigned</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {filtered.map(lead => (
                <LeadCard
                  key={lead.id}
                  lead={lead}
                  selected={lead.id === selectedId}
                  onClick={() => setSelectedId(lead.id === selectedId ? null : lead.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedLead && (
          <LeadDetailPanel
            leadId={selectedLead.id}
            onUpdated={() => qc.invalidateQueries({ queryKey: ["my-leads"] })}
          />
        )}

        {!selectedLead && !isLoading && filtered.length > 0 && (
          <div className="flex-1 hidden md:flex items-center justify-center text-gray-300 flex-col gap-2">
            <ChevronRight size={32} strokeWidth={1} />
            <p className="text-sm">Select a lead to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}
