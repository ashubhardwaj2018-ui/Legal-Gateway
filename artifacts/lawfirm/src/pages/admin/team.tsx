import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, Plus, Pencil, Trash2, X, CheckCircle2, XCircle,
  Clock, Calendar, ChevronRight, Search, Building2, Mail,
  Phone, Shield, Banknote, UserCheck, Award, CalendarCheck, FileText,
  Timer, LogIn, LogOut, ExternalLink, TrendingUp, KeyRound,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TeamMember {
  id: number; name: string; email: string; phone?: string;
  department: string; designation: string; role: string;
  permissions?: string; salary?: string; joiningDate?: string;
  status: string; address?: string; emergencyContact?: string;
  avatar?: string; notes?: string; createdAt: string; updatedAt: string;
}

interface Attendance {
  id: number; memberId: number; date: string; checkIn?: string;
  checkOut?: string; status: string; notes?: string;
}

interface LeaveRequest {
  id: number; memberId: number; memberName?: string; department?: string;
  type: string; startDate: string; endDate: string; days: number;
  reason?: string; status: string; approvedBy?: string; createdAt: string;
}

interface WorkingHours {
  id: number; employeeId: number; date: string;
  clockIn: string | null; clockOut: string | null; totalMinutes: number | null;
  breakMinutes: number | null; notes: string | null; status: string; createdAt: string;
}
interface MemberDetail extends TeamMember { attendance: Attendance[]; leaves: LeaveRequest[]; }

// ── Constants ──────────────────────────────────────────────────────────────────

const DEPARTMENTS = ["Management", "Legal", "Accounts", "HR", "Marketing", "Operations", "IT", "Support"];
const ROLES = ["super_admin", "admin", "manager", "staff", "intern"];
const ROLE_LABELS: Record<string, string> = { super_admin: "Super Admin", admin: "Admin", manager: "Manager", staff: "Staff", intern: "Intern" };
const PERMISSIONS = ["view", "create", "edit", "delete", "approve", "admin"];
const LEAVE_TYPES = ["casual", "sick", "earned", "maternity", "paternity", "unpaid", "other"];
const ATTENDANCE_STATUSES = ["present", "absent", "half_day", "leave", "holiday", "work_from_home"];

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-700 border-green-200",
  inactive: "bg-gray-100 text-gray-500 border-gray-200",
  on_leave: "bg-yellow-100 text-yellow-700 border-yellow-200",
};

const DEPT_COLORS: Record<string, string> = {
  Management: "bg-purple-100 text-purple-700", Legal: "bg-blue-100 text-blue-700",
  Accounts: "bg-green-100 text-green-700", HR: "bg-pink-100 text-pink-700",
  Marketing: "bg-orange-100 text-orange-700", Operations: "bg-yellow-100 text-yellow-700",
  IT: "bg-indigo-100 text-indigo-700", Support: "bg-teal-100 text-teal-700",
};

const LEAVE_STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-700 border-red-200",
};

const ATTENDANCE_COLORS: Record<string, string> = {
  present: "bg-green-500", absent: "bg-red-500", half_day: "bg-yellow-400",
  leave: "bg-blue-400", holiday: "bg-purple-400", work_from_home: "bg-teal-400",
};

// ── API helpers ────────────────────────────────────────────────────────────────

