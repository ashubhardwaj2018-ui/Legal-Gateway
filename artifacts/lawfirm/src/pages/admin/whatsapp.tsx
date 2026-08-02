import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  MessageCircle, Plus, Trash2, Edit2, Check, X, Send, Users, Zap,
  History, BarChart2, ExternalLink, Copy, ToggleLeft, ToggleRight,
  Loader2, ChevronDown, Search, Filter, RefreshCw, AlertCircle, CheckCircle2,
  Settings2, Phone, Eye, EyeOff, Save,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface WaTemplate { id: number; name: string; category: string; body: string; isActive: boolean; createdBy?: string; createdAt: string; }
interface WaMessage { id: number; leadId?: number; toNumber: string; message: string; templateName?: string; senderName?: string; senderType: string; status: string; provider: string; isBulk: boolean; createdAt: string; }
interface WaTrigger { id: number; event: string; templateId?: number; isEnabled: boolean; }
interface WaDashboard { sentToday: number; totalMessages: number; failedMessages: number; activeTemplates: number; activeTriggers: number; recentMessages: WaMessage[]; provider?: string; }
interface Lead { id: number; name: string; phone: string; whatsapp?: string; serviceInterest: string; status: string; city?: string; state?: string; }

type Tab = "dashboard" | "templates" | "bulk" | "triggers" | "history" | "settings";

const CATEGORIES = ["general", "welcome", "followup", "quotation", "invoice", "payment", "assignment", "status", "broadcast"];
const CATEGORY_COLORS: Record<string, string> = {
  general: "bg-gray-100 text-gray-700",
  welcome: "bg-green-100 text-green-700",
  followup: "bg-blue-100 text-blue-700",
  quotation: "bg-violet-100 text-violet-700",
  invoice: "bg-amber-100 text-amber-700",
  payment: "bg-emerald-100 text-emerald-700",
  assignment: "bg-indigo-100 text-indigo-700",
  status: "bg-orange-100 text-orange-700",
  broadcast: "bg-pink-100 text-pink-700",
};

const TRIGGER_LABELS: Record<string, string> = {
  lead_created:       "New Lead Created",
  lead_assigned:      "Lead Assigned to Employee",
  status_changed:     "Lead Status Changed",
  quotation_sent:     "Quotation Sent",
  invoice_sent:       "Invoice Sent",
  payment_reminder:   "Payment Reminder",
  document_requested: "Document Requested",
  service_completed:  "Service Completed",
  portal_created:     "Client Portal Created",
};

const PLACEHOLDERS = [
  "{{ClientName}}", "{{CompanyName}}", "{{LeadID}}", "{{ServiceName}}",
  "{{QuotationNo}}", "{{InvoiceNo}}", "{{Amount}}", "{{AssignedEmployee}}",
  "{{DueDate}}", "{{Website}}", "{{CompanyWhatsApp}}", "{{SupportEmail}}",
];

// ── WhatsApp Settings constants ───────────────────────────────────────────────
const COUNTRY_CODES = [
  { code: "+91", name: "India" }, { code: "+1", name: "USA / Canada" },
  { code: "+44", name: "UK" }, { code: "+971", name: "UAE" },
  { code: "+65", name: "Singapore" }, { code: "+61", name: "Australia" },
  { code: "+49", name: "Germany" }, { code: "+33", name: "France" },
  { code: "+81", name: "Japan" }, { code: "+86", name: "China" },
  { code: "+27", name: "South Africa" }, { code: "+55", name: "Brazil" },
];

const PROVIDERS = [
  { value: "web",       label: "WhatsApp Web (wa.me links only)" },
  { value: "waba",      label: "Meta WABA — Official Cloud API" },
  { value: "twilio",    label: "Twilio" },
  { value: "interakt",  label: "Interakt" },
  { value: "gupshup",   label: "Gupshup" },
  { value: "msg91",     label: "MSG91" },
  { value: "360dialog", label: "360dialog" },
];

