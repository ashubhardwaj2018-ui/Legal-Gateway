import { useState } from "react";
import {
  useListConsultations,
  useListContacts,
  useGetStats,
  useUpdateConsultation,
  getListConsultationsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Scale, Users, MessageSquare, Bell, Mail } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  contacted: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800",
  closed: "bg-gray-100 text-gray-800",
  unread: "bg-red-100 text-red-800",
  read: "bg-gray-100 text-gray-700",
};

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number | undefined; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-border p-6 flex items-center gap-4 shadow-sm">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={22} />
      </div>
      <div>
        <div className="text-2xl font-bold font-serif text-primary">{value ?? "—"}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const queryClient = useQueryClient();
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: consultations, isLoading: consultsLoading } = useListConsultations();
  const { data: contacts, isLoading: contactsLoading } = useListContacts();
  const updateMutation = useUpdateConsultation();
  const [activeTab, setActiveTab] = useState("consultations");

  const handleStatusChange = (id: number, status: string) => {
    updateMutation.mutate(
      { id, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListConsultationsQueryKey() });
        },
      }
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-primary text-white px-6 py-5 flex items-center gap-3">
        <Scale size={24} className="text-secondary" />
        <div>
          <h1 className="text-xl font-serif font-bold">Legal Filing India — Admin Panel</h1>
          <p className="text-white/60 text-xs">Consultation & inquiry management</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {statsLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard icon={Users} label="Total Consultations" value={stats?.totalConsultations} color="bg-blue-50 text-blue-600" />
              <StatCard icon={Bell} label="Pending Consultations" value={stats?.pendingConsultations} color="bg-yellow-50 text-yellow-600" />
              <StatCard icon={MessageSquare} label="Contact Inquiries" value={stats?.totalContacts} color="bg-purple-50 text-purple-600" />
              <StatCard icon={Mail} label="Newsletter Subscribers" value={stats?.totalSubscribers} color="bg-green-50 text-green-600" />
            </>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="consultations">
              Consultations {stats?.totalConsultations != null && <span className="ml-2 bg-primary text-white text-xs rounded-full px-2 py-0.5">{stats.totalConsultations}</span>}
            </TabsTrigger>
            <TabsTrigger value="contacts">
              Contacts {stats?.totalContacts != null && <span className="ml-2 bg-primary text-white text-xs rounded-full px-2 py-0.5">{stats.totalContacts}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="consultations">
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Contact</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Service</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {consultsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : (consultations ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          No consultation requests yet. They will appear here when users book consultations.
                        </td>
                      </tr>
                    ) : (
                      (consultations ?? []).map(c => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-primary">{c.name}</div>
                          </td>
                          <td className="px-4 py-3 hidden md:table-cell">
                            <div className="text-muted-foreground">{c.email}</div>
                            <div className="text-muted-foreground text-xs">{c.phone}</div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{c.serviceInterest}</div>
                            <div className="text-xs text-muted-foreground">{c.serviceCategory}</div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[c.status] ?? "bg-gray-100"}`}>
                              {c.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Select value={c.status} onValueChange={val => handleStatusChange(c.id, val)}>
                              <SelectTrigger className="h-8 w-32 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="contacted">Contacted</SelectItem>
                                <SelectItem value="completed">Completed</SelectItem>
                                <SelectItem value="closed">Closed</SelectItem>
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="contacts">
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Name</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground hidden md:table-cell">Email</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Subject</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Message</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Date</th>
                      <th className="px-4 py-3 text-left font-semibold text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {contactsLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : (contacts ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                          No contact submissions yet. They will appear here when users send messages.
                        </td>
                      </tr>
                    ) : (
                      (contacts ?? []).map(c => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-primary">{c.name}</td>
                          <td className="px-4 py-3 hidden md:table-cell text-muted-foreground">{c.email}</td>
                          <td className="px-4 py-3 font-medium">{c.subject}</td>
                          <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">{c.message}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[c.status] ?? "bg-gray-100"}`}>
                              {c.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
