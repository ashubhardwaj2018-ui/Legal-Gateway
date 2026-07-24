import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Users, Plus, Pencil, Trash2, Search, KeyRound,
  UserCheck, UserX, Shield, Clock, Building2, Mail, Phone, Upload,
} from "lucide-react";

interface Employee {
  id: number; employeeId?: string; name: string; email: string; phone?: string;
  department: string; designation: string; role: string; roleId?: number;
  username?: string; status: string; avatar?: string; joiningDate?: string;
  lastLoginAt?: string; forcePasswordChange?: boolean; twoFactorEnabled?: boolean;
  reportingManagerId?: number; salary?: string; notes?: string; createdAt: string;
}

const DEPARTMENTS = ["Management","Legal","Accounts","HR","Marketing","Operations","IT","Support","Sales","Finance"];
const ROLES = ["Super Admin","Admin","Sales Manager","Sales Executive","Accounts","HR",
  "SEO Executive","Digital Marketing Executive","Content Writer","Customer Support",
  "Legal Team","Finance Manager","Developer","Customer","staff","manager","intern"];
const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
  on_leave: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const EMPTY_FORM = { name:"", email:"", phone:"", department:"", designation:"", role:"staff",
  username:"", password:"", salary:"", joiningDate:"", address:"", emergencyContact:"", notes:"",
  avatar:"", reportingManagerId:"" };

