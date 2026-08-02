import { useState, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Plus, Download, Upload, Loader2, AlertCircle,
  Database, Lock, RefreshCw, Trash2, Pencil, X, CheckSquare,
  Activity, ChevronDown,
} from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import DataGrid from "./DataGrid";
import RecordForm, { type ColDef } from "./RecordForm";
import RecordHistoryDrawer from "./RecordHistoryDrawer";
import ImportModal from "./ImportModal";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TableInfo {
  name: string;
  label: string;
  category: string;
  primaryKey: string;
  softDeleteCol: string | null;
  isProtected: boolean;
  canWrite: boolean;
  columns: ColDef[];
}

interface RecordsResult {
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
}

// ── Audit Log tab ─────────────────────────────────────────────────────────────

interface AuditEntry {
  id: number; tableName: string; rowId: string | null; action: string;
  changedData: unknown; actorUsername: string; ipAddress: string | null; createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  create: "bg-green-100 text-green-700", update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700", restore: "bg-emerald-100 text-emerald-700",
  import: "bg-violet-100 text-violet-700", bulk_delete: "bg-red-100 text-red-700",
  bulk_edit: "bg-orange-100 text-orange-700",
};

function AuditLogTab({ tables }: { tables: TableInfo[] }) {
  const [filters, setFilters] = useState({ tableName: "", action: "", actor: "", dateFrom: "", dateTo: "" });
  const [page, setPage] = useState(1);

  const params = new URLSearchParams({ page: String(page), limit: "50", ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });

  const { data, isLoading } = useQuery<{ rows: AuditEntry[]; total: number }>({
    queryKey: ["audit-logs", params.toString()],
    queryFn: async () => {
      const r = await fetch(`/api/admin/db-manager/audit-logs?${params}`, { credentials: "include" });
      if (!r.ok) return { rows: [], total: 0 };
      return r.json();
    },
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3">
        <select
          value={filters.tableName}
          onChange={e => { setFilters(f => ({ ...f, tableName: e.target.value })); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
        >
          <option value="">All tables</option>
          {tables.map(t => <option key={t.name} value={t.name}>{t.label}</option>)}
        </select>
        <select
          value={filters.action}
          onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
        >
          <option value="">All actions</option>
          {["create", "update", "delete", "restore", "import", "bulk_delete", "bulk_edit"].map(a => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input type="text" value={filters.actor} onChange={e => { setFilters(f => ({ ...f, actor: e.target.value })); setPage(1); }}
          placeholder="Actor username" className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 w-40" />
        <input type="date" value={filters.dateFrom} onChange={e => { setFilters(f => ({ ...f, dateFrom: e.target.value })); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20" />
        <input type="date" value={filters.dateTo} onChange={e => { setFilters(f => ({ ...f, dateTo: e.target.value })); setPage(1); }}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20" />
        <button onClick={() => { setFilters({ tableName: "", action: "", actor: "", dateFrom: "", dateTo: "" }); setPage(1); }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50">
          <X size={13} /> Clear
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Time", "Table", "Row ID", "Action", "Actor", "IP", ""].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400"><Loader2 className="animate-spin inline mr-2" size={16} />Loading…</td></tr>
            ) : !data?.rows?.length ? (
              <tr><td colSpan={7} className="py-12 text-center text-gray-400">No audit entries found</td></tr>
            ) : data.rows.map(entry => (
              <tr key={entry.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-xs font-mono text-gray-700">{entry.tableName}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{entry.rowId ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-600"}`}>
                    {entry.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-700 font-medium">{entry.actorUsername}</td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono">{entry.ipAddress ?? "—"}</td>
                <td className="px-4 py-3" />
              </tr>
            ))}
          </tbody>
        </table>
        {/* Pagination */}
        {data && data.total > 50 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <span className="text-xs text-gray-500">{data.total.toLocaleString()} total entries</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white">Previous</button>
              <span className="text-xs text-gray-500">Page {page} of {Math.ceil(data.total / 50)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(data.total / 50)}
                className="px-3 py-1 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-white">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Bulk toolbar ───────────────────────────────────────────────────────────────

function BulkToolbar({ count, table, columns, onDelete, onEdit, onClear }: {
  count: number; table: TableInfo; columns: ColDef[];
  onDelete: () => void; onEdit: (col: string, val: unknown) => void; onClear: () => void;
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [editCol, setEditCol] = useState("");
  const [editVal, setEditVal] = useState<string>("");
  const [confirm, setConfirm] = useState(false);

  const editableCols = columns.filter(c => !c.readonly && c.type !== "id");

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 bg-[#0f2044] text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 min-w-[360px]">
      <CheckSquare size={16} className="text-[#c9a227] shrink-0" />
      <span className="text-sm font-semibold">{count} row{count !== 1 ? "s" : ""} selected</span>
      <div className="flex items-center gap-2 ml-auto">
        {!confirm && !showEdit && (
          <>
            <button onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg transition-colors">
              <Pencil size={12} /> Bulk Edit
            </button>
            <button onClick={() => setConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-500 hover:bg-red-400 rounded-lg transition-colors">
              <Trash2 size={12} /> Bulk Delete
            </button>
          </>
        )}
        {confirm && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-300">Delete {count} records?</span>
            <button onClick={() => { onDelete(); setConfirm(false); }}
              className="px-3 py-1.5 text-xs bg-red-500 hover:bg-red-400 rounded-lg">Confirm</button>
            <button onClick={() => setConfirm(false)}
              className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg">Cancel</button>
          </div>
        )}
        {showEdit && (
          <div className="flex items-center gap-2">
            <select value={editCol} onChange={e => setEditCol(e.target.value)}
              className="text-xs text-gray-800 rounded-lg px-2 py-1.5 bg-white">
              <option value="">Select field…</option>
              {editableCols.map(c => <option key={c.name} value={c.name}>{c.label}</option>)}
            </select>
            <input type="text" value={editVal} onChange={e => setEditVal(e.target.value)}
              placeholder="New value" className="text-xs text-gray-800 rounded-lg px-2 py-1.5 bg-white w-32" />
            <button onClick={() => { if (editCol) { onEdit(editCol, editVal); setShowEdit(false); } }}
              disabled={!editCol}
              className="px-3 py-1.5 text-xs bg-[#c9a227] text-[#0f2044] hover:bg-[#c9a227]/80 rounded-lg disabled:opacity-40 font-semibold">
              Apply
            </button>
            <button onClick={() => setShowEdit(false)}
              className="px-2 py-1.5 text-xs bg-white/10 hover:bg-white/20 rounded-lg">Cancel</button>
          </div>
        )}
        <button onClick={onClear} className="p-1.5 hover:bg-white/10 rounded-lg ml-1" title="Clear selection">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

const CATEGORY_ORDER = ["CRM", "Finance", "Legal", "Content", "Team", "Communication", "System"];

export default function AdminDbManager() {
  const qc = useQueryClient();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tab, setTab] = useState<"records" | "audit">("records");
  const [tableSearch, setTableSearch] = useState("");

  // Records query state
  const [search, setSearch]         = useState("");
  const [sort, setSort]             = useState("");
  const [order, setOrder]           = useState<"asc" | "desc">("desc");
  const [page, setPage]             = useState(1);
  const [showDeleted, setShowDeleted] = useState(false);
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());

  // Modals
  const [editRecord, setEditRecord]     = useState<Record<string, unknown> | null | "new">(null);
  const [historyTarget, setHistoryTarget] = useState<{ row: Record<string, unknown> } | null>(null);
  const [showImport, setShowImport]     = useState(false);

  // Fetch table registry
  const { data: tables = [], isLoading: tablesLoading } = useQuery<TableInfo[]>({
    queryKey: ["db-manager-tables"],
    queryFn: async () => {
      const r = await fetch("/api/admin/db-manager/tables", { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  const tableDef = tables.find(t => t.name === selectedTable) ?? null;

  // Reset query state when table changes
  useEffect(() => {
    if (!tableDef) return;
    setSearch(""); setSort(tableDef.primaryKey); setOrder("desc");
    setPage(1); setShowDeleted(false); setColumnFilters({}); setSelectedIds(new Set());
  }, [selectedTable]);

  // Fetch records
  const recordParams = new URLSearchParams({
    search, sort, order, page: String(page), limit: "50",
    showDeleted: String(showDeleted),
    ...Object.fromEntries(Object.entries(columnFilters).filter(([, v]) => v)),
  });
  const { data: recordsData, isLoading: recordsLoading, refetch: refetchRecords } = useQuery<RecordsResult>({
    queryKey: ["db-records", selectedTable, recordParams.toString()],
    queryFn: async () => {
      if (!selectedTable) return { rows: [], total: 0, page: 1, limit: 50 };
      const r = await fetch(`/api/admin/db-manager/${selectedTable}/records?${recordParams}`, { credentials: "include" });
      if (!r.ok) return { rows: [], total: 0, page: 1, limit: 50 };
      return r.json();
    },
    enabled: !!selectedTable,
  });

  // Sort handler
  function handleSort(col: string) {
    if (sort === col) setOrder(o => o === "asc" ? "desc" : "asc");
    else { setSort(col); setOrder("asc"); }
    setPage(1);
  }

  // Selection handlers
  function handleSelectId(id: string | number, sel: boolean) {
    setSelectedIds(prev => { const n = new Set(prev); sel ? n.add(id) : n.delete(id); return n; });
  }
  function handleSelectAll(sel: boolean) {
    if (!recordsData) return;
    setSelectedIds(prev => {
      const n = new Set(prev);
      recordsData.rows.forEach(r => {
        const id = r[tableDef!.primaryKey] as string | number;
        sel ? n.add(id) : n.delete(id);
      });
      return n;
    });
  }

  // CRUD
  async function handleCreate(data: Record<string, unknown>) {
    const r = await fetch(`/api/admin/db-manager/${selectedTable}/records`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Create failed"); }
    setEditRecord(null);
    qc.invalidateQueries({ queryKey: ["db-records", selectedTable] });
  }

  async function handleUpdate(id: string | number, data: Record<string, unknown>) {
    const r = await fetch(`/api/admin/db-manager/${selectedTable}/records/${id}`, {
      method: "PUT", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
    });
    if (!r.ok) { const e = await r.json(); throw new Error(e.error ?? "Update failed"); }
    setEditRecord(null);
    qc.invalidateQueries({ queryKey: ["db-records", selectedTable] });
  }

  async function handleDelete(row: Record<string, unknown>) {
    const id = row[tableDef!.primaryKey];
    if (!confirm(`Delete record #${id}? This cannot be undone.`)) return;
    const r = await fetch(`/api/admin/db-manager/${selectedTable}/records/${id}`, {
      method: "DELETE", credentials: "include",
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(`Delete failed: ${e.error ?? r.statusText}`);
      return;
    }
    qc.invalidateQueries({ queryKey: ["db-records", selectedTable] });
  }

  async function handleRestore(row: Record<string, unknown>) {
    const id = row[tableDef!.primaryKey];
    const r = await fetch(`/api/admin/db-manager/${selectedTable}/records/${id}/restore`, {
      method: "POST", credentials: "include",
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(`Restore failed: ${e.error ?? r.statusText}`);
      return;
    }
    qc.invalidateQueries({ queryKey: ["db-records", selectedTable] });
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    const r = await fetch(`/api/admin/db-manager/${selectedTable}/bulk-delete`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(`Bulk delete failed: ${e.error ?? r.statusText}`);
      return;
    }
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["db-records", selectedTable] });
  }

  async function handleBulkEdit(col: string, val: unknown) {
    const ids = Array.from(selectedIds);
    const r = await fetch(`/api/admin/db-manager/${selectedTable}/bulk-edit`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, patch: { [col]: val } }),
    });
    if (!r.ok) {
      const e = await r.json().catch(() => ({}));
      alert(`Bulk edit failed: ${e.error ?? r.statusText}`);
      return;
    }
    setSelectedIds(new Set());
    qc.invalidateQueries({ queryKey: ["db-records", selectedTable] });
  }

  function handleExport() {
    const url = `/api/admin/db-manager/${selectedTable}/export.csv?${new URLSearchParams({ search, sort, order })}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedTable}_export.csv`;
    a.click();
  }

  // Grouped tables sidebar
  const grouped = CATEGORY_ORDER.reduce<Record<string, TableInfo[]>>((acc, cat) => {
    const matches = tables.filter(t =>
      t.category === cat &&
      (tableSearch === "" || t.label.toLowerCase().includes(tableSearch.toLowerCase()))
    );
    if (matches.length) acc[cat] = matches;
    return acc;
  }, {});

  return (
    <AdminLayout
      title="Database Manager"
      subtitle="Browse, search, edit, and audit every table in the application database"
    >
      <div className="flex h-full min-h-0 -m-6">

        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        <div className="w-56 xl:w-64 shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col overflow-hidden">
          {/* Search */}
          <div className="px-3 py-3 border-b border-gray-200">
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={tableSearch}
                onChange={e => setTableSearch(e.target.value)}
                placeholder="Search tables…"
                className="w-full text-xs pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 bg-white"
              />
            </div>
          </div>

          {/* Table list */}
          <div className="flex-1 overflow-y-auto py-2">
            {tablesLoading ? (
              <div className="flex items-center gap-2 text-gray-400 text-xs px-4 py-4">
                <Loader2 size={13} className="animate-spin" /> Loading…
              </div>
            ) : Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">{cat}</div>
                {items.map(t => {
                  const active = selectedTable === t.name && tab === "records";
                  return (
                    <button
                      key={t.name}
                      onClick={() => { setSelectedTable(t.name); setTab("records"); }}
                      className={`w-full flex items-center gap-2 px-4 py-2 text-xs text-left transition-colors ${
                        active ? "bg-[#0f2044] text-white" : "text-gray-700 hover:bg-white hover:text-[#0f2044]"
                      }`}
                    >
                      {t.isProtected && <Lock size={11} className={active ? "text-[#c9a227]" : "text-gray-400"} />}
                      <Database size={11} className={active ? "text-[#c9a227]" : "text-gray-300"} />
                      <span className="font-medium leading-tight truncate">{t.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Audit log button */}
          <div className="border-t border-gray-200 p-3">
            <button
              onClick={() => setTab("audit")}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                tab === "audit" ? "bg-[#0f2044] text-white" : "text-gray-600 hover:bg-white hover:text-[#0f2044] border border-gray-200"
              }`}
            >
              <Activity size={13} />
              Audit Log
            </button>
          </div>
        </div>

        {/* ── Main area ────────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-white">

          {/* ── Audit Log tab ────────────────────────────────────────────── */}
          {tab === "audit" && (
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <AuditLogTab tables={tables} />
            </div>
          )}

          {/* ── No table selected ─────────────────────────────────────────── */}
          {tab === "records" && !tableDef && (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <Database size={40} className="text-gray-200" />
              <p className="text-sm font-medium">Select a table from the sidebar to browse records</p>
              <p className="text-xs text-gray-300">{tables.length} tables available</p>
            </div>
          )}

          {/* ── Records tab ───────────────────────────────────────────────── */}
          {tab === "records" && tableDef && (
            <>
              {/* Top bar */}
              <div className="shrink-0 flex items-center gap-3 px-5 py-3.5 border-b border-gray-200 bg-white flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-bold text-gray-900">{tableDef.label}</h2>
                    {tableDef.isProtected && (
                      <span className="flex items-center gap-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                        <Lock size={10} /> Protected
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-mono bg-gray-100 rounded px-2 py-0.5">{tableDef.name}</span>
                  </div>
                </div>
                <div className="ml-auto flex items-center gap-2 flex-wrap">
                  {/* Search */}
                  <div className="relative">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      value={search}
                      onChange={e => { setSearch(e.target.value); setPage(1); }}
                      placeholder="Search records…"
                      className="text-sm pl-9 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 w-44"
                    />
                  </div>
                  <button onClick={() => refetchRecords()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400" title="Refresh">
                    <RefreshCw size={14} />
                  </button>
                  <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                    <Download size={13} /> Export CSV
                  </button>
                  {tableDef.canWrite && (
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
                      <Upload size={13} /> Import Excel
                    </button>
                  )}
                  {tableDef.canWrite && (
                    <button
                      onClick={() => setEditRecord("new")}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#0f2044] text-white rounded-lg hover:bg-[#0f2044]/90 font-medium"
                    >
                      <Plus size={14} /> New Record
                    </button>
                  )}
                </div>
              </div>

              {/* Protected banner */}
              {tableDef.isProtected && !tableDef.canWrite && (
                <div className="shrink-0 flex items-center gap-2 bg-amber-50 border-b border-amber-200 px-5 py-2.5 text-xs text-amber-700">
                  <Lock size={12} /> This is a protected system table. You can browse records but not modify them. Super admin privileges are required to write.
                </div>
              )}

              {/* Grid area */}
              <div className="flex-1 overflow-hidden px-5 py-4 flex flex-col min-h-0">
                {recordsLoading ? (
                  <div className="flex items-center justify-center gap-3 text-gray-400 py-20">
                    <Loader2 size={22} className="animate-spin" /> Loading records…
                  </div>
                ) : (
                  <DataGrid
                    columns={tableDef.columns}
                    rows={recordsData?.rows ?? []}
                    total={recordsData?.total ?? 0}
                    page={page}
                    limit={50}
                    sort={sort}
                    order={order}
                    canWrite={tableDef.canWrite}
                    softDeleteCol={tableDef.softDeleteCol}
                    showDeleted={showDeleted}
                    selectedIds={selectedIds}
                    primaryKey={tableDef.primaryKey}
                    onSort={handleSort}
                    onPage={setPage}
                    onEdit={row => setEditRecord(row)}
                    onDelete={handleDelete}
                    onRestore={handleRestore}
                    onHistory={row => setHistoryTarget({ row })}
                    onToggleDeleted={() => setShowDeleted(v => !v)}
                    onSelectId={handleSelectId}
                    onSelectAll={handleSelectAll}
                    onColumnFilter={(col, val) => { setColumnFilters(prev => ({ ...prev, [col]: val })); setPage(1); }}
                    columnFilters={columnFilters}
                  />
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Bulk toolbar ──────────────────────────────────────────────────── */}
      {selectedIds.size > 0 && tableDef && (
        <BulkToolbar
          count={selectedIds.size}
          table={tableDef}
          columns={tableDef.columns}
          onDelete={handleBulkDelete}
          onEdit={handleBulkEdit}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* ── Record Form modal ─────────────────────────────────────────────── */}
      {editRecord !== null && tableDef && (
        <RecordForm
          tableName={tableDef.name}
          columns={tableDef.columns}
          record={editRecord === "new" ? null : editRecord}
          onSave={async data => {
            if (editRecord === "new") {
              await handleCreate(data);
            } else {
              const id = editRecord[tableDef.primaryKey] as string | number;
              await handleUpdate(id, data);
            }
          }}
          onClose={() => setEditRecord(null)}
        />
      )}

      {/* ── History drawer ────────────────────────────────────────────────── */}
      {historyTarget && tableDef && (
        <RecordHistoryDrawer
          table={tableDef.name}
          rowId={String(historyTarget.row[tableDef.primaryKey])}
          onClose={() => setHistoryTarget(null)}
        />
      )}

      {/* ── Import modal ──────────────────────────────────────────────────── */}
      {showImport && tableDef && (
        <ImportModal
          tableName={tableDef.name}
          columns={tableDef.columns}
          onClose={() => setShowImport(false)}
          onImported={count => {
            setShowImport(false);
            qc.invalidateQueries({ queryKey: ["db-records", selectedTable] });
          }}
        />
      )}
    </AdminLayout>
  );
}
