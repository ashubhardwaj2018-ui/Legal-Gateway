import { useQuery } from "@tanstack/react-query";
import { X, History, RotateCcw, Clock, Loader2, AlertCircle } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface Version {
  id: number;
  page: string;
  content: Record<string, string>;
  snapshotLabel: string | null;
  createdBy: string | null;
  createdAt: string;
}

interface Props {
  page: string;
  onRestore: (content: Record<string, string>) => void;
  onClose: () => void;
}

export default function VersionHistoryDrawer({ page, onRestore, onClose }: Props) {
  const { data: versions = [], isLoading, error } = useQuery<Version[]>({
    queryKey: ["page-versions", page],
    queryFn: async () => {
      const r = await fetch(`/api/admin/pages/${page}/versions`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load versions");
      return r.json();
    },
  });

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="w-80 bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <History size={16} className="text-[#c9a227]" />
            <div>
              <p className="font-semibold text-sm text-gray-900">Version History</p>
              <p className="text-xs text-gray-400 capitalize">{page.replace(/-/g, " ")}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading…
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 m-4 p-3 bg-red-50 rounded-xl text-sm text-red-600">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              Failed to load versions
            </div>
          ) : versions.length === 0 ? (
            <div className="text-center py-12 px-6 text-gray-400">
              <History size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No versions saved yet.</p>
              <p className="text-xs mt-1">Versions are auto-saved each time you click Save.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {versions.map((v, idx) => {
                const d = new Date(v.createdAt);
                const label = v.snapshotLabel !== v.createdAt
                  ? null
                  : v.snapshotLabel;
                return (
                  <div key={v.id} className="px-5 py-4 hover:bg-gray-50 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-gray-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-800">
                            {idx === 0 ? (
                              <span className="text-[#0f2044] font-semibold">Current</span>
                            ) : (
                              formatDistanceToNow(d, { addSuffix: true })
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1 ml-4">
                          {format(d, "MMM d, yyyy · h:mm a")}
                        </p>
                        {label && (
                          <p className="text-xs text-gray-500 mt-1 ml-4 italic truncate">{label}</p>
                        )}
                      </div>
                      {idx > 0 && (
                        <button
                          onClick={() => {
                            onRestore(v.content);
                            onClose();
                          }}
                          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:border-[#0f2044] hover:text-[#0f2044] opacity-0 group-hover:opacity-100 transition-all"
                        >
                          <RotateCcw size={11} /> Restore
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <p className="text-[10px] text-gray-400 text-center">
            Up to 20 versions stored · Auto-saved on every Save
          </p>
        </div>
      </div>
    </div>
  );
}
