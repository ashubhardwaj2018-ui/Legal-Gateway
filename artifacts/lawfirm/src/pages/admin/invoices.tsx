import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Plus, Search, Printer, Trash2, X, IndianRupee, CreditCard,
  ChevronRight, Eye, Send, CheckCircle2, Clock, AlertCircle,
  FileText, ReceiptText, ShoppingCart, Download, Pencil,
  PlusCircle, Minus,
} from "lucide-react";

interface InvoiceItem {
  _id: string;
  description: string;
  qty: number;
  rate: number;
  gstRate: number;
}

interface Invoice {
  id: number;
  number: string;
  type: string;
  status: string;
  clientName: string;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  clientGST: string | null;
  clientState: string | null;
  items: InvoiceItem[];
  subtotal: string;
  discount: string | null;
  discountType: string | null;
  gstAmount: string | null;
  total: string;
  paidAmount: string | null;
  dueDate: string | null;
  notes: string | null;
  terms: string | null;
  createdAt: string;
}

interface Payment {
  id: number;
  invoiceId: number;
  amount: string;
  mode: string;
  transactionId: string | null;
  notes: string | null;
  paidAt: string;
  createdAt: string;
}

interface Stats {
  totalInvoices: number;
  totalAmount: string;
  paidAmount: string;
  pendingAmount: string;
  overdueCount: number;
}

const TYPE_LABELS: Record<string, string> = {
  invoice: "GST Invoice", quotation: "Quotation", proforma: "Proforma Invoice",
  po: "Purchase Order", credit_note: "Credit Note", debit_note: "Debit Note", receipt: "Receipt",
};
const TYPE_COLORS: Record<string, string> = {
  invoice: "bg-blue-100 text-blue-700", quotation: "bg-purple-100 text-purple-700",
  proforma: "bg-cyan-100 text-cyan-700", po: "bg-indigo-100 text-indigo-700",
  credit_note: "bg-orange-100 text-orange-700", debit_note: "bg-rose-100 text-rose-700",
  receipt: "bg-green-100 text-green-700",
};
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600", sent: "bg-blue-100 text-blue-700",
  paid: "bg-green-100 text-green-700", partial: "bg-yellow-100 text-yellow-700",
  overdue: "bg-red-100 text-red-700", cancelled: "bg-gray-100 text-gray-400",
};
const PAYMENT_MODES = ["cash", "upi", "bank_transfer", "cheque", "card", "neft", "rtgs"];
const GST_RATES = [0, 5, 12, 18, 28];

function fmt(n: string | number | null | undefined) {
  const v = parseFloat(String(n ?? "0")) || 0;
  return new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}
function uid() { return Math.random().toString(36).slice(2); }

function computeItem(item: InvoiceItem) {
  const amount = (item.qty || 0) * (item.rate || 0);
  const gst = amount * (item.gstRate || 0) / 100;
  return { amount, gst, total: amount + gst };
}
function computeTotals(items: InvoiceItem[], discount: number, discountType: string) {
  let subtotal = 0, gstAmount = 0;
  for (const it of items) { const c = computeItem(it); subtotal += c.amount; gstAmount += c.gst; }
  const discAmt = discountType === "percent" ? subtotal * discount / 100 : discount;
  const total = Math.max(0, subtotal + gstAmount - discAmt);
  return { subtotal, gstAmount, discAmt, total };
}

const BLANK_FORM = {
  type: "invoice", dueDate: "", notes: "", terms: "Payment due within 30 days.\nCheques to be made in favour of Vakil & Co.",
  discount: "0", discountType: "fixed",
  clientName: "", clientEmail: "", clientPhone: "", clientAddress: "", clientGST: "", clientState: "",
};

function blankItem(): InvoiceItem {
  return { _id: uid(), description: "", qty: 1, rate: 0, gstRate: 18 };
}

// ─── Invoice Print ──────────────────────────────────────────────────────────

