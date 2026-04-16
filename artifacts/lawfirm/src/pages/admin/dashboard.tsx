import { useGetStats, useListConsultations, useListContacts, useListQuotations } from "@workspace/api-client-react";
import { AdminLayout } from "./AdminLayout";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, MessageSquare, Mail, Bell, FileText, Building2, ArrowRight, TrendingUp } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  contacted: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-600",
  unread: "bg-red-100 text-red-800",
  read: "bg-gray-100 text-gray-600",
  draft: "bg-gray-100 text-gray-700",
  sent: "bg-blue-100 text-blue-800",
  accepted: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

function StatCard({ label, value, icon: Icon, color, href }: {
  label: string; value: number | undefined; icon: React.ElementType; color: string; href: string;
}) {
  return (
    <Link href={href}>
      <div className={`bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer group`}>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color} shrink-0`}>
          <Icon size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-bold font-serif text-[#0f2044]">
            {value === undefined ? <Skeleton className="h-7 w-16" /> : value.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 truncate">{label}</div>
        </div>
        <ArrowRight size={14} className="text-gray-300 group-hover:text-gray-500 transition-colors shrink-0" />
      </div>
    </Link>
  );
}

export default function AdminDashboard() {
  const { data: stats } = useGetStats();
  const { data: consultations } = useListConsultations();
  const { data: contacts } = useListContacts();
  const { data: quotations } = useListQuotations();

  const recentLeads = (consultations ?? []).slice(0, 5);
  const recentContacts = (contacts ?? []).slice(0, 5);
  const recentQuotations = (quotations ?? []).slice(0, 5);

  return (
    <AdminLayout title="Dashboard" subtitle="Overview of your law firm operations">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        <StatCard label="Total Leads" value={stats?.totalConsultations} icon={Users} color="bg-blue-50 text-blue-600" href="/admin/leads" />
        <StatCard label="Pending Leads" value={stats?.pendingConsultations} icon={Bell} color="bg-yellow-50 text-yellow-600" href="/admin/leads" />
        <StatCard label="Contacts" value={stats?.totalContacts} icon={MessageSquare} color="bg-purple-50 text-purple-600" href="/admin/contacts" />
        <StatCard label="Quotations" value={stats?.totalQuotations} icon={FileText} color="bg-orange-50 text-orange-600" href="/admin/quotations" />
        <StatCard label="Newsletter" value={stats?.totalSubscribers} icon={Mail} color="bg-green-50 text-green-600" href="/admin/newsletter" />
        <StatCard label="Company Records" value={stats?.totalCompanyRecords} icon={Building2} color="bg-indigo-50 text-indigo-600" href="/admin/company-data" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Recent Leads */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-[#0f2044] flex items-center gap-2"><Users size={16} /> Recent Leads</h2>
            <Link href="/admin/leads" className="text-xs text-[#c9a227] hover:underline font-medium flex items-center gap-1">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Service</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Date</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentLeads.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-xs">No leads yet</td></tr>
                ) : recentLeads.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#0f2044] truncate max-w-[120px]">{c.name}</div>
                      <div className="text-xs text-gray-400 truncate">{c.email}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs truncate max-w-[120px]">{c.serviceInterest}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[c.status] ?? "bg-gray-100"}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Contacts + Quick Actions */}
        <div className="flex flex-col gap-4">
          {/* Recent Contacts */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden flex-1">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-[#0f2044] text-sm flex items-center gap-2"><MessageSquare size={14} /> Recent Contacts</h2>
              <Link href="/admin/contacts" className="text-xs text-[#c9a227] hover:underline font-medium">View all</Link>
            </div>
            <div className="divide-y divide-gray-50">
              {recentContacts.length === 0 ? (
                <div className="px-4 py-6 text-center text-gray-400 text-xs">No contacts yet</div>
              ) : recentContacts.map(c => (
                <div key={c.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm text-[#0f2044] truncate">{c.name}</div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium capitalize ${statusColors[c.status] ?? "bg-gray-100"}`}>{c.status}</span>
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">{c.subject}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-[#0f2044] text-white rounded-xl p-5">
            <h2 className="font-semibold text-sm mb-4 flex items-center gap-2"><TrendingUp size={14} className="text-[#c9a227]" /> Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: "Create Quotation", href: "/admin/quotations" },
                { label: "Update SEO", href: "/admin/seo" },
                { label: "Add Lawyer Profile", href: "/admin/lawyers" },
                { label: "Upload Company Data", href: "/admin/company-data" },
              ].map(action => (
                <Link key={action.href} href={action.href}>
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer group text-sm">
                    <span className="text-white/80 group-hover:text-white">{action.label}</span>
                    <ArrowRight size={12} className="text-[#c9a227]" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
