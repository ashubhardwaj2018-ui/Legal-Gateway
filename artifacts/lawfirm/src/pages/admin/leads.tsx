import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Search, Download, Plus, X, ChevronRight, LayoutGrid, List,
  Clock, CheckCircle2, Circle, Trash2, MessageSquare, Send, Paperclip, FileText as FileDoc,
  Activity, Phone, Mail, Building2, MapPin, Tag, Star,
  Calendar, Target, User, AlertCircle, Pencil, UserPlus,
  FileText, Video, PhoneCall, RefreshCw, Users, MessageCircle as MessageCircleWa, ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Lead {
  id: number; name: string; email: string; phone: string;
  serviceCategory: string; serviceInterest: string; message?: string;
  preferredDate?: string; status: string; notes?: string;
  company?: string; whatsapp?: string; city?: string; state?: string;
  priority?: string; source?: string; rating?: number; assignedTo?: string;
  expectedRevenue?: string; probability?: number; expectedClosingDate?: string;
  nextFollowUp?: string; tags?: string; createdAt: string; updatedAt: string;
}

interface LeadNote { id: number; leadId: number; content: string; createdBy?: string; createdAt: string; }
interface LeadActivity { id: number; leadId: number; type: string; description: string; createdAt: string; }
interface LeadTask { id: number; leadId: number; title: string; description?: string; dueDate?: string; status: string; priority?: string; createdAt: string; }
interface LeadDetail extends Omit<Lead, "notes"> { notes: LeadNote[]; activities: LeadActivity[]; tasks: LeadTask[]; }
interface LeadAssignment { id: number; leadId: number; assignedToId: number; assignedToName: string; assignedByName?: string; deadline?: string; priority?: string; notes?: string; status: string; assignedAt: string; }
interface LeadTimelineEntry { id: number; leadId: number; actorId?: number; actorName: string; actionType: string; description: string; payload?: string; createdAt: string; }
interface Employee { id: number; name: string; department: string; designation: string; status: string; }

// ── Constants ──────────────────────────────────────────────────────────────────