const api = async (path: string, opts?: RequestInit) => {
  const r = await fetch(`/api${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(`${r.status}`);
  if (r.status === 204) return null;
  return r.json();
};

// ── Avatar initials ────────────────────────────────────────────────────────────

function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500"];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz = size === "sm" ? "w-8 h-8 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-10 h-10 text-sm";
  return (
    <div className={`${color} ${sz} rounded-full flex items-center justify-center text-white font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ── Add/Edit Member Dialog ─────────────────────────────────────────────────────

function MemberDialog({ member, onClose, onSaved }: { member?: TeamMember; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!member;
  const [form, setForm] = useState({
    name: member?.name ?? "", email: member?.email ?? "", phone: member?.phone ?? "",
    department: member?.department ?? "Legal", designation: member?.designation ?? "",
    role: member?.role ?? "staff", permissions: member?.permissions ?? "view",
    salary: member?.salary ?? "", joiningDate: member?.joiningDate ?? "",
    address: member?.address ?? "", emergencyContact: member?.emergencyContact ?? "",
    notes: member?.notes ?? "", status: member?.status ?? "active",
  });

  const mutation = useMutation({
    mutationFn: (data: typeof form) => member
      ? api(`/admin/team/${member.id}`, { method: "PATCH", body: JSON.stringify(data) })
      : api("/admin/team", { method: "POST", body: JSON.stringify(data) }),
    onSuccess: () => { onSaved(); onClose(); },
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));
  const setVal = (k: keyof typeof form) => (v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#0f2044]">{isEdit ? "Edit Team Member" : "Add Team Member"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 mt-2">
          <div>
            <Label className="text-xs">Full Name *</Label>
            <Input className="mt-1 h-8 text-sm" value={form.name} onChange={set("name")} placeholder="Adv. Rahul Verma" />
          </div>
          <div>
            <Label className="text-xs">Designation *</Label>
            <Input className="mt-1 h-8 text-sm" value={form.designation} onChange={set("designation")} placeholder="Senior Associate" />
          </div>
          <div>
            <Label className="text-xs">Email *</Label>
            <Input className="mt-1 h-8 text-sm" type="email" value={form.email} onChange={set("email")} />
          </div>
          <div>
            <Label className="text-xs">Phone</Label>
            <Input className="mt-1 h-8 text-sm" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" />
          </div>
          <div>
            <Label className="text-xs">Department *</Label>
            <Select value={form.department} onValueChange={setVal("department")}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{DEPARTMENTS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <Select value={form.role} onValueChange={setVal("role")}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Permissions</Label>
            <Select value={form.permissions} onValueChange={setVal("permissions")}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{PERMISSIONS.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={setVal("status")}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Salary (₹/month)</Label>
            <Input className="mt-1 h-8 text-sm" value={form.salary} onChange={set("salary")} placeholder="45,000" />
          </div>
          <div>
            <Label className="text-xs">Joining Date</Label>
            <Input type="date" className="mt-1 h-8 text-sm" value={form.joiningDate} onChange={set("joiningDate")} />
          </div>
          <div className="col-span-2">
            <Label className="text-xs">Address</Label>
            <Input className="mt-1 h-8 text-sm" value={form.address} onChange={set("address")} placeholder="Office / Home address" />
          </div>
          <div>
            <Label className="text-xs">Emergency Contact</Label>
            <Input className="mt-1 h-8 text-sm" value={form.emergencyContact} onChange={set("emergencyContact")} placeholder="+91 XXXXX XXXXX" />
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Input className="mt-1 h-8 text-sm" value={form.notes} onChange={set("notes")} placeholder="Any additional info…" />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button
            onClick={() => mutation.mutate(form)}
            disabled={!form.name || !form.email || !form.department || mutation.isPending}
            className="flex-1 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white text-sm h-9"
          >
            {mutation.isPending ? "Saving…" : isEdit ? "Save Changes" : "Add Member"}
          </Button>
          <Button variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Mark Attendance Dialog ─────────────────────────────────────────────────────

function AttendanceDialog({ member, onClose, onSaved }: { member: TeamMember; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ date: today, checkIn: "", checkOut: "", status: "present", notes: "" });

  const mutation = useMutation({
    mutationFn: () => api("/admin/attendance", {
      method: "POST",
      body: JSON.stringify({ memberId: member.id, ...form }),
    }),
    onSuccess: () => { onSaved(); onClose(); },
  });

  const needsTimes = ["present", "work_from_home", "half_day"].includes(form.status);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#0f2044] text-base">Mark Attendance — {member.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Date</Label>
            <Input type="date" className="mt-1 h-8 text-sm" value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ATTENDANCE_STATUSES.map(s => (
                  <SelectItem key={s} value={s} className="capitalize text-sm">{s.replace(/_/g, " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsTimes && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Check In</Label>
                <Input type="time" className="mt-1 h-8 text-sm" value={form.checkIn}
                  onChange={e => setForm(f => ({ ...f, checkIn: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">Check Out</Label>
                <Input type="time" className="mt-1 h-8 text-sm" value={form.checkOut}
                  onChange={e => setForm(f => ({ ...f, checkOut: e.target.value }))} />
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs">Notes</Label>
            <Input className="mt-1 h-8 text-sm" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional note…" />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 bg-[#0f2044] text-white h-9 text-sm">
            {mutation.isPending ? "Saving…" : "Save Attendance"}
          </Button>
          <Button variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Apply Leave Dialog ─────────────────────────────────────────────────────────

function LeaveDialog({ member, onClose, onSaved }: { member: TeamMember; onClose: () => void; onSaved: () => void }) {
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({ type: "casual", startDate: today, endDate: today, days: 1, reason: "" });

  const mutation = useMutation({
    mutationFn: () => api("/admin/leaves", {
      method: "POST",
      body: JSON.stringify({ memberId: member.id, ...form }),
    }),
    onSuccess: () => { onSaved(); onClose(); },
  });

  const calcDays = (start: string, end: string) => {
    if (!start || !end) return 1;
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60 * 60 * 24) + 1;
    return Math.max(1, Math.round(diff));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-serif text-[#0f2044] text-base">Apply Leave — {member.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <Label className="text-xs">Leave Type</Label>
            <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
              <SelectTrigger className="mt-1 h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{LEAVE_TYPES.map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">From Date</Label>
              <Input type="date" className="mt-1 h-8 text-sm" value={form.startDate}
                onChange={e => { const d = calcDays(e.target.value, form.endDate); setForm(f => ({ ...f, startDate: e.target.value, days: d })); }} />
            </div>
            <div>
              <Label className="text-xs">To Date</Label>
              <Input type="date" className="mt-1 h-8 text-sm" value={form.endDate}
                onChange={e => { const d = calcDays(form.startDate, e.target.value); setForm(f => ({ ...f, endDate: e.target.value, days: d })); }} />
            </div>
          </div>
          <div className="text-sm text-[#0f2044] font-medium bg-blue-50 rounded-lg px-3 py-2">
            Total: {form.days} day{form.days !== 1 ? "s" : ""}
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Textarea className="mt-1 text-sm" rows={2} value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Brief reason for leave…" />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 bg-[#0f2044] text-white h-9 text-sm">
            {mutation.isPending ? "Submitting…" : "Submit Leave"}
          </Button>
          <Button variant="outline" onClick={onClose} className="h-9 text-sm">Cancel</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Member Detail Drawer ───────────────────────────────────────────────────────

function fmtHm(minutes: number | null | undefined): string {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60), m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function fmtTimestamp(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function ResetPasswordDialog({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const mismatch = confirm.length > 0 && password !== confirm;
  const tooShort = password.length > 0 && password.length < 8;

  const mutation = useMutation({
    mutationFn: (pw: string) => fetch(`/api/admin/auth/team-members/${member.id}/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password: pw }),
    }).then(async r => { const d = await r.json(); if (!r.ok) throw new Error((d as { error?: string }).error ?? "Failed"); return d; }),
    onSuccess: () => setSuccess(true),
    onError: (e: Error) => setError(e.message),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[#0f2044]">
            <KeyRound size={16} className="text-[#c9a227]" /> Force Reset Password
          </DialogTitle>
        </DialogHeader>
        {success ? (
          <div className="py-4 text-center space-y-3">
            <CheckCircle2 size={36} className="text-green-500 mx-auto" />
            <p className="text-sm text-gray-700 font-medium">Password updated for <strong>{member.name}</strong>.</p>
            <p className="text-xs text-gray-400">They will be asked to change it on next login.</p>
            <Button onClick={onClose} className="mt-2 bg-[#0f2044] text-white hover:bg-[#0f2044]/90">Done</Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            <p className="text-xs text-gray-500">Set a temporary password for <strong>{member.name}</strong>. They will be prompted to change it on next login.</p>
            <div>
              <Label className="text-xs mb-1.5 block">New Password</Label>
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPass(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPass ? <XCircle size={14} /> : <CheckCircle2 size={14} />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Confirm Password</Label>
              <Input
                type={showPass ? "text" : "password"}
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter password"
              />
            </div>
            {(tooShort || mismatch || error) && (
              <p className="text-xs text-red-500">
                {error || (tooShort ? "Password must be at least 8 characters" : "Passwords do not match")}
              </p>
            )}
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
              <Button
                size="sm"
                disabled={mutation.isPending || tooShort || mismatch || password.length < 8}
                onClick={() => { setError(""); mutation.mutate(password); }}
                className="bg-[#c9a227] text-[#0f2044] hover:bg-[#e0b83a] font-semibold"
              >
                {mutation.isPending ? "Saving…" : "Set Password"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MemberDrawer({ member, onClose, onUpdated }: { member: TeamMember; onClose: () => void; onUpdated: () => void }) {
  const [tab, setTab] = useState<"profile" | "attendance" | "leaves" | "workingHours">("profile");
  const [editOpen, setEditOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const [whMonth, setWhMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const qc = useQueryClient();

  const { data: detail, isLoading } = useQuery<MemberDetail>({
    queryKey: ["team-member", member.id],
    queryFn: () => api(`/admin/team/${member.id}`),
  });

  const { data: whRecords = [], isLoading: whLoading } = useQuery<WorkingHours[]>({
    queryKey: ["working-hours", member.id, whMonth],
    queryFn: () => api(`/admin/team/${member.id}/working-hours?month=${whMonth}`),
    enabled: tab === "workingHours",
  });

  const todayStr = new Date().toISOString().split("T")[0];
  const todayWH = whRecords.find(w => w.date === todayStr);
  const monthTotal = whRecords.reduce((sum, w) => sum + (w.totalMinutes ?? 0), 0);

  const clockInMutation = useMutation({
    mutationFn: (status: string) => api(`/admin/team/${member.id}/clock-in`, { method: "POST", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["working-hours", member.id] }),
  });

  const clockOutMutation = useMutation({
    mutationFn: () => api(`/admin/team/${member.id}/clock-out`, { method: "POST", body: JSON.stringify({}) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["working-hours", member.id] }),
  });

  const updateLeaveMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/admin/leaves/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-member", member.id] }),
  });

  const presentDays = detail?.attendance.filter(a => a.status === "present" || a.status === "work_from_home").length ?? 0;
  const absentDays = detail?.attendance.filter(a => a.status === "absent").length ?? 0;

  return (
    <>
      {editOpen && (
        <MemberDialog
          member={member}
          onClose={() => setEditOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["team-member", member.id] }); qc.invalidateQueries({ queryKey: ["team"] }); onUpdated(); }}
        />
      )}
      {attendanceOpen && (
        <AttendanceDialog
          member={member}
          onClose={() => setAttendanceOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["team-member", member.id] })}
        />
      )}
      {leaveOpen && (
        <LeaveDialog
          member={member}
          onClose={() => setLeaveOpen(false)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["team-member", member.id] }); qc.invalidateQueries({ queryKey: ["team"] }); }}
        />
      )}
      {resetPasswordOpen && (
        <ResetPasswordDialog member={member} onClose={() => setResetPasswordOpen(false)} />
      )}

      <div className="fixed inset-0 z-50 flex">
        <div className="flex-1 bg-black/40" onClick={onClose} />
        <div className="w-full max-w-xl bg-white h-full flex flex-col shadow-2xl">
          {/* Header */}
          <div className="px-6 py-5 border-b bg-[#0f2044] flex items-start gap-4">
            <Avatar name={member.name} size="lg" />
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-serif font-bold text-white leading-tight">{member.name}</h2>
              <p className="text-[#c9a227] text-sm mt-0.5">{member.designation}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${DEPT_COLORS[member.department] ?? "bg-gray-100"}`}>{member.department}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/10 text-white/80">{ROLE_LABELS[member.role] ?? member.role}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[member.status] ?? "bg-gray-100 text-gray-600"}`}>{member.status}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button onClick={() => setEditOpen(true)} className="text-white/60 hover:text-white transition-colors"><Pencil size={15} /></button>
              <button onClick={onClose} className="text-white/60 hover:text-white transition-colors"><X size={15} /></button>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 border-b bg-gray-50">
            {[
              { label: "Present (30d)", value: presentDays, icon: <CheckCircle2 size={14} className="text-green-500" /> },
              { label: "Absent (30d)", value: absentDays, icon: <XCircle size={14} className="text-red-400" /> },
              { label: "Leave Requests", value: detail?.leaves.length ?? 0, icon: <Calendar size={14} className="text-blue-500" /> },
            ].map(s => (
              <div key={s.label} className="px-4 py-3 text-center border-r last:border-0">
                <div className="flex items-center justify-center gap-1 mb-1">{s.icon}</div>
                <div className="text-xl font-bold text-[#0f2044]">{s.value}</div>
                <div className="text-[9px] text-gray-400 uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="flex gap-2 px-6 py-3 border-b bg-white flex-wrap">
            <Button size="sm" onClick={() => setAttendanceOpen(true)}
              className="h-7 text-xs gap-1 bg-[#0f2044] text-white hover:bg-[#0f2044]/90">
              <CalendarCheck size={11} /> Mark Attendance
            </Button>
            <Button size="sm" variant="outline" onClick={() => setLeaveOpen(true)} className="h-7 text-xs gap-1">
              <FileText size={11} /> Apply Leave
            </Button>
            <Button size="sm" variant="outline" onClick={() => setResetPasswordOpen(true)}
              className="h-7 text-xs gap-1 border-amber-200 text-amber-700 hover:bg-amber-50">
              <KeyRound size={11} /> Reset Password
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex border-b px-6 bg-white overflow-x-auto">
            {([
              { id: "profile", label: "Profile" },
              { id: "attendance", label: "Attendance" },
              { id: "leaves", label: "Leaves" },
              { id: "workingHours", label: "Working Hours" },
            ] as const).map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${tab === t.id ? "border-[#c9a227] text-[#0f2044]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {isLoading ? (
              <div className="space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
            ) : detail ? (
              <>
                {/* PROFILE */}
                {tab === "profile" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { icon: <Mail size={13} />, label: "Email", val: detail.email },
                        { icon: <Phone size={13} />, label: "Phone", val: detail.phone ?? "—" },
                        { icon: <Building2 size={13} />, label: "Department", val: detail.department },
                        { icon: <Award size={13} />, label: "Designation", val: detail.designation },
                        { icon: <Shield size={13} />, label: "Role", val: ROLE_LABELS[detail.role] ?? detail.role },
                        { icon: <Shield size={13} />, label: "Permissions", val: detail.permissions ?? "view" },
                        { icon: <Banknote size={13} />, label: "Salary", val: detail.salary ? `₹ ${detail.salary}` : "—" },
                        { icon: <Calendar size={13} />, label: "Joining Date", val: detail.joiningDate ?? "—" },
                      ].map(({ icon, label, val }) => (
                        <div key={label}>
                          <p className="text-[10px] text-gray-400 uppercase tracking-wide flex items-center gap-1">{icon}{label}</p>
                          <p className="text-sm font-medium text-gray-800 mt-0.5">{val}</p>
                        </div>
                      ))}
                    </div>
                    {detail.address && (
                      <div className="border-t pt-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Address</p>
                        <p className="text-sm text-gray-700">{detail.address}</p>
                      </div>
                    )}
                    {detail.emergencyContact && (
                      <div>
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Emergency Contact</p>
                        <p className="text-sm text-gray-700">{detail.emergencyContact}</p>
                      </div>
                    )}
                    {detail.notes && (
                      <div className="border-t pt-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{detail.notes}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* ATTENDANCE */}
                {tab === "attendance" && (
                  <div>
                    <div className="flex flex-wrap gap-3 mb-4">
                      {Object.entries(ATTENDANCE_COLORS).map(([k, c]) => (
                        <div key={k} className="flex items-center gap-1.5">
                          <div className={`w-3 h-3 rounded-full ${c}`} />
                          <span className="text-[10px] text-gray-500 capitalize">{k.replace(/_/g, " ")}</span>
                        </div>
                      ))}
                    </div>
                    {detail.attendance.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">No attendance records yet.</div>
                    ) : (
                      <div className="space-y-1">
                        {detail.attendance.map(a => (
                          <div key={a.id} className="flex items-center gap-3 py-2 border-b border-gray-50">
                            <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${ATTENDANCE_COLORS[a.status] ?? "bg-gray-300"}`} />
                            <span className="text-sm font-medium text-gray-800 w-28 shrink-0">{a.date}</span>
                            <span className="text-xs text-gray-500 capitalize flex-1">{a.status.replace(/_/g, " ")}</span>
                            {a.checkIn && (
                              <span className="text-xs text-gray-400">
                                {a.checkIn}{a.checkOut ? ` → ${a.checkOut}` : ""}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* LEAVES */}
                {tab === "leaves" && (
                  <div className="space-y-3">
                    {detail.leaves.length === 0 ? (
                      <div className="text-center py-8 text-gray-400 text-sm">No leave requests.</div>
                    ) : detail.leaves.map(l => (
                      <div key={l.id} className="border border-gray-100 rounded-lg p-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-800 capitalize">{l.type} Leave</span>
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border capitalize ${LEAVE_STATUS_COLORS[l.status] ?? ""}`}>{l.status}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{l.startDate} → {l.endDate} · {l.days} day{l.days !== 1 ? "s" : ""}</p>
                            {l.reason && <p className="text-xs text-gray-400 mt-1 italic">"{l.reason}"</p>}
                          </div>
                          {l.status === "pending" && (
                            <div className="flex gap-1.5">
                              <button onClick={() => updateLeaveMutation.mutate({ id: l.id, status: "approved" })}
                                className="text-green-600 hover:text-green-800"><CheckCircle2 size={16} /></button>
                              <button onClick={() => updateLeaveMutation.mutate({ id: l.id, status: "rejected" })}
                                className="text-red-400 hover:text-red-600"><XCircle size={16} /></button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* WORKING HOURS */}
                {tab === "workingHours" && (
                  <div className="space-y-4">
                    {/* Header + month picker */}
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-[#0f2044] flex items-center gap-2"><Timer size={14} />Working Hours Tracker</h3>
                      <input type="month" value={whMonth} onChange={e => setWhMonth(e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20" />
                    </div>

                    {/* Today's clock-in/out card */}
                    <div className={`rounded-xl border-2 p-4 ${!todayWH?.clockIn ? "border-gray-200 bg-gray-50" : todayWH.clockOut ? "border-green-200 bg-green-50" : "border-[#c9a227] bg-amber-50"}`}>
                      <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Today · {todayStr}</p>
                      {todayWH?.clockIn ? (
                        <div className="space-y-1 mb-3">
                          <div className="flex items-center gap-2 text-sm">
                            <LogIn size={13} className="text-green-600" />
                            <span className="text-gray-700">Clocked in: <span className="font-semibold">{fmtTimestamp(todayWH.clockIn)}</span></span>
                          </div>
                          {todayWH.clockOut ? (
                            <>
                              <div className="flex items-center gap-2 text-sm">
                                <LogOut size={13} className="text-red-500" />
                                <span className="text-gray-700">Clocked out: <span className="font-semibold">{fmtTimestamp(todayWH.clockOut)}</span></span>
                              </div>
                              <div className="flex items-center gap-2 text-sm">
                                <Timer size={13} className="text-[#c9a227]" />
                                <span className="font-bold text-[#0f2044]">Total: {fmtHm(todayWH.totalMinutes)}</span>
                              </div>
                            </>
                          ) : (
                            <p className="text-xs text-amber-700 flex items-center gap-1"><Clock size={11} /> Currently working…</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500 mb-3">Not clocked in yet today.</p>
                      )}
                      <div className="flex gap-2">
                        {!todayWH?.clockIn ? (
                          <>
                            <Button size="sm" onClick={() => clockInMutation.mutate("present")} disabled={clockInMutation.isPending}
                              className="h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white">
                              <LogIn size={11} />Clock In (Present)
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => clockInMutation.mutate("work_from_home")} disabled={clockInMutation.isPending}
                              className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-50">
                              <LogIn size={11} />WFH
                            </Button>
                          </>
                        ) : !todayWH?.clockOut ? (
                          <Button size="sm" onClick={() => clockOutMutation.mutate()} disabled={clockOutMutation.isPending}
                            className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white">
                            <LogOut size={11} />Clock Out
                          </Button>
                        ) : (
                          <span className="text-xs font-medium text-green-700 bg-green-100 px-3 py-1 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={12} /> Shift complete
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Monthly summary */}
                    {whRecords.length > 0 && (
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          { label: "Present", value: whRecords.filter(w => w.status === "present").length, icon: <UserCheck size={12} className="text-green-500" /> },
                          { label: "WFH", value: whRecords.filter(w => w.status === "work_from_home").length, icon: <Clock size={12} className="text-blue-500" /> },
                          { label: "Total Hours", value: fmtHm(monthTotal), icon: <TrendingUp size={12} className="text-[#c9a227]" /> },
                        ].map(s => (
                          <div key={s.label} className="text-center bg-gray-50 rounded-lg p-3 border border-gray-100">
                            <div className="flex justify-center mb-1">{s.icon}</div>
                            <div className="text-base font-bold text-[#0f2044]">{s.value}</div>
                            <div className="text-[9px] text-gray-400 uppercase tracking-wide">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* History table */}
                    {whLoading ? (
                      <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
                    ) : whRecords.filter(w => w.date !== todayStr).length === 0 ? (
                      <div className="text-center py-6 text-gray-400 text-sm">No other records for {whMonth}.</div>
                    ) : (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wide font-semibold mb-2">History</p>
                        {whRecords.filter(w => w.date !== todayStr).map(w => (
                          <div key={w.id} className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded-lg border border-gray-100">
                            <span className={`w-2 h-2 rounded-full shrink-0 ${w.status === "present" ? "bg-green-500" : w.status === "work_from_home" ? "bg-blue-400" : w.status === "half_day" ? "bg-yellow-400" : "bg-gray-300"}`} />
                            <span className="text-xs font-medium text-gray-700 w-24 shrink-0">{w.date}</span>
                            <span className="text-xs text-gray-500 capitalize flex-1 hidden sm:block">{w.status.replace(/_/g, " ")}</span>
                            <span className="text-xs text-gray-400 shrink-0">{fmtTimestamp(w.clockIn)} → {fmtTimestamp(w.clockOut)}</span>
                            <span className="text-xs font-semibold text-[#0f2044] w-14 text-right shrink-0">{fmtHm(w.totalMinutes)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

// ── Leaves Overview Panel ──────────────────────────────────────────────────────

function LeavesPanel({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data: leaves = [], isLoading } = useQuery<LeaveRequest[]>({
    queryKey: ["all-leaves", statusFilter],
    queryFn: () => api(`/admin/leaves?status=${statusFilter}`),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api(`/admin/leaves/${id}`, { method: "PATCH", body: JSON.stringify({ status }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["all-leaves"] }),
  });

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-lg bg-white h-full flex flex-col shadow-2xl">
        <div className="px-6 py-4 border-b flex items-center justify-between bg-[#0f2044]">
          <h2 className="font-serif font-bold text-white">Leave Requests</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        <div className="px-4 py-3 border-b">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-8 text-sm w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)
            : leaves.length === 0
            ? <div className="text-center py-10 text-gray-400 text-sm">No {statusFilter === "all" ? "" : statusFilter} leave requests.</div>
            : leaves.map(l => (
              <div key={l.id} className="border border-gray-100 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium text-sm text-[#0f2044]">{l.memberName}</p>
                    <p className="text-xs text-gray-400">{l.department}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-xs font-medium capitalize">{l.type} Leave</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full border ${LEAVE_STATUS_COLORS[l.status] ?? ""}`}>{l.status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{l.startDate} → {l.endDate} ({l.days} day{l.days !== 1 ? "s" : ""})</p>
                    {l.reason && <p className="text-xs text-gray-400 mt-1 italic">"{l.reason}"</p>}
                  </div>
                  {l.status === "pending" && (
                    <div className="flex gap-2">
                      <button onClick={() => updateMutation.mutate({ id: l.id, status: "approved" })}
                        className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-50 transition-colors">
                        <CheckCircle2 size={18} />
                      </button>
                      <button onClick={() => updateMutation.mutate({ id: l.id, status: "rejected" })}
                        className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                        <XCircle size={18} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

// ── Member Card ────────────────────────────────────────────────────────────────

function MemberCard({ member, onClick, onDelete }: { member: TeamMember; onClick: () => void; onDelete: () => void }) {
  return (
    <div onClick={onClick}
      className="bg-white border border-gray-200 rounded-xl p-4 cursor-pointer hover:shadow-md hover:border-[#c9a227]/40 transition-all group">
      <div className="flex items-start gap-3">
        <Avatar name={member.name} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[#0f2044] truncate">{member.name}</p>
          <p className="text-xs text-gray-500 truncate">{member.designation}</p>
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${DEPT_COLORS[member.department] ?? "bg-gray-100 text-gray-500"}`}>{member.department}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded-full border ${STATUS_COLORS[member.status] ?? "bg-gray-100"}`}>{member.status}</span>
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 text-red-300 hover:text-red-500 transition-all p-1">
          <Trash2 size={13} />
        </button>
      </div>
      <div className="mt-3 pt-3 border-t border-gray-50 space-y-1">
        <p className="text-[10px] text-gray-400 flex items-center gap-1 truncate"><Mail size={9} />{member.email}</p>
        {member.phone && <p className="text-[10px] text-gray-400 flex items-center gap-1"><Phone size={9} />{member.phone}</p>}
        <div className="flex gap-3">
          {member.salary && <p className="text-[10px] text-gray-400 flex items-center gap-1"><Banknote size={9} />₹{member.salary}</p>}
          {member.joiningDate && <p className="text-[10px] text-gray-400 flex items-center gap-1"><Calendar size={9} />{member.joiningDate}</p>}
        </div>
      </div>
      <div className="mt-2 flex justify-end">
        <span className="text-[10px] text-gray-400 flex items-center gap-0.5 group-hover:text-[#0f2044] transition-colors">
          View details <ChevronRight size={10} />
        </span>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function AdminTeam() {
  const qc = useQueryClient();
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [leavesOpen, setLeavesOpen] = useState(false);

  const { data: members = [], isLoading } = useQuery<TeamMember[]>({
    queryKey: ["team", deptFilter, statusFilter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (deptFilter !== "all") p.set("department", deptFilter);
      if (statusFilter !== "all") p.set("status", statusFilter);
      return api(`/admin/team?${p.toString()}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api(`/admin/team/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team"] }),
  });

  const filtered = members.filter(m =>
    !search ||
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.designation.toLowerCase().includes(search.toLowerCase())
  );

  const active = members.filter(m => m.status === "active").length;
  const onLeave = members.filter(m => m.status === "on_leave").length;
  const depts = [...new Set(members.map(m => m.department))].length;

  return (
    <AdminLayout
      title="Team & HR"
      subtitle={`${members.length} member${members.length !== 1 ? "s" : ""} · HR Operations`}
      actions={
        <div className="flex gap-2">
          <Link href="/admin/employees">
            <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs border-[#c9a227] text-[#c9a227] hover:bg-[#c9a227]/10">
              <ExternalLink size={12} /> Employees & Accounts
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={() => setLeavesOpen(true)} className="gap-1.5 h-8 text-xs">
            <Calendar size={12} /> Leave Requests
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}
            className="gap-1.5 h-8 text-xs bg-[#0f2044] text-white hover:bg-[#0f2044]/90">
            <Plus size={12} /> Add Member
          </Button>
        </div>
      }
    >
      {addOpen && (
        <MemberDialog
          onClose={() => setAddOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["team"] })}
        />
      )}
      {selectedMember && (
        <MemberDrawer
          member={selectedMember}
          onClose={() => setSelectedMember(null)}
          onUpdated={() => qc.invalidateQueries({ queryKey: ["team"] })}
        />
      )}
      {leavesOpen && <LeavesPanel onClose={() => setLeavesOpen(false)} />}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-4">
        {[
          { label: "Total Members", value: members.length, icon: <Users size={18} className="text-[#0f2044]" />, color: "text-[#0f2044]" },
          { label: "Active", value: active, icon: <UserCheck size={18} className="text-green-500" />, color: "text-green-600" },
          { label: "On Leave", value: onLeave, icon: <Clock size={18} className="text-yellow-500" />, color: "text-yellow-600" },
          { label: "Departments", value: depts, icon: <Building2 size={18} className="text-blue-500" />, color: "text-blue-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide">{s.label}</p>
              {s.icon}
            </div>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input className="pl-8 h-8 text-sm" placeholder="Search by name, email, designation…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-8 text-xs w-44 shrink-0"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Departments</SelectItem>
            {DEPARTMENTS.map(d => <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 text-xs w-32 shrink-0"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">All Status</SelectItem>
            <SelectItem value="active" className="text-xs">Active</SelectItem>
            <SelectItem value="inactive" className="text-xs">Inactive</SelectItem>
            <SelectItem value="on_leave" className="text-xs">On Leave</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members grid — grouped by department when no filters */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">{members.length === 0 ? "No team members yet — add your first one!" : "No members match this filter."}</p>
        </div>
      ) : deptFilter === "all" && !search ? (
        <div className="space-y-6">
          {DEPARTMENTS.filter(d => filtered.some(m => m.department === d)).map(dept => {
            const deptMembers = filtered.filter(m => m.department === dept);
            return (
              <div key={dept}>
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${DEPT_COLORS[dept] ?? "bg-gray-100 text-gray-600"}`}>{dept}</span>
                  <span className="text-xs text-gray-400">{deptMembers.length} member{deptMembers.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {deptMembers.map(member => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      onClick={() => setSelectedMember(member)}
                      onDelete={() => { if (confirm(`Remove ${member.name} from the team?`)) deleteMutation.mutate(member.id); }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(member => (
            <MemberCard
              key={member.id}
              member={member}
              onClick={() => setSelectedMember(member)}
              onDelete={() => { if (confirm(`Remove ${member.name} from the team?`)) deleteMutation.mutate(member.id); }}
            />
          ))}
        </div>
      )}
    </AdminLayout>
  );
}
