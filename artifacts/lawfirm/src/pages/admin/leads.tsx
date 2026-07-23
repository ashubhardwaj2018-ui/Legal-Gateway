import { useState } from "react";
import { useListConsultations, useUpdateConsultation, getListConsultationsQueryKey, type Consultation } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Download, Eye, Filter } from "lucide-react";


const STATUS_OPTIONS = ["all", "pending", "contacted", "completed", "closed"];
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border border-yellow-200",
  contacted: "bg-blue-100 text-blue-800 border border-blue-200",
  completed: "bg-green-100 text-green-800 border border-green-200",
  closed: "bg-gray-100 text-gray-600 border border-gray-200",
};

function DetailModal({ lead, onClose, onUpdate }: { lead: Consultation; onClose: () => void; onUpdate: (id: number, status: string, notes: string) => void }) {
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#0f2044]">Lead Detail — {lead.name}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Full Name</p>
            <p className="font-medium text-sm">{lead.name}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Phone</p>
            <p className="font-medium text-sm">{lead.phone}</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs text-gray-500 mb-1">Email</p>
            <p className="font-medium text-sm">{lead.email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Service Category</p>
            <p className="font-medium text-sm capitalize">{lead.serviceCategory.replace("-", " ")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Service Interest</p>
            <p className="font-medium text-sm">{lead.serviceInterest}</p>
          </div>
          {lead.preferredDate && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Preferred Date</p>
              <p className="font-medium text-sm">{lead.preferredDate}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-gray-500 mb-1">Submitted</p>
            <p className="font-medium text-sm">{new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          {lead.message && (
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Message</p>
              <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">{lead.message}</p>
            </div>
          )}
          <div className="col-span-2">
            <Label className="text-xs">Update Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Internal Notes</Label>
            <Textarea className="mt-1" rows={3} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add notes about this lead..." />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button onClick={() => onUpdate(lead.id, status, notes)} className="flex-1 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white">
            Save Changes
          </Button>
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function exportCSV(data: Consultation[]) {
  const headers = ["ID", "Name", "Email", "Phone", "Category", "Service", "Message", "Preferred Date", "Status", "Notes", "Created At"];
  const rows = data.map(c => [
    c.id, c.name, c.email, c.phone, c.serviceCategory, c.serviceInterest,
    (c.message ?? "").replace(/,/g, ";"), c.preferredDate ?? "", c.status, (c.notes ?? "").replace(/,/g, ";"),
    new Date(c.createdAt).toLocaleDateString("en-IN")
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "leads.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminLeads() {
  const queryClient = useQueryClient();
  const { data: consultations, isLoading } = useListConsultations();
  const updateMutation = useUpdateConsultation();
  const [selectedLead, setSelectedLead] = useState<Consultation | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (consultations ?? []).filter(c => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.serviceInterest.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const handleUpdate = (id: number, status: string, notes: string) => {
    updateMutation.mutate(
      { id, data: { status, notes } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConsultationsQueryKey() });
          setSelectedLead(null);
        },
      }
    );
  };

  return (
    <AdminLayout
      title="Consultation Leads"
      subtitle={`${filtered.length} of ${(consultations ?? []).length} leads`}
      actions={
        <Button size="sm" variant="outline" onClick={() => exportCSV(filtered)} className="gap-1.5">
          <Download size={14} /> Export CSV
        </Button>
      }
    >
      {selectedLead && (
        <DetailModal
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={handleUpdate}
        />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Search by name, email or service..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-40 text-sm shrink-0">
            <Filter size={12} className="mr-1 text-gray-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s} className="text-sm capitalize">{s === "all" ? "All Status" : s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Contact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Service</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? (
                Array.from({ length: 7 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No leads found {search || statusFilter !== "all" ? "for this filter" : "yet"}
                  </td>
                </tr>
              ) : filtered.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0f2044]">{c.name}</div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <div className="text-xs text-gray-600">{c.email}</div>
                    <div className="text-xs text-gray-400">{c.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium">{c.serviceInterest}</div>
                    <div className="text-xs text-gray-400 capitalize">{c.serviceCategory.replace("-", " ")}</div>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500 whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => setSelectedLead(c)} className="h-7 px-2 text-xs gap-1 text-[#0f2044]">
                      <Eye size={12} /> View
                    </Button>
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
