import { useState } from "react";
import { useListContacts, useUpdateContact, getListContactsQueryKey, type Contact } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Eye, Check, Download, Filter } from "lucide-react";


function DetailModal({ contact, onClose, onMarkRead }: { contact: Contact; onClose: () => void; onMarkRead: () => void }) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#0f2044]">Contact Message</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500 mb-1">From</p>
              <p className="font-semibold text-sm">{contact.name}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Status</p>
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${contact.status === "unread" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                {contact.status}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Email</p>
              <a href={`mailto:${contact.email}`} className="text-sm text-[#c9a227] hover:underline font-medium">{contact.email}</a>
            </div>
            {contact.phone && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Phone</p>
                <a href={`tel:${contact.phone}`} className="text-sm font-medium">{contact.phone}</a>
              </div>
            )}
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Subject</p>
              <p className="text-sm font-semibold">{contact.subject}</p>
            </div>
            <div className="col-span-2">
              <p className="text-xs text-gray-500 mb-1">Message</p>
              <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{contact.message}</div>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">Received</p>
              <p className="text-sm">{new Date(contact.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <a href={`mailto:${contact.email}?subject=Re: ${encodeURIComponent(contact.subject)}`} className="flex-1">
              <Button className="w-full bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2">
                Reply via Email
              </Button>
            </a>
            {contact.status === "unread" && (
              <Button variant="outline" onClick={onMarkRead} className="gap-2">
                <Check size={14} /> Mark Read
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function exportCSV(data: Contact[]) {
  const headers = ["ID", "Name", "Email", "Phone", "Subject", "Message", "Status", "Created At"];
  const rows = data.map(c => [
    c.id, c.name, c.email, c.phone ?? "", c.subject,
    c.message.replace(/,/g, ";").replace(/\n/g, " "), c.status,
    new Date(c.createdAt).toLocaleDateString("en-IN")
  ]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "contacts.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminContacts() {
  const queryClient = useQueryClient();
  const { data: contacts, isLoading } = useListContacts();
  const updateMutation = useUpdateContact();
  const [selected, setSelected] = useState<Contact | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const filtered = (contacts ?? []).filter(c => {
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const markRead = (id: number) => {
    updateMutation.mutate(
      { id, data: { status: "read" } },
      { onSuccess: () => { queryClient.invalidateQueries({ queryKey: getListContactsQueryKey() }); setSelected(null); } }
    );
  };

  const unreadCount = (contacts ?? []).filter(c => c.status === "unread").length;

  return (
    <AdminLayout
      title="Contact Messages"
      subtitle={`${unreadCount} unread`}
      actions={
        <Button size="sm" variant="outline" onClick={() => exportCSV(filtered)} className="gap-1.5">
          <Download size={14} /> Export CSV
        </Button>
      }
    >
      {selected && (
        <DetailModal
          contact={selected}
          onClose={() => setSelected(null)}
          onMarkRead={() => markRead(selected.id)}
        />
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8 h-9 text-sm" placeholder="Search by name, email or subject..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-9 w-36 text-sm shrink-0">
            <Filter size={12} className="mr-1 text-gray-400" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">From</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Subject</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Message Preview</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 6 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">No contact messages found</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} className={`hover:bg-gray-50 transition-colors ${c.status === "unread" ? "bg-blue-50/30" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0f2044]">{c.name}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[140px]">{c.email}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-sm font-medium truncate block max-w-[200px]">{c.subject}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <span className="text-xs text-gray-500 truncate block max-w-[220px]">{c.message}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-xs text-gray-500 whitespace-nowrap">
                    {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${c.status === "unread" ? "bg-red-100 text-red-700 border border-red-200" : "bg-gray-100 text-gray-600"}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setSelected(c)} className="h-7 px-2 text-xs gap-1 text-[#0f2044]">
                        <Eye size={12} /> View
                      </Button>
                      {c.status === "unread" && (
                        <Button size="sm" variant="ghost" onClick={() => markRead(c.id)} className="h-7 px-2 text-xs gap-1 text-green-700">
                          <Check size={12} />
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
