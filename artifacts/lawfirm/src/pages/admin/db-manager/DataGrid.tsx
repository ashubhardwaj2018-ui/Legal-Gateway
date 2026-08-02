import { useState, useCallback, useRef } from "react";
import {
  ChevronUp, ChevronDown, ChevronsUpDown, Pencil, Trash2,
  RotateCcw, History, ChevronLeft, ChevronRight, Filter, X,
  CheckSquare, Square, MinusSquare,
} from "lucide-react";
import { format } from "date-fns";

export interface ColDef {
  name: string;
  db: string;
  type: string;
  label: string;
  nullable?: boolean;
  readonly?: boolean;
  enumValues?: string[];
}

interface Props {
  columns: ColDef[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  limit: number;
  sort: string;
  order: "asc" | "desc";
  canWrite: boolean;
  softDeleteCol?: string | null;
  showDeleted: boolean;
  selectedIds: Set<string | number>;
  primaryKey: string;
  onSort: (col: string) => void;
  onPage: (p: number) => void;
  onEdit: (row: Record<string, unknown>) => void;
  onDelete: (row: Record<string, unknown>) => void;
  onRestore: (row: Record<string, unknown>) => void;
  onHistory: (row: Record<string, unknown>) => void;
  onToggleDeleted: () => void;
  onSelectId: (id: string | number, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onColumnFilter: (col: string, val: string) => void;
  columnFilters: Record<string, string>;
}

function CellValue({ value, type }: { value: unknown; type: string }) {
  if (value == null || value === "") return <span className="text-gray-300 text-xs">—</span>;
  if (type === "boolean") {
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
        value ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
      }`}>
        {value ? "Yes" : "No"}
      </span>
    );
  }
  if (type === "timestamp") {
    try {
      return <span className="text-xs text-gray-500">{format(new Date(String(value)), "MMM d, yyyy HH:mm")}</span>;
    } catch {
      return <span className="text-xs text-gray-500">{String(value)}</span>;
    }
  }
  if (type === "jsonb" || typeof value === "object") {
    const s = JSON.stringify(value);
    return <span className="text-xs font-mono text-gray-400 truncate max-w-[120px]" title={s}>{s}</span>;
  }
  const s = String(value);
  return (
    <span className="text-sm text-gray-700 truncate max-w-[200px]" title={s}>
      {s.length > 60 ? s.slice(0, 58) + "…" : s}
    </span>
  );
}

export default function DataGrid({
  columns, rows, total, page, limit, sort, order,
  canWrite, softDeleteCol, showDeleted, selectedIds, primaryKey,
  onSort, onPage, onEdit, onDelete, onRestore, onHistory,
  onToggleDeleted, onSelectId, onSelectAll, onColumnFilter, columnFilters,
}: Props) {
  const [showFilters, setShowFilters] = useState(false);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const pageIds = rows.map(r => r[primaryKey] as string | number);
  const allSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id));
  const someSelected = pageIds.some(id => selectedIds.has(id)) && !allSelected;

  const visibleCols = columns.slice(0, 8); // cap displayed cols to avoid overflow

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Filter bar */}
      {showFilters && (
        <div className="shrink-0 bg-amber-50 border border-amber-200 rounded-xl p-3 mb-3 flex flex-wrap gap-2">
          {visibleCols.map(col => (
            <div key={col.name} className="flex items-center gap-1">
              <label className="text-xs text-amber-700 whitespace-nowrap">{col.label}:</label>
              {col.type === "boolean" ? (
                <select
                  value={columnFilters[col.db] ?? ""}
                  onChange={e => onColumnFilter(col.db, e.target.value)}
                  className="text-xs border border-amber-200 rounded px-1.5 py-1 bg-white"
                >
                  <option value="">All</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : (
                <input
                  type="text"
                  value={columnFilters[col.db] ?? ""}
                  onChange={e => onColumnFilter(col.db, e.target.value)}
                  placeholder={`Filter…`}
                  className="text-xs border border-amber-200 rounded px-2 py-1 bg-white w-24"
                />
              )}
            </div>
          ))}
          <button
            onClick={() => { visibleCols.forEach(c => onColumnFilter(c.db, "")); }}
            className="ml-auto text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1"
          >
            <X size={11} /> Clear all
          </button>
        </div>
      )}

      {/* Table wrapper */}
      <div className="flex-1 overflow-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gray-50 border-b border-gray-200">
              {/* Checkbox */}
              <th className="w-10 px-3 py-3 text-left">
                <button
                  type="button"
                  onClick={() => onSelectAll(!allSelected)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  {allSelected ? (
                    <CheckSquare size={15} className="text-[#0f2044]" />
                  ) : someSelected ? (
                    <MinusSquare size={15} className="text-[#0f2044]" />
                  ) : (
                    <Square size={15} />
                  )}
                </button>
              </th>
              {/* Column headers */}
              {visibleCols.map(col => (
                <th
                  key={col.name}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap"
                  onClick={() => onSort(col.name)}
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    {sort === col.name ? (
                      order === "asc" ? <ChevronUp size={12} className="text-[#0f2044]" /> : <ChevronDown size={12} className="text-[#0f2044]" />
                    ) : (
                      <ChevronsUpDown size={11} className="text-gray-300" />
                    )}
                  </div>
                </th>
              ))}
              {/* Filter toggle */}
              <th className="w-8 px-2 py-3 text-center">
                <button
                  onClick={() => setShowFilters(v => !v)}
                  className={`p-1 rounded hover:bg-gray-200 ${showFilters ? "text-amber-600 bg-amber-50" : "text-gray-300"}`}
                  title="Column filters"
                >
                  <Filter size={13} />
                </button>
              </th>
              {/* Actions */}
              <th className="w-28 px-3 py-3 text-center text-xs font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={visibleCols.length + 3} className="text-center text-gray-400 py-16 text-sm">
                  No records found
                </td>
              </tr>
            ) : rows.map(row => {
              const id = row[primaryKey] as string | number;
              const isChecked = selectedIds.has(id);
              // rows have DB snake_case keys — look up col.db for the soft-delete flag
              const sdColDef = softDeleteCol ? columns.find(c => c.name === softDeleteCol) : null;
              const isDeleted = sdColDef ? !!row[sdColDef.db] : false;

              return (
                <tr
                  key={String(id)}
                  className={`group transition-colors ${
                    isChecked ? "bg-blue-50/60" : isDeleted ? "bg-red-50/40" : "hover:bg-gray-50"
                  }`}
                >
                  {/* Checkbox */}
                  <td className="px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectId(id, !isChecked)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      {isChecked
                        ? <CheckSquare size={14} className="text-[#0f2044]" />
                        : <Square size={14} />
                      }
                    </button>
                  </td>
                  {/* Cells */}
                  {visibleCols.map(col => (
                    <td key={col.name} className="px-4 py-2.5 max-w-xs">
                      <CellValue value={row[col.db] ?? row[col.name]} type={col.type} />
                    </td>
                  ))}
                  {/* Filter spacer */}
                  <td />
                  {/* Actions */}
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onHistory(row)}
                        className="p-1.5 rounded-lg hover:bg-gray-200 text-gray-400 hover:text-gray-700"
                        title="View history"
                      >
                        <History size={13} />
                      </button>
                      {canWrite && !isDeleted && (
                        <button
                          onClick={() => onEdit(row)}
                          className="p-1.5 rounded-lg hover:bg-blue-100 text-gray-400 hover:text-blue-700"
                          title="Edit record"
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {canWrite && isDeleted ? (
                        <button
                          onClick={() => onRestore(row)}
                          className="p-1.5 rounded-lg hover:bg-green-100 text-gray-400 hover:text-green-700"
                          title="Restore record"
                        >
                          <RotateCcw size={13} />
                        </button>
                      ) : canWrite ? (
                        <button
                          onClick={() => onDelete(row)}
                          className="p-1.5 rounded-lg hover:bg-red-100 text-gray-400 hover:text-red-600"
                          title="Delete record"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer: pagination + show deleted toggle */}
      <div className="shrink-0 flex items-center justify-between pt-3 gap-4">
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>{total.toLocaleString()} total rows</span>
          {softDeleteCol && (
            <button
              onClick={onToggleDeleted}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                showDeleted
                  ? "border-red-200 bg-red-50 text-red-600"
                  : "border-gray-200 hover:border-gray-300 text-gray-500"
              }`}
            >
              <Trash2 size={11} />
              {showDeleted ? "Hide deleted" : "Show deleted"}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="text-xs text-gray-500 min-w-[80px] text-center">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page >= totalPages}
            className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed text-gray-600"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