export default function AdminEmployees() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDept, setFilterDept] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showPwdModal, setShowPwdModal] = useState<Employee | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [forceChange, setForceChange] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ["employees", search, filterStatus, filterDept],
    queryFn: async () => {
      const p = new URLSearchParams();
      if (search) p.set("search", search);
      if (filterStatus !== "all") p.set("status", filterStatus);
      if (filterDept !== "all") p.set("department", filterDept);
      return fetch(`/api/admin/employees?${p}`).then(r => r.json());
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      const url = editing ? `/api/admin/employees/${editing.id}` : "/api/admin/employees";
      const method = editing ? "PATCH" : "POST";
      const body: Record<string, unknown> = { ...form };
      if (editing && !body.password) delete body.password;
      if (body.reportingManagerId) body.reportingManagerId = parseInt(body.reportingManagerId as string, 10);
      else delete body.reportingManagerId;
      return fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then(r => r.json());
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["employees"] }); closeForm(); },
  });

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch("/api/admin/chat/upload", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ filename: file.name, data: reader.result as string }),
        });
        const json = await res.json() as { url: string };
        setForm(f => ({ ...f, avatar: json.url }));
      } finally { setAvatarUploading(false); }
    };
    reader.readAsDataURL(file);
  }

  const remove = useMutation({
    mutationFn: (id: number) => fetch(`/api/admin/employees/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      fetch(`/api/admin/employees/${id}/status`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });

  const resetPwd = useMutation({
    mutationFn: () => fetch(`/api/admin/employees/${showPwdModal!.id}/password`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPwd, forceChange }),
    }).then(r => r.json()),
    onSuccess: () => { setShowPwdModal(null); setNewPwd(""); },
  });

  function openEdit(emp: Employee) {
    setEditing(emp);
    setForm({ name: emp.name, email: emp.email, phone: emp.phone ?? "", department: emp.department,
      designation: emp.designation, role: emp.role, username: emp.username ?? "",
      password: "", salary: emp.salary ?? "", joiningDate: emp.joiningDate ?? "",
      address: "", emergencyContact: "", notes: emp.notes ?? "", avatar: emp.avatar ?? "",
      reportingManagerId: emp.reportingManagerId ? String(emp.reportingManagerId) : "" });
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditing(null); setForm({ ...EMPTY_FORM }); }

  return (
    <AdminLayout title="Employee Management" subtitle="Manage all employees, roles and access credentials">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={15} />
          <Input className="pl-9" placeholder="Search by name, email, ID…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="on_leave">On Leave</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDept} onValueChange={setFilterDept}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => { setShowForm(true); setEditing(null); }} className="bg-[#c9a227] hover:bg-[#b8911e] text-[#0f2044] font-semibold shrink-0">
          <Plus size={15} className="mr-1" /> Add Employee
        </Button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Total", count: employees.length, color: "text-[#0f2044]" },
          { label: "Active", count: employees.filter(e => e.status === "active").length, color: "text-green-600" },
          { label: "Inactive", count: employees.filter(e => e.status === "inactive").length, color: "text-gray-500" },
          { label: "On Leave", count: employees.filter(e => e.status === "on_leave").length, color: "text-yellow-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-200 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-gray-400">Loading…</div>
        ) : employees.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto mb-3 text-gray-300" size={40} />
            <p className="text-gray-500">No employees found</p>
            <Button size="sm" className="mt-3 bg-[#c9a227] hover:bg-[#b8911e] text-[#0f2044]" onClick={() => setShowForm(true)}>
              <Plus size={14} className="mr-1" /> Add First Employee
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {["Emp ID","Name / Email","Department","Designation","Role","Status","Last Login","Actions"].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {employees.map(emp => (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-[#c9a227] font-bold">{emp.employeeId ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#0f2044] flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {emp.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-gray-900">{emp.name}</div>
                          <div className="text-xs text-gray-400">{emp.email}</div>
                          {emp.username && <div className="text-xs text-gray-400">@{emp.username}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{emp.department}</td>
                    <td className="px-4 py-3 text-gray-600">{emp.designation}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">
                        <Shield size={11} className="mr-1" />{emp.role}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[emp.status] ?? STATUS_COLORS.inactive}`}>
                        {emp.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleDateString("en-IN") : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Edit" onClick={() => openEdit(emp)}>
                          <Pencil size={13} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" title="Reset Password" onClick={() => { setShowPwdModal(emp); setNewPwd(""); }}>
                          <KeyRound size={13} />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7"
                          title={emp.status === "active" ? "Deactivate" : "Activate"}
                          onClick={() => toggleStatus.mutate({ id: emp.id, status: emp.status === "active" ? "inactive" : "active" })}>
                          {emp.status === "active" ? <UserX size={13} className="text-red-500" /> : <UserCheck size={13} className="text-green-500" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" title="Delete"
                          onClick={() => { if (confirm(`Delete ${emp.name}?`)) remove.mutate(emp.id); }}>
                          <Trash2 size={13} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={v => { if (!v) closeForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Edit — ${editing.name}` : "Add New Employee"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 mt-2">
            {/* Photo upload */}
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Profile Photo</Label>
              <div className="flex items-center gap-3">
                {form.avatar ? (
                  <img src={form.avatar} alt="Preview" className="w-12 h-12 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-[#0f2044] flex items-center justify-center text-white text-lg font-bold shrink-0">
                    {form.name.charAt(0).toUpperCase() || "?"}
                  </div>
                )}
                <label className="cursor-pointer">
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-gray-300 hover:bg-gray-50 transition-colors">
                    {avatarUploading ? "Uploading…" : <><Upload size={12} /> Upload Photo</>}
                  </span>
                </label>
                {form.avatar && (
                  <button type="button" onClick={() => setForm(f => ({ ...f, avatar: "" }))}
                    className="text-xs text-red-500 hover:underline">Remove</button>
                )}
              </div>
            </div>

            {[
              { label: "Full Name *", field: "name", span: 2 },
              { label: "Email *", field: "email", type: "email" },
              { label: "Phone", field: "phone" },
              { label: "Designation *", field: "designation" },
              { label: "Joining Date", field: "joiningDate", type: "date" },
              { label: "Salary", field: "salary" },
              { label: "Username (for login)", field: "username" },
              { label: editing ? "New Password (blank = no change)" : "Password", field: "password", type: "password" },
              { label: "Notes", field: "notes", span: 2 },
            ].map(({ label, field, type = "text", span }) => (
              <div key={field} className={span === 2 ? "col-span-2" : ""}>
                <Label className="text-xs mb-1 block">{label}</Label>
                <Input type={type} value={(form as Record<string, string>)[field] ?? ""} onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))} />
              </div>
            ))}
            <div>
              <Label className="text-xs mb-1 block">Department *</Label>
              <Select value={form.department} onValueChange={v => setForm(f => ({ ...f, department: v }))}>
                <SelectTrigger><SelectValue placeholder="Select dept" /></SelectTrigger>
                <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs mb-1 block">Role</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs mb-1 block">Reporting Manager</Label>
              <Select
                value={form.reportingManagerId || "none"}
                onValueChange={v => setForm(f => ({ ...f, reportingManagerId: v === "none" ? "" : v }))}
              >
                <SelectTrigger><SelectValue placeholder="Select manager (optional)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {employees
                    .filter(e => !editing || e.id !== editing.id)
                    .map(e => <SelectItem key={e.id} value={String(e.id)}>{e.name} ({e.designation})</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 mt-4 justify-end">
            <Button variant="outline" onClick={closeForm}>Cancel</Button>
            <Button className="bg-[#c9a227] hover:bg-[#b8911e] text-[#0f2044] font-semibold"
              onClick={() => save.mutate()} disabled={save.isPending || !form.name || !form.email || !form.department || !form.designation}>
              {save.isPending ? "Saving…" : editing ? "Update Employee" : "Create Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={!!showPwdModal} onOpenChange={v => { if (!v) { setShowPwdModal(null); setNewPwd(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Reset Password — {showPwdModal?.name}</DialogTitle></DialogHeader>
          <div className="mt-2 space-y-3">
            <div>
              <Label className="text-xs mb-1 block">New Password (min 6 chars)</Label>
              <Input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={forceChange} onChange={e => setForceChange(e.target.checked)} className="rounded" />
              Force password change on next login
            </label>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => { setShowPwdModal(null); setNewPwd(""); }}>Cancel</Button>
              <Button className="bg-[#0f2044] text-white" onClick={() => resetPwd.mutate()} disabled={newPwd.length < 6 || resetPwd.isPending}>
                {resetPwd.isPending ? "Resetting…" : "Reset Password"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
