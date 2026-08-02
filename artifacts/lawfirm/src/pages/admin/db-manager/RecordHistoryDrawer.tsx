import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, History, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

interface AuditEntry {
  id: number;
  tableName: string;
  rowId: string | null;
  action: string;
  changedData: unknown;
  actorUsername: string;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  create:      "bg-green-100 text-green-700",
  update:      "bg-blue-100 text-blue-700",
  delete:      "bg-red-100 text-red-700",
  restore:     "bg-emerald-100 text-emerald-700",
  import:      "bg-violet-100 text-violet-700",
  bulk_delete: "bg-red-100 text-red-700",
  bulk_edit:   "bg-orange-100 text-orange-700",
};

function DiffView({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;

  const d = data as Record<string, unknown>;

  // Show a diff for update actions
  if (d.before && d.after) {
    const before = d.before as Record<string, unknown>;
    const after = d.after as Record<string, unknown>;
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changed = Array.from(keys).filter(k => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
        >
          {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {changed.length} field{changed.length !== 1 ? "s" : ""} changed
        </button>
        {open && (
          <div className="mt-1.5 space-y-1">
            {changed.map(k => (
              <div key={k} className="text-xs bg-gray-50 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-600">{k}</span>
                <div className="mt-0.5 grid grid-cols-2 gap-2">
                  <div className="bg-red-50 rounded px-2 py-0.5 text-red-600 font-mono truncate">
                    {String(before[k] ?? "—")}
                  </div>
                  <div className="bg-green-50 rounded px-2 py-0.5 text-green-600 font-mono truncate">
                    {String(after[k] ?? "—")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        Details
      </button>
      {open && (
        <pre className="mt-1.5 text-xs bg-gray-50 rounded-lg px-3 py-2 overflow-x-auto text-gray-500 max-h-40">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

interface Props {
  table: string;
  rowId: string;
  onClose: () => void;
}

export default function RecordHistoryDrawer({ table, rowId, onClose }: Props) {
  const { data: history = [], isLoading } = useQuery<AuditEntry[]>({
    queryKey: ["record-history", table, rowId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/db-manager/${table}/records/${rowId}/history`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <History size={16} className="text-[#0f2044]" />
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-gray-900">Record History</h2>
            <p className="text-xs text-gray-400 truncate">{table} · row #{rowId}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 text-gray-400 py-16">
              <Loader2 size={18} className="animate-spin" /> Loading history…
            </div>
          ) : history.length === 0 ? (
            <div className="text-center text-gray-400 py-16 text-sm">
              No audit history for this record yet.
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-3.5 top-0 bottom-0 w-px bg-gray-100" />
              <div className="space-y-4">
                {history.map((entry, i) => (
                  <div key={entry.id} className="flex gap-3 relative">
                    {/* Dot */}
                    <div className="shrink-0 w-7 h-7 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center z-10">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#0f2044]" />
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${ACTION_COLORS[entry.action] ?? "bg-gray-100 text-gray-600"}`}>
                          {entry.action}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">{entry.actorUsername}</span>
                        <span className="text-xs text-gray-300 ml-auto">
                          {entry.createdAt ? format(new Date(entry.createdAt), "MMM d, HH:mm") : ""}
                        </span>
                      </div>
                      {entry.ipAddress && (
                        <p className="text-[10px] text-gray-300 mt-0.5">IP: {entry.ipAddress}</p>
                      )}
                      <DiffView data={entry.changedData} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
