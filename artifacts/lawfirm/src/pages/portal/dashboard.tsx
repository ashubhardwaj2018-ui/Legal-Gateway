import { useState, useEffect, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import {
  Scale, LogOut, Briefcase, FileText, MessageSquare, ChevronRight,
  Clock, CheckCircle, AlertCircle, XCircle, Download, Send, Loader2,
  User, IndianRupee, Calendar, Upload, Paperclip, Check, X,
  FileQuestion, Activity, ThumbsUp, ThumbsDown, ExternalLink,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────
interface ClientInfo { email: string; name: string; company: string | null; }
interface Case { id: number; name: string; service: string; status: string; priority: string | null; assignedTo: string | null; nextFollowUp: string | null; notes: string | null; createdAt: string; message: string | null; }
interface Invoice { id: number; number: string; status: string; subtotal: string | null; gstAmount: string | null; total: string | null; paidAmount: string | null; dueDate: string | null; items: unknown; notes: string | null; createdAt: string; }
interface Quotation { id: number; quotationNumber: string; clientName: string; items: unknown; subtotal: number; taxPercent: number; taxAmount: number; total: number; status: string; notes: string | null; validityDays: number; sentAt: string | null; acceptedAt: string | null; rejectedAt: string | null; rejectedReason: string | null; createdAt: string; }
interface PortalDoc { id: number; leadId: number; clientEmail: string; fileName: string; fileUrl: string; fileSize: number; mimeType: string; uploadedAt: string; }
interface ChatMsg { id: number; leadId: number; clientEmail: string; senderType: string; senderName: string; message: string; createdAt: string; }
interface TimelineItem { id: number; type: string; actionType: string; description: string; actor: string; createdAt: string; }

type Tab = "cases" | "quotations" | "invoices" | "documents" | "chat" | "progress" | "profile";

// ── Helpers ───────────────────────────────────────────────────────────────────
const CASE_STEPS = ["new", "contacted", "qualified", "proposal", "negotiation", "won"];
const STATUS_LABELS: Record<string, string> = { new: "New", contacted: "Contacted", qualified: "Qualified", pending: "Pending", proposal: "Proposal Sent", negotiation: "Under Review", in_progress: "In Progress", won: "Completed", lost: "Closed", hold: "On Hold", completed: "Completed" };
const STATUS_COLORS: Record<string, string> = { new: "bg-blue-100 text-blue-700", contacted: "bg-indigo-100 text-indigo-700", qualified: "bg-violet-100 text-violet-700", pending: "bg-yellow-100 text-yellow-700", proposal: "bg-amber-100 text-amber-700", negotiation: "bg-orange-100 text-orange-700", in_progress: "bg-purple-100 text-purple-700", won: "bg-green-100 text-green-700", lost: "bg-gray-100 text-gray-600", hold: "bg-orange-100 text-orange-700", completed: "bg-green-100 text-green-700" };
const INV_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600" },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-700" },
  partial: { label: "Partial", color: "bg-orange-100 text-orange-700" },
  paid: { label: "Paid", color: "bg-green-100 text-green-700" },
  payment_confirmed: { label: "Payment Confirmed", color: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "Overdue", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-500" },
};
const QUOT_STATUS: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-gray-100 text-gray-600" },
  sent: { label: "Awaiting Response", color: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-700" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-500" },
};