const PROVIDER_FIELDS: Record<string, Array<{
  key: string; label: string; sensitive?: boolean; required?: boolean;
  placeholder?: string; hint?: string;
}>> = {
  waba: [
    { key: "whatsapp_api_key",             label: "System User Token",          sensitive: true, required: true, placeholder: "EAA..." },
    { key: "whatsapp_phone_number_id",     label: "Phone Number ID",             required: true, placeholder: "Numeric ID from Meta Business Manager" },
    { key: "whatsapp_business_account_id", label: "Business Account ID (WABA)", required: true, placeholder: "Numeric WABA ID" },
    { key: "whatsapp_verify_token",        label: "Webhook Verify Token",        sensitive: true, placeholder: "Any random string you choose",
      hint: "Set this in Meta App Dashboard → Webhooks. Webhook URL to configure: /api/webhooks/whatsapp" },
  ],
  twilio: [
    { key: "whatsapp_account_sid", label: "Account SID",   required: true, placeholder: "AC..." },
    { key: "whatsapp_api_key",     label: "Auth Token",    sensitive: true, required: true },
    { key: "whatsapp_from_number", label: "From Number",   required: true, placeholder: "whatsapp:+14155238886",
      hint: "Must be a WhatsApp-enabled Twilio number" },
  ],
  interakt: [
    { key: "whatsapp_api_key",     label: "API Key",         sensitive: true, required: true },
    { key: "whatsapp_from_number", label: "WhatsApp Number", placeholder: "+91...", hint: "Your Interakt registered number" },
  ],
  gupshup: [
    { key: "whatsapp_api_key",     label: "API Key",       sensitive: true, required: true },
    { key: "whatsapp_app_name",    label: "App Name",      placeholder: "Your Gupshup app name" },
    { key: "whatsapp_from_number", label: "Source Number", placeholder: "+91..." },
  ],
  msg91: [
    { key: "whatsapp_api_key",    label: "Auth Key",  sensitive: true, required: true },
    { key: "whatsapp_sender_id",  label: "Sender ID", placeholder: "e.g. VAKILCO" },
  ],
  "360dialog": [
    { key: "whatsapp_api_key",     label: "Partner API Key", sensitive: true, required: true },
    { key: "whatsapp_from_number", label: "Phone Number",    placeholder: "+91..." },
  ],
};

