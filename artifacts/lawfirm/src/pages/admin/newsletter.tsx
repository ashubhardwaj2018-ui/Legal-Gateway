import { useListNewsletterSubscribers } from "@workspace/api-client-react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Download, Search, Mail, Users } from "lucide-react";

type Subscriber = NonNullable<ReturnType<typeof useListNewsletterSubscribers>["data"]>[number];

function exportCSV(data: Subscriber[]) {
  const headers = ["ID", "Email", "Name", "Subscribed At"];
  const rows = data.map(s => [s.id, s.email, s.name ?? "", new Date(s.subscribedAt).toLocaleDateString("en-IN")]);
  const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "newsletter-subscribers.csv"; a.click();
  URL.revokeObjectURL(url);
}

export default function AdminNewsletter() {
  const { data: subscribers, isLoading } = useListNewsletterSubscribers();
  const [search, setSearch] = useState("");

  const filtered = (subscribers ?? []).filter(s =>
    !search || s.email.toLowerCase().includes(search.toLowerCase()) ||
    (s.name ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const thisMonth = (subscribers ?? []).filter(s => {
    const d = new Date(s.subscribedAt);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <AdminLayout
      title="Newsletter Subscribers"
      subtitle={`${(subscribers ?? []).length} total subscribers`}
      actions={
        <Button size="sm" variant="outline" onClick={() => exportCSV(filtered)} className="gap-1.5">
          <Download size={14} /> Export CSV
        </Button>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-5">
        {[
          { label: "Total Subscribers", value: (subscribers ?? []).length, icon: Users, color: "bg-blue-50 text-blue-600" },
          { label: "This Month", value: thisMonth, icon: Mail, color: "bg-green-50 text-green-600" },
          { label: "Filtered", value: filtered.length, icon: Search, color: "bg-purple-50 text-purple-600" },
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color} shrink-0`}>
              <stat.icon size={18} />
            </div>
            <div>
              <div className="text-xl font-bold font-serif text-[#0f2044]">{stat.value}</div>
              <div className="text-xs text-gray-500">{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <Input className="pl-8 h-9 text-sm" placeholder="Search by email or name..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Subscribed</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 4 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              )) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Mail size={28} className="text-gray-300" />
                      <p className="text-gray-400">{search ? "No subscribers match your search" : "No subscribers yet"}</p>
                    </div>
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <a href={`mailto:${s.email}`} className="font-medium text-[#0f2044] hover:text-[#c9a227] transition-colors">{s.email}</a>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell text-gray-600 text-sm">{s.name ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(s.subscribedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <a href={`mailto:${s.email}`} className="text-xs text-[#0f2044] hover:text-[#c9a227] transition-colors flex items-center gap-1">
                      <Mail size={11} /> Send Mail
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-xs text-gray-500">Showing {filtered.length} subscribers</span>
            <Button size="sm" variant="ghost" onClick={() => {
              const emails = filtered.map(s => s.email).join(", ");
              navigator.clipboard.writeText(emails);
            }} className="text-xs text-gray-500 gap-1">
              <Mail size={11} /> Copy all emails
            </Button>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
