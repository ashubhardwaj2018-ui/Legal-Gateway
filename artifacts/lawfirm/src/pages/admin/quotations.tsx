import { useState } from "react";
import {
  useListQuotations, useCreateQuotation, useUpdateQuotation, useSendQuotation,
  getListQuotationsQueryKey, useGetQuotation, type Quotation
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, Send, Eye, FileText, PlusCircle, Printer, MessageCircle } from "lucide-react";

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

function QuotationDetail({ quotation, onClose, onSend }: { quotation: Quotation; onClose: () => void; onSend: () => void }) {
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
              <div className="font-serif text-lg font-bold">VAKIL & CO.</div>
              <div className="text-xs text-[#c9a227] mt-0.5">Legal Associates</div>
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

          <div className="flex gap-3">
            {quotation.status === "draft" && (
              <Button onClick={onSend} className="flex-1 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2">
                <Send size={14} /> Mark as Sent
              </Button>
            )}
            <Button variant="outline" onClick={() => window.print()} className="gap-2">
              <Printer size={14} /> Print
            </Button>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminQuotations() {
  const queryClient = useQueryClient();
  const { data: quotations, isLoading } = useListQuotations();
  const sendMutation = useSendQuotation();
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Quotation | null>(null);

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
                      {q.clientPhone && (
                        <Button size="sm" variant="ghost"
                          onClick={() => {
                            const num = q.clientPhone!.replace(/[\s\-().]/g, "").replace(/[^\d+]/g, "");
                            sendWaFromQuotation(num, `Dear ${q.clientName}, your quotation ${q.quotationNumber} for ₹${Number(q.total).toLocaleString("en-IN")} is ready for your review. Please let us know if you have any questions. — Vakil & Co.`);
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
