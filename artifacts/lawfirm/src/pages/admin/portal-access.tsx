import { useState, useEffect, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import {
  Users, CheckCircle, XCircle, Clock, RefreshCw,
  Mail, Phone, MessageSquare, Trash2, ExternalLink, Copy, Check, Link,
} from "lucide-react";

interface AccessRequest {
  id: number;
  email: string;
  name: string | null;
  phone: string | null;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

const STATUS_META = {
  pending:  { label: "Pending",  color: "bg-amber-100 text-amber-800 border-amber-200" },
  approved: { label: "Approved", color: "bg-green-100 text-green-800 border-green-200" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 border-red-200" },
};

export default function PortalAccessPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [actionPending, setActionPending] = useState<number | null>(null);
  const [devLinks, setDevLinks] = useState<Record<number, string>>({});
  const [copied, setCopied] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/portal-access");
      if (r.ok) setRequests(await r.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const visible = requests.filter(r => filter === "all" || r.status === filter);
  const pendingCount = requests.filter(r => r.status === "pending").length;

  async function approve(id: number) {
    setActionPending(id);
    try {
      const r = await fetch(`/api/admin/portal-access/${id}/approve`, { method: "POST" });
      const d = await r.json();
      if (r.ok) {
        if (d.link) setDevLinks(prev => ({ ...prev, [id]: d.link }));
        if (d.emailSent) showToast("Approved and access link sent to client by email.");
        else showToast("Approved! Copy the access link below to share with the client.", true);
        await load();
      } else {
        showToast(d.error ?? "Failed to approve", false);
      }
    } finally {
      setActionPending(null);
    }
  }

  async function getLink(id: number) {
    setActionPending(id);
    try {
      const r = await fetch(`/api/admin/portal-access/${id}/link`);
      const d = await r.json();
      if (r.ok && d.link) {
        setDevLinks(prev => ({ ...prev, [id]: d.link }));
        showToast("Access link ready — copy it below.");
      } else {
        showToast(d.error ?? "Failed to get link", false);
      }
    } finally {
      setActionPending(null);
    }
  }

  async function reject(id: number) {
    setActionPending(id);
    try {
      const r = await fetch(`/api/admin/portal-access/${id}/reject`, { method: "POST" });
      const d = await r.json();
      if (r.ok) showToast("Request rejected.");
      else showToast(d.error ?? "Failed to reject", false);
      await load();
    } finally {
      setActionPending(null);
    }
  }

  async function remove(id: number) {
    if (!confirm("Delete this request permanently?")) return;
    await fetch(`/api/admin/portal-access/${id}`, { method: "DELETE" });
    setRequests(prev => prev.filter(r => r.id !== id));
    setDevLinks(prev => { const n = { ...prev }; delete n[id]; return n; });
    showToast("Deleted.");
  }

  function copyLink(id: number, link: string) {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <AdminLayout title="Client Portal Access" subtitle="Review and approve client portal access requests">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
          ${toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"}`}>
          {toast.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <div className="space-y-6">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4">
          {(["pending", "approved", "rejected"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`p-4 rounded-xl border text-left transition-all hover:shadow-sm
                ${filter === s ? "ring-2 ring-[#0f2044] bg-white" : "bg-white border-gray-100"}`}
            >
              <div className="text-2xl font-bold text-[#0f2044]">
                {requests.filter(r => r.status === s).length}
              </div>
              <div className="text-xs text-gray-500 capitalize mt-0.5">{s}</div>
            </button>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {(["all", "pending", "approved", "rejected"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                  ${filter === f
                    ? "bg-[#0f2044] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f === "pending" && pendingCount > 0 && (
                  <span className="ml-1.5 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
                )}
              </button>
            ))}
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw size={20} className="animate-spin mr-2" /> Loading requests…
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
              <Users size={32} className="mb-3 opacity-30" />
              <div className="font-medium">No {filter === "all" ? "" : filter} requests</div>
              <div className="text-sm mt-1">
                {filter === "pending"
                  ? "Clients who submit access requests will appear here"
                  : "Switch to a different filter to see more"}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {visible.map(req => {
                const meta = STATUS_META[req.status];
                const devLink = devLinks[req.id];
                const isPending = req.status === "pending";
                const isActing = actionPending === req.id;

                return (
                  <div key={req.id} className="p-5 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <div className="w-8 h-8 rounded-full bg-[#0f2044]/10 flex items-center justify-center shrink-0">
                            <span className="text-[#0f2044] font-bold text-sm">
                              {(req.name ?? req.email)[0].toUpperCase()}
                            </span>
                          </div>
                          <div>
                            {req.name && <div className="font-semibold text-gray-900 text-sm">{req.name}</div>}
                            <div className="flex items-center gap-1 text-gray-500 text-xs">
                              <Mail size={11} />
                              <span>{req.email}</span>
                            </div>
                          </div>
                          <span className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                            {meta.label}
                          </span>
                        </div>

                        {/* Details */}
                        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
                          {req.phone && (
                            <span className="flex items-center gap-1">
                              <Phone size={11} /> {req.phone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            Requested {new Date(req.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {req.reviewedBy && (
                            <span className="flex items-center gap-1 text-gray-400">
                              {req.status === "approved" ? <CheckCircle size={11} className="text-green-500" /> : <XCircle size={11} className="text-red-400" />}
                              {req.status === "approved" ? "Approved" : "Rejected"} by {req.reviewedBy}
                              {req.reviewedAt && <> · {new Date(req.reviewedAt).toLocaleDateString("en-IN")}</>}
                            </span>
                          )}
                        </div>

                        {req.message && (
                          <div className="mt-2.5 flex items-start gap-1.5 bg-gray-50 rounded-lg px-3 py-2 text-xs text-gray-600">
                            <MessageSquare size={11} className="shrink-0 mt-0.5 text-gray-400" />
                            <span className="line-clamp-2">{req.message}</span>
                          </div>
                        )}

                        {/* Access link box */}
                        {devLink && (
                          <div className="mt-3 flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                            <Link size={12} className="text-blue-600 shrink-0" />
                            <span className="text-xs text-blue-800 flex-1 truncate font-mono">{devLink}</span>
                            <button
                              onClick={() => copyLink(req.id, devLink)}
                              className="text-blue-700 hover:text-blue-900 transition-colors shrink-0"
                              title="Copy link"
                            >
                              {copied === req.id ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        {isPending && (
                          <>
                            <button
                              onClick={() => approve(req.id)}
                              disabled={isActing}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                              <CheckCircle size={13} />
                              {isActing ? "Approving…" : "Approve"}
                            </button>
                            <button
                              onClick={() => reject(req.id)}
                              disabled={isActing}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                              <XCircle size={13} />
                              {isActing ? "Rejecting…" : "Reject"}
                            </button>
                          </>
                        )}
                        {req.status === "rejected" && (
                          <button
                            onClick={() => approve(req.id)}
                            disabled={isActing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            <CheckCircle size={13} />
                            Approve
                          </button>
                        )}
                        {req.status === "approved" && (
                          <button
                            onClick={() => getLink(req.id)}
                            disabled={isActing}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                          >
                            <Link size={13} />
                            {isActing ? "Getting…" : "Get Link"}
                          </button>
                        )}
                        <button
                          onClick={() => remove(req.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-500 border border-gray-200 text-xs rounded-lg transition-colors"
                        >
                          <Trash2 size={12} />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
