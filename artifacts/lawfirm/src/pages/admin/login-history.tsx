import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { History, CheckCircle2, XCircle, Download } from "lucide-react";

interface LoginRecord {
  id: number; userId?: number; username: string; userType: string;
  ipAddress?: string; userAgent?: string; status: string;
  loggedInAt: string; loggedOutAt?: string;
}

export default function AdminLoginHistory() {
  const [search, setSearch] = useState("");
  const [userType, setUserType] = useState("all");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: rows = [], isLoading } = useQuery<LoginRecord[]>({
    queryKey: ["login-history", search, userType, status, from, to],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "200" });
      if (search) p.set("username", search);
      if (userType !== "all") p.set("userType", userType);
      if (status !== "all") p.set("status", status);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      return fetch(`/api/admin/login-history?${p}`).then(r => r.json());
    },
  });

  function exportCsv() {
    const header = "ID,Username,Type,IP,Status,Login At,Logout At";
    const lines = rows.map(r => `${r.id},${r.username},${r.userType},${r.ipAddress ?? ""},${r.status},${r.loggedInAt},${r.loggedOutAt ?? ""}`);
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "login-history.csv"; a.click();
  }

  return (
    <AdminLayout title="Login History" subtitle="Track all admin and employee login events">
      <div className="flex flex-wrap gap-3 mb-5">
        <Input className="w-48" placeholder="Search username…" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={userType} onValueChange={setUserType}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="success">Success</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} title="From date" />
        <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} title="To date" />
        <Button variant="outline" onClick={exportCsv} className="ml-auto"><Download size={14} className="mr-1.5" />Export CSV</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <History className="mx-auto mb-3 text-gray-300" size={36} />
            <p className="text-gray-400">No login records found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Username","Type","IP Address","Status","Login Time","Logout Time","Device"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">@{r.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.userType === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {r.userType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">{r.ipAddress ?? "—"}</td>
                    <td className="px-4 py-3">
                      {r.status === "success"
                        ? <span className="flex items-center gap-1 text-green-600 text-xs"><CheckCircle2 size={13} />Success</span>
                        : <span className="flex items-center gap-1 text-red-500 text-xs"><XCircle size={13} />Failed</span>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.loggedInAt).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{r.loggedOutAt ? new Date(r.loggedOutAt).toLocaleString("en-IN") : "Active"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate" title={r.userAgent}>{r.userAgent?.split(" ").slice(0, 3).join(" ") ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
