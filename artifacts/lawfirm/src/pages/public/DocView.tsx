import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { Scale, Printer, AlertCircle, Loader2 } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface DocSettings {
  // Firm identity keys (task #40)
  firm_name: string;
  firm_tagline: string;
  firm_address: string;
  firm_phone: string;
  firm_email: string;
  firm_gstin: string;
  firm_pan: string;
  // Bank details (task #40)
  bank_name: string;
  bank_account_no: string;
  bank_ifsc: string;
  bank_upi: string;
  // Legacy / fallback
  site_name: string;
  logo_url: string;
}

interface DocPayload {
  docType: "invoice" | "quotation";
  doc: Record<string, unknown>;
  settings: DocSettings;
  expiresAt: string;
}

function fmt(val: unknown) {
  return Number(val ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); }
  catch { return d; }
}

const TYPE_LABELS: Record<string, string> = {
  invoice: "Tax Invoice", quotation: "Quotation", proforma: "Proforma Invoice",
  po: "Purchase Order", credit_note: "Credit Note", debit_note: "Debit Note", receipt: "Payment Receipt",
};

export default function DocView() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [payload, setPayload] = useState<DocPayload | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setError("Invalid link."); setLoading(false); return; }
    fetch(`${BASE}/api/public/doc/${token}`)
      .then(async r => {
        if (r.status === 410) throw new Error("This link has expired.");
        if (!r.ok) throw new Error("Link not found or already expired.");
        return r.json() as Promise<DocPayload>;
      })
      .then(data => { setPayload(data); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 size={32} className="animate-spin text-[#0f2044]" />
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm text-center">
          <AlertCircle size={40} className="mx-auto text-red-400 mb-4" />
          <h2 className="font-bold text-lg text-gray-800 mb-2">Link Unavailable</h2>
          <p className="text-sm text-gray-500">{error ?? "This document link is invalid or has expired."}</p>
        </div>
      </div>
    );
  }

  const { doc, settings, docType } = payload;
  const items = (Array.isArray(doc.items) ? doc.items : []) as Array<{ description?: string; qty?: number; rate?: number; gstRate?: number; quantity?: number; unitPrice?: number }>;
  const firmName   = settings.firm_name || settings.site_name || "Legal Filing India";
  const isInvoice  = docType === "invoice";

  // Invoice-style doc
  if (isInvoice) {
    const subtotal    = parseFloat(String(doc.subtotal ?? "0"));
    const gstAmount   = parseFloat(String(doc.gstAmount ?? "0"));
    const discount    = parseFloat(String(doc.discount ?? "0"));
    const discType    = String(doc.discountType ?? "fixed");
    const discAmt     = discType === "percent" ? subtotal * discount / 100 : discount;
    const total       = parseFloat(String(doc.total ?? "0"));
    const paidAmount  = parseFloat(String(doc.paidAmount ?? "0"));
    const balance     = total - paidAmount;

    return (
      <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
        {/* Print button */}
        <div className="max-w-3xl mx-auto mb-4 flex justify-end print:hidden">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-[#0f2044] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0f2044]/90 transition-colors"
          >
            <Printer size={15} /> Download / Print
          </button>
        </div>

        {/* Invoice card */}
        <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0 print:rounded-none">
          {/* Header */}
          <div className="bg-[#0f2044] text-white px-8 py-6 flex items-start justify-between">
            <div>
              {settings.logo_url ? (
                <img src={settings.logo_url} alt={firmName} className="h-12 max-w-[160px] object-contain mb-2" />
              ) : (
                <div className="flex items-center gap-2 mb-2">
                  <Scale size={22} className="text-[#c9a227]" />
                  <span className="font-bold text-lg">{firmName}</span>
                </div>
              )}
              <p className="text-white/60 text-xs">{settings.firm_tagline}</p>
              {settings.firm_address && <p className="text-white/50 text-xs mt-1">{settings.firm_address}</p>}
              {settings.firm_phone   && <p className="text-white/50 text-xs">📞 {settings.firm_phone}</p>}
              {settings.firm_email   && <p className="text-white/50 text-xs">✉ {settings.firm_email}</p>}
              {settings.firm_gstin   && <p className="text-white/50 text-xs">GSTIN: {settings.firm_gstin}</p>}
              {settings.firm_pan     && <p className="text-white/50 text-xs">PAN: {settings.firm_pan}</p>}
            </div>
            <div className="text-right">
              <div className="text-[#c9a227] font-bold text-xs uppercase tracking-widest mb-1">
                {TYPE_LABELS[String(doc.type)] ?? "Invoice"}
              </div>
              <div className="text-2xl font-bold font-mono">{String(doc.number ?? doc.quotationNumber ?? "")}</div>
              <div className="text-white/60 text-xs mt-1">Date: {fmtDate(String(doc.createdAt ?? ""))}</div>
              {!!doc.dueDate && <div className="text-white/60 text-xs">Due: {fmtDate(String(doc.dueDate))}</div>}
              <div className="mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full font-semibold uppercase ${
                  doc.status === "paid" ? "bg-green-400/20 text-green-200" :
                  doc.status === "sent" ? "bg-blue-400/20 text-blue-200" :
                  "bg-white/10 text-white/60"
                }`}>{String(doc.status ?? "draft")}</span>
              </div>
            </div>
          </div>

          <div className="px-8 py-6">
            {/* Bill-to */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-bold text-[#0f2044] uppercase tracking-wide mb-2">Bill To</h4>
                <p className="font-semibold text-gray-800">{String(doc.clientName ?? "")}</p>
                {!!doc.clientAddress && <p className="text-xs text-gray-500 mt-0.5">{String(doc.clientAddress)}</p>}
                {!!doc.clientState   && <p className="text-xs text-gray-500">{String(doc.clientState)}</p>}
                {!!doc.clientPhone   && <p className="text-xs text-gray-500">📞 {String(doc.clientPhone)}</p>}
                {!!doc.clientEmail   && <p className="text-xs text-gray-500">✉ {String(doc.clientEmail)}</p>}
                {!!doc.clientGST     && <p className="text-xs text-gray-500">GSTIN: {String(doc.clientGST)}</p>}
              </div>
              {(settings.bank_name || settings.bank_account_no) && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-[#0f2044] uppercase tracking-wide mb-2">Payment Information</h4>
                  {settings.bank_name       && <p className="text-xs text-gray-600">Bank: {settings.bank_name}</p>}
                  {settings.bank_account_no && <p className="text-xs text-gray-600">A/C: {settings.bank_account_no}</p>}
                  {settings.bank_ifsc       && <p className="text-xs text-gray-600">IFSC: {settings.bank_ifsc}</p>}
                  {settings.bank_upi        && <p className="text-xs text-gray-600">UPI: {settings.bank_upi}</p>}
                </div>
              )}
            </div>

            {/* Line items */}
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[#0f2044]/5 text-[#0f2044]">
                    <th className="px-3 py-2 text-left text-xs font-semibold w-8">#</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold">Description</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold w-14">Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold w-24">Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold w-16">GST%</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold w-28">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map((it, i) => {
                    const qty  = Number(it.qty ?? it.quantity ?? 0);
                    const rate = Number(it.rate ?? it.unitPrice ?? 0);
                    const gst  = Number(it.gstRate ?? 0);
                    const base = qty * rate;
                    const tax  = base * gst / 100;
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2.5 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2.5 text-sm text-gray-700">{it.description || "—"}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-gray-600">{qty}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-gray-600">₹{fmt(rate)}</td>
                        <td className="px-3 py-2.5 text-xs text-right text-gray-400">{gst}%</td>
                        <td className="px-3 py-2.5 text-sm text-right font-medium">₹{fmt(base + tax)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end mb-6">
              <div className="w-64 space-y-1.5">
                <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>₹{fmt(subtotal)}</span></div>
                {discAmt > 0 && <div className="flex justify-between text-sm text-red-500"><span>Discount</span><span>-₹{fmt(discAmt)}</span></div>}
                {gstAmount > 0 && <div className="flex justify-between text-sm text-gray-600"><span>GST</span><span>₹{fmt(gstAmount)}</span></div>}
                <div className="flex justify-between font-bold text-base text-[#0f2044] border-t border-gray-200 pt-1.5">
                  <span>Grand Total</span><span>₹{fmt(total)}</span>
                </div>
                {paidAmount > 0 && <div className="flex justify-between text-sm text-green-600"><span>Amount Paid</span><span>₹{fmt(paidAmount)}</span></div>}
                {balance > 0.01 && <div className="flex justify-between text-sm font-semibold text-red-600"><span>Balance Due</span><span>₹{fmt(balance)}</span></div>}
              </div>
            </div>

            {/* Notes / Terms */}
            {(!!doc.notes || !!doc.terms) && (
              <div className="border-t border-gray-100 pt-4 text-xs text-gray-500 space-y-2">
                {!!doc.notes && <p><span className="font-semibold text-gray-700">Notes: </span>{String(doc.notes)}</p>}
                {!!doc.terms && <p><span className="font-semibold text-gray-700">Terms & Conditions: </span>{String(doc.terms)}</p>}
              </div>
            )}

            {/* Footer */}
            <div className="border-t border-gray-100 mt-6 pt-4 flex items-end justify-between">
              <p className="text-[10px] text-gray-400">Computer-generated document. No signature required.</p>
              <div className="text-center">
                <div className="border-t border-gray-400 w-32 mb-1 mt-8"></div>
                <p className="text-xs text-gray-500">Authorised Signatory</p>
                <p className="text-xs text-gray-500">{firmName}</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-4 print:hidden">
          Link expires: {fmtDate(payload.expiresAt)}
        </p>
      </div>
    );
  }

  // Quotation-style doc
  const quotItems = items as Array<{ serviceName?: string; description?: string; quantity?: number; unitPrice?: number; total?: number }>;
  const subtotal  = Number(doc.subtotal ?? 0);
  const taxAmt    = Number(doc.taxAmount ?? 0);
  const total     = Number(doc.total ?? 0);

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4 print:bg-white print:p-0">
      <div className="max-w-3xl mx-auto mb-4 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-[#0f2044] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#0f2044]/90 transition-colors"
        >
          <Printer size={15} /> Download / Print
        </button>
      </div>

      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden print:shadow-none print:border-0">
        <div className="bg-[#0f2044] text-white px-8 py-6 flex items-start justify-between">
          <div>
            {settings.logo_url ? (
              <img src={settings.logo_url} alt={firmName} className="h-12 max-w-[160px] object-contain mb-2" />
            ) : (
              <div className="flex items-center gap-2 mb-2">
                <Scale size={22} className="text-[#c9a227]" />
                <span className="font-bold text-lg">{firmName}</span>
              </div>
            )}
            {settings.firm_address && <p className="text-white/50 text-xs">{settings.firm_address}</p>}
            {settings.firm_phone   && <p className="text-white/50 text-xs">📞 {settings.firm_phone}</p>}
          </div>
          <div className="text-right">
            <div className="text-[#c9a227] font-bold text-xs uppercase tracking-widest mb-1">Quotation</div>
            <div className="text-2xl font-bold font-mono">{String(doc.quotationNumber ?? "")}</div>
            <div className="text-white/60 text-xs mt-1">Date: {fmtDate(String(doc.createdAt ?? ""))}</div>
            {!!doc.validityDays && <div className="text-white/60 text-xs">Valid for: {String(doc.validityDays)} days</div>}
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="bg-gray-50 rounded-xl p-4 mb-6 inline-block">
            <h4 className="text-xs font-bold text-[#0f2044] uppercase tracking-wide mb-1">Prepared For</h4>
            <p className="font-semibold text-gray-800">{String(doc.clientName ?? "")}</p>
            {!!doc.clientCompany && <p className="text-xs text-gray-500">{String(doc.clientCompany)}</p>}
            {!!doc.clientEmail   && <p className="text-xs text-gray-500">✉ {String(doc.clientEmail)}</p>}
            {!!doc.clientPhone   && <p className="text-xs text-gray-500">📞 {String(doc.clientPhone)}</p>}
          </div>

          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="bg-[#0f2044]/5 text-[#0f2044]">
                <th className="px-3 py-2 text-left text-xs font-semibold">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Service</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Unit Price</th>
                <th className="px-3 py-2 text-right text-xs font-semibold">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {quotItems.map((it, i) => {
                const lineTotal = it.total ?? (it.quantity ?? 1) * (it.unitPrice ?? 0);
                return (
                <tr key={i}>
                  <td className="px-3 py-2.5 text-xs text-gray-400">{i + 1}</td>
                  <td className="px-3 py-2.5 text-sm text-gray-700">
                    <div className="font-medium">{it.serviceName || it.description || "—"}</div>
                    {it.serviceName && it.description && (
                      <div className="text-xs text-gray-400">{it.description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-xs text-right">{it.quantity ?? 1}</td>
                  <td className="px-3 py-2.5 text-xs text-right">₹{fmt(it.unitPrice ?? 0)}</td>
                  <td className="px-3 py-2.5 text-sm text-right font-medium">₹{fmt(lineTotal)}</td>
                </tr>
                );
              })}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-56 space-y-1.5">
              <div className="flex justify-between text-sm text-gray-600"><span>Subtotal</span><span>₹{fmt(subtotal)}</span></div>
              {taxAmt > 0 && <div className="flex justify-between text-sm text-gray-600"><span>Tax ({String(doc.taxPercent ?? 0)}%)</span><span>₹{fmt(taxAmt)}</span></div>}
              <div className="flex justify-between font-bold text-base text-[#0f2044] border-t border-gray-200 pt-1.5">
                <span>Total</span><span>₹{fmt(total)}</span>
              </div>
            </div>
          </div>

          {!!doc.notes && (
            <div className="border-t border-gray-100 mt-6 pt-4 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Notes: </span>{String(doc.notes)}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-gray-400 mt-4 print:hidden">
        Link expires: {fmtDate(payload.expiresAt)}
      </p>
    </div>
  );
}