const api = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    ...opts,
  });
  if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error ?? `HTTP ${r.status}`); }
  return r.json();
};

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ label, value, color = "text-[#0f2044]", bg = "bg-white" }: { label: string; value: string | number; color?: string; bg?: string }) {
  return (
    <div className={`${bg} rounded-2xl border border-gray-100 p-5 shadow-sm`}>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

// ── Template Form ──────────────────────────────────────────────────────────────
function TemplateForm({ initial, onSave, onCancel }: {
  initial?: Partial<WaTemplate>;
  onSave: (data: { name: string; category: string; body: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState(initial?.category ?? "general");
  const [body, setBody] = useState(initial?.body ?? "");

  const insertPlaceholder = (ph: string) => setBody(b => b + ph);

  return (
    <div className="space-y-4 bg-white rounded-2xl border border-gray-100 p-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-xs">Template Name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Welcome Message" className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs">Category</Label>
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="mt-1 h-9 w-full border border-gray-200 rounded-lg px-3 text-sm focus:outline-none bg-white capitalize">
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div>
        <Label className="text-xs">Message Body *</Label>
        <Textarea value={body} onChange={e => setBody(e.target.value)} rows={5}
          placeholder="Hi {{ClientName}}, thank you for reaching out to {{CompanyName}}..."
          className="mt-1 text-sm resize-none" />
      </div>
      <div>
        <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wider font-semibold">Insert Placeholder</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDERS.map(ph => (
            <button key={ph} onClick={() => insertPlaceholder(ph)}
              className="text-[11px] px-2 py-1 bg-[#0f2044]/5 text-[#0f2044] rounded-lg hover:bg-[#0f2044]/10 font-mono transition-colors">
              {ph}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Button onClick={() => onSave({ name, category, body })} disabled={!name.trim() || !body.trim()}
          className="bg-[#0f2044] hover:bg-[#0f2044]/90 text-white">
          <Check size={14} className="mr-2" />Save Template
        </Button>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function AdminWhatsApp() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const qc = useQueryClient();

  // Templates state
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // Bulk send state
  const [bulkTemplateId, setBulkTemplateId] = useState<number | null>(null);
  const [bulkCustomMsg, setBulkCustomMsg] = useState("");
  const [bulkFilter, setBulkFilter] = useState({ status: "", service: "", city: "", state: "" });
  const [bulkResult, setBulkResult] = useState<{ sent: number; skipped: number; results: Array<{ name: string; number: string; waUrl: string }> } | null>(null);
  const [bulkSending, setBulkSending] = useState(false);

  // History search
  const [histSearch, setHistSearch] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────────
  const { data: dashboard } = useQuery<WaDashboard>({
    queryKey: ["wa-dashboard"],
    queryFn: () => api("/admin/whatsapp/dashboard"),
    enabled: tab === "dashboard",
    refetchInterval: 30000,
  });

  const { data: templates = [] } = useQuery<WaTemplate[]>({
    queryKey: ["wa-templates"],
    queryFn: () => api("/admin/whatsapp/templates"),
  });

  const { data: triggers = [] } = useQuery<WaTrigger[]>({
    queryKey: ["wa-triggers"],
    queryFn: () => api("/admin/whatsapp/triggers"),
    enabled: tab === "triggers",
  });

  const { data: messages = [], isLoading: msgsLoading } = useQuery<WaMessage[]>({
    queryKey: ["wa-messages"],
    queryFn: () => api("/admin/whatsapp/messages"),
    enabled: tab === "history",
  });

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const createTemplate = useMutation({
    mutationFn: (data: { name: string; category: string; body: string }) =>
      api("/admin/whatsapp/templates", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wa-templates"] }); setShowCreate(false); },
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) =>
      api(`/admin/whatsapp/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wa-templates"] }); setEditingId(null); },
  });

  const deleteTemplate = useMutation({
    mutationFn: (id: number) => api(`/admin/whatsapp/templates/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-templates"] }),
  });

  const updateTrigger = useMutation({
    mutationFn: ({ event, data }: { event: string; data: Record<string, unknown> }) =>
      api(`/admin/whatsapp/triggers/${event}`, { method: "PUT", body: JSON.stringify(data) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["wa-triggers"] }),
  });

  // ── Bulk send ─────────────────────────────────────────────────────────────────
  const handleBulkSend = async () => {
    if (!bulkTemplateId && !bulkCustomMsg.trim()) return;
    setBulkSending(true);
    try {
      const res = await api("/admin/whatsapp/bulk", {
        method: "POST",
        body: JSON.stringify({
          templateId: bulkTemplateId ?? undefined,
          message: !bulkTemplateId ? bulkCustomMsg : undefined,
          filter: {
            status: bulkFilter.status || undefined,
            service: bulkFilter.service || undefined,
            city: bulkFilter.city || undefined,
            state: bulkFilter.state || undefined,
          },
        }),
      });
      setBulkResult(res);
      qc.invalidateQueries({ queryKey: ["wa-messages"] });
    } catch { /* handled */ }
    setBulkSending(false);
  };

  const filteredMessages = messages.filter(m =>
    !histSearch || m.message.toLowerCase().includes(histSearch.toLowerCase()) ||
    m.toNumber.includes(histSearch) || m.senderName?.toLowerCase().includes(histSearch.toLowerCase())
  );

  // ── Dashboard inline connection test ─────────────────────────────────────────
  const [dashTesting, setDashTesting] = useState(false);
  const [dashConnResult, setDashConnResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleDashTestConn = async () => {
    setDashTesting(true);
    setDashConnResult(null);
    try {
      const r = await api("/admin/whatsapp/test-connection", { method: "POST" }) as Record<string, unknown>;
      setDashConnResult({
        ok:      Boolean(r.success ?? r.ok ?? true),
        message: String(r.message ?? "Connection successful"),
      });
    } catch (e: unknown) {
      setDashConnResult({ ok: false, message: e instanceof Error ? e.message : "Test failed" });
    }
    setDashTesting(false);
  };

  // ── Settings state ────────────────────────────────────────────────────────────
  const [sf, setSf] = useState<Record<string, string>>({});
  const [showSecret, setShowSecret] = useState<Record<string, boolean>>({});
  const [testingConn, setTestingConn] = useState(false);
  const [connResult, setConnResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: settingsRaw = [] } = useQuery<Array<{ key: string; value: string }>>({
    queryKey: ["wa-settings"],
    queryFn: () => api("/admin/settings"),
    enabled: tab === "settings",
  });

  useEffect(() => {
    if (settingsRaw.length) {
      setSf(Object.fromEntries(settingsRaw.map(({ key, value }) => [key, value])));
    }
  }, [settingsRaw]);

  const saveSettings = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: Object.entries(data).map(([key, value]) => ({ key, value })) }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["wa-settings"] });
      setConnResult({ ok: true, message: "Settings saved successfully." });
      setTimeout(() => setConnResult(null), 4000);
    },
    onError: () => setConnResult({ ok: false, message: "Failed to save settings." }),
  });

  const handleSaveSettings = () => saveSettings.mutate(sf);

  const handleTestConn = async () => {
    setTestingConn(true);
    setConnResult(null);
    try {
      // Save current form first so the backend reads fresh credentials
      await api("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ settings: Object.entries(sf).map(([key, value]) => ({ key, value })) }),
      });
      const r = await api("/admin/whatsapp/test-connection", { method: "POST" }) as Record<string, unknown>;
      setConnResult({
        ok:      Boolean(r.success ?? r.ok ?? true),
        message: String(r.message ?? "Connection successful"),
      });
    } catch (e: unknown) {
      setConnResult({ ok: false, message: e instanceof Error ? e.message : "Test failed" });
    }
    setTestingConn(false);
  };

  // ── Tabs ──────────────────────────────────────────────────────────────────────
  const TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
    { key: "dashboard", label: "Dashboard",      icon: BarChart2 },
    { key: "templates", label: "Templates",      icon: MessageCircle },
    { key: "bulk",      label: "Bulk Send",      icon: Users },
    { key: "triggers",  label: "Auto-Triggers",  icon: Zap },
    { key: "history",   label: "History",        icon: History },
    { key: "settings",  label: "Settings",       icon: Settings2 },
  ];

  return (
    <AdminLayout title="WhatsApp CRM" subtitle="Manage templates, bulk messaging, automation, and message history">
      {/* Tab bar */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl p-1.5 mb-6 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all ${tab === key ? "bg-[#0f2044] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════
          DASHBOARD TAB
      ════════════════════════════════════════════ */}
      {tab === "dashboard" && (
        <div className="space-y-6">

          {/* ── Provider Status Card ── */}
          {dashboard?.provider === "web" ? (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
              <AlertCircle size={18} className="text-amber-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Web fallback — configure a provider in Settings</p>
                <p className="text-xs text-amber-600 mt-0.5">Messages open WhatsApp Web (wa.me links). To send via API, go to the <button onClick={() => setTab("settings")} className="underline hover:text-amber-800 transition-colors">Settings tab</button> and choose a provider.</p>
              </div>
            </div>
          ) : dashboard?.provider ? (
            <div
              role="button"
              tabIndex={0}
              onClick={handleDashTestConn}
              onKeyDown={e => e.key === "Enter" && handleDashTestConn()}
              className="flex items-center gap-4 bg-white border border-gray-100 rounded-2xl px-5 py-4 shadow-sm cursor-pointer hover:border-[#0f2044]/20 hover:shadow transition-all select-none"
              title="Click to test connection"
            >
              <div className="w-9 h-9 rounded-xl bg-[#0f2044]/5 flex items-center justify-center shrink-0">
                <Phone size={16} className="text-[#0f2044]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-0.5">Active Provider</p>
                <p className="text-sm font-semibold text-[#0f2044] capitalize">{PROVIDERS.find(p => p.value === dashboard.provider)?.label ?? dashboard.provider}</p>
                {dashConnResult && (
                  <p className={`text-xs mt-1 ${dashConnResult.ok ? "text-green-600" : "text-red-500"}`}>
                    {dashConnResult.message}
                  </p>
                )}
              </div>
              <div className="shrink-0 flex items-center gap-2">
                {dashTesting ? (
                  <Loader2 size={15} className="animate-spin text-gray-400" />
                ) : dashConnResult ? (
                  dashConnResult.ok
                    ? <CheckCircle2 size={16} className="text-green-500" />
                    : <AlertCircle size={16} className="text-red-500" />
                ) : (
                  <RefreshCw size={14} className="text-gray-300" />
                )}
                <span className="text-[11px] text-gray-400 whitespace-nowrap">
                  {dashTesting ? "Testing…" : dashConnResult ? (dashConnResult.ok ? "Connected ✓" : "Error") : "Test connection"}
                </span>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Sent Today" value={dashboard?.sentToday ?? 0} color="text-green-600" />
            <StatCard label="Total Messages" value={dashboard?.totalMessages ?? 0} />
            <StatCard label="Failed" value={dashboard?.failedMessages ?? 0} color={dashboard?.failedMessages ? "text-red-600" : "text-gray-400"} />
            <StatCard label="Active Templates" value={dashboard?.activeTemplates ?? 0} color="text-[#c9a227]" />
            <StatCard label="Active Triggers" value={dashboard?.activeTriggers ?? 0} color="text-indigo-600" />
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#0f2044] text-sm mb-4 flex items-center gap-2"><History size={14} className="text-[#c9a227]" />Recent Activity</h3>
            {!dashboard?.recentMessages?.length ? (
              <p className="text-sm text-gray-400 py-6 text-center">No messages sent yet. Use Bulk Send or the WhatsApp button on a lead.</p>
            ) : (
              <div className="space-y-2">
                {dashboard.recentMessages.map(msg => (
                  <div key={msg.id} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${msg.status === "sent" ? "bg-green-400" : msg.status === "failed" ? "bg-red-400" : "bg-gray-300"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{msg.message}</p>
                      <p className="text-[10px] text-gray-400">To: {msg.toNumber} · {msg.senderName ?? msg.senderType} · {new Date(msg.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${msg.status === "sent" ? "bg-green-100 text-green-700" : msg.status === "failed" ? "bg-red-100 text-red-600" : "bg-gray-100 text-gray-500"}`}>{msg.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick setup guide */}
          <div className="bg-gradient-to-r from-[#0f2044] to-[#1a3a6e] rounded-2xl p-6 text-white">
            <h3 className="font-bold text-base mb-3 flex items-center gap-2"><Zap size={16} className="text-[#c9a227]" />Quick Setup Guide</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
              {[
                { step: "1", title: "Create Templates", desc: "Go to Templates tab and add reusable messages with placeholders like {{ClientName}}." },
                { step: "2", title: "Configure Triggers", desc: "Enable Auto-Triggers to send WhatsApp messages automatically on CRM events." },
                { step: "3", title: "Send Messages", desc: "Use Bulk Send to message multiple leads, or click WhatsApp button on any lead." },
              ].map(s => (
                <div key={s.step} className="bg-white/10 rounded-xl p-4">
                  <div className="w-6 h-6 bg-[#c9a227] rounded-full text-[#0f2044] text-xs font-bold flex items-center justify-center mb-2">{s.step}</div>
                  <p className="font-semibold text-white mb-1">{s.title}</p>
                  <p className="text-white/60 text-xs">{s.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-white/40">Open the <button onClick={() => setTab("settings")} className="underline hover:text-white/70 transition-colors">Settings tab</button> to configure your API provider, credentials, and fallback behaviour.</div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          TEMPLATES TAB
      ════════════════════════════════════════════ */}
      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
            <Button onClick={() => { setShowCreate(true); setEditingId(null); }}
              className="bg-[#0f2044] hover:bg-[#0f2044]/90 text-white h-9">
              <Plus size={14} className="mr-2" />New Template
            </Button>
          </div>

          {showCreate && (
            <TemplateForm
              onSave={data => createTemplate.mutate(data)}
              onCancel={() => setShowCreate(false)}
            />
          )}

          {templates.length === 0 && !showCreate ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <MessageCircle size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">No templates yet</p>
              <p className="text-gray-300 text-sm mt-1">Create reusable WhatsApp message templates with dynamic placeholders</p>
            </div>
          ) : (
            <div className="space-y-3">
              {templates.map(tmpl => (
                <div key={tmpl.id} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                  {editingId === tmpl.id ? (
                    <TemplateForm
                      initial={tmpl}
                      onSave={data => updateTemplate.mutate({ id: tmpl.id, data })}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <span className="font-semibold text-[#0f2044]">{tmpl.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-medium ${CATEGORY_COLORS[tmpl.category] ?? "bg-gray-100 text-gray-600"}`}>{tmpl.category}</span>
                          {!tmpl.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400">Inactive</span>}
                        </div>
                        <p className="text-sm text-gray-600 whitespace-pre-line font-mono bg-gray-50 rounded-xl px-3 py-2 text-xs">{tmpl.body}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => updateTemplate.mutate({ id: tmpl.id, data: { isActive: !tmpl.isActive } })}
                          title={tmpl.isActive ? "Deactivate" : "Activate"}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600">
                          {tmpl.isActive ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} />}
                        </button>
                        <button onClick={() => setEditingId(tmpl.id)}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-blue-600">
                          <Edit2 size={14} />
                        </button>
                        <button onClick={() => { if (confirm("Delete this template?")) deleteTemplate.mutate(tmpl.id); }}
                          className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-red-600">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          BULK SEND TAB
      ════════════════════════════════════════════ */}
      {tab === "bulk" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            {/* Message source */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <h3 className="font-semibold text-[#0f2044] text-sm">Message</h3>
              <div>
                <Label className="text-xs">Use Template (recommended)</Label>
                <select value={bulkTemplateId ?? ""} onChange={e => setBulkTemplateId(e.target.value ? Number(e.target.value) : null)}
                  className="mt-1 h-9 w-full border border-gray-200 rounded-lg px-3 text-sm focus:outline-none bg-white">
                  <option value="">— No template (custom message) —</option>
                  {templates.filter(t => t.isActive).map(t => (
                    <option key={t.id} value={t.id}>{t.name} ({t.category})</option>
                  ))}
                </select>
              </div>
              {!bulkTemplateId && (
                <div>
                  <Label className="text-xs">Custom Message</Label>
                  <Textarea value={bulkCustomMsg} onChange={e => setBulkCustomMsg(e.target.value)}
                    rows={4} placeholder="Type your message… You can use {{ClientName}}, {{CompanyName}} etc."
                    className="mt-1 text-sm resize-none" />
                </div>
              )}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h3 className="font-semibold text-[#0f2044] text-sm flex items-center gap-2"><Filter size={13} />Filter Recipients</h3>
              <div className="text-xs text-gray-400 bg-blue-50 px-3 py-2 rounded-xl">Leave all filters empty to send to all leads with a WhatsApp/phone number.</div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: "status", label: "Lead Status", placeholder: "e.g. new, won" },
                  { key: "service", label: "Service", placeholder: "e.g. Tax Filing" },
                  { key: "city", label: "City", placeholder: "e.g. Mumbai" },
                  { key: "state", label: "State", placeholder: "e.g. Maharashtra" },
                ].map(f => (
                  <div key={f.key}>
                    <Label className="text-xs">{f.label}</Label>
                    <Input value={bulkFilter[f.key as keyof typeof bulkFilter]}
                      onChange={e => setBulkFilter(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} className="mt-1 h-8 text-xs" />
                  </div>
                ))}
              </div>
              <Button onClick={handleBulkSend}
                disabled={bulkSending || (!bulkTemplateId && !bulkCustomMsg.trim())}
                className="w-full bg-green-600 hover:bg-green-700 text-white">
                {bulkSending ? <><Loader2 size={14} className="animate-spin mr-2" />Sending…</> : <><Send size={14} className="mr-2" />Send Bulk WhatsApp</>}
              </Button>
            </div>
          </div>

          {/* Results */}
          <div>
            {!bulkResult ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-12 text-center h-full flex flex-col items-center justify-center">
                <Users size={36} className="text-gray-200 mb-3" />
                <p className="text-gray-400 font-medium">No bulk send yet</p>
                <p className="text-gray-300 text-sm mt-1">Results will appear here after sending</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-green-600">{bulkResult.sent}</div>
                    <div className="text-xs text-gray-400">Messages queued</div>
                  </div>
                  <div className="flex-1">
                    <div className="text-2xl font-bold text-gray-400">{bulkResult.skipped}</div>
                    <div className="text-xs text-gray-400">Skipped (no number)</div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setBulkResult(null)}><RefreshCw size={12} /></Button>
                </div>
                <div className="max-h-80 overflow-y-auto space-y-2">
                  {bulkResult.results.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                      <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700">{r.name}</p>
                        <p className="text-xs text-gray-400">{r.number}</p>
                      </div>
                      <a href={r.waUrl} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-medium">
                        <ExternalLink size={11} />Open
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          TRIGGERS TAB
      ════════════════════════════════════════════ */}
      {tab === "triggers" && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="text-sm text-amber-800">
              <strong>Auto-Triggers</strong> fire when CRM events occur. Each trigger needs an <strong>assigned template</strong>. Messages are sent automatically using the configured WhatsApp provider.
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(TRIGGER_LABELS).map(([event, label]) => {
              const trigger = triggers.find(t => t.event === event);
              return (
                <div key={event} className={`bg-white rounded-2xl border p-5 transition-all ${trigger?.isEnabled ? "border-green-200" : "border-gray-100"}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-[#0f2044] text-sm">{label}</p>
                      <p className="text-[10px] text-gray-400 font-mono mt-0.5">{event}</p>
                    </div>
                    <button
                      onClick={() => updateTrigger.mutate({ event, data: { isEnabled: !trigger?.isEnabled } })}
                      className={`shrink-0 transition-all ${trigger?.isEnabled ? "text-green-500" : "text-gray-300"}`}>
                      {trigger?.isEnabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                    </button>
                  </div>
                  <div>
                    <Label className="text-xs">Assigned Template</Label>
                    <select
                      value={trigger?.templateId ?? ""}
                      onChange={e => updateTrigger.mutate({ event, data: { templateId: e.target.value ? Number(e.target.value) : null } })}
                      className="mt-1 h-8 w-full border border-gray-200 rounded-lg px-3 text-xs focus:outline-none bg-white">
                      <option value="">— No template assigned —</option>
                      {templates.filter(t => t.isActive).map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  {trigger?.isEnabled && !trigger?.templateId && (
                    <p className="text-[10px] text-amber-600 mt-1.5 flex items-center gap-1"><AlertCircle size={10} />Assign a template to activate this trigger.</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════
          HISTORY TAB
      ════════════════════════════════════════════ */}
      {tab === "history" && (
        <div className="space-y-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input value={histSearch} onChange={e => setHistSearch(e.target.value)}
              placeholder="Search messages, numbers, senders…"
              className="pl-9 h-9" />
          </div>
          {msgsLoading ? (
            <div className="bg-white rounded-2xl p-12 text-center"><Loader2 size={24} className="animate-spin text-[#c9a227] mx-auto" /></div>
          ) : filteredMessages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
              <History size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 font-medium">{histSearch ? "No messages match your search" : "No messages sent yet"}</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
              {filteredMessages.map(msg => (
                <div key={msg.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-2 ${msg.status === "sent" ? "bg-green-400" : msg.status === "failed" ? "bg-red-400" : "bg-gray-300"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="text-sm font-medium text-[#0f2044]">{msg.toNumber}</span>
                      {msg.templateName && <span className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 rounded-full">{msg.templateName}</span>}
                      {msg.isBulk && <span className="text-[10px] px-2 py-0.5 bg-pink-100 text-pink-700 rounded-full">Bulk</span>}
                      <span className={`text-[10px] px-2 py-0.5 rounded-full capitalize ${msg.status === "sent" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{msg.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 line-clamp-1">{msg.message}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {msg.senderName ?? msg.senderType} · {new Date(msg.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════
          SETTINGS TAB
      ════════════════════════════════════════════ */}
      {tab === "settings" && (
        <div className="space-y-5 max-w-2xl">

          {/* Business Identity */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-[#0f2044] text-sm flex items-center gap-2">
              <Phone size={14} className="text-[#c9a227]" /> Business Identity
            </h3>
            <div>
              <label className="text-xs font-medium text-gray-600">Business Name</label>
              <input
                className="mt-1 h-9 w-full border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2044]/30"
                placeholder="e.g. Vakil & Co. Legal Associates"
                value={sf.whatsapp_business_name ?? ""}
                onChange={e => setSf(p => ({ ...p, whatsapp_business_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600">Country Code</label>
                <select
                  className="mt-1 h-9 w-full border border-gray-200 rounded-lg px-3 text-sm focus:outline-none bg-white"
                  value={sf.whatsapp_country_code ?? "+91"}
                  onChange={e => setSf(p => ({ ...p, whatsapp_country_code: e.target.value }))}
                >
                  {COUNTRY_CODES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="text-xs font-medium text-gray-600">Company WhatsApp Number</label>
                <input
                  className="mt-1 h-9 w-full border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0f2044]/30"
                  placeholder="9876543210 (without country code)"
                  value={sf.company_whatsapp ?? ""}
                  onChange={e => setSf(p => ({ ...p, company_whatsapp: e.target.value }))}
                />
                <p className="text-[10px] text-gray-400 mt-1">{"Used for wa.me links and {{CompanyWhatsApp}} placeholder in templates"}</p>
              </div>
            </div>
          </div>

          {/* API Provider */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
            <h3 className="font-semibold text-[#0f2044] text-sm flex items-center gap-2">
              <Zap size={14} className="text-[#c9a227]" /> API Provider
            </h3>
            <div>
              <label className="text-xs font-medium text-gray-600">Provider</label>
              <select
                className="mt-1 h-9 w-full border border-gray-200 rounded-lg px-3 text-sm focus:outline-none bg-white"
                value={sf.whatsapp_provider ?? "web"}
                onChange={e => setSf(p => ({ ...p, whatsapp_provider: e.target.value }))}
              >
                {PROVIDERS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Dynamic credentials */}
            {(!sf.whatsapp_provider || sf.whatsapp_provider === "web") ? (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
                <strong>WhatsApp Web mode</strong> — messages open as wa.me links in the browser.
                No API credentials needed. Upgrade to an API provider to enable direct sending and auto-triggers.
              </div>
            ) : (
              <div className="space-y-3">
                {(PROVIDER_FIELDS[sf.whatsapp_provider] ?? []).map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-medium text-gray-600">
                      {field.label}
                      {field.required && <span className="text-red-400 ml-0.5">*</span>}
                    </label>
                    <div className="relative mt-1">
                      <input
                        type={field.sensitive && !showSecret[field.key] ? "password" : "text"}
                        className="h-9 w-full border border-gray-200 rounded-lg px-3 text-sm pr-9 focus:outline-none focus:ring-1 focus:ring-[#0f2044]/30"
                        placeholder={field.placeholder ?? ""}
                        value={sf[field.key] ?? ""}
                        onChange={e => setSf(p => ({ ...p, [field.key]: e.target.value }))}
                        autoComplete="off"
                      />
                      {field.sensitive && (
                        <button
                          type="button"
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          onClick={() => setShowSecret(s => ({ ...s, [field.key]: !s[field.key] }))}
                        >
                          {showSecret[field.key] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      )}
                    </div>
                    {field.hint && <p className="text-[10px] text-gray-400 mt-1">{field.hint}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fallback */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h3 className="font-semibold text-[#0f2044] text-sm flex items-center gap-2 mb-4">
              <RefreshCw size={14} className="text-[#c9a227]" /> Fallback Settings
            </h3>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-700">Fallback to WhatsApp Web</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  When API delivery fails, open a wa.me link so staff can send the message manually instead of silently failing.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSf(p => ({ ...p, whatsapp_fallback_web: p.whatsapp_fallback_web === "true" ? "false" : "true" }))}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  sf.whatsapp_fallback_web === "true"
                    ? "bg-green-100 text-green-700 border border-green-200"
                    : "bg-gray-100 text-gray-500 border border-gray-200"
                }`}
              >
                {sf.whatsapp_fallback_web === "true"
                  ? <><ToggleRight size={14} /> Enabled</>
                  : <><ToggleLeft  size={14} /> Disabled</>}
              </button>
            </div>
          </div>

          {/* Result banner */}
          {connResult && (
            <div className={`flex items-start gap-2 text-sm px-4 py-3 rounded-xl border ${
              connResult.ok
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}>
              {connResult.ok
                ? <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
                : <AlertCircle  size={16} className="mt-0.5 shrink-0" />}
              {connResult.message}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pb-2">
            {sf.whatsapp_provider && sf.whatsapp_provider !== "web" && (
              <button
                type="button"
                onClick={handleTestConn}
                disabled={testingConn}
                className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {testingConn
                  ? <><Loader2 size={14} className="animate-spin" /> Testing…</>
                  : <><Zap size={14} className="text-[#c9a227]" /> Test Connection</>}
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={saveSettings.isPending}
              className="flex items-center gap-2 px-5 py-2 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white rounded-xl text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {saveSettings.isPending
                ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                : <><Save size={14} /> Save Settings</>}
            </button>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
