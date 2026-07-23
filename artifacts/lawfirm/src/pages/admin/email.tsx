import { useState, useEffect, useRef } from "react";
import {
  Mail, Settings, FileText, History, Send, Plus, Pencil, Trash2,
  X, Check, Eye, EyeOff, RefreshCw, ChevronDown, Copy,
  CheckCircle, XCircle, Clock, AlertCircle, Inbox,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";

// ── Types ─────────────────────────────────────────────────────────────────────
interface SmtpSettings { host: string; port: string; secure: string; user: string; pass: string; fromName: string; fromEmail: string; replyTo: string; }
interface Template { id: number; name: string; subject: string; htmlBody: string; type: string; isActive: boolean; createdAt: string; }
interface EmailLog { id: number; toEmail: string; toName: string | null; subject: string; type: string; status: string; errorMsg: string | null; messageId: string | null; sentAt: string | null; openedAt: string | null; createdAt: string; leadId: number | null; invoiceId: number | null; }
interface Lead { id: number; name: string; email: string; serviceInterest: string; }
interface Invoice { id: number; number: string; clientName: string; clientEmail: string | null; total: string; }

const TAB_ICONS: Record<string, React.ElementType> = { settings: Settings, templates: FileText, compose: Send, history: History };

const TEMPLATE_TYPES = [
  { value: "invoice", label: "Invoice" },
  { value: "quotation", label: "Quotation" },
  { value: "reminder", label: "Payment Reminder" },
  { value: "welcome", label: "Welcome" },
  { value: "followup", label: "Follow-up" },
  { value: "custom", label: "Custom" },
];

const VARIABLES = [
  { key: "firm_name", desc: "Your firm name" },
  { key: "firm_email", desc: "Firm email" },
  { key: "firm_phone", desc: "Firm phone" },
  { key: "client_name", desc: "Client full name" },
  { key: "client_email", desc: "Client email" },
  { key: "client_company", desc: "Client company" },
  { key: "invoice_number", desc: "Invoice number" },
  { key: "invoice_total", desc: "Invoice total amount" },
  { key: "invoice_due", desc: "Due date" },
  { key: "service_name", desc: "Service requested" },
  { key: "year", desc: "Current year" },
];

function toast(msg: string, type: "success" | "error" = "success") {
  const el = document.createElement("div");
  el.className = `fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-sm font-medium text-white transition-all duration-300 ${type === "success" ? "bg-green-600" : "bg-red-600"}`;
  el.innerHTML = `<span>${type === "success" ? "✓" : "✗"}</span><span>${msg}</span>`;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; setTimeout(() => el.remove(), 300); }, 3000);
}