function fmt(v: string | number | null) {
  if (v === null || v === undefined) return "₹0";
  const n = typeof v === "string" ? parseFloat(v) : v;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function fmtDateTime(d: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" }) + " " +
    dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function timeSince(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

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

function printPortalQuotation(q: Quotation) {
  // Items may be stored as { serviceName, description, quantity, unitPrice, total } or similar
  const rawItems = Array.isArray(q.items) ? q.items as Array<Record<string, unknown>> : [];
  const rows = rawItems.map((it, i) => {
    const name = String(it.serviceName ?? it.description ?? "—");
    const desc = it.serviceName && it.description ? String(it.description) : "";
    const qty = Number(it.quantity ?? it.qty ?? 1);
    const price = Number(it.unitPrice ?? it.rate ?? 0);
    const amt = Number(it.total ?? it.amount ?? (qty * price));
    return `<tr>
      <td>${i + 1}</td>
      <td style="text-align:left"><strong>${name}</strong>${desc ? `<br><span style="font-size:10px;color:#888">${desc}</span>` : ""}</td>
      <td>${qty}</td>
      <td>₹${price.toLocaleString("en-IN")}</td>
      <td>₹${amt.toLocaleString("en-IN")}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Quotation — ${q.quotationNumber}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f2044; padding-bottom: 16px; margin-bottom: 16px; }
  .firm-name { font-size: 22px; font-weight: 900; color: #0f2044; letter-spacing: 1px; }
  .firm-sub { color: #c9a227; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin: 2px 0 6px; }
  .firm-addr { color: #555; font-size: 11px; line-height: 1.5; }
  .doc-box { text-align: right; }
  .doc-type { font-size: 18px; font-weight: 700; color: #0f2044; text-transform: uppercase; letter-spacing: 1px; }
  .doc-num { font-size: 13px; font-weight: 700; color: #c9a227; margin: 4px 0; }
  .doc-meta { font-size: 11px; color: #555; line-height: 1.8; }
  .bill-box { background: #f7f7f7; border-radius: 6px; padding: 12px 14px; border-left: 3px solid #0f2044; margin: 16px 0; }
  .bill-box h4 { font-size: 10px; color: #c9a227; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  table th { background: #0f2044; color: #fff; padding: 8px 6px; font-size: 11px; text-align: right; }
  table th:first-child, table th:nth-child(2) { text-align: left; }
  table td { padding: 7px 6px; font-size: 11px; text-align: right; border-bottom: 1px solid #eee; }
  table td:first-child, table td:nth-child(2) { text-align: left; }
  table tr:nth-child(even) td { background: #fafafa; }
  .totals { width: 240px; margin-left: auto; margin-top: 8px; }
  .totals tr td { padding: 4px 8px; font-size: 12px; }
  .totals tr td:first-child { color: #555; }
  .totals tr td:last-child { text-align: right; font-weight: 600; }
  .total-row td { font-size: 14px; font-weight: 900; color: #0f2044; border-top: 2px solid #0f2044; padding-top: 8px; }
  .footer { margin-top: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .notes { flex: 1; font-size: 11px; color: #555; line-height: 1.6; }
  .sign { text-align: center; min-width: 120px; }
  .sign-line { border-top: 1px solid #333; width: 120px; margin: 40px auto 4px; }
  .sign p { font-size: 10px; color: #555; }
  @media print { body { padding: 10px; } }
</style></head><body>
<div class="header">
  <div>
    <div class="firm-name">Vakil &amp; Co.</div>
    <div class="firm-sub">Advocates &amp; Legal Consultants</div>
    <div class="firm-addr">123, Legal Complex, Connaught Place, New Delhi — 110001<br>📞 +91 98765 43210 &nbsp;|&nbsp; ✉ info@vakilco.in</div>
  </div>
  <div class="doc-box">
    <div class="doc-type">Quotation</div>
    <div class="doc-num">${q.quotationNumber}</div>
    <div class="doc-meta">
      Date: ${fmtDate(q.createdAt)}<br>
      Valid for: ${q.validityDays} days<br>
      Status: <strong>${(q.status ?? "draft").toUpperCase()}</strong>
    </div>
  </div>
</div>
<div class="bill-box">
  <h4>Prepared For</h4>
  <p><strong>${q.clientName}</strong></p>
</div>
<table>
  <thead>
    <tr>
      <th style="width:30px">#</th>
      <th>Service / Description</th>
      <th style="width:50px">Qty</th>
      <th style="width:90px">Unit Price</th>
      <th style="width:90px">Amount</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
<table class="totals">
  <tr><td>Subtotal</td><td>₹${q.subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
  <tr><td>GST (${q.taxPercent}%)</td><td>₹${q.taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
  <tr class="total-row"><td>Grand Total</td><td>₹${q.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
</table>
<div class="footer">
  <div class="notes">
    ${q.notes ? `<h4 style="font-size:10px;font-weight:700;color:#0f2044;text-transform:uppercase;margin-bottom:4px">Notes</h4><p>${q.notes}</p>` : ""}
    <p style="margin-top:10px;color:#999;font-size:10px">This is a computer-generated quotation. Valid for ${q.validityDays} days from date of issue.</p>
  </div>
  <div class="sign">
    <div class="sign-line"></div>
    <p>Authorised Signatory</p>
    <p>Vakil &amp; Co.</p>
  </div>
</div>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

// ── Tab config ─────────────────────────────────────────────────────────────────
const TABS: Array<{ key: Tab; label: string; icon: React.ElementType }> = [
  { key: "cases", label: "My Cases", icon: Briefcase },
  { key: "quotations", label: "Quotations", icon: FileQuestion },
  { key: "invoices", label: "Invoices", icon: FileText },
  { key: "documents", label: "Documents", icon: Paperclip },
  { key: "chat", label: "Chat", icon: MessageSquare },
  { key: "progress", label: "Progress", icon: Activity },
  { key: "profile", label: "My Profile", icon: User },
];

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

  // Data
  const [cases, setCases] = useState<Case[]>([]);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [documents, setDocuments] = useState<PortalDoc[]>([]);
  const [chatMsgs, setChatMsgs] = useState<ChatMsg[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Selected case (for documents/chat/progress)
  const [selectedCaseId, setSelectedCaseId] = useState<number | null>(null);
  const selectedCase = cases.find(c => c.id === selectedCaseId) ?? cases[0] ?? null;

  // Chat
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatSseRef = useRef<EventSource | null>(null);

  // Profile edit
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", whatsapp: "", company: "", city: "", state: "" });
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // Invoice pay
  const [payingInvId, setPayingInvId] = useState<number | null>(null);
  const [payMode, setPayMode] = useState("online");
  const [payRef, setPayRef] = useState("");
  const [paySubmitting, setPaySubmitting] = useState(false);

  // Quotation reject
  const [rejectingQId, setRejectingQId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Document upload
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiHeaders = (tok: string) => ({ "X-Portal-Token": tok });
  const apiFetch = (url: string, tok: string, opts?: RequestInit) =>
    fetch(url, { ...opts, headers: { ...apiHeaders(tok), ...(opts?.headers ?? {}) } });

  // Verify on mount
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
          if (tokenFromUrl) window.history.replaceState({}, "", "/portal/dashboard");
        } else {
          localStorage.removeItem("portal_token");
          setAuthError(d.error ?? "Session expired. Please request a new link.");
        }
        setVerifying(false);
      })
      .catch(() => { setAuthError("Network error. Please try again."); setVerifying(false); });
  }, []);

  // Load cases on token set
  useEffect(() => {
    if (!token) return;
    apiFetch("/api/portal/cases", token).then(r => r.json()).then(d => {
      const arr = Array.isArray(d) ? d : [];
      setCases(arr);
      if (arr.length > 0) setSelectedCaseId(arr[0].id);
    });
  }, [token]);

  // Load data per tab
  useEffect(() => {
    if (!token) return;
    setDataLoading(true);
    const load = async () => {
      try {
        if (tab === "quotations") {
          const d = await apiFetch("/api/portal/quotations", token).then(r => r.json());
          setQuotations(Array.isArray(d) ? d : []);
        } else if (tab === "invoices") {
          const d = await apiFetch("/api/portal/invoices", token).then(r => r.json());
          setInvoices(Array.isArray(d) ? d : []);
        } else if (tab === "documents" && selectedCase) {
          const d = await apiFetch(`/api/portal/documents?leadId=${selectedCase.id}`, token).then(r => r.json());
          setDocuments(Array.isArray(d) ? d : []);
        } else if (tab === "chat" && selectedCase) {
          const d = await apiFetch(`/api/portal/chat/messages?leadId=${selectedCase.id}`, token).then(r => r.json());
          setChatMsgs(Array.isArray(d) ? d : []);
        } else if (tab === "progress" && selectedCase) {
          const d = await apiFetch(`/api/portal/cases/${selectedCase.id}/timeline`, token).then(r => r.json());
          setTimeline(Array.isArray(d) ? d : []);
        }
      } catch { /* silent */ }
      setDataLoading(false);
    };
    load();
  }, [token, tab, selectedCase?.id]);

  // SSE for real-time chat
  useEffect(() => {
    if (tab !== "chat" || !token || !selectedCase) return;
    chatSseRef.current?.close();
    const es = new EventSource(`/api/portal/chat/sse?leadId=${selectedCase.id}&token=${token}`);
    es.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === "message" && msg.data) {
          setChatMsgs(prev => {
            if (prev.find(m => m.id === msg.data.id)) return prev;
            return [...prev, msg.data];
          });
        }
      } catch { /* ignore */ }
    };
    chatSseRef.current = es;
    return () => { es.close(); chatSseRef.current = null; };
  }, [tab, token, selectedCase?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  const logout = () => { localStorage.removeItem("portal_token"); navigate("/portal"); };

  // ── Actions ───────────────────────────────────────────────────────────────

  const acceptQuotation = async (qid: number) => {
    if (!token) return;
    setActionLoading(true);
    await apiFetch(`/api/portal/quotations/${qid}/accept`, token, { method: "PATCH" });
    const d = await apiFetch("/api/portal/quotations", token).then(r => r.json());
    setQuotations(Array.isArray(d) ? d : []);
    setActionLoading(false);
  };

  const rejectQuotation = async (qid: number) => {
    if (!token) return;
    setActionLoading(true);
    await apiFetch(`/api/portal/quotations/${qid}/reject`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: rejectReason }),
    });
    const d = await apiFetch("/api/portal/quotations", token).then(r => r.json());
    setQuotations(Array.isArray(d) ? d : []);
    setRejectingQId(null);
    setRejectReason("");
    setActionLoading(false);
  };

  const confirmPayment = async (invId: number) => {
    if (!token) return;
    setPaySubmitting(true);
    await apiFetch(`/api/portal/invoices/${invId}/pay`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: payMode, transactionId: payRef }),
    });
    const d = await apiFetch("/api/portal/invoices", token).then(r => r.json());
    setInvoices(Array.isArray(d) ? d : []);
    setPayingInvId(null);
    setPayMode("online");
    setPayRef("");
    setPaySubmitting(false);
  };

  const sendChatMessage = async () => {
    if (!token || !selectedCase || !chatInput.trim()) return;
    setChatSending(true);
    await apiFetch("/api/portal/chat/message", token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leadId: selectedCase.id, message: chatInput.trim(), senderName: client?.name }),
    });
    setChatInput("");
    setChatSending(false);
  };

  const uploadDocument = async (file: File) => {
    if (!token || !selectedCase) return;
    setUploadingDoc(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      await apiFetch("/api/portal/documents", token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedCase.id,
          fileName: file.name,
          mimeType: file.type,
          fileData: base64,
        }),
      });
      const d = await apiFetch(`/api/portal/documents?leadId=${selectedCase.id}`, token).then(r => r.json());
      setDocuments(Array.isArray(d) ? d : []);
      setUploadingDoc(false);
    };
    reader.readAsDataURL(file);
  };

  // ── Auth states ───────────────────────────────────────────────────────────
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
  const overdueInvoices = invoices.filter(i => i.dueDate && i.dueDate < new Date().toISOString().slice(0, 10) && i.status !== "paid" && i.status !== "cancelled" && i.status !== "payment_confirmed").length;
  const pendingQuotations = quotations.filter(q => q.status === "sent").length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ── Header ── */}
      <header className="bg-[#0f2044] px-6 py-3 flex items-center gap-4 sticky top-0 z-40 shadow-md">
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
        {/* ── Welcome banner ── */}
        <div className="bg-gradient-to-r from-[#0f2044] to-[#1a3a6e] rounded-2xl p-6 text-white">
          <h1 className="text-xl font-bold mb-0.5">Welcome back, {client?.name?.split(" ")[0]} 👋</h1>
          {client?.company && <p className="text-white/50 text-sm">{client.company}</p>}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            {[
              { label: "Active Cases", value: cases.length, color: "text-[#c9a227]" },
              { label: "Quotations Pending", value: pendingQuotations, color: pendingQuotations > 0 ? "text-amber-300" : "text-green-300" },
              { label: "Invoices", value: invoices.length || "—", color: "text-[#c9a227]" },
              { label: "Outstanding", value: outstanding > 0 ? fmt(String(outstanding.toFixed(0))) : "Clear", color: outstanding > 0 ? "text-orange-300" : "text-green-300" },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-white/50 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Alerts ── */}
        {overdueInvoices > 0 && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5">
            <AlertCircle size={16} className="text-red-500 shrink-0" />
            <span className="text-red-700 text-sm font-medium">You have {overdueInvoices} overdue invoice{overdueInvoices > 1 ? "s" : ""}. Please make payment at the earliest.</span>
            <button onClick={() => setTab("invoices")} className="ml-auto text-xs text-red-700 font-semibold underline">View →</button>
          </div>
        )}
        {pendingQuotations > 0 && (
          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3.5">
            <FileQuestion size={16} className="text-amber-500 shrink-0" />
            <span className="text-amber-800 text-sm font-medium">{pendingQuotations} quotation{pendingQuotations > 1 ? "s" : ""} awaiting your response.</span>
            <button onClick={() => setTab("quotations")} className="ml-auto text-xs text-amber-800 font-semibold underline">Review →</button>
          </div>
        )}

        {/* ── Case selector (for docs/chat/progress tabs) ── */}
        {cases.length > 1 && ["documents", "chat", "progress"].includes(tab) && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Select Case</p>
            <div className="flex gap-2 flex-wrap">
              {cases.map(c => (
                <button key={c.id} onClick={() => setSelectedCaseId(c.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${selectedCase?.id === c.id ? "bg-[#0f2044] text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  {c.service}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab bar ── */}
        <div className="bg-white border border-gray-200 rounded-2xl p-1.5 shadow-sm overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {TABS.map(({ key, label, icon: Icon }) => (
              <button key={key} onClick={() => setTab(key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${tab === key ? "bg-[#0f2044] text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            MY CASES TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "cases" && (
          <div className="space-y-4">
            {cases.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <Briefcase size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No cases found</p>
                <p className="text-gray-300 text-sm">Your consultation requests will appear here</p>
              </div>
            ) : cases.map(c => {
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
                  {stepIdx >= 0 && (
                    <div className="mb-4">
                      <div className="flex justify-between text-[10px] text-gray-400 mb-1.5"><span>Progress</span><span>{progressPct}%</span></div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#0f2044] to-[#c9a227] rounded-full transition-all" style={{ width: `${progressPct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1.5">
                        {CASE_STEPS.map((step, i) => (
                          <div key={step} className={`text-[9px] font-medium capitalize ${i <= stepIdx ? "text-[#0f2044]" : "text-gray-300"}`}>{step.replace("_", " ")}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-gray-500">
                    {c.assignedTo && <div className="flex items-center gap-1.5"><User size={11} className="text-gray-300" />Handled by: <span className="font-medium text-gray-700">{c.assignedTo}</span></div>}
                    {c.nextFollowUp && <div className="flex items-center gap-1.5"><Calendar size={11} className="text-gray-300" />Next follow-up: <span className="font-medium text-gray-700">{fmtDate(c.nextFollowUp)}</span></div>}
                  </div>
                  {c.notes && (
                    <div className="mt-3 pt-3 border-t border-gray-50">
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Latest Update</div>
                      <p className="text-sm text-gray-600">{c.notes}</p>
                    </div>
                  )}
                  <div className="flex gap-2 mt-4 flex-wrap">
                    <button onClick={() => { setSelectedCaseId(c.id); setTab("chat"); }}
                      className="text-[11px] px-3 py-1.5 rounded-xl bg-[#0f2044] text-white hover:bg-[#1a3060] transition-colors flex items-center gap-1">
                      <MessageSquare size={11} />Chat
                    </button>
                    <button onClick={() => { setSelectedCaseId(c.id); setTab("documents"); }}
                      className="text-[11px] px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1">
                      <Paperclip size={11} />Documents
                    </button>
                    <button onClick={() => { setSelectedCaseId(c.id); setTab("progress"); }}
                      className="text-[11px] px-3 py-1.5 rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors flex items-center gap-1">
                      <Activity size={11} />Progress
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            QUOTATIONS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "quotations" && (
          <div className="space-y-4">
            {dataLoading ? (
              <div className="bg-white rounded-2xl p-12 text-center"><Loader2 size={24} className="animate-spin text-[#c9a227] mx-auto" /></div>
            ) : quotations.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <FileQuestion size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No quotations yet</p>
                <p className="text-gray-300 text-sm">Quotations from our team will appear here</p>
              </div>
            ) : quotations.map(q => {
              const statusCfg = QUOT_STATUS[q.status] ?? QUOT_STATUS.draft;
              const isExpired = q.status === "sent" && q.sentAt && new Date(q.sentAt).getTime() + q.validityDays * 86400000 < Date.now();
              const canAct = q.status === "sent" && !isExpired;
              const items = Array.isArray(q.items) ? q.items as Array<{ description: string; qty: number; rate: number; gstRate: number; amount: number }> : [];
              return (
                <div key={q.id} className={`bg-white rounded-2xl border p-5 transition-all shadow-sm ${q.status === "sent" ? "border-amber-200" : "border-gray-100"}`}>
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-[#0f2044]">{q.quotationNumber}</h3>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${isExpired ? "bg-gray-100 text-gray-500" : statusCfg.color}`}>{isExpired ? "Expired" : statusCfg.label}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        Issued {fmtDate(q.createdAt)}
                        {q.sentAt ? ` · Valid ${q.validityDays} days from ${fmtDate(q.sentAt)}` : ""}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex flex-col items-end gap-2">
                      <div className="text-xl font-bold text-[#0f2044]">{fmt(q.total)}</div>
                      <div className="text-xs text-gray-400">incl. GST</div>
                      <button onClick={() => printPortalQuotation(q)}
                        className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-[#0f2044] hover:text-white hover:border-[#0f2044] transition-all font-medium">
                        <Download size={12} />Download
                      </button>
                    </div>
                  </div>

                  {/* Items */}
                  {items.length > 0 && (
                    <div className="rounded-xl overflow-hidden border border-gray-100 mb-4">
                      <table className="w-full text-xs">
                        <thead className="bg-[#0f2044] text-white">
                          <tr>
                            <th className="text-left px-3 py-2">Description</th>
                            <th className="text-center px-3 py-2">Qty</th>
                            <th className="text-right px-3 py-2">Rate</th>
                            <th className="text-right px-3 py-2">Amount</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {items.map((it, i) => (
                            <tr key={i} className="hover:bg-gray-50/50">
                              <td className="px-3 py-2 text-gray-700">{it.description}</td>
                              <td className="px-3 py-2 text-center text-gray-500">{it.qty}</td>
                              <td className="px-3 py-2 text-right text-gray-500">{fmt(it.rate)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-[#0f2044]">{fmt(it.amount)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div className="flex justify-end gap-4 text-xs text-gray-500 mb-4">
                    <span>Subtotal: {fmt(q.subtotal)}</span>
                    <span>GST ({q.taxPercent}%): {fmt(q.taxAmount)}</span>
                    <span className="font-bold text-[#0f2044] text-sm">Total: {fmt(q.total)}</span>
                  </div>

                  {q.notes && <p className="text-xs text-gray-400 mb-4 bg-gray-50 rounded-xl px-3 py-2">{q.notes}</p>}

                  {/* Status info */}
                  {q.status === "accepted" && (
                    <div className="flex items-center gap-2 bg-green-50 rounded-xl px-4 py-2.5 text-green-700 text-xs font-medium">
                      <CheckCircle size={14} />You accepted this quotation on {fmtDate(q.acceptedAt)}
                    </div>
                  )}
                  {q.status === "rejected" && (
                    <div className="flex items-center gap-2 bg-red-50 rounded-xl px-4 py-2.5 text-red-700 text-xs font-medium">
                      <XCircle size={14} />Rejected on {fmtDate(q.rejectedAt)}{q.rejectedReason ? ` · Reason: "${q.rejectedReason}"` : ""}
                    </div>
                  )}

                  {/* Action buttons */}
                  {canAct && rejectingQId !== q.id && (
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => acceptQuotation(q.id)} disabled={actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                        <ThumbsUp size={14} />{actionLoading ? "Processing…" : "Accept Quotation"}
                      </button>
                      <button onClick={() => setRejectingQId(q.id)} disabled={actionLoading}
                        className="flex-1 flex items-center justify-center gap-2 bg-white border border-red-300 text-red-600 hover:bg-red-50 font-semibold py-2.5 rounded-xl text-sm transition-all disabled:opacity-50">
                        <ThumbsDown size={14} />Reject
                      </button>
                    </div>
                  )}

                  {/* Reject form */}
                  {rejectingQId === q.id && (
                    <div className="mt-4 bg-red-50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-red-700">Please let us know why you're rejecting (optional):</p>
                      <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                        placeholder="e.g. Budget constraints, timeline doesn't work, need more services included…"
                        rows={3} className="w-full text-sm border border-red-200 rounded-xl px-3 py-2 focus:outline-none focus:border-red-400 bg-white resize-none" />
                      <div className="flex gap-2">
                        <button onClick={() => rejectQuotation(q.id)} disabled={actionLoading}
                          className="flex-1 bg-red-600 text-white font-semibold py-2 rounded-xl text-sm hover:bg-red-700 transition-all disabled:opacity-50">
                          {actionLoading ? "Submitting…" : "Confirm Rejection"}
                        </button>
                        <button onClick={() => { setRejectingQId(null); setRejectReason(""); }}
                          className="px-4 bg-white border border-gray-200 text-gray-600 font-semibold py-2 rounded-xl text-sm hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            INVOICES TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "invoices" && (
          <div className="space-y-4">
            {dataLoading ? (
              <div className="bg-white rounded-2xl p-12 text-center"><Loader2 size={24} className="animate-spin text-[#c9a227] mx-auto" /></div>
            ) : invoices.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
                <FileText size={40} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 font-medium">No invoices yet</p>
                <p className="text-gray-300 text-sm">Your invoices will appear here once raised</p>
              </div>
            ) : invoices.map(inv => {
              const bal = Math.max(0, parseFloat(inv.total ?? "0") - parseFloat(inv.paidAmount ?? "0"));
              const isOverdue = !!inv.dueDate && inv.dueDate < new Date().toISOString().slice(0, 10) && !["paid", "cancelled", "payment_confirmed"].includes(inv.status);
              const statusKey = isOverdue ? "overdue" : inv.status;
              const statusCfg = INV_STATUS[statusKey] ?? INV_STATUS.draft;
              const canPay = bal > 0 && !["paid", "cancelled", "payment_confirmed"].includes(inv.status);
              return (
                <div key={inv.id} className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${isOverdue ? "border-red-200" : "border-gray-100"}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-[#0f2044]">{inv.number}</h3>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${statusCfg.color}`}>{statusCfg.label}</span>
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">Issued {fmtDate(inv.createdAt)}{inv.dueDate ? ` · Due ${fmtDate(inv.dueDate)}` : ""}</div>
                    </div>
                    <button onClick={() => printInvoice(inv, client?.name ?? "")}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-xl text-xs text-gray-600 hover:bg-[#0f2044] hover:text-white hover:border-[#0f2044] transition-all font-medium">
                      <Download size={12} />Download
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4">
                    {[
                      { label: "Subtotal", value: fmt(inv.subtotal), bold: false },
                      { label: "GST", value: fmt(inv.gstAmount), bold: false },
                      { label: "Total", value: fmt(inv.total), bold: true },
                    ].map(s => (
                      <div key={s.label} className={`rounded-xl p-3 text-center ${s.bold ? (inv.status === "paid" || inv.status === "payment_confirmed" ? "bg-green-50" : "bg-[#0f2044]/5") : "bg-gray-50"}`}>
                        <div className="text-xs text-gray-400">{s.label}</div>
                        <div className={`${s.bold ? "font-bold " + (inv.status === "paid" || inv.status === "payment_confirmed" ? "text-green-700" : "text-[#0f2044]") : "font-semibold text-gray-700"} text-sm mt-0.5`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {bal > 0 && (
                    <div className={`mt-3 flex items-center justify-between px-4 py-2.5 rounded-xl ${isOverdue ? "bg-red-50" : "bg-orange-50"}`}>
                      <div className={`text-xs font-medium ${isOverdue ? "text-red-700" : "text-orange-700"}`}>{isOverdue ? "⚠️ Overdue Amount" : "Balance Due"}</div>
                      <div className={`font-bold text-sm ${isOverdue ? "text-red-700" : "text-orange-700"}`}>{fmt(String(bal.toFixed(0)))}</div>
                    </div>
                  )}
                  {inv.notes && <p className="text-xs text-gray-400 mt-3 pt-3 border-t border-gray-50">{inv.notes}</p>}

                  {/* Pay button */}
                  {canPay && payingInvId !== inv.id && (
                    <button onClick={() => setPayingInvId(inv.id)}
                      className="mt-4 w-full flex items-center justify-center gap-2 bg-[#0f2044] text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-[#1a3060] transition-all">
                      <IndianRupee size={14} />Confirm Payment — {fmt(String(bal.toFixed(0)))}
                    </button>
                  )}

                  {/* Pay form */}
                  {payingInvId === inv.id && (
                    <div className="mt-4 bg-[#0f2044]/5 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-[#0f2044]">Confirm your payment details:</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Payment Mode</label>
                          <select value={payMode} onChange={e => setPayMode(e.target.value)}
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none bg-white">
                            <option value="online">Online Transfer</option>
                            <option value="upi">UPI</option>
                            <option value="neft">NEFT/RTGS</option>
                            <option value="cheque">Cheque</option>
                            <option value="cash">Cash</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Transaction Ref (optional)</label>
                          <input value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="UTR / UPI ref / cheque no."
                            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 focus:outline-none bg-white" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => confirmPayment(inv.id)} disabled={paySubmitting}
                          className="flex-1 bg-green-600 text-white font-semibold py-2.5 rounded-xl text-sm hover:bg-green-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                          {paySubmitting ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}{paySubmitting ? "Submitting…" : "Submit Payment Confirmation"}
                        </button>
                        <button onClick={() => setPayingInvId(null)}
                          className="px-4 bg-white border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-gray-50">
                          Cancel
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-400 text-center">Our team will verify and mark your invoice as paid. You will receive a confirmation.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            DOCUMENTS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "documents" && (
          <div className="space-y-4">
            {!selectedCase ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">No active cases found.</div>
            ) : (
              <>
                {/* Upload zone */}
                <div className="bg-white rounded-2xl border-2 border-dashed border-gray-200 hover:border-[#c9a227] transition-all p-8 text-center cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add("border-[#c9a227]", "bg-[#c9a227]/5"); }}
                  onDragLeave={e => { e.currentTarget.classList.remove("border-[#c9a227]", "bg-[#c9a227]/5"); }}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadDocument(f); }}>
                  <input ref={fileInputRef} type="file" className="hidden"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadDocument(f); e.target.value = ""; }} />
                  {uploadingDoc ? (
                    <><Loader2 size={28} className="animate-spin text-[#c9a227] mx-auto mb-2" /><p className="text-sm text-gray-500">Uploading…</p></>
                  ) : (
                    <>
                      <Upload size={28} className="text-gray-300 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-600">Click to upload or drag and drop</p>
                      <p className="text-xs text-gray-400 mt-1">PDF, Word, Excel, Images up to 10 MB</p>
                    </>
                  )}
                </div>

                {/* Document list */}
                {dataLoading ? (
                  <div className="bg-white rounded-2xl p-12 text-center"><Loader2 size={24} className="animate-spin text-[#c9a227] mx-auto" /></div>
                ) : documents.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <Paperclip size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No documents uploaded yet for this case.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 divide-y divide-gray-50">
                    {documents.map(doc => (
                      <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                        <div className="w-9 h-9 bg-[#0f2044]/10 rounded-xl flex items-center justify-center shrink-0">
                          <FileText size={16} className="text-[#0f2044]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[#0f2044] text-sm truncate">{doc.fileName}</p>
                          <p className="text-xs text-gray-400">{fmtSize(doc.fileSize)} · {fmtDate(doc.uploadedAt)}</p>
                        </div>
                        <a href={`/api${doc.fileUrl}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-gray-200 text-xs text-gray-600 hover:bg-[#0f2044] hover:text-white hover:border-[#0f2044] transition-all font-medium">
                          <Download size={11} />Download
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            CHAT TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "chat" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex flex-col" style={{ height: "calc(100vh - 340px)", minHeight: "400px" }}>
            {!selectedCase ? (
              <div className="flex-1 flex items-center justify-center text-gray-400">No active cases found.</div>
            ) : (
              <>
                {/* Chat header */}
                <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-3">
                  <div className="w-8 h-8 bg-[#0f2044] rounded-xl flex items-center justify-center">
                    <User size={14} className="text-[#c9a227]" />
                  </div>
                  <div>
                    <p className="font-semibold text-[#0f2044] text-sm">{selectedCase.assignedTo ?? "Support Team"}</p>
                    <p className="text-xs text-gray-400">{selectedCase.service}</p>
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {dataLoading ? (
                    <div className="flex items-center justify-center h-full"><Loader2 size={24} className="animate-spin text-[#c9a227]" /></div>
                  ) : chatMsgs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <MessageSquare size={32} className="mb-3 opacity-30" />
                      <p className="text-sm">No messages yet. Start the conversation!</p>
                    </div>
                  ) : (
                    chatMsgs.map(msg => {
                      const isClient = msg.senderType === "client";
                      return (
                        <div key={msg.id} className={`flex gap-2.5 ${isClient ? "flex-row-reverse" : "flex-row"}`}>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isClient ? "bg-[#c9a227] text-[#0f2044]" : "bg-[#0f2044] text-[#c9a227]"}`}>
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                          <div className={`max-w-[72%] ${isClient ? "items-end" : "items-start"} flex flex-col gap-0.5`}>
                            <div className={`px-4 py-2.5 rounded-2xl text-sm ${isClient ? "bg-[#0f2044] text-white rounded-tr-sm" : "bg-gray-100 text-gray-800 rounded-tl-sm"}`}>
                              {msg.message}
                            </div>
                            <span className="text-[10px] text-gray-400 px-1">{timeSince(msg.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Input */}
                <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                    placeholder="Type a message…"
                    className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#c9a227] transition-colors"
                  />
                  <button onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending}
                    className="w-10 h-10 bg-[#0f2044] rounded-xl flex items-center justify-center text-white hover:bg-[#1a3060] transition-all disabled:opacity-40">
                    {chatSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            PROGRESS TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "progress" && (
          <div className="space-y-4">
            {!selectedCase ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center text-gray-400">No active cases found.</div>
            ) : (
              <>
                {/* Case header */}
                <div className="bg-gradient-to-r from-[#0f2044] to-[#1a3a6e] rounded-2xl p-5 text-white">
                  <h3 className="font-bold text-base">{selectedCase.service}</h3>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${STATUS_COLORS[selectedCase.status] ?? "bg-gray-100 text-gray-600"}`}>{STATUS_LABELS[selectedCase.status] ?? selectedCase.status}</span>
                    {selectedCase.assignedTo && <span className="text-white/50 text-xs">· {selectedCase.assignedTo}</span>}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full bg-[#c9a227] rounded-full transition-all"
                        style={{ width: `${Math.round(((CASE_STEPS.indexOf(selectedCase.status) + 1) / CASE_STEPS.length) * 100)}%` }} />
                    </div>
                    <div className="flex justify-between mt-2">
                      {CASE_STEPS.map((step, i) => (
                        <div key={step} className={`text-[9px] font-medium capitalize ${i <= CASE_STEPS.indexOf(selectedCase.status) ? "text-[#c9a227]" : "text-white/30"}`}>{step.replace("_", " ")}</div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                {dataLoading ? (
                  <div className="bg-white rounded-2xl p-12 text-center"><Loader2 size={24} className="animate-spin text-[#c9a227] mx-auto" /></div>
                ) : timeline.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
                    <Activity size={32} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm">No activity recorded yet on this case.</p>
                    <p className="text-gray-300 text-xs mt-1">Updates from our team will appear here</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-gray-100 p-5">
                    <h3 className="font-semibold text-[#0f2044] mb-5 flex items-center gap-2"><Activity size={15} className="text-[#c9a227]" />Case Timeline</h3>
                    <div className="relative">
                      <div className="absolute left-4 top-0 bottom-0 w-px bg-gray-100" />
                      <div className="space-y-4">
                        {timeline.map(item => (
                          <div key={`${item.type}-${item.id}`} className="flex gap-4 relative">
                            <div className="w-8 h-8 rounded-full bg-[#0f2044]/10 border-2 border-white flex items-center justify-center shrink-0 z-10">
                              <ChevronRight size={12} className="text-[#0f2044]" />
                            </div>
                            <div className="flex-1 pb-4">
                              <p className="text-sm text-gray-700 font-medium">{item.description}</p>
                              <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                <span>{fmtDateTime(item.createdAt)}</span>
                                {item.actor && item.actor !== "System" && <span>· {item.actor}</span>}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MY PROFILE TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "profile" && (
          <div className="max-w-lg mx-auto space-y-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-[#0f2044]/10 rounded-2xl flex items-center justify-center text-[#0f2044] font-bold text-lg">
                  {client?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-[#0f2044]">{client?.name}</h2>
                  <p className="text-xs text-gray-400">{client?.email}</p>
                </div>
              </div>

              {!profileLoaded && token && (() => {
                fetch(`/api/portal/profile`, { headers: { "x-portal-token": token }, credentials: "include" })
                  .then(r => r.json())
                  .then((d: { name: string; phone: string; whatsapp: string; company: string | null; city: string | null; state: string | null }) => {
                    setProfileForm({
                      name: d.name ?? "", phone: d.phone ?? "", whatsapp: d.whatsapp ?? "",
                      company: d.company ?? "", city: d.city ?? "", state: d.state ?? "",
                    });
                    setProfileLoaded(true);
                  }).catch(() => setProfileLoaded(true));
                return null;
              })()}

              <div className="space-y-4">
                {[
                  { key: "name",      label: "Full Name",      placeholder: "Your full name",        required: true },
                  { key: "company",   label: "Company / Firm", placeholder: "Your company name",     required: false },
                  { key: "phone",     label: "Phone Number",   placeholder: "+91 98765 43210",        required: false },
                  { key: "whatsapp",  label: "WhatsApp Number",placeholder: "+91 98765 43210",        required: false },
                  { key: "city",      label: "City",           placeholder: "e.g. Mumbai",            required: false },
                  { key: "state",     label: "State",          placeholder: "e.g. Maharashtra",       required: false },
                ].map(({ key, label, placeholder, required }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">{label}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
                    <input
                      type="text"
                      value={profileForm[key as keyof typeof profileForm]}
                      onChange={e => setProfileForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full h-10 px-3 text-sm border border-gray-200 rounded-xl focus:outline-none focus:border-[#c9a227] transition-colors bg-white"
                    />
                  </div>
                ))}

                {profileSaved && (
                  <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 rounded-xl px-4 py-2.5">
                    <CheckCircle size={14} /> Profile updated successfully
                  </div>
                )}

                <button
                  disabled={profileSaving || !profileForm.name.trim()}
                  onClick={async () => {
                    if (!token || !profileForm.name.trim()) return;
                    setProfileSaving(true); setProfileSaved(false);
                    try {
                      const r = await fetch("/api/portal/profile", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", "x-portal-token": token },
                        credentials: "include",
                        body: JSON.stringify(profileForm),
                      });
                      if (r.ok) setProfileSaved(true);
                    } finally { setProfileSaving(false); }
                  }}
                  className="w-full h-10 bg-[#0f2044] hover:bg-[#0f2044]/90 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {profileSaving ? <Loader2 size={14} className="animate-spin" /> : <User size={14} />}
                  {profileSaving ? "Saving…" : "Update Profile"}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <p className="text-xs text-gray-400 text-center">
                Your email address <span className="font-semibold text-gray-600">{client?.email}</span> is your login identifier and cannot be changed here.
                Contact our team if you need to update your email.
              </p>
            </div>
          </div>
        )}
      </div>

      <footer className="text-center py-4 text-gray-300 text-xs border-t border-gray-100">
        Vakil & Co. Client Portal · Secure &amp; Confidential
      </footer>
    </div>
  );
}
