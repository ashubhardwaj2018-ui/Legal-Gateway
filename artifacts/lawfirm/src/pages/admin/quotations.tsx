import { useState, useEffect, useRef } from "react";
import {
  useListQuotations, useCreateQuotation, useUpdateQuotation, useSendQuotation,
  getListQuotationsQueryKey, useGetQuotation, type Quotation
} from "@workspace/api-client-react";
import { useSiteSettings } from "@/hooks/useSiteSettings";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Send, Eye, FileText, PlusCircle, Printer, MessageCircle, Download, Link2, Check } from "lucide-react";

// ─── Firm details helper ─────────────────────────────────────────────────────

interface FirmDetails {
  firmName: string; firmTagline: string; firmAddress: string;
  firmPhone: string; firmEmail: string; firmGstin: string; firmPan: string;
  bankName: string; bankAccountNo: string; bankIfsc: string; bankUpi: string;
  logoUrl: string;
}

const FIRM_DEFAULTS: FirmDetails = {
  firmName: "Legal Filing India", firmTagline: "Advocates & Legal Consultants",
  firmAddress: "123, Legal Complex, Connaught Place, New Delhi — 110001",
  firmPhone: "+91 98765 43210", firmEmail: "info@legalfilingindia.com",
  firmGstin: "07AABCV1234P1Z5", firmPan: "AABCV1234P",
  bankName: "HDFC Bank, New Delhi", bankAccountNo: "12345678901234",
  bankIfsc: "HDFC0001234", bankUpi: "legalfilingindia@hdfcbank",
  logoUrl: "",
};

async function fetchFirmDetails(): Promise<FirmDetails> {
  try {
    const r = await fetch("/api/settings");
    if (!r.ok) return FIRM_DEFAULTS;
    const s: Record<string, string> = await r.json();
    return {
      firmName:      s.firm_name       || FIRM_DEFAULTS.firmName,
      firmTagline:   s.firm_tagline    || FIRM_DEFAULTS.firmTagline,
      firmAddress:   s.firm_address    || FIRM_DEFAULTS.firmAddress,
      firmPhone:     s.firm_phone      || FIRM_DEFAULTS.firmPhone,
      firmEmail:     s.firm_email      || FIRM_DEFAULTS.firmEmail,
      firmGstin:     s.firm_gstin      || FIRM_DEFAULTS.firmGstin,
      firmPan:       s.firm_pan        || FIRM_DEFAULTS.firmPan,
      bankName:      s.bank_name       || FIRM_DEFAULTS.bankName,
      bankAccountNo: s.bank_account_no || FIRM_DEFAULTS.bankAccountNo,
      bankIfsc:      s.bank_ifsc       || FIRM_DEFAULTS.bankIfsc,
      bankUpi:       s.bank_upi        || FIRM_DEFAULTS.bankUpi,
      logoUrl:       s.logo_url        || "",
    };
  } catch {
    return FIRM_DEFAULTS;
  }
}

// ─── Quotation Print / Download PDF ─────────────────────────────────────────

