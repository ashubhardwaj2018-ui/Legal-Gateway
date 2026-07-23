import { useState, useEffect } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Scale, LogOut, Briefcase, FileText, MessageSquare, ChevronRight,
  Clock, CheckCircle, AlertCircle, XCircle, Download, Send, Loader2,
  User, Building2, Phone, IndianRupee, Calendar, Bell, RefreshCw,
  Home, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClientInfo { email: string; name: string; company: string | null; }
interface Case { id: number; service: string; status: string; priority: string | null; assignedTo: string | null; nextFollowUp: string | null; lastContact: string | null; notes: string | null; createdAt: string; message: string | null; }
interface Invoice { id: number; number: string; status: string; subtotal: string | null; gstAmount: string | null; total: string | null; paidAmount: string | null; dueDate: string | null; items: unknown; notes: string | null; createdAt: string; }
interface Message { id: number; clientEmail: string; clientName: string | null; subject: string; message: string; isRead: string; createdAt: string; }

type Tab = "cases" | "invoices" | "messages";

// ── Status Helpers ─────────────────────────────────────────────────────────────
const CASE_STEPS = ["new", "contacted", "pending", "in_progress", "won", "completed"];
const STATUS_LABELS: Record<string, string> = { new: "New", contacted: "Contacted", pending: "Pending", in_progress: "In Progress", won: "Completed", lost: "Closed", hold: "On Hold", completed: "Completed" };
const STATUS_COLORS: Record<string, string> = { new: "bg-blue-100 text-blue-700", contacted: "bg-indigo-100 text-indigo-700", pending: "bg-yellow-100 text-yellow-700", in_progress: "bg-purple-100 text-purple-700", won: "bg-green-100 text-green-700", lost: "bg-gray-100 text-gray-600", hold: "bg-orange-100 text-orange-700", completed: "bg-green-100 text-green-700" };
const INV_STATUS: Record<string, { label: string; color: string }> = { draft: { label: "Draft", color: "bg-gray-100 text-gray-600" }, sent: { label: "Sent", color: "bg-blue-100 text-blue-700" }, partial: { label: "Partial", color: "bg-orange-100 text-orange-700" }, paid: { label: "Paid", color: "bg-green-100 text-green-700" }, overdue: { label: "Overdue", color: "bg-red-100 text-red-700" }, cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500" } };

function fmt(v: string | null) {
  if (!v) return "₹0";
  const n = parseFloat(v);
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string) { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }

// ── Invoice Print ─────────────────────────────────────────────────────────────
function printInvoice(inv: Invoice, clientName: string) {
  const items = Array.isArray(inv.items) ? inv.items as Array<{ description: string; qty: number; rate: number; gstRate: number; amount: number }> : [];
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>Invoice ${inv.number}</title>
<style>body{font-family:sans-serif;padding:32px;max-width:700px;margin:0 auto;color:#333}h1{color:#0f2044}table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#0f2044;color:#c9a227;padding:8px 12px;text-align:left;font-size:12px}td{padding:8px 12px;border-bottom:1px solid #f0f0f0;font-size:13px}.total{text-align:right;font-size:15px;margin-top:16px}.badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:11px;background:#e0fce7;color:#166534}</style>
</head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
  <div><h1 style="margin:0">Vakil & Co.</h1><p style="margin:4px 0;color:#888;font-size:13px">Legal Services</p></div>
  <div style="text-align:right"><div style="font-size:22px;font-weight:bold;color:#0f2044">INVOICE</div><div style="font-size:14px;color:#888">${inv.number}</div></div>
</div>
<div style="margin-bottom:16px"><strong>Billed To:</strong><br>${clientName}</div>
<div style="display:flex;gap:32px;margin-bottom:16px;font-size:13px;color:#666">
  <div><strong>Date:</strong> ${fmtDate(inv.createdAt)}</div>
  ${inv.dueDate ? `<div><strong>Due:</strong> ${fmtDate(inv.dueDate)}</div>` : ""}
  <div><strong>Status:</strong> <span class="badge">${inv.status.toUpperCase()}</span></div>
</div>
<table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>GST</th><th>Amount</th></tr></thead><tbody>
${items.map(it => `<tr><td>${it.description}</td><td>${it.qty}</td><td>₹${(+it.rate).toLocaleString("en-IN")}</td><td>${it.gstRate ?? 0}%</td><td>₹${(+it.amount).toLocaleString("en-IN")}</td></tr>`).join("")}
</tbody></table>
<div class="total">
  <div>Subtotal: ${fmt(inv.subtotal)}</div>
  <div>GST: ${fmt(inv.gstAmount)}</div>
  <div style="font-size:20px;font-weight:bold;color:#0f2044;margin-top:8px">Total: ${fmt(inv.total)}</div>
  ${inv.paidAmount && parseFloat(inv.paidAmount) > 0 ? `<div style="color:green">Paid: ${fmt(inv.paidAmount)}</div>` : ""}
</div>
${inv.notes ? `<div style="margin-top:24px;padding:12px;background:#f9f9f9;border-radius:8px;font-size:12px;color:#666"><strong>Notes:</strong> ${inv.notes}</div>` : ""}
<script>window.print();window.close()</script></body></html>`);
}

// ── Main Component ─────────────────────────────────────────────────────────────
export default function PortalDashboard() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const tokenFromUrl = params.get("token");

  const [token, setToken] = useState<string | null>(null);
  const [client, setClient] = useState<ClientInfo | null>(null);
  const [verifying, setVerifying] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const [tab, setTab] = useState<Tab>("cases");
  const [cases, setCases] = useState<Case[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [msgForm, setMsgForm] = useState({ subject: "", message: "" });
  const [msgSending, setMsgSending] = useState(false);
  const [msgSent, setMsgSent] = useState(false);

  // Verify token on mount
  useEffect(() => {
    const stored = localStorage.getItem("portal_token");
    const activeToken = tokenFromUrl ?? stored;
    if (!activeToken) { navigate("/portal"); return; }

    fetch(`/api/portal/verify?token=${activeToken}`)
      .then(r => r.json())
      .then(d => {
        if (d.ok) {
          localStorage.setItem("portal_token", activeToken);
          setToken(activeToken);
          setClient({ email: d.email, name: d.name, company: d.company });
          // clear token from URL
          if (tokenFromUrl) window.history.replaceState({}, "", "/portal/dashboard");
        } else {
          localStorage.removeItem("portal_token");
          setAuthError(d.error ?? "Session expired. Please request a new link.");
        }
        setVerifying(false);
      })
      .catch(() => { setAuthError("Network error. Please try again."); setVerifying(false); });
  }, []);

  // Fetch data when token/tab changes
  useEffect(() => {
    if (!token) return;
    const headers = { "X-Portal-Token": token };
    setDataLoading(true);
    const endpoints: Record<Tab, string> = { cases: "/api/portal/cases", invoices: "/api/portal/invoices", messages: "/api/portal/messages" };
    fetch(endpoints[tab], { headers })
      .then(r => r.json())
      .then(d => {
        if (tab === "cases") setCases(Array.isArray(d) ? d : []);
        else if (tab === "invoices") setInvoices(Array.isArray(d) ? d : []);
        else if (tab === "messages") setMessages(Array.isArray(d) ? d : []);
        setDataLoading(false);
      })
      .catch(() => setDataLoading(false));
  }, [token, tab]);

  const logout = () => { localStorage.removeItem("portal_token"); navigate("/portal"); };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgForm.subject || !msgForm.message || !token) return;
    setMsgSending(true);
    await fetch("/api/portal/message", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Portal-Token": token },
      body: JSON.stringify({ ...msgForm, clientName: client?.name }),
    });
    setMsgSending(false);
    setMsgSent(true);
    setMsgForm({ subject: "", message: "" });
    fetch("/api/portal/messages", { headers: { "X-Portal-Token": token } })
      .then(r => r.json()).then(d => setMessages(Array.isArray(d) ? d : []));
  };

  // ── Loading / Auth Error ───────────────────────────────────────────────────
  if (verifying) return (
    <div className="min-h-screen bg-[#0f2044] flex items-center justify-center">
      <div className="text-center text-white"><Loader2 size={32} className="animate-spin mx-auto mb-3 text-[#c9a227]" /><p className="text-white/50 text-sm">Verifying your access…</p></div>
    </div>
  );

  if (authError) return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a1628] to-[#0f2044] flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <XCircle size={48} className="text-red-400 mx-auto mb-4" />
        <h2 className="text-white text-xl font-bold mb-2">Session Expired</h2>
        <p className="text-white/50 text-sm mb-6">{authError}</p>
        <button onClick={() => navigate("/portal")} className="bg-[#c9a227] text-[#0f2044] font-bold px-8 py-3 rounded-xl hover:bg-[#e0b83a] transition-all">Request New Link</button>
      </div>
    </div>
  );

  const outstanding = invoices.reduce((s, i) => s + Math.max(0, parseFloat(i.total ?? "0") - parseFloat(i.paidAmount ?? "0")), 0);
  const overdue = invoices.filter(i => i.dueDate && i.dueDate < new Date().toISOString().slice(0,10) && i.status !== "paid" && i.status !== "cancelled").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Top Bar ────────────────────────────────────────────────────── */}
      <header className="bg-[#0f2044] px-6 py-3 flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-8 h-8 bg-[#c9a227] rounded-xl flex items-center justify-center shrink-0">
            <Scale size={15} className="text-[#0f2044]" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">Vakil & Co.</div>
            <div className="text-[#c9a227]/60 text-[9px] uppercase tracking-wider">Client Portal</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block text-right">
            <div className="text-white text-sm font-semibold">{client?.name}</div>
            <div className="text-white/40 text-xs">{client?.email}</div>
          </div>
          <div className="w-8 h-8 bg-white/10 rounded-xl flex items-center justify-center text-white/60 text-xs font-bold">{client?.name?.charAt(0).toUpperCase()}</div>
          <button onClick={logout} title="Sign out" className="p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/10"><LogOut size={15} /></button>
        </div>
      </header>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 space-y-5">
        {/* ── Welcome + Summary ──────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-[#0f2044] to-[#1a3a6e] rounded-2xl p-6 text-white">
          <h1 className="text-xl font-bold mb-0.5">Welcome back, {client?.name?.split(" ")[0]} 👋</h1>
          {client?.company && <p className="text-white/50 text-sm">{client.company}</p>}
          <div className="grid grid-cols-3 gap-4 mt-5">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-[#c9a227]">{cases.length || "—"}</div>
              <div className="text-white/50 text-xs mt-0.5">Active Cases</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className="text-2xl font-bold text-[#c9a227]">{invoices.length || "—"}</div>
              <div className="text-white/50 text-xs mt-0.5">Invoices</div>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <div className={`text-2xl font-bold ${outstanding > 0 ? "text-orange-300" : "text-green-300"}`}>{outstanding > 0 ? fmt(String(outstanding.toFixed(2))) : "Clear"}</div>
              <div className="text-white/50 text-xs mt-0.5">Outstanding</div>
            </div>
          </div>
        </div>

        {overdue > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span className="text-red-700 text-sm font-medium">You have {overdue} overdue invoice{overdue > 1 ? "s" : ""}. Please make payment at the earliest.</span>
          </div>
        )}

        {/* ── Tabs ───────────────────────────────────────────────────── */}
        <div className="flex gap-1 bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm w-fit">
          {([
            ["cases", "My Cases", Briefcase],
            ["invoices", "Invoices", FileText],
            ["messages", "Contact Firm", MessageSquare],
          ] as [Tab, string, React.ElementType][]).map(([t, l, Icon]) => (
            <button key={t} onClick={() => setTab(t)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${tab===t?"bg-[#0f2044] text-white shadow-sm":"text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
              <Icon size={14} />{l}
            </button>
          ))}
        </div>

        {/* ── CASES TAB ──────────────────────────────────────────────── */}
        {tab === "cases" && (
          <div className="space-y-4">
            {dataLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><Loader2 size={24} className="animate-spin text-[#c9a227] mx-auto" /></div>
            ) : cases.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Briefcase size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No cases found</p>
                <p className="text-gray-300 text-sm">Your consultation requests will appear here</p>
              </div>
            ) : (
              cases.map(c => {
                const stepIdx = CASE_STEPS.indexOf(c.status);
                const progressPct = stepIdx >= 0 ? Math.round(((stepIdx + 1) / CASE_STEPS.length) * 100) : 0;
                return (
                  <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-5 hover:border-[#c9a227]/30 transition-all shadow-sm">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[#0f2044] text-base">{c.service}</h3>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>{STATUS_LABELS[c.status] ?? c.status}</span>
                          {c.priority === "high" && <span className="text-[10px] px-2.5 py-0.5 rounded-full font-semibold bg-red-50 text-red-600">High Priority</span>}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">Opened {fmtDate(c.createdAt)}</div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    {stepIdx >= 0 && (
                      <div className="mb-4">
                        <div className="flex justify-between text-[10px] text-gray-400 mb-1.5">
                          <span>Progress</span>
                          <span>{progressPct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-[#0f2044] to-[#c9a227] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                        </div>
                        <div className="flex justify-between mt-1.5">
                          {CASE_STEPS.filter(s => s !== "won").map((step, i) => (
                            <div key={step} className={`text-[9px] font-medium capitalize ${i <= stepIdx ? "text-[#0f2044]" : "text-gray-300"}`}>
                              {step.replace("_", " ")}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                      {c.assignedTo && <div className="flex items-center gap-1.5"><User size={11} className="text-gray-300" />Handled by: <span className="font-medium text-gray-700">{c.assignedTo}</span></div>}
                      {c.nextFollowUp && <div className="flex items-center gap-1.5"><Calendar size={11} className="text-gray-300" />Next follow-up: <span className="font-medium text-gray-700">{fmtDate(c.nextFollowUp)}</span></div>}
                      {c.lastContact && <div className="flex items-center gap-1.5"><Clock size={11} className="text-gray-300" />Last contact: <span className="font-medium text-gray-700">{fmtDate(c.lastContact)}</span></div>}
                    </div>

                    {c.notes && (
                      <div className="mt-3 pt-3 border-t border-gray-50">
                        <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Latest Update</div>
                        <p className="text-sm text-gray-600">{c.notes}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── INVOICES TAB ───────────────────────────────────────────── */}
        {tab === "invoices" && (
          <div className="space-y-4">
            {dataLoading ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center"><Loader2 size={24} className="animate-spin text-[#c9a227] mx-auto" /></div>
            ) : invoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No invoices yet</p>
                <p className="text-gray-300 text-sm">Your invoices will appear here once raised</p>
              </div>
            ) : (
              invoices.map(inv => {
                const outstanding = Math.max(0, parseFloat(inv.total ?? "0") - parseFloat(inv.paidAmount ?? "0"));
                const isOverdue = !!inv.dueDate && inv.dueDate < new Date().toISOString().slice(0, 10) && inv.status !== "paid";
                const statusKey = isOverdue ? "overdue" : inv.status;
                const statusCfg = INV_STATUS[statusKey] ?? INV_STATUS.draft;
                return (
                  <div key={inv.id} className={`bg-white rounded-2xl border p-5 hover:shadow-sm transition-all ${isOverdue ? "border-red-200" : "border-gray-100"}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-[#0f2044]">{inv.number}</h3>
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">Issued {fmtDate(inv.createdAt)}{inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}</div>
                      </div>
                      <button onClick={() => printInvoice(inv, client?.name ?? "")} title="Download / Print" className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-[#0f2044] hover:text-white hover:border-[#0f2044] transition-all font-medium">
                        <Download size={12} />Download
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <div className="text-xs text-gray-400">Subtotal</div>
                        <div className="font-semibold text-gray-700 text-sm mt-0.5">{fmt(inv.subtotal)}</div>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 text-center">
                        <div className="text-xs text-gray-400">GST</div>
                        <div className="font-semibold text-gray-700 text-sm mt-0.5">{fmt(inv.gstAmount)}</div>
                      </div>
                      <div className={`rounded-xl p-3 text-center ${inv.status === "paid" ? "bg-green-50" : "bg-[#0f2044]/5"}`}>
                        <div className="text-xs text-gray-400">Total</div>
                        <div className={`font-bold text-sm mt-0.5 ${inv.status === "paid" ? "text-green-700" : "text-[#0f2044]"}`}>{fmt(inv.total)}</div>
                      </div>
                    </div>

                    {outstanding > 0 && (
                      <div className={`mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl ${isOverdue ? "bg-red-50" : "bg-orange-50"}`}>
                        <div className={`text-xs font-medium ${isOverdue ? "text-red-700" : "text-orange-700"}`}>
                          {isOverdue ? "⚠️ Overdue Amount" : "Balance Due"}
                        </div>
                        <div className={`font-bold text-sm ${isOverdue ? "text-red-700" : "text-orange-700"}`}>{fmt(String(outstanding))}</div>
                      </div>
                    )}

                    {inv.notes && <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">{inv.notes}</p>}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ── MESSAGES TAB ───────────────────────────────────────────── */}
        {tab === "messages" && (
          <div className="space-y-4">
            {/* Compose form */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-[#0f2044] mb-1 flex items-center gap-2"><Send size={15} />Send Message to the Firm</h3>
              <p className="text-xs text-gray-400 mb-5">Our team usually responds within 1 business day.</p>
              {msgSent ? (
                <div className="text-center py-6">
                  <CheckCircle size={36} className="text-green-500 mx-auto mb-3" />
                  <div className="font-semibold text-gray-700">Message sent successfully!</div>
                  <div className="text-sm text-gray-400 mt-1">Our team will get back to you shortly.</div>
                  <button onClick={() => setMsgSent(false)} className="mt-4 text-sm text-[#c9a227] hover:underline">Send another message</button>
                </div>
              ) : (
                <form onSubmit={sendMessage} className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1.5">Subject *</label>
                    <input value={msgForm.subject} onChange={e => setMsgForm(m => ({ ...m, subject: e.target.value }))} placeholder="e.g. Status update on trademark registration" required className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 block mb-1.5">Message *</label>
                    <textarea value={msgForm.message} onChange={e => setMsgForm(m => ({ ...m, message: e.target.value }))} placeholder="Write your message here…" rows={5} required className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 resize-none" />
                  </div>
                  <button type="submit" disabled={msgSending} className="flex items-center gap-2 bg-[#0f2044] text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#c9a227] hover:text-[#0f2044] transition-all disabled:opacity-50">
                    {msgSending ? <><Loader2 size={14} className="animate-spin" />Sending…</> : <><Send size={14} />Send Message</>}
                  </button>
                </form>
              )}
            </div>

            {/* Message history */}
            {messages.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="font-bold text-[#0f2044] text-sm mb-4">Message History</h3>
                <div className="space-y-3">
                  {messages.map(m => (
                    <div key={m.id} className="flex gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="w-8 h-8 bg-[#0f2044] rounded-full flex items-center justify-center text-[#c9a227] text-xs font-bold shrink-0">{client?.name?.charAt(0) ?? "U"}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-700 text-sm">{m.subject}</span>
                          <span className="text-gray-400 text-[10px] whitespace-nowrap">{fmtDate(m.createdAt)}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{m.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="text-center py-4 text-gray-300 text-xs border-t border-gray-100">
        Vakil & Co. Client Portal · Secure & Confidential
      </footer>
    </div>
  );
}
