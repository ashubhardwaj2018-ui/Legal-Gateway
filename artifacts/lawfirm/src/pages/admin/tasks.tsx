import { useState, useEffect, useRef, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, Calendar, Kanban, List, Trash2, MessageSquare,
  Clock, User, Tag, ChevronLeft, ChevronRight, X, Send, AlertCircle,
  CheckCircle2, Timer, Eye, MoreHorizontal, Flag, Edit2,
} from "lucide-react";

interface Task {
  id: number;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  assignedToId: number | null;
  assignedToName: string | null;
  dueDate: string | null;
  tags: string | null;
  estimatedHours: string | null;
  commentCount: number;
  completedAt: string | null;
  createdAt: string;
}

interface Comment {
  id: number;
  taskId: number;
  authorName: string;
  comment: string;
  createdAt: string;
}

interface Member { id: number; name: string; department: string; designation: string; }

const STATUSES = [
  { key: "todo", label: "To Do", color: "bg-gray-100 text-gray-700", col: "bg-gray-50 border-gray-200" },
  { key: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700", col: "bg-blue-50/40 border-blue-200" },
  { key: "review", label: "Review", color: "bg-purple-100 text-purple-700", col: "bg-purple-50/40 border-purple-200" },
  { key: "done", label: "Done", color: "bg-green-100 text-green-700", col: "bg-green-50/40 border-green-200" },
];

const PRIORITIES = [
  { key: "low", label: "Low", color: "text-gray-500", bg: "bg-gray-100" },
  { key: "medium", label: "Medium", color: "text-yellow-600", bg: "bg-yellow-100" },
  { key: "high", label: "High", color: "text-orange-600", bg: "bg-orange-100" },
  { key: "urgent", label: "Urgent", color: "text-red-600", bg: "bg-red-100" },
];

function priorityStyle(p: string) {
  return PRIORITIES.find(x => x.key === p) ?? PRIORITIES[1];
}
function statusStyle(s: string) {
  return STATUSES.find(x => x.key === s) ?? STATUSES[0];
}
function isOverdue(dueDate: string | null) {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date() && true;
}
function fmtDate(d: string | null) {
  if (!d) return null;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "2-digit" });
}
function initials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}
function avatarBg(name: string) {
  const colors = ["bg-violet-500","bg-blue-500","bg-emerald-500","bg-rose-500","bg-amber-500","bg-cyan-500"];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % colors.length;
  return colors[h];
}

const BLANK_FORM = { title: "", description: "", priority: "medium", status: "todo", assignedToId: "", dueDate: "", tags: "", estimatedHours: "" };