async function printQuotation(q: Quotation) {
  const firm = await fetchFirmDetails();

  const items = (q.items ?? []) as Array<{ serviceName: string; description: string; quantity: number; unitPrice: number; total: number }>;
  const subtotal = q.subtotal ?? 0;
  const taxAmt = q.taxAmount ?? 0;
  const total = q.total ?? 0;

  const rows = items.map((it, i) => `<tr>
    <td>${i + 1}</td>
    <td style="text-align:left"><strong>${it.serviceName || "—"}</strong>${it.description ? `<br><span style="font-size:10px;color:#888">${it.description}</span>` : ""}</td>
    <td>${it.quantity}</td>
    <td>₹${it.unitPrice.toLocaleString("en-IN")}</td>
    <td>₹${it.total.toLocaleString("en-IN")}</td>
  </tr>`).join("");

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
  .footer { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
  .notes { flex: 1; font-size: 11px; color: #555; line-height: 1.6; }
  .notes h4 { font-size: 10px; font-weight: 700; color: #0f2044; text-transform: uppercase; margin-bottom: 4px; }
  .sign { text-align: center; min-width: 120px; }
  .sign-line { border-top: 1px solid #333; width: 120px; margin: 40px auto 4px; }
  .sign p { font-size: 10px; color: #555; }
  @media print { body { padding: 10px; } }
</style></head><body>
<div class="header">
  <div>
    ${firm.logoUrl
      ? `<img src="${firm.logoUrl}" alt="${firm.firmName}" style="max-height:52px;max-width:180px;object-fit:contain;margin-bottom:6px;display:block;">`
      : `<svg width="52" height="52" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-bottom:6px;display:block;border-radius:10px"><rect width="180" height="180" rx="36" fill="#0f2044"/><rect x="28" y="22" width="124" height="6" rx="3" fill="#c9a227"/><rect x="24" y="58" width="13" height="72" rx="3" fill="#fff"/><rect x="24" y="117" width="38" height="13" rx="3" fill="#fff"/><rect x="74" y="58" width="13" height="72" rx="3" fill="#fff"/><rect x="74" y="58" width="38" height="13" rx="3" fill="#fff"/><rect x="74" y="86" width="30" height="11" rx="3" fill="#c9a227"/><rect x="124" y="58" width="32" height="13" rx="3" fill="#fff"/><rect x="131" y="71" width="13" height="46" rx="3" fill="#fff"/><rect x="124" y="117" width="32" height="13" rx="3" fill="#fff"/><circle cx="90" cy="156" r="6" fill="#c9a227"/></svg>`
    }
    <div class="firm-name">${firm.firmName}</div>
    <div class="firm-sub">${firm.firmTagline}</div>
    <div class="firm-addr">
      ${firm.firmAddress}<br>
      📞 ${firm.firmPhone} &nbsp;|&nbsp; ✉ ${firm.firmEmail}<br>
      ${firm.firmGstin ? `GSTIN: ${firm.firmGstin}` : ""}${firm.firmGstin && firm.firmPan ? " &nbsp;|&nbsp; " : ""}${firm.firmPan ? `PAN: ${firm.firmPan}` : ""}
    </div>
  </div>
  <div class="doc-box">
    <div class="doc-type">Quotation</div>
    <div class="doc-num">${q.quotationNumber}</div>
    <div class="doc-meta">
      Date: ${new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}<br>
      Valid for: ${q.validityDays} days<br>
      Status: <strong>${(q.status ?? "draft").toUpperCase()}</strong>
    </div>
  </div>
</div>

<div class="bill-section">
  <div class="bill-box">
    <h4>Prepared For</h4>
    <p><strong>${q.clientName}</strong><br>
    ${q.clientCompany ? q.clientCompany + "<br>" : ""}
    ${q.clientPhone ? "📞 " + q.clientPhone + "<br>" : ""}
    ${q.clientEmail ? "✉ " + q.clientEmail : ""}</p>
  </div>
  <div class="bill-box">
    <h4>Quotation Details</h4>
    <p>
      This quotation is valid for <strong>${q.validityDays} days</strong> from the date of issue.<br>
      For queries, contact us at ${firm.firmEmail}
    </p>
  </div>
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
  <tr><td>Subtotal</td><td>₹${subtotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
  <tr><td>GST (${q.taxPercent}%)</td><td>₹${taxAmt.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
  <tr class="total-row"><td>Grand Total</td><td>₹${total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td></tr>
</table>

<div class="footer">
  <div class="notes">
    ${q.notes ? `<h4>Notes</h4><p>${q.notes.replace(/\n/g, "<br>")}</p>` : ""}
    <p style="margin-top:${q.notes ? "10px" : "0"};color:#999;font-size:10px">This is a computer-generated quotation. Subject to acceptance within the validity period.</p>
  </div>
  <div class="sign">
    <div class="sign-line"></div>
    <p>Authorised Signatory</p>
    <p>${firm.firmName}</p>
  </div>
</div>
<script>window.onload = function(){ window.print(); }</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

/** Call /admin/whatsapp/send, store the message, then open WhatsApp Web. */
async function sendWaFromQuotation(toNumber: string, message: string) {
  try {
    const r = await fetch("/api/admin/whatsapp/send", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toNumber, message, senderName: "Admin" }),
    });
    if (r.ok) { const d = await r.json(); if (d.waUrl) window.open(d.waUrl, "_blank"); }
  } catch { /* noop */ }
}

// ─── WhatsApp quick-send with template support ────────────────────────────────

interface WaTemplate { id: number; name: string; body: string; category: string; isActive: boolean }

function resolvePlaceholders(body: string, ctx: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => ctx[k] ?? `{{${k}}}`);
}

/**
 * ctx — document-specific placeholder values, e.g.:
 *   { ClientName, QuotationNo, Amount, ValidityDays, CompanyName }
 * These are resolved into the template body client-side before sending,
 * so the stored message and the WhatsApp text are always fully resolved.
 */
function WaSendButton({
  phone, defaultMessage, categoryHint, ctx,
}: {
  phone: string; defaultMessage: string; categoryHint: string;
  ctx: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(defaultMessage);
  const [templateId, setTemplateId] = useState<number | undefined>(undefined);
  const [templateName, setTemplateName] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);

  // Keep a ref so the fetch callback always sees the latest ctx without
  // causing the effect to re-fire on every render.
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  useEffect(() => {
    if (!open || templatesLoaded) return;
    fetch("/api/admin/whatsapp/templates", { credentials: "include" })
      .then(r => r.json())
      .then((ts: WaTemplate[]) => {
        const match = ts.find(t => t.isActive && t.category.toLowerCase().includes(categoryHint));
        if (match) {
          // Resolve all {{Placeholder}} tokens with document-specific context
          setMessage(resolvePlaceholders(match.body, ctxRef.current));
          setTemplateId(match.id);
          setTemplateName(match.name);
        }
        setTemplatesLoaded(true);
      })
      .catch(() => { setTemplatesLoaded(true); });
  }, [open, templatesLoaded, categoryHint]);

  const send = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      const r = await fetch("/api/admin/whatsapp/send", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        // Pass the pre-resolved message + templateId for storage.
        // The backend skips re-resolution when message is non-empty.
        body: JSON.stringify({ toNumber: phone, message, templateId, templateName, senderName: "Admin" }),
      });
      if (r.ok) { const d = await r.json(); if (d.waUrl) window.open(d.waUrl, "_blank"); }
      setOpen(false);
    } catch { /* noop */ }
    finally { setSending(false); }
  };

  if (!phone) return null;
  return (
    <div className="w-full">
      {!open ? (
        <Button variant="outline" onClick={() => setOpen(true)}
          className="w-full gap-2 text-green-700 border-green-300 hover:bg-green-50 hover:border-green-400">
          <MessageCircle size={14} /> Send WhatsApp
        </Button>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-green-800 flex items-center gap-1.5">
              <MessageCircle size={12} /> Sending to {phone}
              {templateName && <span className="ml-1 text-green-600 font-normal">· template: {templateName}</span>}
            </span>
            <button onClick={() => setOpen(false)} className="text-green-600 hover:text-green-900 p-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <textarea
            value={message} onChange={e => setMessage(e.target.value)} rows={4}
            placeholder="Type your message…"
            className="w-full text-xs border border-green-200 rounded-lg px-3 py-2 focus:outline-none focus:border-green-400 bg-white resize-none"
          />
          <Button onClick={send} disabled={sending || !message.trim()}
            className="w-full bg-green-600 hover:bg-green-700 text-white gap-2 h-8 text-xs">
            {sending ? "Opening WhatsApp…" : "Send & Open WhatsApp ↗"}
          </Button>
        </div>
      )}
    </div>
  );
}

type QuotationItem = { serviceName: string; description: string; quantity: number; unitPrice: number; total: number };

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
  expired: "bg-orange-100 text-orange-800",
};

function QuotationForm({ onSuccess }: { onSuccess: () => void }) {
  const queryClient = useQueryClient();
  const createMutation = useCreateQuotation();

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientCompany, setClientCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [validityDays, setValidityDays] = useState("30");
  const [taxPercent, setTaxPercent] = useState("18");
  const [items, setItems] = useState<QuotationItem[]>([
    { serviceName: "", description: "", quantity: 1, unitPrice: 0, total: 0 }
  ]);

  const updateItem = (idx: number, key: keyof QuotationItem, val: string | number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const updated = { ...item, [key]: val };
      updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, { serviceName: "", description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  const removeItem = (idx: number) => setItems(prev => prev.filter((_, i) => i !== idx));

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxAmt = Math.round(subtotal * parseInt(taxPercent || "0") / 100);
  const total = subtotal + taxAmt;

  const handleSubmit = () => {
    if (!clientName || !clientEmail || items.some(i => !i.serviceName)) return;
    createMutation.mutate(
      {
        data: {
          clientName, clientEmail,
          clientPhone: clientPhone || null,
          clientCompany: clientCompany || null,
          items, taxPercent: parseInt(taxPercent),
          notes: notes || null, validityDays: parseInt(validityDays)
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
          onSuccess();
        }
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Client Info */}
      <div>
        <h3 className="text-sm font-semibold text-[#0f2044] mb-3 pb-2 border-b">Client Information</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs">Client Name *</Label>
            <Input className="mt-1 h-9 text-sm" value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="col-span-2 sm:col-span-1">
            <Label className="text-xs">Email *</Label>
            <Input className="mt-1 h-9 text-sm" type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="email@example.com" />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input className="mt-1 h-9 text-sm" value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="+91 98765 43210" />
          </div>
          <div>
            <Label className="text-xs">Company</Label>
            <Input className="mt-1 h-9 text-sm" value={clientCompany} onChange={e => setClientCompany(e.target.value)} placeholder="Company name (optional)" />
          </div>
        </div>
      </div>

      {/* Line Items */}
      <div>
        <h3 className="text-sm font-semibold text-[#0f2044] mb-3 pb-2 border-b">Services & Items *</h3>
        <div className="space-y-3">
          {items.map((item, idx) => (
            <div key={idx} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
              <div className="grid grid-cols-12 gap-2">
                <div className="col-span-12 sm:col-span-5">
                  <Label className="text-xs">Service Name</Label>
                  <Input className="mt-1 h-8 text-xs" value={item.serviceName} onChange={e => updateItem(idx, "serviceName", e.target.value)} placeholder="e.g., Trademark Registration" />
                </div>
                <div className="col-span-4 sm:col-span-2">
                  <Label className="text-xs">Qty</Label>
                  <Input className="mt-1 h-8 text-xs" type="number" min={1} value={item.quantity} onChange={e => updateItem(idx, "quantity", parseInt(e.target.value) || 1)} />
                </div>
                <div className="col-span-5 sm:col-span-3">
                  <Label className="text-xs">Unit Price (₹)</Label>
                  <Input className="mt-1 h-8 text-xs" type="number" min={0} value={item.unitPrice} onChange={e => updateItem(idx, "unitPrice", parseInt(e.target.value) || 0)} />
                </div>
                <div className="col-span-2 sm:col-span-2 flex flex-col items-end pt-5">
                  <span className="text-sm font-semibold text-[#0f2044]">₹{item.total.toLocaleString("en-IN")}</span>
                </div>
                <div className="col-span-1 sm:col-span-1 flex items-end justify-end pb-0.5">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 p-1">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="col-span-12">
                  <Label className="text-xs">Description</Label>
                  <Input className="mt-1 h-8 text-xs" value={item.description} onChange={e => updateItem(idx, "description", e.target.value)} placeholder="Brief description of service" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <button onClick={addItem} className="mt-2 flex items-center gap-1.5 text-xs text-[#c9a227] hover:text-[#b08820] font-medium">
          <PlusCircle size={14} /> Add Service
        </button>
      </div>

      {/* Summary */}
      <div className="bg-[#0f2044]/5 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Subtotal</span>
          <span className="font-medium">₹{subtotal.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-600">Tax</span>
            <Input className="h-7 w-16 text-xs text-center" value={taxPercent} onChange={e => setTaxPercent(e.target.value)} />
            <span className="text-gray-500 text-xs">%</span>
          </div>
          <span className="font-medium">₹{taxAmt.toLocaleString("en-IN")}</span>
        </div>
        <div className="flex justify-between text-base font-bold text-[#0f2044] border-t pt-2 mt-2">
          <span>Total</span>
          <span>₹{total.toLocaleString("en-IN")}</span>
        </div>
      </div>

      {/* Settings */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Validity (days)</Label>
          <Input className="mt-1 h-9 text-sm" type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-xs">Notes for Client</Label>
          <Textarea className="mt-1 text-sm" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes or terms..." />
        </div>
      </div>

      <Button
        onClick={handleSubmit}
        disabled={createMutation.isPending || !clientName || !clientEmail}
        className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white"
      >
        {createMutation.isPending ? "Creating..." : "Create Quotation"}
      </Button>
    </div>
  );
}

function QuotationDetail({ quotation, onClose, onSend, onCopyLink, copied }: {
  quotation: Quotation; onClose: () => void; onSend: () => void;
  onCopyLink?: () => void; copied?: boolean;
}) {
  const settings = useSiteSettings();
  const firmName = settings.site_name || "Legal Filing India";
  const items = (quotation.items ?? []) as QuotationItem[];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#0f2044]">{quotation.quotationNumber}</DialogTitle>
        </DialogHeader>
        <div className="mt-4 space-y-4">
          {/* Header */}
          <div className="bg-[#0f2044] text-white p-4 rounded-lg flex justify-between items-start">
            <div>
              <div className="font-serif text-lg font-bold">LEGAL FILING INDIA</div>
              <div className="text-xs text-[#c9a227] mt-0.5">India's Trusted Filing Platform</div>
            </div>
            <div className="text-right text-sm">
              <div className="font-bold">{quotation.quotationNumber}</div>
              <div className="text-white/70 text-xs">{new Date(quotation.createdAt).toLocaleDateString("en-IN")}</div>
              <span className={`inline-flex mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[quotation.status] ?? "bg-white/10 text-white"}`}>
                {quotation.status}
              </span>
            </div>
          </div>

          {/* Client Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 mb-1">Bill To</p>
              <p className="font-semibold">{quotation.clientName}</p>
              <p className="text-gray-600">{quotation.clientEmail}</p>
              {quotation.clientPhone && <p className="text-gray-600">{quotation.clientPhone}</p>}
              {quotation.clientCompany && <p className="text-gray-500 text-xs">{quotation.clientCompany}</p>}
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Validity</p>
              <p className="font-medium">{quotation.validityDays} days</p>
              {quotation.sentAt && (
                <>
                  <p className="text-xs text-gray-500 mt-2 mb-1">Sent On</p>
                  <p className="font-medium">{new Date(quotation.sentAt).toLocaleDateString("en-IN")}</p>
                </>
              )}
            </div>
          </div>

          {/* Items */}
          <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Service</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Qty</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Unit Price</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map((item, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">
                    <div className="font-medium">{item.serviceName}</div>
                    <div className="text-xs text-gray-500">{item.description}</div>
                  </td>
                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                  <td className="px-3 py-2 text-right">₹{item.unitPrice.toLocaleString("en-IN")}</td>
                  <td className="px-3 py-2 text-right font-medium">₹{item.total.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-gray-500">Subtotal</td>
                <td className="px-3 py-1.5 text-right text-sm">₹{quotation.subtotal.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-1.5 text-right text-xs text-gray-500">GST ({quotation.taxPercent}%)</td>
                <td className="px-3 py-1.5 text-right text-sm">₹{quotation.taxAmount.toLocaleString("en-IN")}</td>
              </tr>
              <tr>
                <td colSpan={3} className="px-3 py-2 text-right font-bold text-[#0f2044]">Total</td>
                <td className="px-3 py-2 text-right font-bold text-[#0f2044] text-base">₹{quotation.total.toLocaleString("en-IN")}</td>
              </tr>
            </tfoot>
          </table>

          {quotation.notes && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Notes</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{quotation.notes}</p>
            </div>
          )}

          <div className="space-y-3">
            <div className="flex gap-3 flex-wrap">
              {quotation.status === "draft" && (
                <Button onClick={onSend} className="flex-1 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2">
                  <Send size={14} /> Mark as Sent
                </Button>
              )}
              <Button variant="outline" onClick={() => printQuotation(quotation)} className="gap-2">
                <Printer size={14} /> Print
              </Button>
              <Button variant="outline" onClick={() => printQuotation(quotation)} className="gap-2 bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] border-0">
                <Download size={14} /> Download PDF
              </Button>
              {onCopyLink && (
                <Button variant="outline" onClick={onCopyLink} className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50">
                  {copied ? <><Check size={14} />Copied!</> : <><Link2 size={14} />Copy Link</>}
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>Close</Button>
            </div>
            {quotation.clientPhone && (
              <WaSendButton
                phone={quotation.clientPhone}
                defaultMessage={`Dear ${quotation.clientName}, your quotation ${quotation.quotationNumber} for ₹${(quotation.total ?? 0).toLocaleString("en-IN")} is ready for your review. Valid for ${quotation.validityDays} days. Please contact us for any queries. — ${firmName}`}
                categoryHint="quotation"
                ctx={{
                  ClientName: quotation.clientName,
                  QuotationNo: quotation.quotationNumber,
                  Amount: `₹${(quotation.total ?? 0).toLocaleString("en-IN")}`,
                  ValidityDays: String(quotation.validityDays),
                  CompanyName: firmName,
                  SupportEmail: "info@legalfilingindia.com",
                }}
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminQuotations() {
  const settings = useSiteSettings();
  const firmName = settings.site_name || "Legal Filing India";
  const queryClient = useQueryClient();
  const { data: quotations, isLoading } = useListQuotations();
  const sendMutation = useSendQuotation();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Quotation | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const handleCopyLink = async (id: number) => {
    try {
      const r = await fetch(`/api/admin/quotations/${id}/share-link`, {
        method: "POST", credentials: "include",
      });
      if (!r.ok) throw new Error("Failed");
      const { token } = await r.json() as { token: string };
      const url = `${window.location.origin}${import.meta.env.BASE_URL}public/doc/${token}`;
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(c => c === id ? null : c), 3000);
    } catch {
      alert("Could not generate link. Please try again.");
    }
  };

  const handleSend = (id: number) => {
    sendMutation.mutate(
      { id },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListQuotationsQueryKey() });
          setSelected(data);
        }
      }
    );
  };

  return (
    <AdminLayout
      title="Quotations"
      subtitle={`${(quotations ?? []).length} quotations`}
      actions={
        <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white">
          <Plus size={14} /> New Quotation
        </Button>
      }
    >
      {/* Create Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif text-[#0f2044]">Create Quotation</DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <QuotationForm onSuccess={() => setShowForm(false)} />
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      {selected && (
        <QuotationDetail
          quotation={selected}
          onClose={() => setSelected(null)}
          onSend={() => handleSend(selected.id)}
          onCopyLink={() => handleCopyLink(selected.id)}
          copied={copiedId === selected.id}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Quotation #</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              )) : (quotations ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <FileText size={32} className="text-gray-300" />
                      <p className="text-gray-400">No quotations yet</p>
                      <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 bg-[#0f2044] text-white">
                        <Plus size={14} /> Create First Quotation
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (quotations ?? []).map(q => (
                <tr key={q.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs font-medium text-[#0f2044]">{q.quotationNumber}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{q.clientName}</div>
                    <div className="text-xs text-gray-400">{q.clientEmail}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="font-semibold text-[#0f2044]">₹{q.total.toLocaleString("en-IN")}</div>
                    <div className="text-xs text-gray-400">incl. {q.taxPercent}% GST</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 whitespace-nowrap">
                    {new Date(q.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[q.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {q.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(q)} className="h-7 px-2 text-xs gap-1 text-[#0f2044]">
                        <Eye size={12} /> View
                      </Button>
                      {q.status === "draft" && (
                        <Button size="sm" variant="ghost" onClick={() => handleSend(q.id)} className="h-7 px-2 text-xs gap-1 text-blue-600">
                          <Send size={12} /> Send
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => printQuotation(q)} className="h-7 px-2 text-xs gap-1 text-gray-600 hover:text-[#0f2044] hover:bg-gray-100">
                        <Download size={12} /> PDF
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCopyLink(q.id)} className="h-7 px-2 text-xs gap-1 text-purple-600 hover:bg-purple-50" title="Copy share link">
                        {copiedId === q.id ? <><Check size={12} />Copied</> : <><Link2 size={12} />Link</>}
                      </Button>
                      {q.clientPhone && (
                        <Button size="sm" variant="ghost"
                          onClick={() => {
                            const num = q.clientPhone!.replace(/[\s\-().]/g, "").replace(/[^\d+]/g, "");
                            sendWaFromQuotation(num, `Dear ${q.clientName}, your quotation ${q.quotationNumber} for ₹${Number(q.total).toLocaleString("en-IN")} is ready for your review. Please let us know if you have any questions. — ${firmName}`);
                          }}
                          className="h-7 px-2 text-xs gap-1 text-green-600 hover:text-green-700 hover:bg-green-50">
                          <MessageCircle size={12} /> WA
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
}
