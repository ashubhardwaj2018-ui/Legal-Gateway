import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Activity, Download } from "lucide-react";

interface ActivityRecord {
  id: number; userId?: number; username: string; userType: string;
  module: string; action: string; entityId?: number; details?: string; createdAt: string;
}

const MODULES = ["all","auth","dashboard","leads","employees","team","companies","tasks","invoices","chat","email","reports","contacts","quotations","blogs","seo","services","settings","locations","page-editor","roles"];
const ACTIONS = ["all","login","logout","create","update","delete","export","approve","assign","view"];

const MODULE_COLORS: Record<string, string> = {
  leads: "bg-blue-100 text-blue-700", auth: "bg-gray-100 text-gray-600",
  employees: "bg-green-100 text-green-700", invoices: "bg-yellow-100 text-yellow-700",
  tasks: "bg-orange-100 text-orange-700", chat: "bg-pink-100 text-pink-700",
};

export default function AdminActivityLog() {
  const [search, setSearch] = useState("");
  const [module, setModule] = useState("all");
  const [action, setAction] = useState("all");
  const [userType, setUserType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: rows = [], isLoading } = useQuery<ActivityRecord[]>({
    queryKey: ["activity-logs", search, module, action, userType, from, to],
    queryFn: () => {
      const p = new URLSearchParams({ limit: "200" });
      if (search) p.set("username", search);
      if (module !== "all") p.set("module", module);
      if (action !== "all") p.set("action", action);
      if (userType !== "all") p.set("userType", userType);
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      return fetch(`/api/admin/activity-logs?${p}`).then(r => r.json());
    },
  });

  function exportCsv() {
    const header = "ID,Username,Type,Module,Action,Entity ID,Details,Time";
    const lines = rows.map(r => `${r.id},${r.username},${r.userType},${r.module},${r.action},${r.entityId ?? ""},${r.details ?? ""},${r.createdAt}`);
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "activity-log.csv"; a.click();
  }

  return (
    <AdminLayout title="Activity Log" subtitle="Complete audit trail of all admin and employee actions">
      <div className="flex flex-wrap gap-3 mb-5">
        <Input className="w-44" placeholder="Search username…" value={search} onChange={e => setSearch(e.target.value)} />
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MODULES.map(m => <SelectItem key={m} value={m}>{m === "all" ? "All Modules" : m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACTIONS.map(a => <SelectItem key={a} value={a}>{a === "all" ? "All Actions" : a}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={userType} onValueChange={setUserType}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} />
        <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} />
        <Button variant="outline" onClick={exportCsv} className="ml-auto"><Download size={14} className="mr-1.5" />Export CSV</Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center">
            <Activity className="mx-auto mb-3 text-gray-300" size={36} />
            <p className="text-gray-400">No activity records yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Time","User","Type","Module","Action","Entity","Details"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("en-IN")}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">@{r.username}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${r.userType === "admin" ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>
                        {r.userType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium capitalize ${MODULE_COLORS[r.module] ?? "bg-gray-100 text-gray-600"}`}>
                        {r.module}
                      </span>
                    </td>
                    <td className="px-4 py-3 capitalize text-gray-700 font-medium">{r.action}</td>
                    <td className="px-4 py-3 text-xs text-gray-400">{r.entityId ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-gray-400 max-w-[200px] truncate" title={r.details ?? ""}>
                      {r.details ? (() => { try { const d = JSON.parse(r.details); return Object.entries(d).map(([k,v]) => `${k}: ${v}`).join(", "); } catch { return r.details; } })() : "—"}
                    </td>
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