export default function AdminTasks() {
  const [view, setView] = useState<"kanban" | "calendar" | "list">("kanban");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("");

  // Create dialog
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [saving, setSaving] = useState(false);

  // Detail drawer
  const [selected, setSelected] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [editingTask, setEditingTask] = useState(false);
  const [editForm, setEditForm] = useState({ ...BLANK_FORM });

  // Drag
  const dragId = useRef<number | null>(null);

  // Calendar
  const today = new Date();
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [calYear, setCalYear] = useState(today.getFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterPriority) params.set("priority", filterPriority);
    if (filterAssignee) params.set("assignedToId", filterAssignee);
    try {
      const [tr, mr] = await Promise.all([
        fetch(`/api/admin/tasks?${params}`).then(r => r.json()),
        fetch("/api/admin/team-members-list").then(r => r.json()),
      ]);
      setTasks(tr.tasks ?? []);
      setMembers(Array.isArray(mr) ? mr : []);
    } finally { setLoading(false); }
  }, [search, filterPriority, filterAssignee]);

  useEffect(() => { load(); }, [load]);

  const loadComments = useCallback(async (id: number) => {
    const c = await fetch(`/api/admin/tasks/${id}/comments`).then(r => r.json());
    setComments(Array.isArray(c) ? c : []);
  }, []);

  const openTask = (t: Task) => {
    setSelected(t);
    setEditForm({ title: t.title, description: t.description ?? "", priority: t.priority, status: t.status, assignedToId: t.assignedToId ? String(t.assignedToId) : "", dueDate: t.dueDate ?? "", tags: t.tags ?? "", estimatedHours: t.estimatedHours ?? "" });
    setEditingTask(false);
    loadComments(t.id);
  };

  const createTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const member = members.find(m => m.id === Number(form.assignedToId));
    await fetch("/api/admin/tasks", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, assignedToName: member?.name ?? null }),
    });
    setSaving(false); setShowCreate(false); setForm({ ...BLANK_FORM }); load();
  };

  const patchTask = async (id: number, patch: Record<string, unknown>) => {
    await fetch(`/api/admin/tasks/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    load();
    if (selected?.id === id) {
      setSelected(prev => prev ? { ...prev, ...patch } as Task : null);
    }
  };

  const saveEdit = async () => {
    if (!selected) return;
    const member = members.find(m => m.id === Number(editForm.assignedToId));
    await patchTask(selected.id, { ...editForm, assignedToName: member?.name ?? null });
    setEditingTask(false);
  };

  const deleteTask = async (id: number) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/admin/tasks/${id}`, { method: "DELETE" });
    if (selected?.id === id) setSelected(null);
    load();
  };

  const addComment = async () => {
    if (!newComment.trim() || !selected) return;
    await fetch(`/api/admin/tasks/${selected.id}/comments`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: "Admin", comment: newComment.trim() }),
    });
    setNewComment(""); loadComments(selected.id);
    load();
  };

  const moveStatus = async (id: number, newStatus: string) => {
    await patchTask(id, { status: newStatus });
  };

  // Drag handlers
  const onDragStart = (id: number) => { dragId.current = id; };
  const onDrop = async (status: string) => {
    if (dragId.current == null) return;
    await moveStatus(dragId.current, status);
    dragId.current = null;
  };

  // Stats
  const stats = {
    total: tasks.length,
    todo: tasks.filter(t => t.status === "todo").length,
    inProgress: tasks.filter(t => t.status === "in_progress").length,
    done: tasks.filter(t => t.status === "done").length,
    overdue: tasks.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== "done").length,
  };

  // Calendar helpers
  const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const calDays = () => {
    const first = new Date(calYear, calMonth, 1).getDay();
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    return { first, daysInMonth };
  };
  const tasksOnDay = (day: number) => {
    const dStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return tasks.filter(t => t.dueDate?.startsWith(dStr));
  };

  return (
    <AdminLayout
      title="Task Management"
      subtitle={`${stats.total} tasks · ${stats.overdue} overdue`}
      actions={
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            {(["kanban","calendar","list"] as const).map(v => (
              <button key={v} onClick={() => setView(v)} className={`p-2 rounded-md transition-all ${view === v ? "bg-white shadow-sm text-[#0f2044]" : "text-gray-400 hover:text-gray-600"}`}>
                {v === "kanban" ? <Kanban size={15} /> : v === "calendar" ? <Calendar size={15} /> : <List size={15} />}
              </button>
            ))}
          </div>
          <Button onClick={() => setShowCreate(true)} className="bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] gap-1.5">
            <Plus size={15} /> New Task
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {[
          { label: "Total", value: stats.total, color: "text-gray-700", bg: "bg-white" },
          { label: "To Do", value: stats.todo, color: "text-gray-600", bg: "bg-white" },
          { label: "In Progress", value: stats.inProgress, color: "text-blue-700", bg: "bg-blue-50" },
          { label: "Done", value: stats.done, color: "text-green-700", bg: "bg-green-50" },
          { label: "Overdue", value: stats.overdue, color: "text-red-700", bg: "bg-red-50" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl border border-gray-200 px-4 py-3`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="relative flex-1 min-w-44">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input placeholder="Search tasks…" value={search} onChange={e => setSearch(e.target.value)} className="pl-8 h-9 text-sm" />
        </div>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20">
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} className="h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20">
          <option value="">All Assignees</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {(search || filterPriority || filterAssignee) && (
          <Button variant="outline" size="sm" className="h-9" onClick={() => { setSearch(""); setFilterPriority(""); setFilterAssignee(""); }}>
            <X size={13} className="mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* ─── KANBAN VIEW ─── */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 min-h-[500px]">
          {STATUSES.map(col => {
            const colTasks = tasks.filter(t => t.status === col.key);
            return (
              <div
                key={col.key}
                onDragOver={e => e.preventDefault()}
                onDrop={() => onDrop(col.key)}
                className={`rounded-xl border-2 ${col.col} flex flex-col`}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-current/10">
                  <span className={`text-xs font-bold uppercase tracking-wide px-2 py-1 rounded-full ${col.color}`}>{col.label}</span>
                  <span className="text-xs text-gray-400 font-medium">{colTasks.length}</span>
                </div>
                {/* Cards */}
                <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[68vh]">
                  {colTasks.map(task => (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      onOpen={() => openTask(task)}
                      onDelete={() => deleteTask(task.id)}
                      onDragStart={() => onDragStart(task.id)}
                      onMove={status => moveStatus(task.id, status)}
                    />
                  ))}
                  {colTasks.length === 0 && (
                    <div className="text-center py-8 text-gray-300 text-xs">Drop tasks here</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── CALENDAR VIEW ─── */}
      {view === "calendar" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y-1); } else setCalMonth(m => m-1); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronLeft size={16} />
            </button>
            <span className="font-bold text-[#0f2044] text-base">{MONTH_NAMES[calMonth]} {calYear}</span>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y+1); } else setCalMonth(m => m+1); }} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500">
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 border-b border-gray-100">
            {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-2">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {(() => {
              const { first, daysInMonth } = calDays();
              const cells = [];
              for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} className="border-r border-b border-gray-100 min-h-[90px] bg-gray-50/50" />);
              for (let d = 1; d <= daysInMonth; d++) {
                const dt = tasksOnDay(d);
                const isToday = d === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
                cells.push(
                  <div key={d} className="border-r border-b border-gray-100 min-h-[90px] p-1.5">
                    <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold mb-1 ${isToday ? "bg-[#0f2044] text-white" : "text-gray-600"}`}>{d}</div>
                    <div className="space-y-0.5">
                      {dt.slice(0, 3).map(t => (
                        <div
                          key={t.id}
                          onClick={() => openTask(t)}
                          className={`text-[10px] px-1.5 py-0.5 rounded font-medium cursor-pointer truncate ${priorityStyle(t.priority).bg} ${priorityStyle(t.priority).color} hover:opacity-80`}
                        >
                          {t.title}
                        </div>
                      ))}
                      {dt.length > 3 && <div className="text-[10px] text-gray-400 pl-1">+{dt.length - 3} more</div>}
                    </div>
                  </div>
                );
              }
              return cells;
            })()}
          </div>
        </div>
      )}

      {/* ─── LIST VIEW ─── */}
      {view === "list" && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {loading && <div className="py-16 text-center text-gray-400 text-sm">Loading…</div>}
          {!loading && tasks.length === 0 && (
            <div className="py-20 text-center">
              <CheckCircle2 size={36} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400">No tasks yet. Create your first task!</p>
            </div>
          )}
          {!loading && tasks.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Task</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Priority</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Assignee</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Due Date</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">Comments</th>
                  <th className="text-right px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tasks.map(t => {
                  const ps = priorityStyle(t.priority);
                  const ss = statusStyle(t.status);
                  const overdue = isOverdue(t.dueDate) && t.status !== "done";
                  return (
                    <tr key={t.id} className="hover:bg-gray-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <button onClick={() => openTask(t)} className="font-medium text-[#0f2044] hover:text-[#c9a227] text-left line-clamp-1 transition-colors">{t.title}</button>
                        {t.tags && <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1"><Tag size={10} />{t.tags}</div>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ps.bg} ${ps.color}`}><Flag size={9} className="inline mr-0.5" />{ps.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ss.color}`}>{ss.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        {t.assignedToName ? (
                          <div className="flex items-center gap-1.5">
                            <div className={`w-6 h-6 rounded-full ${avatarBg(t.assignedToName)} text-white text-[10px] font-bold flex items-center justify-center`}>{initials(t.assignedToName)}</div>
                            <span className="text-xs text-gray-600 truncate max-w-[80px]">{t.assignedToName}</span>
                          </div>
                        ) : <span className="text-xs text-gray-300">—</span>}
                      </td>
                      <td className={`px-4 py-3 text-xs whitespace-nowrap ${overdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                        {fmtDate(t.dueDate) ?? "—"}{overdue && " ⚠"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1 text-xs text-gray-400"><MessageSquare size={12} />{t.commentCount}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button onClick={() => deleteTask(t.id)} className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ─── CREATE DIALOG ─── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg z-10 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-[#0f2044] text-white px-6 py-4 flex items-center justify-between">
              <h2 className="font-bold text-base">Create New Task</h2>
              <button onClick={() => setShowCreate(false)} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Title *</label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" className="h-9" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Description</label>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Details…" rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Priority</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none">
                    {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none">
                    {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Assign To</label>
                  <select value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))} className="w-full h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none">
                    <option value="">Unassigned</option>
                    {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Due Date</label>
                  <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Tags</label>
                  <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="e.g. legal, urgent" className="h-9" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1 block">Est. Hours</label>
                  <Input value={form.estimatedHours} onChange={e => setForm(f => ({ ...f, estimatedHours: e.target.value }))} placeholder="e.g. 4" className="h-9" />
                </div>
              </div>
              <Button onClick={createTask} disabled={saving || !form.title.trim()} className="w-full bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] mt-2">
                {saving ? "Creating…" : "Create Task"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DETAIL DRAWER ─── */}
      {selected && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20" onClick={() => setSelected(null)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-[#0f2044] text-white px-5 py-4 flex items-start justify-between gap-3 shrink-0">
              <div className="flex-1 min-w-0">
                {editingTask ? (
                  <Input value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} className="bg-white/10 border-white/20 text-white placeholder:text-white/40 h-8 text-sm mb-1" />
                ) : (
                  <h2 className="font-bold text-base leading-snug">{selected.title}</h2>
                )}
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${priorityStyle(selected.priority).bg} ${priorityStyle(selected.priority).color}`}>{priorityStyle(selected.priority).label}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle(selected.status).color}`}>{statusStyle(selected.status).label}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditingTask(e => !e)} className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10"><Edit2 size={15} /></button>
                <button onClick={() => deleteTask(selected.id)} className="p-1.5 text-white/60 hover:text-red-300 rounded-lg hover:bg-white/10"><Trash2 size={15} /></button>
                <button onClick={() => setSelected(null)} className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10"><X size={16} /></button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Edit form */}
              {editingTask && (
                <div className="bg-amber-50 rounded-xl p-4 space-y-3 border border-amber-200">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Priority</label>
                      <select value={editForm.priority} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))} className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none">
                        {PRIORITIES.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Status</label>
                      <select value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none">
                        {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Assign To</label>
                      <select value={editForm.assignedToId} onChange={e => setEditForm(f => ({ ...f, assignedToId: e.target.value }))} className="w-full h-8 border border-gray-200 rounded-lg px-2 text-xs focus:outline-none">
                        <option value="">Unassigned</option>
                        {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Due Date</label>
                      <Input type="date" value={editForm.dueDate} onChange={e => setEditForm(f => ({ ...f, dueDate: e.target.value }))} className="h-8 text-xs" />
                    </div>
                  </div>
                  <textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} placeholder="Description…" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none resize-none" />
                  <div className="flex gap-2">
                    <Button onClick={saveEdit} size="sm" className="bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] h-8 text-xs">Save Changes</Button>
                    <Button variant="outline" size="sm" onClick={() => setEditingTask(false)} className="h-8 text-xs">Cancel</Button>
                  </div>
                </div>
              )}

              {/* Detail grid */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Assigned To", value: selected.assignedToName ?? "Unassigned", icon: User },
                  { label: "Due Date", value: fmtDate(selected.dueDate) ?? "No due date", icon: Clock },
                  { label: "Est. Hours", value: selected.estimatedHours ?? "—", icon: Timer },
                  { label: "Tags", value: selected.tags ?? "—", icon: Tag },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <div className="text-xs text-gray-500 flex items-center gap-1 mb-1"><Icon size={11} />{label}</div>
                    <div className="text-sm font-semibold text-[#0f2044] truncate">{value}</div>
                  </div>
                ))}
              </div>

              {/* Description */}
              {selected.description && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Description</div>
                  <p className="text-sm text-gray-700 leading-relaxed">{selected.description}</p>
                </div>
              )}

              {/* Move to */}
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Move to Column</div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUSES.filter(s => s.key !== selected.status).map(s => (
                    <button key={s.key} onClick={() => { moveStatus(selected.id, s.key); setSelected(prev => prev ? { ...prev, status: s.key } : null); }} className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all border ${s.color} hover:opacity-80`}>{s.label}</button>
                  ))}
                </div>
              </div>

              {/* Comments */}
              <div>
                <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide flex items-center gap-1.5">
                  <MessageSquare size={12} /> Comments ({comments.length})
                </div>
                <div className="space-y-3 mb-3">
                  {comments.length === 0 && <p className="text-xs text-gray-400 text-center py-2">No comments yet</p>}
                  {comments.map(c => (
                    <div key={c.id} className="flex gap-2.5">
                      <div className={`w-7 h-7 rounded-full ${avatarBg(c.authorName)} text-white text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5`}>{initials(c.authorName)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-gray-700">{c.authorName}</span>
                          <span className="text-[10px] text-gray-400">{new Date(c.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                        <div className="bg-gray-100 rounded-xl px-3 py-2 text-sm text-gray-700 leading-relaxed">{c.comment}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment()} placeholder="Add a comment…" className="flex-1 h-8 text-xs" />
                  <Button onClick={addComment} disabled={!newComment.trim()} size="sm" className="bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] h-8 px-2.5">
                    <Send size={13} />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}

function KanbanCard({ task, onOpen, onDelete, onDragStart, onMove }: {
  task: Task;
  onOpen: () => void;
  onDelete: () => void;
  onDragStart: () => void;
  onMove: (status: string) => void;
}) {
  const ps = priorityStyle(task.priority);
  const overdue = isOverdue(task.dueDate) && task.status !== "done";
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <button onClick={onOpen} className="font-semibold text-[#0f2044] text-sm text-left hover:text-[#c9a227] transition-colors leading-snug line-clamp-2 flex-1">{task.title}</button>
        <div className="relative shrink-0">
          <button onClick={() => setShowMenu(m => !m)} className="p-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all rounded">
            <MoreHorizontal size={13} />
          </button>
          {showMenu && (
            <div className="absolute right-0 top-6 bg-white border border-gray-200 rounded-xl shadow-xl z-10 w-36 py-1 text-xs">
              <button onClick={() => { onOpen(); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2"><Eye size={11} />View Details</button>
              {STATUSES.filter(s => s.key !== task.status).map(s => (
                <button key={s.key} onClick={() => { onMove(s.key); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-gray-600">→ {s.label}</button>
              ))}
              <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full text-left px-3 py-2 hover:bg-red-50 text-red-500 flex items-center gap-2"><Trash2 size={11} />Delete</button>
            </div>
          )}
        </div>
      </div>

      {task.tags && (
        <div className="flex flex-wrap gap-1 mb-2">
          {task.tags.split(",").slice(0, 2).map(tag => (
            <span key={tag} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{tag.trim()}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${ps.bg} ${ps.color}`}><Flag size={8} className="inline mr-0.5" />{ps.label}</span>
        <div className="flex items-center gap-2">
          {task.commentCount > 0 && (
            <span className="text-[10px] text-gray-400 flex items-center gap-0.5"><MessageSquare size={9} />{task.commentCount}</span>
          )}
          {task.assignedToName && (
            <div className={`w-5 h-5 rounded-full ${avatarBg(task.assignedToName)} text-white text-[9px] font-bold flex items-center justify-center`} title={task.assignedToName}>{initials(task.assignedToName)}</div>
          )}
          {task.dueDate && (
            <span className={`text-[10px] flex items-center gap-0.5 ${overdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
              <Clock size={9} />{fmtDate(task.dueDate)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