// ── Status Badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status, opened }: { status: string; opened: boolean }) {
  const cfg: Record<string, { label: string; icon: React.ElementType; cls: string }> = {
    sent: { label: opened ? "Opened" : "Sent", icon: opened ? CheckCircle : Check, cls: opened ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700" },
    failed: { label: "Failed", icon: XCircle, cls: "bg-red-100 text-red-700" },
    queued: { label: "Queued", icon: Clock, cls: "bg-yellow-100 text-yellow-700" },
  };
  const c = cfg[status] ?? { label: status, icon: AlertCircle, cls: "bg-gray-100 text-gray-600" };
  const Icon = c.icon;
  return <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${c.cls}`}><Icon size={11} />{c.label}</span>;
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function AdminEmail() {
  const [tab, setTab] = useState<"settings" | "templates" | "compose" | "history">("settings");

  // Settings
  const [smtp, setSmtp] = useState<SmtpSettings>({ host: "", port: "587", secure: "false", user: "", pass: "", fromName: "", fromEmail: "", replyTo: "" });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [testLoading, setTestLoading] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<Template[]>([]);
  const [editTmpl, setEditTmpl] = useState<Partial<Template> | null>(null);
  const [tmplPreview, setTmplPreview] = useState<Template | null>(null);
  const [savingTmpl, setSavingTmpl] = useState(false);

  // Compose
  const [compose, setCompose] = useState({ toEmail: "", toName: "", subject: "", htmlBody: "", type: "custom", templateId: "", leadId: "", invoiceId: "" });
  const [showPreview, setShowPreview] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sending, setSending] = useState(false);

  // History
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [logFilter, setLogFilter] = useState({ status: "", type: "", search: "" });
  const [logsLoading, setLogsLoading] = useState(false);

  // Load on tab switch
  useEffect(() => {
    if (tab === "settings") {
      fetch("/api/admin/email/settings").then(r => r.json()).then(d => setSmtp(d));
    } else if (tab === "templates") {
      fetch("/api/admin/email/templates").then(r => r.json()).then(d => setTemplates(d));
    } else if (tab === "compose") {
      fetch("/api/admin/email/templates").then(r => r.json()).then(d => setTemplates(d));
      fetch("/api/admin/leads?limit=100").then(r => r.json()).then(d => setLeads(Array.isArray(d) ? d.slice(0, 100) : []));
      fetch("/api/admin/invoices?type=invoice&limit=100").then(r => r.json()).then(d => setInvoices(Array.isArray(d) ? d.slice(0, 100) : []));
    } else if (tab === "history") {
      loadLogs();
    }
  }, [tab]);

  const loadLogs = async () => {
    setLogsLoading(true);
    const params = new URLSearchParams();
    if (logFilter.status) params.set("status", logFilter.status);
    if (logFilter.type) params.set("type", logFilter.type);
    if (logFilter.search) params.set("search", logFilter.search);
    const rows = await fetch(`/api/admin/email/logs?${params}`).then(r => r.json());
    setLogs(Array.isArray(rows) ? rows : []);
    setLogsLoading(false);
  };

  const saveSmtp = async () => {
    setSmtpLoading(true);
    const r = await fetch("/api/admin/email/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(smtp) });
    setSmtpLoading(false);
    if (r.ok) toast("SMTP settings saved successfully");
    else toast("Failed to save settings", "error");
  };

  const testSmtp = async () => {
    if (!testEmail) { toast("Enter a test email address", "error"); return; }
    setTestLoading(true);
    const r = await fetch("/api/admin/email/settings/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toEmail: testEmail }) });
    const d = await r.json();
    setTestLoading(false);
    if (r.ok) toast("Test email sent successfully! Check your inbox.");
    else toast(d.error ?? "Test failed", "error");
  };

  const saveTmpl = async () => {
    if (!editTmpl?.name || !editTmpl.subject || !editTmpl.htmlBody) { toast("Name, subject and body required", "error"); return; }
    setSavingTmpl(true);
    const isEdit = !!editTmpl.id;
    const r = isEdit
      ? await fetch(`/api/admin/email/templates/${editTmpl.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editTmpl) })
      : await fetch("/api/admin/email/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editTmpl) });
    setSavingTmpl(false);
    if (r.ok) {
      toast(`Template ${isEdit ? "updated" : "created"}`);
      setEditTmpl(null);
      fetch("/api/admin/email/templates").then(res => res.json()).then(d => setTemplates(d));
    } else toast("Save failed", "error");
  };

  const deleteTmpl = async (id: number) => {
    if (!confirm("Delete this template?")) return;
    await fetch(`/api/admin/email/templates/${id}`, { method: "DELETE" });
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast("Template deleted");
  };

  const applyTemplate = (tmpl: Template) => {
    setCompose(c => ({ ...c, subject: tmpl.subject, htmlBody: tmpl.htmlBody, type: tmpl.type, templateId: String(tmpl.id) }));
  };

  const sendEmail = async () => {
    if (!compose.toEmail || !compose.subject) { toast("Recipient and subject required", "error"); return; }
    setSending(true);
    const r = await fetch("/api/admin/email/send", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...compose, templateId: compose.templateId ? parseInt(compose.templateId) : undefined, leadId: compose.leadId ? parseInt(compose.leadId) : undefined, invoiceId: compose.invoiceId ? parseInt(compose.invoiceId) : undefined }) });
    const d = await r.json();
    setSending(false);
    if (r.ok) { toast("Email sent successfully!"); setCompose({ toEmail: "", toName: "", subject: "", htmlBody: "", type: "custom", templateId: "", leadId: "", invoiceId: "" }); }
    else toast(d.error ?? "Send failed", "error");
  };

  const copyVar = (key: string) => { navigator.clipboard.writeText(`{{${key}}}`); toast(`Copied {{${key}}}`, "success"); };

  const fmtTime = (d: string) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true });

  return (
    <AdminLayout title="Email" subtitle="SMTP settings, templates, compose and history">
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-2xl p-1 w-fit">
        {(["settings", "templates", "compose", "history"] as const).map(t => {
          const Icon = TAB_ICONS[t];
          return (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${tab === t ? "bg-white shadow text-[#0f2044]" : "text-gray-500 hover:text-gray-700"}`}>
              <Icon size={14} />{t}
            </button>
          );
        })}
      </div>

      {/* ── SETTINGS TAB ─────────────────────────────────────────────────────── */}
      {tab === "settings" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#0f2044] mb-5 flex items-center gap-2"><Settings size={16} />SMTP Configuration</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="label-sm">SMTP Host</label>
                <input value={smtp.host} onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))} placeholder="smtp.gmail.com" className="input-field" />
              </div>
              <div>
                <label className="label-sm">Port</label>
                <input value={smtp.port} onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))} placeholder="587" className="input-field" />
              </div>
              <div className="flex items-center gap-3 pt-5">
                <input type="checkbox" id="secure" checked={smtp.secure === "true"} onChange={e => setSmtp(s => ({ ...s, secure: e.target.checked ? "true" : "false" }))} className="w-4 h-4 accent-[#0f2044]" />
                <label htmlFor="secure" className="text-sm text-gray-600">Use SSL/TLS (port 465)</label>
              </div>
              <div>
                <label className="label-sm">SMTP Username</label>
                <input value={smtp.user} onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))} placeholder="your@gmail.com" className="input-field" />
              </div>
              <div>
                <label className="label-sm">Password / App Password</label>
                <div className="relative">
                  <input type={showPass ? "text" : "password"} value={smtp.pass} onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))} placeholder="App password" className="input-field pr-10" />
                  <button onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">{showPass ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                </div>
              </div>
              <div>
                <label className="label-sm">From Name</label>
                <input value={smtp.fromName} onChange={e => setSmtp(s => ({ ...s, fromName: e.target.value }))} placeholder="Vakil & Co." className="input-field" />
              </div>
              <div>
                <label className="label-sm">From Email</label>
                <input value={smtp.fromEmail} onChange={e => setSmtp(s => ({ ...s, fromEmail: e.target.value }))} placeholder="info@vakilco.com" className="input-field" />
              </div>
              <div className="col-span-2">
                <label className="label-sm">Reply-To (optional)</label>
                <input value={smtp.replyTo} onChange={e => setSmtp(s => ({ ...s, replyTo: e.target.value }))} placeholder="replies@vakilco.com" className="input-field" />
              </div>
            </div>
            <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
              <button onClick={saveSmtp} disabled={smtpLoading} className="btn-primary flex items-center gap-2">{smtpLoading ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}Save Settings</button>
            </div>
          </div>

          <div className="space-y-4">
            {/* Test email */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-[#0f2044] text-sm mb-3 flex items-center gap-2"><Mail size={14} />Test Connection</h3>
              <p className="text-xs text-gray-400 mb-3">Send a test email to verify your SMTP settings are working.</p>
              <input value={testEmail} onChange={e => setTestEmail(e.target.value)} placeholder="your@email.com" className="input-field mb-3" />
              <button onClick={testSmtp} disabled={testLoading} className="w-full btn-primary flex items-center justify-center gap-2 text-sm">{testLoading ? <><RefreshCw size={13} className="animate-spin" />Sending…</> : <><Send size={13} />Send Test Email</>}</button>
            </div>

            {/* Provider guide */}
            <div className="bg-[#0f2044] text-white rounded-2xl p-5">
              <h3 className="font-semibold text-sm mb-3 text-[#c9a227]">📧 Common SMTP Settings</h3>
              {[
                { name: "Gmail", host: "smtp.gmail.com", port: "587", note: "Use App Password" },
                { name: "Outlook", host: "smtp-mail.outlook.com", port: "587", note: "Use account password" },
                { name: "Yahoo", host: "smtp.mail.yahoo.com", port: "587", note: "Use App Password" },
                { name: "SendGrid", host: "smtp.sendgrid.net", port: "587", note: "Use API key" },
              ].map(p => (
                <div key={p.name} className="mb-3 last:mb-0">
                  <div className="text-xs font-bold text-white/80">{p.name}</div>
                  <div className="text-[11px] text-white/50">{p.host} · Port {p.port}</div>
                  <div className="text-[10px] text-[#c9a227]/70">⚡ {p.note}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATES TAB ────────────────────────────────────────────────────── */}
      {tab === "templates" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#0f2044]">Email Templates <span className="text-gray-400 font-normal text-sm">({templates.length})</span></h2>
              <button onClick={() => setEditTmpl({ type: "custom", isActive: true })} className="btn-primary flex items-center gap-2 text-sm"><Plus size={14} />New Template</button>
            </div>
            <div className="space-y-3">
              {templates.map(t => (
                <div key={t.id} className={`bg-white rounded-2xl border p-4 flex gap-4 items-start transition-all ${!t.isActive ? "opacity-50" : "border-gray-100 hover:border-[#c9a227]/40"}`}>
                  <div className="w-10 h-10 rounded-xl bg-[#0f2044] flex items-center justify-center shrink-0">
                    <FileText size={16} className="text-[#c9a227]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-semibold text-[#0f2044] text-sm">{t.name}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0f2044]/10 text-[#0f2044] font-medium capitalize">{t.type}</span>
                      {!t.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                    </div>
                    <div className="text-xs text-gray-500 truncate">Subject: {t.subject}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setTmplPreview(t)} className="p-2 text-gray-400 hover:text-[#0f2044] hover:bg-gray-100 rounded-lg transition-colors" title="Preview"><Eye size={14} /></button>
                    <button onClick={() => setEditTmpl(t)} className="p-2 text-gray-400 hover:text-[#0f2044] hover:bg-gray-100 rounded-lg transition-colors" title="Edit"><Pencil size={14} /></button>
                    <button onClick={() => deleteTmpl(t.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                  <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400">No templates yet. Create one to get started.</p>
                </div>
              )}
            </div>
          </div>

          {/* Variables reference */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 h-fit">
            <h3 className="font-semibold text-[#0f2044] text-sm mb-3">Available Variables</h3>
            <p className="text-xs text-gray-400 mb-3">Click to copy. Use in subject and body.</p>
            <div className="space-y-1.5">
              {VARIABLES.map(v => (
                <button key={v.key} onClick={() => copyVar(v.key)} className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors group text-left">
                  <code className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[#0f2044] shrink-0">{`{{${v.key}}}`}</code>
                  <span className="text-xs text-gray-500 flex-1 truncate">{v.desc}</span>
                  <Copy size={10} className="text-gray-300 group-hover:text-gray-500 shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── COMPOSE TAB ──────────────────────────────────────────────────────── */}
      {tab === "compose" && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-bold text-[#0f2044] mb-5 flex items-center gap-2"><Send size={16} />Compose Email</h2>
            <div className="space-y-4">
              {/* Template selector */}
              <div>
                <label className="label-sm">Use Template (optional)</label>
                <select value={compose.templateId} onChange={e => { const t = templates.find(t => String(t.id) === e.target.value); if (t) applyTemplate(t); setCompose(c => ({ ...c, templateId: e.target.value })); }} className="input-field">
                  <option value="">— Select template —</option>
                  {templates.filter(t => t.isActive).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">To Email *</label>
                  <input value={compose.toEmail} onChange={e => setCompose(c => ({ ...c, toEmail: e.target.value }))} placeholder="client@example.com" className="input-field" />
                </div>
                <div>
                  <label className="label-sm">Recipient Name</label>
                  <input value={compose.toName} onChange={e => setCompose(c => ({ ...c, toName: e.target.value }))} placeholder="Mr. Rahul Sharma" className="input-field" />
                </div>
              </div>
              <div>
                <label className="label-sm">Subject *</label>
                <input value={compose.subject} onChange={e => setCompose(c => ({ ...c, subject: e.target.value }))} placeholder="Email subject" className="input-field" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Attach Lead (for variables)</label>
                  <select value={compose.leadId} onChange={e => { const l = leads.find(l => String(l.id) === e.target.value); if (l && !compose.toEmail) setCompose(c => ({ ...c, leadId: e.target.value, toEmail: l.email, toName: l.name })); else setCompose(c => ({ ...c, leadId: e.target.value })); }} className="input-field">
                    <option value="">— Select lead —</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.name} ({l.email})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label-sm">Attach Invoice (for variables)</label>
                  <select value={compose.invoiceId} onChange={e => { const inv = invoices.find(i => String(i.id) === e.target.value); if (inv && !compose.toEmail && inv.clientEmail) setCompose(c => ({ ...c, invoiceId: e.target.value, toEmail: inv.clientEmail ?? "", toName: inv.clientName })); else setCompose(c => ({ ...c, invoiceId: e.target.value })); }} className="input-field">
                    <option value="">— Select invoice —</option>
                    {invoices.map(i => <option key={i.id} value={i.id}>{i.number} — {i.clientName}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label-sm">Email Body (HTML)</label>
                  <button onClick={() => setShowPreview(s => !s)} className="text-xs text-[#c9a227] flex items-center gap-1 hover:underline">{showPreview ? <><EyeOff size={11} />Hide Preview</> : <><Eye size={11} />Preview</>}</button>
                </div>
                {showPreview ? (
                  <div className="w-full h-64 border border-gray-200 rounded-xl overflow-hidden bg-white">
                    <iframe srcDoc={compose.htmlBody || "<p style='color:#aaa;padding:20px'>Start typing to preview…</p>"} className="w-full h-full" title="Email Preview" sandbox="allow-same-origin" />
                  </div>
                ) : (
                  <textarea value={compose.htmlBody} onChange={e => setCompose(c => ({ ...c, htmlBody: e.target.value }))} rows={10} placeholder="<p>Dear {{client_name}},</p><p>…</p>" className="input-field font-mono text-xs resize-y" />
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={sendEmail} disabled={sending || !compose.toEmail || !compose.subject} className="btn-primary flex items-center gap-2">{sending ? <><RefreshCw size={14} className="animate-spin" />Sending…</> : <><Send size={14} />Send Email</>}</button>
                <button onClick={() => setCompose({ toEmail: "", toName: "", subject: "", htmlBody: "", type: "custom", templateId: "", leadId: "", invoiceId: "" })} className="btn-secondary">Clear</button>
              </div>
            </div>
          </div>

          {/* Variables sidebar */}
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="font-semibold text-[#0f2044] text-sm mb-3">Variables</h3>
              <p className="text-xs text-gray-400 mb-3">These will be replaced with real data when sending.</p>
              <div className="space-y-1.5">
                {VARIABLES.map(v => (
                  <button key={v.key} onClick={() => copyVar(v.key)} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-gray-50 group text-left">
                    <code className="text-[10px] font-mono bg-gray-100 px-1.5 py-0.5 rounded text-[#0f2044] shrink-0">{`{{${v.key}}}`}</code>
                    <span className="text-[11px] text-gray-400 flex-1 truncate">{v.desc}</span>
                    <Copy size={10} className="text-gray-200 group-hover:text-gray-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#0f2044]/5 rounded-2xl p-4 text-xs text-gray-500 space-y-1.5">
              <p className="font-semibold text-[#0f2044]">💡 Tips</p>
              <p>• Select a template to pre-fill subject and body</p>
              <p>• Attach a lead to auto-fill recipient details</p>
              <p>• Variables are replaced server-side when sending</p>
              <p>• HTML is supported — use inline styles for best compatibility</p>
              <p>• Open tracking is automatically embedded</p>
            </div>
          </div>
        </div>
      )}

      {/* ── HISTORY TAB ──────────────────────────────────────────────────────── */}
      {tab === "history" && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <input value={logFilter.search} onChange={e => setLogFilter(f => ({ ...f, search: e.target.value }))} placeholder="Search by email…" className="input-field flex-1 min-w-[200px]" />
            <select value={logFilter.status} onChange={e => setLogFilter(f => ({ ...f, status: e.target.value }))} className="input-field w-36">
              <option value="">All status</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
            </select>
            <select value={logFilter.type} onChange={e => setLogFilter(f => ({ ...f, type: e.target.value }))} className="input-field w-36">
              <option value="">All types</option>
              {TEMPLATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <button onClick={loadLogs} className="btn-primary flex items-center gap-2 text-sm"><RefreshCw size={13} />Refresh</button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            {[
              { label: "Total Sent", count: logs.filter(l => l.status === "sent").length, icon: Mail, color: "bg-blue-50 text-blue-600" },
              { label: "Opened", count: logs.filter(l => l.openedAt).length, icon: CheckCircle, color: "bg-green-50 text-green-600" },
              { label: "Failed", count: logs.filter(l => l.status === "failed").length, icon: XCircle, color: "bg-red-50 text-red-600" },
              { label: "Open Rate", count: `${logs.filter(l => l.status === "sent").length > 0 ? Math.round(logs.filter(l => l.openedAt).length / logs.filter(l => l.status === "sent").length * 100) : 0}%`, icon: Eye, color: "bg-purple-50 text-purple-600" },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${s.color}`}><s.icon size={16} /></div>
                <div><div className="text-lg font-bold text-[#0f2044]">{s.count}</div><div className="text-xs text-gray-400">{s.label}</div></div>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {logsLoading ? (
              <div className="p-12 text-center text-gray-400">Loading email history…</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center">
                <Inbox size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">No emails sent yet</p>
                <p className="text-gray-300 text-xs">Send your first email from the Compose tab</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Recipient</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Subject</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Sent At</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#0f2044] text-sm">{log.toName ?? log.toEmail}</div>
                        {log.toName && <div className="text-xs text-gray-400">{log.toEmail}</div>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs max-w-[200px]">
                        <div className="truncate">{log.subject}</div>
                        {log.errorMsg && <div className="text-red-500 text-[10px] mt-0.5 truncate">⚠ {log.errorMsg}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 capitalize font-medium">{log.type}</span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={log.status} opened={!!log.openedAt} />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                        {log.sentAt ? fmtTime(log.sentAt) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={async () => { await fetch(`/api/admin/email/logs/${log.id}`, { method: "DELETE" }); setLogs(l => l.filter(x => x.id !== log.id)); }} className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg transition-colors"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── TEMPLATE EDIT MODAL ───────────────────────────────────────────────── */}
      {editTmpl !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-[#0f2044]">{editTmpl.id ? "Edit Template" : "New Template"}</h3>
              <button onClick={() => setEditTmpl(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label-sm">Template Name *</label>
                  <input value={editTmpl.name ?? ""} onChange={e => setEditTmpl(t => ({ ...t!, name: e.target.value }))} placeholder="Invoice Email" className="input-field" />
                </div>
                <div>
                  <label className="label-sm">Type</label>
                  <select value={editTmpl.type ?? "custom"} onChange={e => setEditTmpl(t => ({ ...t!, type: e.target.value }))} className="input-field">
                    {TEMPLATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label-sm">Subject *</label>
                <input value={editTmpl.subject ?? ""} onChange={e => setEditTmpl(t => ({ ...t!, subject: e.target.value }))} placeholder="Subject with {{variables}}" className="input-field" />
              </div>
              <div>
                <label className="label-sm">HTML Body *</label>
                <textarea value={editTmpl.htmlBody ?? ""} onChange={e => setEditTmpl(t => ({ ...t!, htmlBody: e.target.value }))} rows={12} placeholder="<p>Dear {{client_name}},</p>…" className="input-field font-mono text-xs resize-y" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="tmplActive" checked={editTmpl.isActive !== false} onChange={e => setEditTmpl(t => ({ ...t!, isActive: e.target.checked }))} className="w-4 h-4 accent-[#0f2044]" />
                <label htmlFor="tmplActive" className="text-sm text-gray-600">Active (visible in compose)</label>
              </div>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <button onClick={saveTmpl} disabled={savingTmpl} className="btn-primary flex items-center gap-2">{savingTmpl ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}Save Template</button>
              <button onClick={() => setEditTmpl(null)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── TEMPLATE PREVIEW MODAL ────────────────────────────────────────────── */}
      {tmplPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div><h3 className="font-bold text-[#0f2044]">{tmplPreview.name}</h3><p className="text-xs text-gray-400">Subject: {tmplPreview.subject}</p></div>
              <button onClick={() => setTmplPreview(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe srcDoc={tmplPreview.htmlBody} className="w-full h-full" title="Template Preview" sandbox="allow-same-origin" />
            </div>
          </div>
        </div>
      )}

      <style>{`
        .label-sm { @apply block text-xs font-semibold text-gray-600 mb-1; }
        .input-field { @apply w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 bg-white; }
        .btn-primary { @apply px-5 py-2.5 bg-[#0f2044] text-white text-sm font-semibold rounded-xl hover:bg-[#c9a227] hover:text-[#0f2044] transition-all disabled:opacity-50 disabled:cursor-not-allowed; }
        .btn-secondary { @apply px-4 py-2.5 border border-gray-200 text-sm rounded-xl hover:bg-gray-50 transition-colors text-gray-600; }
      `}</style>
    </AdminLayout>
  );
}