function printInvoice(inv: Invoice) {
  const items = inv.items ?? [];
  const subtotal = parseFloat(inv.subtotal ?? "0");
  const gstAmount = parseFloat(inv.gstAmount ?? "0");
  const discount = parseFloat(inv.discount ?? "0");
  const discountType = inv.discountType ?? "fixed";
  const discAmt = discountType === "percent" ? subtotal * discount / 100 : discount;
  const total = parseFloat(inv.total ?? "0");
  const paid = parseFloat(inv.paidAmount ?? "0");
  const due = total - paid;

  const rows = items.map((it: InvoiceItem, i: number) => {
    const { amount, gst, total: rowTotal } = computeItem(it);
    return `<tr>
      <td>${i + 1}</td>
      <td style="text-align:left">${it.description || "—"}</td>
      <td>${it.qty}</td>
      <td>₹${fmt(it.rate)}</td>
      <td>${it.gstRate}%</td>
      <td>₹${fmt(gst)}</td>
      <td>₹${fmt(rowTotal)}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${TYPE_LABELS[inv.type] ?? "Invoice"} — ${inv.number}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; background: #fff; padding: 20px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0f2044; padding-bottom: 16px; margin-bottom: 16px; }
  .firm-name { font-size: 22px; font-weight: 900; color: #0f2044; letter-spacing: 1px; }
  .firm-sub { color: #c9a227; font-size: 11px; font-weight: 600; letter-spacing: 2px; text-transform: uppercase; margin: 2px 0 6px; }
  .firm-addr { color: #555; font-size: 11px; line-height: 1.5; }
  .inv-box { text-align: right; }
  .inv-type { font-size: 18px; font-weight: 700; color: #0f2044; text-transform: uppercase; letter-spacing: 1px; }
  .inv-num { font-size: 13px; font-weight: 700; color: #c9a227; margin: 4px 0; }
  .inv-meta { font-size: 11px; color: #555; line-height: 1.8; }
  .bill-section { display: flex; gap: 20px; margin: 16px 0; }
  .bill-box { flex: 1; background: #f7f7f7; border-radius: 6px; padding: 12px 14px; border-left: 3px solid #0f2044; }
  .bill-box h4 { font-size: 10px; color: #c9a227; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; }
  .bill-box p { font-size: 12px; color: #222; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  table th { background: #0f2044; color: #fff; padding: 8px 6px; font-size: 11px; text-align: right; }
  table th:first-child, table th:nth-child(2) { text-align: left; }
  table td { padding: 7px 6px; font-size: 11px; text-align: right; border-bottom: 1px solid #eee; }
  table td:first-child, table td:nth-child(2) { text-align: left; }
  table tr:nth-child(even) td { background: #fafafa; }
  .totals { width: 260px; margin-left: auto; margin-top: 10px; }
  .totals tr td { padding: 5px 8px; font-size: 12px; }
  .totals tr td:first-child { color: #555; }
  .totals tr td:last-child { text-align: right; font-weight: 600; }
  .total-row td { font-size: 15px; font-weight: 900; color: #0f2044; border-top: 2px solid #0f2044; padding-top: 8px; }
  .balance-row td { color: #c0392b; font-size: 13px; }
  .paid-row td { color: #27ae60; }
  .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
  .notes { flex: 1; font-size: 11px; color: #555; line-height: 1.6; }
  .notes h4 { font-size: 10px; font-weight: 700; color: #0f2044; text-transform: uppercase; margin-bottom: 4px; }
  .sign { text-align: center; min-width: 120px; }
  .sign-line { border-top: 1px solid #333; width: 120px; margin: 40px auto 4px; }
  .sign p { font-size: 10px; color: #555; }
  .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-35deg); font-size: 80px; font-weight: 900; color: rgba(200,200,200,0.15); pointer-events: none; text-transform: uppercase; }
  @media print { body { padding: 10px; } }
</style></head><body>
${inv.status === "paid" ? '<div class="watermark">PAID</div>' : ""}
<div class="header">
  <div>
    <div class="firm-name">Vakil &amp; Co.</div>
    <div class="firm-sub">Advocates &amp; Legal Consultants</div>
    <div class="firm-addr">
      123, Legal Complex, Connaught Place, New Delhi — 110001<br>
      📞 +91 98765 43210 &nbsp;|&nbsp; ✉ info@vakilco.in<br>
      GSTIN: 07AABCV1234P1Z5 &nbsp;|&nbsp; PAN: AABCV1234P
    </div>
  </div>
  <div class="inv-box">
    <div class="inv-type">${TYPE_LABELS[inv.type] ?? "Invoice"}</div>
    <div class="inv-num">${inv.number}</div>
    <div class="inv-meta">
      Date: ${fmtDate(inv.createdAt.slice(0, 10))}<br>
      ${inv.dueDate ? `Due: ${fmtDate(inv.dueDate)}<br>` : ""}
      Status: <strong>${(inv.status ?? "draft").toUpperCase()}</strong>
    </div>
  </div>
</div>

<div class="bill-section">
  <div class="bill-box">
    <h4>Bill To</h4>
    <p><strong>${inv.clientName}</strong><br>
    ${inv.clientAddress ? inv.clientAddress + "<br>" : ""}
    ${inv.clientState ? inv.clientState + "<br>" : ""}
    ${inv.clientPhone ? "📞 " + inv.clientPhone + "<br>" : ""}
    ${inv.clientEmail ? "✉ " + inv.clientEmail + "<br>" : ""}
    ${inv.clientGST ? "GSTIN: " + inv.clientGST : ""}</p>
  </div>
  <div class="bill-box">
    <h4>Payment Information</h4>
    <p>
      Bank: HDFC Bank, New Delhi<br>
      A/C No: 12345678901234<br>
      IFSC: HDFC0001234<br>
      UPI: vakilco@hdfcbank<br>
      ${inv.dueDate ? "<strong>Due Date: " + fmtDate(inv.dueDate) + "</strong>" : ""}
    </p>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:30px">#</th>
      <th>Description</th>
      <th style="width:50px">Qty</th>
      <th style="width:80px">Rate</th>
      <th style="width:50px">GST%</th>
      <th style="width:80px">GST Amt</th>
      <th style="width:90px">Total</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>

<table class="totals">
  <tr><td>Subtotal</td><td>₹${fmt(subtotal)}</td></tr>
  ${discAmt > 0 ? `<tr><td>Discount (${discountType === "percent" ? discount + "%" : "Fixed"})</td><td style="color:#c0392b">-₹${fmt(discAmt)}</td></tr>` : ""}
  ${gstAmount > 0 ? `<tr><td>GST</td><td>₹${fmt(gstAmount)}</td></tr>` : ""}
  <tr class="total-row"><td>Grand Total</td><td>₹${fmt(total)}</td></tr>
  ${paid > 0 ? `<tr class="paid-row"><td>Amount Paid</td><td>₹${fmt(paid)}</td></tr>` : ""}
  ${due > 0.01 ? `<tr class="balance-row"><td>Balance Due</td><td>₹${fmt(due)}</td></tr>` : ""}
</table>

<div class="footer">
  <div class="notes">
    ${inv.notes ? `<h4>Notes</h4><p>${inv.notes.replace(/\n/g, "<br>")}</p>` : ""}
    ${inv.terms ? `<h4 style="margin-top:8px">Terms &amp; Conditions</h4><p>${inv.terms.replace(/\n/g, "<br>")}</p>` : ""}
    <p style="margin-top:10px;color:#999;font-size:10px">This is a computer-generated document. No signature required.</p>
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

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AdminInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const [selected, setSelected] = useState<Invoice | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);

  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Invoice | null>(null);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [items, setItems] = useState<InvoiceItem[]>([blankItem()]);
  const [saving, setSaving] = useState(false);

  const [showPayment, setShowPayment] = useState(false);
  const [payForm, setPayForm] = useState({ amount: "", mode: "upi", transactionId: "", notes: "", paidAt: new Date().toISOString().slice(0, 10) });

  const load = useCallback(async () => {
    setLoading(true);
    const p = new URLSearchParams();
    if (search) p.set("search", search);
    if (filterType) p.set("type", filterType);
    if (filterStatus) p.set("status", filterStatus);
    try {
      const [invR, statsR] = await Promise.all([
        fetch(`/api/admin/invoices?${p}`).then(r => r.json()),
        fetch("/api/admin/invoices/stats").then(r => r.json()),
      ]);
      setInvoices(Array.isArray(invR) ? invR : []);
      setStats(statsR);
    } finally { setLoading(false); }
  }, [search, filterType, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const openInvoice = async (inv: Invoice) => {
    setSelected(inv);
    const p = await fetch(`/api/admin/invoices/${inv.id}/payments`).then(r => r.json());
    setPayments(Array.isArray(p) ? p : []);
  };

  const openCreate = (inv?: Invoice) => {
    if (inv) {
      setEditTarget(inv);
      setForm({ type: inv.type, dueDate: inv.dueDate ?? "", notes: inv.notes ?? "", terms: inv.terms ?? BLANK_FORM.terms, discount: inv.discount ?? "0", discountType: inv.discountType ?? "fixed", clientName: inv.clientName, clientEmail: inv.clientEmail ?? "", clientPhone: inv.clientPhone ?? "", clientAddress: inv.clientAddress ?? "", clientGST: inv.clientGST ?? "", clientState: inv.clientState ?? "" });
      setItems((inv.items ?? []).map(it => ({ ...it, _id: uid() })));
    } else {
      setEditTarget(null);
      setForm({ ...BLANK_FORM });
      setItems([blankItem()]);
    }
    setShowCreate(true);
  };

  const saveInvoice = async () => {
    if (!form.clientName.trim()) return;
    setSaving(true);
    const body = { ...form, discount: parseFloat(form.discount) || 0, items: items.map(({ _id, ...rest }) => rest) };
    if (editTarget) {
      await fetch(`/api/admin/invoices/${editTarget.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/admin/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setSaving(false); setShowCreate(false); setEditTarget(null); load();
    if (selected && editTarget?.id === selected.id) setSelected(null);
  };

  const deleteInvoice = async (id: number) => {
    if (!confirm("Delete this invoice permanently?")) return;
    await fetch(`/api/admin/invoices/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    load();
  };

  const markStatus = async (id: number, status: string) => {
    await fetch(`/api/admin/invoices/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    setSelected(prev => prev ? { ...prev, status } : null);
    load();
  };

  const addPayment = async () => {
    if (!selected || !payForm.amount) return;
    setSaving(true);
    await fetch(`/api/admin/invoices/${selected.id}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payForm) });
    setSaving(false); setShowPayment(false);
    setPayForm({ amount: "", mode: "upi", transactionId: "", notes: "", paidAt: new Date().toISOString().slice(0, 10) });
    const [updatedInv, pmts] = await Promise.all([
      fetch(`/api/admin/invoices/${selected.id}`).then(r => r.json()),
      fetch(`/api/admin/invoices/${selected.id}/payments`).then(r => r.json()),
    ]);
    setSelected(updatedInv);
    setPayments(Array.isArray(pmts) ? pmts : []);
    load();
  };

  const updateItem = (id: string, key: keyof InvoiceItem, val: string | number) => {
    setItems(its => its.map(it => it._id === id ? { ...it, [key]: val } : it));
  };
  const addItemRow = () => setItems(its => [...its, blankItem()]);
  const removeItemRow = (id: string) => setItems(its => its.length > 1 ? its.filter(it => it._id !== id) : its);

  const { subtotal, gstAmount, discAmt, total } = computeTotals(items, parseFloat(form.discount) || 0, form.discountType);

  const selTotal = parseFloat(selected?.total ?? "0");
  const selPaid = parseFloat(selected?.paidAmount ?? "0");
  const selBalance = selTotal - selPaid;

  return (
    <AdminLayout
      title="Invoice & Finance"
      subtitle={stats ? `₹${fmt(stats.paidAmount)} collected · ₹${fmt(stats.pendingAmount)} pending` : "Loading…"}
      actions={
        <Button onClick={() => openCreate()} className="bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] gap-1.5">
          <Plus size={15} /> New Invoice
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Total", value: stats?.totalInvoices ?? 0, type: "count", color: "text-gray-700", bg: "bg-white" },
          { label: "Invoiced", value: `₹${fmt(stats?.totalAmount)}`, type: "text", color: "text-[#0f2044]", bg: "bg-white" },
          { label: "Collected", value: `₹${fmt(stats?.paidAmount)}`, type: "text", color: "text-green-700", bg: "bg-green-50" },
          { label: "Pending", value: `₹${fmt(stats?.pendingAmount)}`, type: "text", color: "text-yellow-700", bg: "bg-yellow-50" },
          { label: "Overdue", value: stats?.overdueCount ?? 0, type: "count", color: "text-red-700", bg: "bg-red-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-gray-200 px-4 py-3`}>
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search by client…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none">
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none">
          <option value="">All Statuses</option>
          {["draft","sent","paid","partial","overdue","cancelled"].map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
        {(search || filterType || filterStatus) && (
          <Button variant="outline" size="sm" className="h-9" onClick={() => { setSearch(""); setFilterType(""); setFilterStatus(""); }}>
            <X size={13} className="mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>}
        {!loading && invoices.length === 0 && (
          <div className="py-20 text-center">
            <ReceiptText size={36} className="text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No invoices yet. Create your first one!</p>
          </div>
        )}
        {!loading && invoices.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Number</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Total</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">Paid</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Due</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map(inv => {
                  const paid = parseFloat(inv.paidAmount ?? "0");
                  const total = parseFloat(inv.total ?? "0");
                  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                  const overdue = inv.dueDate && inv.dueDate < new Date().toISOString().slice(0, 10) && inv.status !== "paid" && inv.status !== "cancelled";
                  return (
                    <tr key={inv.id} className="hover:bg-gray-50/70 transition-colors group">
                      <td className="px-4 py-3">
                        <button onClick={() => openInvoice(inv)} className="font-mono font-bold text-[#0f2044] hover:text-[#c9a227] text-xs transition-colors">{inv.number}</button>
                        <div className="text-[10px] text-gray-400">{fmtDate(inv.createdAt.slice(0, 10))}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800 text-sm">{inv.clientName}</div>
                        {inv.clientGST && <div className="text-[10px] text-gray-400">{inv.clientGST}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[inv.type] ?? "bg-gray-100 text-gray-600"}`}>{TYPE_LABELS[inv.type] ?? inv.type}</span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-gray-800">₹{fmt(inv.total)}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="text-green-700 font-semibold text-sm">₹{fmt(inv.paidAmount)}</div>
                        {total > 0 && <div className="mt-1 h-1 bg-gray-200 rounded-full w-16 ml-auto"><div className="h-1 bg-green-500 rounded-full" style={{ width: `${pct}%` }} /></div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[inv.status] ?? STATUS_COLORS.draft}`}>{inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}</span>
                      </td>
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                        {fmtDate(inv.dueDate)}{overdue ? " ⚠" : ""}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center gap-1 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openInvoice(inv)} className="p-1.5 text-gray-400 hover:text-[#0f2044] hover:bg-gray-100 rounded-lg transition-colors"><Eye size={13} /></button>
                          <button onClick={() => printInvoice(inv)} className="p-1.5 text-gray-400 hover:text-[#0f2044] hover:bg-gray-100 rounded-lg transition-colors"><Printer size={13} /></button>
                          <button onClick={() => openCreate(inv)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={13} /></button>
                          <button onClick={() => deleteInvoice(inv.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── DETAIL DRAWER ─── */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-[#0f2044] text-white px-5 py-4 flex items-start gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono font-bold text-[#c9a227] text-sm">{selected.number}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[selected.type] ?? ""}`}>{TYPE_LABELS[selected.type] ?? selected.type}</span>
                </div>
                <div className="font-bold text-lg leading-tight">{selected.clientName}</div>
                <div className="text-white/60 text-xs mt-0.5">{selected.clientGST ?? selected.clientEmail ?? ""}</div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => { openCreate(selected); setSelected(null); }} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"><Pencil size={14} /></button>
                <button onClick={() => printInvoice(selected)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"><Printer size={14} /></button>
                <button onClick={() => deleteInvoice(selected.id)} className="p-1.5 text-white/60 hover:text-red-300 hover:bg-white/10 rounded-lg"><Trash2 size={14} /></button>
                <button onClick={() => setSelected(null)} className="p-1.5 text-white/60 hover:text-white hover:bg-white/10 rounded-lg"><X size={16} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Status + Actions */}
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className={`text-sm px-3 py-1 rounded-full font-semibold ${STATUS_COLORS[selected.status] ?? STATUS_COLORS.draft}`}>
                  {selected.status.charAt(0).toUpperCase() + selected.status.slice(1)}
                </span>
                <div className="flex gap-1.5 flex-wrap">
                  {selected.status === "draft" && <button onClick={() => markStatus(selected.id, "sent")} className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 font-medium flex items-center gap-1"><Send size={11} />Mark Sent</button>}
                  {(selected.status === "sent" || selected.status === "partial" || selected.status === "overdue") && <button onClick={() => { setShowPayment(true); setPayForm(f => ({ ...f, amount: String(Math.max(0, selBalance).toFixed(2)) })); }} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium flex items-center gap-1"><CreditCard size={11} />Add Payment</button>}
                  {selected.status !== "cancelled" && selected.status !== "paid" && <button onClick={() => markStatus(selected.id, "cancelled")} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 font-medium">Cancel</button>}
                </div>
              </div>

              {/* Amounts */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-[#0f2044]">₹{fmt(selected.total)}</div>
                  <div className="text-xs text-gray-500">Grand Total</div>
                </div>
                <div className="bg-green-50 rounded-xl p-3 text-center">
                  <div className="text-lg font-bold text-green-700">₹{fmt(selected.paidAmount)}</div>
                  <div className="text-xs text-gray-500">Collected</div>
                </div>
                <div className={`rounded-xl p-3 text-center ${selBalance > 0.01 ? "bg-red-50" : "bg-gray-50"}`}>
                  <div className={`text-lg font-bold ${selBalance > 0.01 ? "text-red-600" : "text-gray-400"}`}>₹{fmt(selBalance)}</div>
                  <div className="text-xs text-gray-500">Balance</div>
                </div>
              </div>
              {selTotal > 0 && (
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-2 bg-green-500 rounded-full transition-all" style={{ width: `${Math.min(100, (selPaid / selTotal) * 100)}%` }} />
                </div>
              )}

              {/* Client details */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Client Information</div>
                <div className="grid grid-cols-2 gap-y-1.5 text-sm">
                  {selected.clientPhone && <><span className="text-gray-500 text-xs">Phone</span><span className="text-gray-800 font-medium text-xs">{selected.clientPhone}</span></>}
                  {selected.clientEmail && <><span className="text-gray-500 text-xs">Email</span><span className="text-gray-800 font-medium text-xs truncate">{selected.clientEmail}</span></>}
                  {selected.clientGST && <><span className="text-gray-500 text-xs">GSTIN</span><span className="text-gray-800 font-medium text-xs">{selected.clientGST}</span></>}
                  {selected.dueDate && <><span className="text-gray-500 text-xs">Due Date</span><span className="text-gray-800 font-medium text-xs">{fmtDate(selected.dueDate)}</span></>}
                  {selected.clientAddress && <><span className="text-gray-500 text-xs col-span-2">Address</span><span className="text-gray-800 font-medium text-xs col-span-2">{selected.clientAddress}</span></>}
                </div>
              </div>

              {/* Items */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Line Items</div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th><th className="text-right px-3 py-2 font-semibold text-gray-600">Qty</th><th className="text-right px-3 py-2 font-semibold text-gray-600">Rate</th><th className="text-right px-3 py-2 font-semibold text-gray-600">GST</th><th className="text-right px-3 py-2 font-semibold text-gray-600">Amount</th></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {(selected.items ?? []).map((it: InvoiceItem, i: number) => {
                        const { amount, gst, total: rowTotal } = computeItem(it);
                        return <tr key={i}><td className="px-3 py-2 text-gray-700">{it.description || "—"}</td><td className="px-3 py-2 text-right">{it.qty}</td><td className="px-3 py-2 text-right">₹{fmt(it.rate)}</td><td className="px-3 py-2 text-right text-gray-500">{it.gstRate}%</td><td className="px-3 py-2 text-right font-semibold">₹{fmt(rowTotal)}</td></tr>;
                      })}
                    </tbody>
                  </table>
                  <div className="bg-gray-50 border-t border-gray-200 px-3 py-2 flex flex-col items-end gap-1 text-xs">
                    <div className="flex gap-6"><span className="text-gray-500">Subtotal</span><span className="font-semibold">₹{fmt(selected.subtotal)}</span></div>
                    {parseFloat(selected.gstAmount ?? "0") > 0 && <div className="flex gap-6"><span className="text-gray-500">GST</span><span className="font-semibold">₹{fmt(selected.gstAmount)}</span></div>}
                    {parseFloat(selected.discount ?? "0") > 0 && <div className="flex gap-6"><span className="text-gray-500">Discount</span><span className="font-semibold text-red-500">-₹{fmt(selected.discountType === "percent" ? parseFloat(selected.subtotal) * parseFloat(selected.discount ?? "0") / 100 : parseFloat(selected.discount ?? "0"))}</span></div>}
                    <div className="flex gap-6 border-t border-gray-300 pt-1 mt-0.5"><span className="font-bold text-[#0f2044]">Grand Total</span><span className="font-bold text-[#0f2044]">₹{fmt(selected.total)}</span></div>
                  </div>
                </div>
              </div>

              {/* Payments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment History</div>
                  {selected.status !== "paid" && selected.status !== "cancelled" && (
                    <button onClick={() => { setShowPayment(true); setPayForm(f => ({ ...f, amount: String(Math.max(0, selBalance).toFixed(2)) })); }} className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium flex items-center gap-1">
                      <PlusCircle size={11} /> Add Payment
                    </button>
                  )}
                </div>
                {payments.length === 0 && <div className="text-xs text-gray-400 text-center py-3">No payments recorded yet</div>}
                <div className="space-y-2">
                  {payments.map(p => (
                    <div key={p.id} className="flex items-center gap-3 bg-green-50 rounded-xl px-3 py-2.5 border border-green-100">
                      <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-gray-700">₹{fmt(p.amount)} via {p.mode.replace("_", " ").toUpperCase()}</div>
                        {p.transactionId && <div className="text-[10px] text-gray-500">Ref: {p.transactionId}</div>}
                        {p.notes && <div className="text-[10px] text-gray-500">{p.notes}</div>}
                      </div>
                      <div className="text-[10px] text-gray-400 shrink-0">{fmtDate(p.paidAt)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              {(selected.notes || selected.terms) && (
                <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-600 space-y-2">
                  {selected.notes && <div><div className="font-semibold text-gray-700 mb-1">Notes</div>{selected.notes}</div>}
                  {selected.terms && <div><div className="font-semibold text-gray-700 mb-1">Terms</div>{selected.terms}</div>}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ─── CREATE / EDIT DIALOG ─── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl z-10 flex flex-col max-h-[92vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0f2044] text-white px-6 py-4 flex items-center justify-between shrink-0">
              <h2 className="font-bold text-base">{editTarget ? `Edit ${editTarget.number}` : "Create New Document"}</h2>
              <button onClick={() => setShowCreate(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>

            <div className="overflow-y-auto p-6 space-y-5 flex-1">
              {/* Type + Due Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Document Type</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} disabled={!!editTarget} className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 disabled:bg-gray-50">
                    {Object.entries(TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Due Date</label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="h-9" />
                </div>
              </div>

              {/* Client Info */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1"><FileText size={11} />Client Information</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1 block">Client Name *</label><Input value={form.clientName} onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))} placeholder="Full name or company" className="h-9" /></div>
                  <div><label className="text-xs font-semibold text-gray-600 mb-1 block">Email</label><Input value={form.clientEmail} onChange={e => setForm(f => ({ ...f, clientEmail: e.target.value }))} placeholder="email@example.com" className="h-9" /></div>
                  <div><label className="text-xs font-semibold text-gray-600 mb-1 block">Phone</label><Input value={form.clientPhone} onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))} placeholder="+91 98765 43210" className="h-9" /></div>
                  <div><label className="text-xs font-semibold text-gray-600 mb-1 block">GSTIN</label><Input value={form.clientGST} onChange={e => setForm(f => ({ ...f, clientGST: e.target.value }))} placeholder="07AABCV1234P1Z5" className="h-9" /></div>
                  <div><label className="text-xs font-semibold text-gray-600 mb-1 block">State</label><Input value={form.clientState} onChange={e => setForm(f => ({ ...f, clientState: e.target.value }))} placeholder="e.g. Delhi" className="h-9" /></div>
                  <div className="col-span-2"><label className="text-xs font-semibold text-gray-600 mb-1 block">Address</label><Input value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))} placeholder="Full address" className="h-9" /></div>
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1"><ShoppingCart size={11} />Line Items</div>
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead><tr className="bg-gray-50"><th className="text-left px-3 py-2 font-semibold text-gray-600">Description</th><th className="text-center px-2 py-2 font-semibold text-gray-600 w-16">Qty</th><th className="text-center px-2 py-2 font-semibold text-gray-600 w-24">Rate (₹)</th><th className="text-center px-2 py-2 font-semibold text-gray-600 w-20">GST %</th><th className="text-right px-3 py-2 font-semibold text-gray-600 w-24">Total</th><th className="w-8" /></tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {items.map(it => {
                        const { total: rowTotal } = computeItem(it);
                        return (
                          <tr key={it._id}>
                            <td className="px-2 py-1.5"><Input value={it.description} onChange={e => updateItem(it._id, "description", e.target.value)} placeholder="Description of service" className="h-7 text-xs border-gray-200" /></td>
                            <td className="px-1 py-1.5"><Input type="number" min="1" value={it.qty} onChange={e => updateItem(it._id, "qty", parseFloat(e.target.value) || 1)} className="h-7 text-xs text-center border-gray-200 w-16" /></td>
                            <td className="px-1 py-1.5"><Input type="number" min="0" value={it.rate} onChange={e => updateItem(it._id, "rate", parseFloat(e.target.value) || 0)} className="h-7 text-xs text-right border-gray-200 w-24" /></td>
                            <td className="px-1 py-1.5">
                              <select value={it.gstRate} onChange={e => updateItem(it._id, "gstRate", parseInt(e.target.value))} className="h-7 w-20 border border-gray-200 rounded-lg px-1 text-xs focus:outline-none">
                                {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-1.5 text-right font-semibold text-gray-700">₹{fmt(rowTotal)}</td>
                            <td className="pr-2 py-1.5"><button onClick={() => removeItemRow(it._id)} className="p-1 text-gray-300 hover:text-red-500 rounded"><Minus size={12} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-2 border-t border-gray-100 bg-gray-50">
                    <button onClick={addItemRow} className="text-xs text-[#0f2044] hover:text-[#c9a227] font-semibold flex items-center gap-1 transition-colors">
                      <PlusCircle size={12} /> Add Row
                    </button>
                  </div>
                </div>

                {/* Discount + Totals */}
                <div className="mt-3 flex justify-between items-start gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-gray-600">Discount</label>
                    <Input type="number" min="0" value={form.discount} onChange={e => setForm(f => ({ ...f, discount: e.target.value }))} className="h-8 w-20 text-xs" />
                    <select value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value }))} className="h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none">
                      <option value="fixed">₹ Fixed</option>
                      <option value="percent">% Percent</option>
                    </select>
                  </div>
                  <div className="text-xs space-y-1 text-right">
                    <div className="flex gap-8 justify-end"><span className="text-gray-500">Subtotal</span><span className="font-semibold">₹{fmt(subtotal)}</span></div>
                    {gstAmount > 0 && <div className="flex gap-8 justify-end"><span className="text-gray-500">GST</span><span className="font-semibold">₹{fmt(gstAmount)}</span></div>}
                    {discAmt > 0 && <div className="flex gap-8 justify-end"><span className="text-gray-500">Discount</span><span className="font-semibold text-red-500">-₹{fmt(discAmt)}</span></div>}
                    <div className="flex gap-8 justify-end border-t border-gray-300 pt-1 mt-1"><span className="font-bold text-[#0f2044]">Grand Total</span><span className="font-bold text-[#0f2044] text-base">₹{fmt(total)}</span></div>
                  </div>
                </div>
              </div>

              {/* Notes + Terms */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes for Client</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} placeholder="Any special notes…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 resize-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Terms & Conditions</label>
                  <textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 resize-none" />
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0 bg-gray-50">
              <Button onClick={saveInvoice} disabled={saving || !form.clientName.trim()} className="bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] flex-1">
                {saving ? "Saving…" : editTarget ? "Save Changes" : "Create Document"}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── PAYMENT DIALOG ─── */}
      {showPayment && selected && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={() => setShowPayment(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0f2044] text-white px-5 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="font-bold">Record Payment</h3>
              <button onClick={() => setShowPayment(false)} className="text-white/60 hover:text-white"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm">
                <span className="text-gray-500">Balance Due: </span>
                <span className="font-bold text-red-600">₹{fmt(selBalance)}</span>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Amount (₹) *</label>
                <Input type="number" min="0" step="0.01" value={payForm.amount} onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="h-9" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Payment Mode</label>
                  <select value={payForm.mode} onChange={e => setPayForm(f => ({ ...f, mode: e.target.value }))} className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none">
                    {PAYMENT_MODES.map(m => <option key={m} value={m}>{m.replace("_", " ").toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 mb-1 block">Payment Date</label>
                  <Input type="date" value={payForm.paidAt} onChange={e => setPayForm(f => ({ ...f, paidAt: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Transaction / Ref ID</label>
                <Input value={payForm.transactionId} onChange={e => setPayForm(f => ({ ...f, transactionId: e.target.value }))} placeholder="UPI ref, cheque no., etc." className="h-9" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
                <Input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note" className="h-9" />
              </div>
              <Button onClick={addPayment} disabled={saving || !payForm.amount} className="w-full bg-green-600 hover:bg-green-700 text-white">
                {saving ? "Recording…" : "Record Payment"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