const PIPELINE: { value: string; label: string; color: string; bg: string }[] = [
  { value: "new", label: "New", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  { value: "interested", label: "Interested", color: "text-violet-700", bg: "bg-violet-50 border-violet-200" },
  { value: "contacted", label: "Contacted", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", color: "text-orange-700", bg: "bg-orange-50 border-orange-200" },
  { value: "proposal_sent", label: "Proposal Sent", color: "text-pink-700", bg: "bg-pink-50 border-pink-200" },
  { value: "negotiation", label: "Negotiation", color: "text-indigo-700", bg: "bg-indigo-50 border-indigo-200" },
  { value: "won", label: "Won", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  { value: "lost", label: "Lost", color: "text-red-700", bg: "bg-red-50 border-red-200" },
  { value: "hold", label: "Hold", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
  // legacy
  { value: "pending", label: "Pending", color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200" },
  { value: "completed", label: "Completed", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  { value: "closed", label: "Closed", color: "text-gray-600", bg: "bg-gray-50 border-gray-200" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  medium: "bg-blue-100 text-blue-700",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const SOURCES = ["website", "referral", "social", "cold_call", "walk_in", "whatsapp", "email", "other"];
const PRIORITIES = ["low", "medium", "high", "urgent"];

const KANBAN_COLS = PIPELINE.filter(p => !["pending","completed","closed"].includes(p.value));

// ── API helpers ────────────────────────────────────────────────────────────────

const api = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(`${r.status}`);
  if (r.status === 204) return null;
  return r.json();
};

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const s = PIPELINE.find(p => p.value === status);
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium border ${s?.bg ?? "bg-gray-50 border-gray-200"} ${s?.color ?? "text-gray-600"}`}>
      {s?.label ?? status}
    </span>
  );
}

// ── Create Lead Dialog ─────────────────────────────────────────────────────────

function CreateLeadDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", email: "", phone: "", company: "", whatsapp: "",
    city: "", state: "", serviceCategory: "general", serviceInterest: "General Enquiry",
    message: "", priority: "medium", source: "website", assignedTo: "", expectedRevenue: "", tags: "",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => api("/admin/leads", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { onCreated(); onClose(); setForm(f => ({ ...f, name: "", email: "", phone: "" })); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#0f2044]">Create New Lead</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="col-span-2 grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Full Name *</Label>
              <Input className="mt-1 h-8 text-sm" value={form.name} onChange={set("name")} placeholder="Rajesh Kumar" />
            </div>
            <div>
              <Label className="text-xs">Company</Label>
              <Input className="mt-1 h-8 text-sm" value={form.company} onChange={set("company")} placeholder="Acme Pvt Ltd" />
            </div>
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input className="mt-1 h-8 text-sm" type="email" value={form.email} onChange={set("email")} placeholder="raj@example.com" />
          </div>
          <div>
            <Label className="text-xs">Phone *</Label>
            <Input className="mt-1 h-8 text-sm" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
          </div>
          <div>
            <Label className="text-xs">WhatsApp</Label>
            <Input className="mt-1 h-8 text-sm" value={form.whatsapp} onChange={set("whatsapp")} placeholder="+91 98765 43210" />
          </div>
          <div>
            <Label className="text-xs">City</Label>
            <Input className="mt-1 h-8 text-sm" value={form.city} onChange={set("city")} placeholder="Mumbai" />
          </div>
          <div>
            <Label className="text-xs">State</Label>
            <Input className="mt-1 h-8 text-sm" value={form.state} onChange={set("state")} placeholder="Maharashtra" />
          </div>
          <div>
            <Label className="text-xs">Service Interest</Label>
            <Input className="mt-1 h-8 text-sm" value={form.serviceInterest} onChange={set("serviceInterest")} placeholder="Trademark Registration" />
          </div>
          <div>
            <Label className="text-xs">Expected Revenue (₹)</Label>
            <Input className="mt-1 h-8 text-sm" value={form.expectedRevenue} onChange={set("expectedRevenue")} placeholder="25,000" />
          </div>
          <div>
            <Label className="text-xs">Priority</Label>
            <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Source</Label>
            <Select value={form.source} onValueChange={v => setForm(f => ({ ...f, source: v }))}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{SOURCES.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Assigned To</Label>
            <Input className="mt-1 h-8 text-sm" value={form.assignedTo} onChange={set("assignedTo")} placeholder="Adv. Sharma" />
          </div>
          <div>
            <Label className="text-xs">Tags (comma-separated)</Label>
            <Input className="mt-1 h-8 text-sm" value={form.tags} onChange={set("tags")} placeholder="urgent, new-client" />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Message / Remarks</Label>
            <Textarea className="mt-1 text-sm" rows={2} value={form.message} onChange={set("message")} placeholder="Client needs trademark registration urgently..." />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={!form.name || !form.email || !form.phone || mutation.isPending}
            className="flex-1 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white text-sm h-9"
          >
            {mutation.isPending ? "Creating…" : "Create Lead"}
          </Button>
          <Button variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Lead Detail Drawer ─────────────────────────────────────────────────────────

const ASSIGN_METHODS = [
  { value: "individual", label: "Individual" },
  { value: "multiple", label: "Multiple Employees" },
  { value: "department", label: "By Department" },
  { value: "round_robin", label: "Round Robin" },
  { value: "auto", label: "Auto (Least Loaded)" },
];

const TIMELINE_ICONS: Record<string, React.ReactElement> = {
  created: <Plus size={11} />,
  assigned: <UserPlus size={11} />,
  unassigned: <Users size={11} />,
  status_changed: <Activity size={11} />,
  note_added: <MessageSquare size={11} />,
  task_created: <CheckCircle2 size={11} />,
  call_recorded: <PhoneCall size={11} />,
  meeting_scheduled: <Video size={11} />,
  followup_added: <RefreshCw size={11} />,
  document_uploaded: <FileText size={11} />,
  email_sent: <Mail size={11} />,
  whatsapp_sent: <Phone size={11} />,
};

const TIMELINE_COLORS: Record<string, string> = {
  created: "bg-[#0f2044] text-white",
  assigned: "bg-[#c9a227] text-[#0f2044]",
  unassigned: "bg-gray-200 text-gray-600",
  status_changed: "bg-indigo-100 text-indigo-700",
  note_added: "bg-yellow-100 text-yellow-700",
  task_created: "bg-green-100 text-green-700",
  call_recorded: "bg-blue-100 text-blue-700",
  meeting_scheduled: "bg-purple-100 text-purple-700",
  followup_added: "bg-orange-100 text-orange-700",
  document_uploaded: "bg-teal-100 text-teal-700",
  email_sent: "bg-pink-100 text-pink-700",
  whatsapp_sent: "bg-emerald-100 text-emerald-700",
};

function LeadDetailDrawer({ leadId, onClose, onUpdated }: { leadId: number; onClose: () => void; onUpdated: () => void }) {
  const [tab, setTab] = useState<"info" | "notes" | "tasks" | "timeline" | "assign" | "portal-chat" | "portal-docs" | "whatsapp">("info");
  const [noteText, setNoteText] = useState("");
  const [taskForm, setTaskForm] = useState({ title: "", dueDate: "", priority: "medium" });
  const [editField, setEditField] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  // WhatsApp tab state
  const [waInput, setWaInput] = useState("");
  const [waTemplateId, setWaTemplateId] = useState<number | null>(null);
  const [waSending, setWaSending] = useState(false);
  const waEndRef = useRef<HTMLDivElement>(null);
  // Portal chat state
  const [portalChatInput, setPortalChatInput] = useState("");
  const [portalChatSending, setPortalChatSending] = useState(false);
  const [portalChatSenderName, setPortalChatSenderName] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSseRef = useRef<EventSource | null>(null);
  // Assignment state
  const [assignMethod, setAssignMethod] = useState("individual");
  const [assignDept, setAssignDept] = useState("");
  const [assignDeadline, setAssignDeadline] = useState("");
  const [assignPriority, setAssignPriority] = useState("medium");
  const [assignNotes, setAssignNotes] = useState("");
  const [assignReplace, setAssignReplace] = useState(false);
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([]);
  // Quick timeline action
  const [quickAction, setQuickAction] = useState<string | null>(null);
  const [quickActionNote, setQuickActionNote] = useState("");
  const qc = useQueryClient();

  const { data: lead, isLoading } = useQuery<LeadDetail>({
    queryKey: ["lead", leadId],
    queryFn: () => api(`/admin/leads/${leadId}`),
  });

  const { data: timeline = [] } = useQuery<LeadTimelineEntry[]>({
    queryKey: ["lead-timeline", leadId],
    queryFn: () => api(`/admin/leads/${leadId}/timeline`),
    enabled: tab === "timeline",
  });

  // Portal chat messages
  interface PortalChatMsg { id: number; leadId: number; clientEmail: string; senderType: string; senderName: string; message: string; createdAt: string; }
  const { data: portalChatMsgs = [], refetch: refetchPortalChat } = useQuery<PortalChatMsg[]>({
    queryKey: ["portal-chat", leadId],
    queryFn: () => api(`/admin/leads/${leadId}/portal-chat`),
    enabled: tab === "portal-chat",
  });

  // Portal documents
  interface PortalDoc { id: number; fileName: string; fileUrl: string; fileSize: number; mimeType: string; uploadedAt: string; clientEmail: string; }
  const { data: portalDocs = [] } = useQuery<PortalDoc[]>({
    queryKey: ["portal-docs", leadId],
    queryFn: () => api(`/admin/leads/${leadId}/portal-documents`),
    enabled: tab === "portal-docs",
  });

  // WhatsApp messages for this lead
  interface WaMsg { id: number; toNumber: string; message: string; templateName?: string; senderName?: string; senderType: string; status: string; createdAt: string; direction: string; }
  const { data: waMsgs = [], refetch: refetchWa } = useQuery<WaMsg[]>({
    queryKey: ["wa-messages-lead", leadId],
    queryFn: () => api(`/admin/whatsapp/messages?leadId=${leadId}`),
    enabled: tab === "whatsapp",
  });

  // WhatsApp templates (loaded lazily when tab opens)
  interface WaTemplate { id: number; name: string; category: string; body: string; isActive?: boolean; }
  const { data: waTemplates = [] } = useQuery<WaTemplate[]>({
    queryKey: ["wa-templates"],
    queryFn: () => api("/admin/whatsapp/templates"),
    enabled: tab === "whatsapp",
  });

  // SSE for real-time portal chat on admin side
  useEffect(() => {
    if (tab !== "portal-chat") { chatSseRef.current?.close(); chatSseRef.current = null; return; }
    const apiBase = (window as Window & { __API_BASE__?: string }).__API_BASE__ ?? "/api";
    const es = new EventSource(`${apiBase}/admin/leads/${leadId}/portal-chat/sse`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "message") refetchPortalChat();
      } catch { /* ignore */ }
    };
    chatSseRef.current = es;
    return () => { es.close(); chatSseRef.current = null; };
  }, [tab, leadId]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [portalChatMsgs]);

  const { data: assignments = [] } = useQuery<LeadAssignment[]>({
    queryKey: ["lead-assignments", leadId],
    queryFn: () => api(`/admin/leads/${leadId}/assignments`),
    enabled: tab === "assign",
  });

  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["team-active"],
    queryFn: () => api(`/admin/team?status=active`),
    enabled: tab === "assign",
  });

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api(`/admin/leads/${leadId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", leadId] }); qc.invalidateQueries({ queryKey: ["leads"] }); onUpdated(); },
  });

  const addNoteMutation = useMutation({
    mutationFn: (content: string) => api(`/admin/leads/${leadId}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", leadId] }); qc.invalidateQueries({ queryKey: ["lead-timeline", leadId] }); setNoteText(""); },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: (noteId: number) => api(`/admin/leads/${leadId}/notes/${noteId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", leadId] }),
  });

  const addTaskMutation = useMutation({
    mutationFn: (data: typeof taskForm) => api(`/admin/leads/${leadId}/tasks`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead", leadId] }); qc.invalidateQueries({ queryKey: ["lead-timeline", leadId] }); setTaskForm({ title: "", dueDate: "", priority: "medium" }); },
  });

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, data }: { taskId: number; data: Record<string, unknown> }) =>
      api(`/admin/leads/${leadId}/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", leadId] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (taskId: number) => api(`/admin/leads/${leadId}/tasks/${taskId}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["lead", leadId] }),
  });

  const assignMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => api(`/admin/leads/${leadId}/assign`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-assignments", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", leadId] });
      qc.invalidateQueries({ queryKey: ["leads"] });
      setSelectedEmployees([]);
    },
  });

  const unassignMutation = useMutation({
    mutationFn: (assignmentId: number) => api(`/admin/leads/${leadId}/assignments/${assignmentId}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead-assignments", leadId] });
      qc.invalidateQueries({ queryKey: ["lead-timeline", leadId] });
    },
  });

  const addTimelineEntryMutation = useMutation({
    mutationFn: (data: { actionType: string; description: string }) =>
      api(`/admin/leads/${leadId}/timeline`, { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["lead-timeline", leadId] }); setQuickAction(null); setQuickActionNote(""); },
  });

  const startEdit = (field: string, val: string) => { setEditField(field); setEditVal(val ?? ""); };
  const saveEdit = () => { if (editField) updateMutation.mutate({ [editField]: editVal }); setEditField(null); };

  const toggleEmployee = (id: number) =>
    setSelectedEmployees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const handleAssign = () => {
    const payload: Record<string, unknown> = { method: assignMethod, priority: assignPriority, replaceExisting: assignReplace };
    if (assignDeadline) payload.deadline = assignDeadline;
    if (assignNotes) payload.notes = assignNotes;
    if (assignMethod === "individual" || assignMethod === "multiple") payload.employeeIds = selectedEmployees;
    if (assignMethod === "department") payload.department = assignDept;
    assignMutation.mutate(payload);
  };

  const handleQuickAction = (type: string) => {
    if (!quickActionNote.trim()) return;
    const labels: Record<string, string> = {
      call_recorded: "Call recorded", meeting_scheduled: "Meeting scheduled",
      followup_added: "Follow-up added", document_uploaded: "Document noted",
    };
    addTimelineEntryMutation.mutate({ actionType: type, description: `${labels[type] ?? type}: ${quickActionNote.trim()}` });
  };

  const activityIcons: Record<string, React.ReactElement> = {
    created: <Plus size={12} />, status_change: <Activity size={12} />,
    note_added: <MessageSquare size={12} />, task_created: <CheckCircle2 size={12} />,
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-start justify-between bg-[#0f2044]">
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-48 bg-white/20" />
            ) : (
              <>
                <h2 className="text-lg font-serif font-bold text-white">{lead?.name}</h2>
                <p className="text-[#c9a227] text-xs mt-0.5">{lead?.company ?? lead?.serviceInterest}</p>
              </>
            )}
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white mt-1"><X size={18} /></button>
        </div>

        {/* Status + Priority quick bar */}
        {lead && (
          <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-3 items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Status:</span>
              <Select value={lead.status} onValueChange={v => updateMutation.mutate({ status: v })}>
                <SelectTrigger className="h-7 text-xs w-40 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PIPELINE.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Priority:</span>
              <Select value={lead.priority ?? "medium"} onValueChange={v => updateMutation.mutate({ priority: v })}>
                <SelectTrigger className="h-7 text-xs w-28 border-gray-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize text-xs">{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {lead.tags && (
              <div className="flex gap-1 flex-wrap">
                {lead.tags.split(",").map(t => t.trim()).filter(Boolean).map(t => (
                  <span key={t} className="bg-[#c9a227]/10 text-[#0f2044] text-[10px] px-2 py-0.5 rounded-full border border-[#c9a227]/30 font-medium">{t}</span>
                ))}
              </div>
            )}
            {/* WhatsApp quick button — always visible in the action bar */}
            {(lead.whatsapp || lead.phone) && (
              <a
                href={`https://wa.me/${(lead.whatsapp || lead.phone).replace(/[^\d+]/g, "")}?text=${encodeURIComponent(`Hi ${lead.name}, this is from Vakil & Co. regarding your enquiry on ${lead.serviceInterest}. How can we assist you today?`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-1.5 text-xs font-medium text-green-700 border border-green-300 bg-white hover:bg-green-50 hover:border-green-400 rounded-full px-3 py-1 transition-colors shrink-0"
              >
                <MessageCircleWa size={12} /> WhatsApp
              </a>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b px-4 bg-white overflow-x-auto">
          {(["info", "notes", "tasks", "timeline", "assign", "portal-chat", "portal-docs", "whatsapp"] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t ? "border-[#c9a227] text-[#0f2044]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            >
              {t === "assign" && <span className="flex items-center gap-1"><UserPlus size={11} />Assign</span>}
              {t === "portal-chat" && <span className="flex items-center gap-1"><MessageSquare size={11} />Portal Chat</span>}
              {t === "portal-docs" && <span className="flex items-center gap-1"><Paperclip size={11} />Portal Docs</span>}
              {t === "whatsapp" && <span className="flex items-center gap-1"><MessageCircleWa size={11} />WhatsApp</span>}
              {!["assign", "portal-chat", "portal-docs", "whatsapp"].includes(t) && <span className="capitalize">{t}</span>}
              {t === "notes" && lead?.notes?.length ? ` (${lead.notes.length})` : ""}
              {t === "tasks" && lead?.tasks?.length ? ` (${lead.tasks.length})` : ""}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
          ) : lead ? (
            <>
              {/* INFO TAB */}
              {tab === "info" && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: <User size={14} />, label: "Name", field: "name", val: lead.name },
                      { icon: <Building2 size={14} />, label: "Company", field: "company", val: lead.company ?? "" },
                      { icon: <Mail size={14} />, label: "Email", field: "email", val: lead.email },
                      { icon: <Phone size={14} />, label: "Phone", field: "phone", val: lead.phone },
                      { icon: <Phone size={14} />, label: "WhatsApp", field: "whatsapp", val: lead.whatsapp ?? "" },
                      { icon: <MapPin size={14} />, label: "City", field: "city", val: lead.city ?? "" },
                      { icon: <MapPin size={14} />, label: "State", field: "state", val: lead.state ?? "" },
                      { icon: <Tag size={14} />, label: "Source", field: "source", val: lead.source ?? "" },
                      { icon: <User size={14} />, label: "Assigned To", field: "assignedTo", val: lead.assignedTo ?? "" },
                    ].map(({ icon, label, field, val }) => (
                      <div key={field} className="group">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">{icon}{label}</p>
                        {editField === field ? (
                          <div className="flex gap-1 mt-0.5">
                            <Input className="h-7 text-xs flex-1" value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditField(null); }} />
                            <Button size="sm" className="h-7 px-2 text-xs bg-[#0f2044] text-white" onClick={saveEdit}>✓</Button>
                          </div>
                        ) : (
                          <p className="font-medium text-sm text-gray-800 mt-0.5 flex items-center gap-1 cursor-pointer group-hover:text-[#0f2044]" onClick={() => startEdit(field, val)}>
                            {val || <span className="text-gray-300 italic text-xs">—</span>}
                            <Pencil size={10} className="opacity-0 group-hover:opacity-50 transition-opacity" />
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t pt-4 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><Target size={14} />Expected Revenue</p>
                      {editField === "expectedRevenue" ? (
                        <div className="flex gap-1 mt-0.5">
                          <Input className="h-7 text-xs flex-1" value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditField(null); }} />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0f2044] text-white" onClick={saveEdit}>✓</Button>
                        </div>
                      ) : (
                        <p className="font-medium text-sm text-gray-800 mt-0.5 cursor-pointer hover:text-[#0f2044]" onClick={() => startEdit("expectedRevenue", lead.expectedRevenue ?? "")}>
                          {lead.expectedRevenue ? `₹ ${lead.expectedRevenue}` : <span className="text-gray-300 italic text-xs">—</span>}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><Star size={14} />Probability</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="bg-[#c9a227] h-1.5 rounded-full transition-all" style={{ width: `${lead.probability ?? 0}%` }} />
                        </div>
                        <span className="text-xs font-medium text-gray-700">{lead.probability ?? 0}%</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1"><Calendar size={14} />Closing Date</p>
                      {editField === "expectedClosingDate" ? (
                        <div className="flex gap-1 mt-0.5">
                          <Input type="date" className="h-7 text-xs flex-1" value={editVal} onChange={e => setEditVal(e.target.value)} autoFocus onKeyDown={e => { if (e.key === "Enter") saveEdit(); if (e.key === "Escape") setEditField(null); }} />
                          <Button size="sm" className="h-7 px-2 text-xs bg-[#0f2044] text-white" onClick={saveEdit}>✓</Button>
                        </div>
                      ) : (
                        <p className="font-medium text-sm text-gray-800 mt-0.5 cursor-pointer hover:text-[#0f2044]" onClick={() => startEdit("expectedClosingDate", lead.expectedClosingDate ?? "")}>
                          {lead.expectedClosingDate || <span className="text-gray-300 italic text-xs">—</span>}
                        </p>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Service</p>
                      <p className="font-medium text-sm text-gray-800 mt-0.5">{lead.serviceInterest}</p>
                    </div>
                  </div>

                  {lead.message && (
                    <div className="border-t pt-4">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Message / Remarks</p>
                      <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg leading-relaxed">{lead.message}</p>
                    </div>
                  )}

                  <div className="border-t pt-4 grid grid-cols-2 gap-4 text-xs text-gray-500">
                    <div>Created: {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                    <div>Updated: {new Date(lead.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</div>
                  </div>
                </div>
              )}

              {/* NOTES TAB */}
              {tab === "notes" && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Textarea
                      className="text-sm flex-1"
                      rows={2}
                      placeholder="Add a note about this lead..."
                      value={noteText}
                      onChange={e => setNoteText(e.target.value)}
                    />
                    <Button
                      onClick={() => addNoteMutation.mutate(noteText)}
                      disabled={!noteText.trim() || addNoteMutation.isPending}
                      className="bg-[#0f2044] text-white text-xs px-3 self-start h-9"
                    >
                      Add
                    </Button>
                  </div>
                  {lead.notes.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No notes yet. Add the first one above.</div>
                  ) : (
                    <div className="space-y-3">
                      {lead.notes.map(note => (
                        <div key={note.id} className="bg-gray-50 border border-gray-100 rounded-lg p-3 group">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-sm text-gray-800 leading-relaxed">{note.content}</p>
                              <p className="text-[10px] text-gray-400 mt-1.5">{note.createdBy} · {new Date(note.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                            </div>
                            <button
                              onClick={() => deleteNoteMutation.mutate(note.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 ml-2 mt-0.5 transition-opacity"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TASKS TAB */}
              {tab === "tasks" && (
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-2">
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
                        <SelectTrigger className="h-8 text-xs w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize text-xs">{p}</SelectItem>)}</SelectContent>
                      </Select>
                      <Button
                        onClick={() => addTaskMutation.mutate(taskForm)}
                        disabled={!taskForm.title.trim() || addTaskMutation.isPending}
                        className="h-8 bg-[#0f2044] text-white text-xs px-3"
                      >
                        Add
                      </Button>
                    </div>
                  </div>

                  {lead.tasks.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No tasks yet.</div>
                  ) : (
                    <div className="space-y-2">
                      {lead.tasks.map(task => (
                        <div key={task.id} className={`flex items-start gap-3 p-3 rounded-lg border group ${task.status === "done" ? "bg-green-50 border-green-100" : "bg-white border-gray-100"}`}>
                          <button
                            onClick={() => updateTaskMutation.mutate({ taskId: task.id, data: { status: task.status === "done" ? "pending" : "done" } })}
                            className={task.status === "done" ? "text-green-500 mt-0.5" : "text-gray-300 hover:text-gray-400 mt-0.5"}
                          >
                            {task.status === "done" ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>{task.title}</p>
                            <div className="flex gap-2 mt-0.5">
                              {task.dueDate && (
                                <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                                  <Clock size={10} /> {task.dueDate}
                                </span>
                              )}
                              {task.priority && (
                                <span className={`text-[10px] px-1.5 rounded capitalize ${PRIORITY_COLORS[task.priority] ?? ""}`}>{task.priority}</span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteTaskMutation.mutate(task.id)}
                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TIMELINE TAB */}
              {tab === "timeline" && (
                <div className="space-y-4">
                  {/* Quick Actions */}
                  <div className="flex gap-2 flex-wrap">
                    {[
                      { type: "call_recorded", label: "Log Call", icon: <PhoneCall size={12} /> },
                      { type: "meeting_scheduled", label: "Meeting", icon: <Video size={12} /> },
                      { type: "followup_added", label: "Follow-up", icon: <RefreshCw size={12} /> },
                      { type: "document_uploaded", label: "Document", icon: <FileText size={12} /> },
                    ].map(qa => (
                      <button
                        key={qa.type}
                        onClick={() => setQuickAction(quickAction === qa.type ? null : qa.type)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-all ${quickAction === qa.type ? "bg-[#0f2044] text-white border-[#0f2044]" : "bg-white text-gray-600 border-gray-200 hover:border-[#0f2044] hover:text-[#0f2044]"}`}
                      >
                        {qa.icon} {qa.label}
                      </button>
                    ))}
                  </div>

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
                          disabled={!quickActionNote.trim() || addTimelineEntryMutation.isPending}
                          className="h-7 text-xs bg-[#0f2044] text-white px-3"
                        >Save</Button>
                        <Button variant="outline" onClick={() => { setQuickAction(null); setQuickActionNote(""); }} className="h-7 text-xs px-3">Cancel</Button>
                      </div>
                    </div>
                  )}

                  {timeline.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 text-sm">No timeline entries yet.</div>
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

              {/* ASSIGN TAB */}
              {tab === "assign" && (
                <div className="space-y-5">
                  {/* Current Assignments */}
                  <div>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Currently Assigned</h3>
                    {assignments.length === 0 ? (
                      <p className="text-sm text-gray-400 italic">No active assignments</p>
                    ) : (
                      <div className="space-y-2">
                        {assignments.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-[#0f2044]/5 border border-[#0f2044]/10">
                            <div>
                              <p className="text-sm font-medium text-[#0f2044]">{a.assignedToName}</p>
                              <div className="flex gap-2 mt-0.5">
                                {a.priority && <span className={`text-[10px] px-1.5 rounded capitalize ${PRIORITY_COLORS[a.priority] ?? ""}`}>{a.priority}</span>}
                                {a.deadline && <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><Clock size={9} />{a.deadline}</span>}
                                <span className="text-[10px] text-gray-400">by {a.assignedByName ?? "Admin"}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => unassignMutation.mutate(a.id)}
                              disabled={unassignMutation.isPending}
                              className="text-red-400 hover:text-red-600 transition-colors"
                              title="Unassign"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t pt-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">New Assignment</h3>
                    <div className="space-y-3">
                      {/* Method */}
                      <div>
                        <Label className="text-xs">Assignment Method</Label>
                        <Select value={assignMethod} onValueChange={setAssignMethod}>
                          <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {ASSIGN_METHODS.map(m => <SelectItem key={m.value} value={m.value} className="text-sm">{m.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Employee picker for individual/multiple */}
                      {(assignMethod === "individual" || assignMethod === "multiple") && (
                        <div>
                          <Label className="text-xs">Select Employee{assignMethod === "multiple" ? "s" : ""}</Label>
                          <div className="mt-1 border rounded-lg divide-y max-h-40 overflow-y-auto">
                            {employees.filter(e => e.status === "active").map(emp => (
                              <label key={emp.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                <input
                                  type={assignMethod === "individual" ? "radio" : "checkbox"}
                                  checked={selectedEmployees.includes(emp.id)}
                                  onChange={() => {
                                    if (assignMethod === "individual") setSelectedEmployees([emp.id]);
                                    else toggleEmployee(emp.id);
                                  }}
                                  className="accent-[#0f2044]"
                                />
                                <div>
                                  <p className="text-sm font-medium">{emp.name}</p>
                                  <p className="text-[10px] text-gray-400">{emp.designation} · {emp.department}</p>
                                </div>
                              </label>
                            ))}
                            {employees.filter(e => e.status === "active").length === 0 && (
                              <p className="text-xs text-gray-400 p-3">No active employees found</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Department picker */}
                      {assignMethod === "department" && (
                        <div>
                          <Label className="text-xs">Department</Label>
                          <Select value={assignDept} onValueChange={setAssignDept}>
                            <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue placeholder="Select department" /></SelectTrigger>
                            <SelectContent>
                              {[...new Set(employees.map(e => e.department).filter(Boolean))].map(d => (
                                <SelectItem key={d} value={d} className="text-sm">{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Info for auto methods */}
                      {(assignMethod === "round_robin" || assignMethod === "auto") && (
                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-2.5 text-xs text-blue-700">
                          {assignMethod === "round_robin" ? "Will assign to the next employee in rotation." : "Will assign to the employee with the fewest active leads."}
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Deadline</Label>
                          <Input type="date" className="mt-1 h-8 text-xs" value={assignDeadline} onChange={e => setAssignDeadline(e.target.value)} />
                        </div>
                        <div>
                          <Label className="text-xs">Priority</Label>
                          <Select value={assignPriority} onValueChange={setAssignPriority}>
                            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize text-xs">{p}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div>
                        <Label className="text-xs">Assignment Notes</Label>
                        <Textarea className="mt-1 text-sm" rows={2} placeholder="Any specific instructions…" value={assignNotes} onChange={e => setAssignNotes(e.target.value)} />
                      </div>

                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={assignReplace} onChange={e => setAssignReplace(e.target.checked)} className="accent-[#0f2044]" />
                        <span className="text-xs text-gray-600">Replace existing assignments</span>
                      </label>

                      <Button
                        onClick={handleAssign}
                        disabled={
                          assignMutation.isPending ||
                          ((assignMethod === "individual" || assignMethod === "multiple") && selectedEmployees.length === 0) ||
                          (assignMethod === "department" && !assignDept)
                        }
                        className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white h-9 text-sm"
                      >
                        <UserPlus size={14} className="mr-2" />
                        {assignMutation.isPending ? "Assigning…" : "Assign Lead"}
                      </Button>

                      {assignMutation.isSuccess && (
                        <p className="text-xs text-green-600 text-center">Lead assigned successfully!</p>
                      )}
                      {assignMutation.isError && (
                        <p className="text-xs text-red-500 text-center">Assignment failed. Please try again.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* PORTAL CHAT TAB */}
              {tab === "portal-chat" && (
                <div className="flex flex-col" style={{ height: "480px" }}>
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {portalChatMsgs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <MessageSquare size={28} className="mb-2 opacity-30" />
                        <p className="text-sm">No portal chat messages yet</p>
                      </div>
                    ) : portalChatMsgs.map(msg => {
                      const isEmployee = msg.senderType === "employee";
                      return (
                        <div key={msg.id} className={`flex gap-2 ${isEmployee ? "flex-row-reverse" : "flex-row"}`}>
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${isEmployee ? "bg-[#c9a227] text-[#0f2044]" : "bg-[#0f2044] text-white"}`}>
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                          <div className={`max-w-[75%] ${isEmployee ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                            <div className={`text-[10px] font-semibold ${isEmployee ? "text-right text-[#0f2044]/60" : "text-gray-400"}`}>{msg.senderName}</div>
                            <div className={`px-3 py-2 rounded-xl text-sm ${isEmployee ? "bg-[#0f2044] text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                              {msg.message}
                            </div>
                            <div className="text-[10px] text-gray-400 px-1">{new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="border-t pt-3 mt-3 space-y-2">
                    <input
                      value={portalChatSenderName}
                      onChange={e => setPortalChatSenderName(e.target.value)}
                      placeholder="Your name (shown to client)"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#c9a227]"
                    />
                    <div className="flex gap-2">
                      <input
                        value={portalChatInput}
                        onChange={e => setPortalChatInput(e.target.value)}
                        onKeyDown={async e => {
                          if (e.key === "Enter" && portalChatInput.trim()) {
                            e.preventDefault();
                            setPortalChatSending(true);
                            await api(`/admin/leads/${leadId}/portal-chat/reply`, {
                              method: "POST",
                              body: JSON.stringify({ message: portalChatInput.trim(), senderName: portalChatSenderName || "Support Team" }),
                            });
                            setPortalChatInput("");
                            refetchPortalChat();
                            setPortalChatSending(false);
                          }
                        }}
                        placeholder="Reply to client…"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c9a227]"
                      />
                      <button
                        disabled={!portalChatInput.trim() || portalChatSending}
                        onClick={async () => {
                          if (!portalChatInput.trim()) return;
                          setPortalChatSending(true);
                          await api(`/admin/leads/${leadId}/portal-chat/reply`, {
                            method: "POST",
                            body: JSON.stringify({ message: portalChatInput.trim(), senderName: portalChatSenderName || "Support Team" }),
                          });
                          setPortalChatInput("");
                          refetchPortalChat();
                          setPortalChatSending(false);
                        }}
                        className="w-9 h-9 bg-[#0f2044] rounded-lg flex items-center justify-center text-white hover:bg-[#1a3060] transition-all disabled:opacity-40"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* PORTAL DOCS TAB */}
              {tab === "portal-docs" && (
                <div className="space-y-3">
                  {portalDocs.length === 0 ? (
                    <div className="flex flex-col items-center py-12 text-gray-400">
                      <Paperclip size={28} className="mb-2 opacity-30" />
                      <p className="text-sm">Client has not uploaded any documents</p>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-gray-100 divide-y">
                      {portalDocs.map(doc => {
                        const filename = doc.fileUrl.split("/").pop() ?? "";
                        return (
                          <div key={doc.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                            <div className="w-8 h-8 bg-[#0f2044]/10 rounded-lg flex items-center justify-center shrink-0">
                              <FileDoc size={14} className="text-[#0f2044]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm text-[#0f2044] truncate">{doc.fileName}</p>
                              <p className="text-[10px] text-gray-400">
                                {doc.fileSize < 1024 ? `${doc.fileSize} B` : doc.fileSize < 1024 * 1024 ? `${(doc.fileSize / 1024).toFixed(1)} KB` : `${(doc.fileSize / (1024 * 1024)).toFixed(1)} MB`}
                                {" · "}{new Date(doc.uploadedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                              <p className="text-[10px] text-gray-300">{doc.clientEmail}</p>
                            </div>
                            <a
                              href={`/api/admin/portal/files/${filename}`}
                              target="_blank"
                              rel="noreferrer"
                              download={doc.fileName}
                              className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 rounded-lg text-[11px] text-gray-600 hover:bg-[#0f2044] hover:text-white hover:border-[#0f2044] transition-all"
                            >
                              <Download size={11} />Download
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* WHATSAPP TAB */}
              {tab === "whatsapp" && lead && (() => {
                const waNumber = lead.whatsapp || lead.phone || "";
                const cleanWaNum = waNumber.replace(/[\s\-().]/g, "").replace(/[^\d+]/g, "").replace(/^\+/, "");
                const waWebUrl = cleanWaNum ? `https://wa.me/${cleanWaNum}` : null;

                const handleWaSend = async () => {
                  if (!waNumber) return;
                  if (!waInput.trim() && !waTemplateId) return;
                  setWaSending(true);
                  try {
                    const res = await api("/admin/whatsapp/send", {
                      method: "POST",
                      body: JSON.stringify({
                        leadId,
                        templateId: waTemplateId ?? undefined,
                        message: !waTemplateId ? waInput.trim() : undefined,
                        senderName: "Admin",
                      }),
                    });
                    setWaInput("");
                    setWaTemplateId(null);
                    refetchWa();
                    if (res.waUrl) window.open(res.waUrl, "_blank");
                  } catch { /* noop */ }
                  setWaSending(false);
                };

                return (
                  <div className="flex flex-col h-full gap-4">
                    {/* Header with number + open WA Web */}
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
                      <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center shrink-0">
                        <MessageCircleWa size={16} className="text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800">{lead.name}</p>
                        <p className="text-xs text-gray-500">{waNumber || "No number on file"}</p>
                      </div>
                      {waWebUrl && (
                        <a href={waWebUrl} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 px-3 py-1.5 bg-green-500 text-white text-xs rounded-lg hover:bg-green-600 transition-colors font-medium shrink-0">
                          <ExternalLink size={11} />Open Chat
                        </a>
                      )}
                    </div>

                    {!waNumber && (
                      <div className="text-center py-4 text-sm text-amber-600 bg-amber-50 rounded-xl border border-amber-100">
                        This lead has no WhatsApp or phone number. Edit the Info tab to add one.
                      </div>
                    )}

                    {/* Message history */}
                    <div className="flex-1 overflow-y-auto space-y-2 max-h-64 pr-1">
                      {waMsgs.length === 0 ? (
                        <div className="text-center py-8 text-gray-300 text-sm">No messages yet — send the first one below.</div>
                      ) : (
                        [...waMsgs].reverse().map(msg => (
                          <div key={msg.id} className={`flex ${msg.direction === "outgoing" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs shadow-sm ${msg.direction === "outgoing" ? "bg-[#0f2044] text-white rounded-br-sm" : "bg-gray-100 text-gray-800 rounded-bl-sm"}`}>
                              <p className="leading-relaxed whitespace-pre-line">{msg.message}</p>
                              <div className={`flex items-center gap-1 mt-1 ${msg.direction === "outgoing" ? "text-white/50 justify-end" : "text-gray-400"}`}>
                                {msg.senderName && <span className="text-[9px]">{msg.senderName} ·</span>}
                                <span className="text-[9px]">{new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                                {msg.templateName && <span className="text-[9px] opacity-70">· {msg.templateName}</span>}
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                      <div ref={waEndRef} />
                    </div>

                    {/* Compose */}
                    {waNumber && (
                      <div className="space-y-2 border-t pt-3">
                        <select value={waTemplateId ?? ""} onChange={e => { setWaTemplateId(e.target.value ? Number(e.target.value) : null); setWaInput(""); }}
                          className="w-full h-8 border border-gray-200 rounded-lg px-3 text-xs focus:outline-none bg-white">
                          <option value="">— Custom message (no template) —</option>
                          {waTemplates.filter(t => t.isActive !== false).map(t => (
                            <option key={t.id} value={t.id}>{t.name}</option>
                          ))}
                        </select>
                        {!waTemplateId && (
                          <textarea
                            value={waInput}
                            onChange={e => setWaInput(e.target.value)}
                            rows={3}
                            placeholder="Type a WhatsApp message…"
                            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-400 resize-none"
                          />
                        )}
                        {waTemplateId && (
                          <div className="bg-gray-50 rounded-xl px-3 py-2 text-xs text-gray-500 font-mono">
                            {waTemplates.find(t => t.id === waTemplateId)?.body ?? ""}
                          </div>
                        )}
                        <button
                          disabled={waSending || (!waInput.trim() && !waTemplateId)}
                          onClick={handleWaSend}
                          className="w-full flex items-center justify-center gap-2 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-xl transition-colors disabled:opacity-40 font-medium"
                        >
                          {waSending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                          {waSending ? "Opening WhatsApp…" : "Send via WhatsApp"}
                        </button>
                        <p className="text-[10px] text-gray-400 text-center">This will open WhatsApp Web and save the message to CRM history.</p>
                      </div>
                    )}
                  </div>
                );
              })()}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Kanban Card ────────────────────────────────────────────────────────────────

function KanbanCard({ lead, onClick, onStatusChange }: {
  lead: Lead;
  onClick: () => void;
  onStatusChange?: (status: string) => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-pointer hover:shadow-md hover:border-[#c9a227]/40 transition-all group"
    >
      <div className="flex justify-between items-start mb-2">
        <p className="font-medium text-sm text-[#0f2044] leading-tight group-hover:text-[#0f2044]">{lead.name}</p>
        {lead.priority && lead.priority !== "medium" && (
          <span className={`text-[9px] px-1.5 rounded capitalize ml-1 shrink-0 ${PRIORITY_COLORS[lead.priority] ?? ""}`}>{lead.priority}</span>
        )}
      </div>
      {lead.company && <p className="text-xs text-gray-500 mb-1.5 flex items-center gap-1"><Building2 size={10} />{lead.company}</p>}
      <p className="text-[11px] text-gray-500 mb-2 truncate">{lead.serviceInterest ?? "—"}</p>
      <div className="flex justify-between items-center">
        {lead.expectedRevenue ? (
          <span className="text-xs font-semibold text-[#0f2044]">₹ {lead.expectedRevenue}</span>
        ) : <span />}
        <span className="text-[10px] text-gray-400">
          {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </span>
      </div>
      {lead.tags && (
        <div className="flex gap-1 flex-wrap mt-2">
          {lead.tags.split(",").slice(0, 2).map(t => t.trim()).filter(Boolean).map(t => (
            <span key={t} className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">{t}</span>
          ))}
        </div>
      )}
      {/* Inline stage mover — stops propagation so clicking here won't open the detail drawer */}
      {onStatusChange && (
        <div onClick={e => e.stopPropagation()} className="mt-2 pt-2 border-t border-gray-100">
          <select
            value={lead.status}
            onChange={e => { e.stopPropagation(); onStatusChange(e.target.value); }}
            onClick={e => e.stopPropagation()}
            className="w-full text-[10px] border border-gray-200 rounded px-1.5 py-0.5 bg-gray-50 text-gray-600 focus:outline-none focus:border-[#c9a227] cursor-pointer"
          >
            {KANBAN_COLS.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

// ── Export CSV ─────────────────────────────────────────────────────────────────

function exportCSV(data: Lead[]) {
  const headers = ["ID","Name","Company","Email","Phone","WhatsApp","City","State","Service","Status","Priority","Source","Assigned","Revenue","Probability","Tags","Created"];
  const rows = data.map(c => [
    c.id, c.name, c.company ?? "", c.email, c.phone, c.whatsapp ?? "",
    c.city ?? "", c.state ?? "", c.serviceInterest, c.status, c.priority ?? "",
    c.source ?? "", c.assignedTo ?? "", c.expectedRevenue ?? "", c.probability ?? "",
    (c.tags ?? "").replace(/,/g, ";"), new Date(c.createdAt).toLocaleDateString("en-IN"),
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "crm-leads.csv"; a.click();
  URL.revokeObjectURL(url);
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminLeads() {
  const qc = useQueryClient();
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const handleSearch = useCallback((val: string) => {
    setSearch(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(val), 350);
  }, []);

  const params = new URLSearchParams();
  if (statusFilter !== "all") params.set("status", statusFilter);
  if (priorityFilter !== "all") params.set("priority", priorityFilter);
  if (debouncedSearch) params.set("search", debouncedSearch);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["leads", statusFilter, priorityFilter, debouncedSearch],
    queryFn: () => api(`/admin/leads?${params.toString()}`),
  });

  // Kanban: group by status (only show main pipeline cols)
  const kanbanCols = KANBAN_COLS.map(col => ({
    ...col,
    leads: leads.filter(l => l.status === col.value),
  }));

  // Inline Kanban status change
  const patchStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/admin/leads/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  // Stats
  const total = leads.length;
  const won = leads.filter(l => l.status === "won").length;
  const totalRev = leads.filter(l => l.expectedRevenue).reduce((s, l) => s + parseFloat(l.expectedRevenue?.replace(/,/g, "") ?? "0"), 0);

  return (
    <AdminLayout
      title="CRM — Lead Pipeline"
      subtitle={`${total} leads`}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => exportCSV(leads)} className="gap-1.5 h-8 text-xs">
            <Download size={12} /> Export
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5 h-8 text-xs bg-[#0f2044] text-white hover:bg-[#0f2044]/90">
            <Plus size={12} /> New Lead
          </Button>
        </div>
      }
    >
      {createOpen && (
        <CreateLeadDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={() => qc.invalidateQueries({ queryKey: ["leads"] })}
        />
      )}
      {selectedId !== null && (
        <LeadDetailDrawer
          leadId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["leads"] })}
        />
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Leads", value: total, color: "text-[#0f2044]" },
          { label: "Won", value: won, color: "text-green-600" },
          { label: "In Progress", value: leads.filter(l => !["won","lost","closed","completed"].includes(l.status)).length, color: "text-blue-600" },
          { label: "Pipeline Value", value: totalRev ? `₹ ${totalRev.toLocaleString("en-IN")}` : "—", color: "text-[#c9a227]" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
            <p className={`text-xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8 h-8 text-sm" placeholder="Search leads…" value={search} onChange={e => handleSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-40 shrink-0"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Status</SelectItem>
            {PIPELINE.map(p => <SelectItem key={p.value} value={p.value} className="text-xs">{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-8 text-xs w-36 shrink-0"><SelectValue placeholder="All Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Priority</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize text-xs">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex border rounded-lg overflow-hidden shrink-0">
          <button
            onClick={() => setView("kanban")}
            className={`px-3 h-8 text-xs flex items-center gap-1.5 transition-colors ${view === "kanban" ? "bg-[#0f2044] text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <LayoutGrid size={12} /> Kanban
          </button>
          <button
            onClick={() => setView("table")}
            className={`px-3 h-8 text-xs flex items-center gap-1.5 transition-colors ${view === "table" ? "bg-[#0f2044] text-white" : "text-gray-500 hover:bg-gray-50"}`}
          >
            <List size={12} /> Table
          </button>
        </div>
      </div>

      {/* KANBAN VIEW */}
      {view === "kanban" && (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="w-56 bg-gray-50 rounded-xl border border-gray-200 p-3">
                  <Skeleton className="h-5 w-24 mb-3" />
                  <Skeleton className="h-24 w-full mb-2" />
                  <Skeleton className="h-24 w-full" />
                </div>
              ))
            ) : kanbanCols.map(col => (
              <div key={col.value} className="w-60 flex flex-col">
                <div className={`rounded-t-xl border-t border-x px-3 py-2.5 flex items-center justify-between ${col.bg}`}>
                  <span className={`text-xs font-semibold ${col.color}`}>{col.label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bg} ${col.color} border`}>{col.leads.length}</span>
                </div>
                <div className={`flex-1 min-h-[120px] rounded-b-xl border-b border-x ${col.bg} p-2 space-y-2`}>
                  {col.leads.length === 0 ? (
                    <div className="text-center py-4 text-xs text-gray-400">No leads</div>
                  ) : col.leads.map(lead => (
                    <KanbanCard key={lead.id} lead={lead} onClick={() => setSelectedId(lead.id)} onStatusChange={status => patchStatus.mutate({ id: lead.id, status })} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TABLE VIEW */}
      {view === "table" && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Name / Company","Contact","Service","Status","Priority","Revenue","Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>{Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}</tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-gray-400 text-sm">
                      {debouncedSearch || statusFilter !== "all" ? "No leads match this filter." : "No leads yet — create one to get started."}
                    </td>
                  </tr>
                ) : leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setSelectedId(lead.id)}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0f2044] text-sm">{lead.name}</div>
                      {lead.company && <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><Building2 size={10} />{lead.company}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-600">{lead.email}</div>
                      <div className="text-xs text-gray-400">{lead.phone}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-700 max-w-[140px] truncate">{lead.serviceInterest}</div>
                      {lead.source && <div className="text-[10px] text-gray-400 capitalize mt-0.5">{lead.source.replace("_"," ")}</div>}
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={lead.status} /></td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded capitalize ${PRIORITY_COLORS[lead.priority ?? "medium"] ?? ""}`}>{lead.priority ?? "medium"}</span>
                    </td>
                    <td className="px-4 py-3">
                      {lead.expectedRevenue ? (
                        <span className="text-xs font-semibold text-[#0f2044]">₹ {lead.expectedRevenue}</span>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <button className="text-xs text-[#0f2044] font-medium hover:underline flex items-center gap-1">
                        Open <ChevronRight size={10} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
