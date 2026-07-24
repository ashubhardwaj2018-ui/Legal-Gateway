import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { Bell, CheckCheck, X, Loader2, BellOff } from "lucide-react";

interface Notif {
  id: number;
  type: string;
  title: string;
  body: string;
  entityType: string | null;
  entityId: number | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const TYPE_ICONS: Record<string, string> = {
  lead_assigned: "👤",
  lead_updated: "📋",
  task_assigned: "✅",
  chat_message: "💬",
  followup_reminder: "🔔",
  invoice_generated: "📄",
  payment_received: "💰",
};

function fmtAgo(d: string): string {
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60000) return "just now";
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return `${Math.floor(ms / 86400000)}d ago`;
}

export function NotificationBell() {
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Poll unread count every 30s
  const fetchCount = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/notifications/unread-count");
      if (r.ok) {
        const d = await r.json() as { count: number };
        setUnread(d.count);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const t = setInterval(fetchCount, 30000);
    return () => clearInterval(t);
  }, [fetchCount]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function openPanel() {
    setOpen(v => !v);
    if (!open) {
      setLoading(true);
      try {
        const r = await fetch("/api/admin/notifications");
        if (r.ok) setItems(await r.json() as Notif[]);
      } finally { setLoading(false); }
    }
  }

  async function markOne(id: number) {
    await fetch(`/api/admin/notifications/${id}/read`, { method: "POST" });
    setItems(items.map(n => n.id === id ? { ...n, readAt: new Date().toISOString() } : n));
    setUnread(u => Math.max(0, u - 1));
  }

  async function markAll() {
    await fetch("/api/admin/notifications/read-all", { method: "POST" });
    setItems(items.map(n => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    setUnread(0);
  }

  function clickItem(n: Notif) {
    if (!n.readAt) markOne(n.id);
    if (n.link) navigate(n.link);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={openPanel}
        className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-800 transition-colors"
        title="Notifications"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[17px] h-[17px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-[#0f2044]">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={markAll} className="text-[10px] text-[#c9a227] hover:text-[#a07a10] font-medium flex items-center gap-1 transition-colors">
                  <CheckCheck size={12} /> Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[420px]">
            {loading ? (
              <div className="flex items-center justify-center h-24">
                <Loader2 size={18} className="animate-spin text-[#c9a227]" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 text-gray-400">
                <BellOff size={20} className="mb-1 opacity-40" />
                <p className="text-xs">No notifications yet</p>
              </div>
            ) : (
              items.map(n => (
                <button
                  key={n.id}
                  onClick={() => clickItem(n)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${!n.readAt ? "bg-blue-50/40" : ""}`}
                >
                  <span className="text-lg shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-xs font-semibold truncate ${!n.readAt ? "text-[#0f2044]" : "text-gray-600"}`}>{n.title}</div>
                    {n.body && <div className="text-[11px] text-gray-500 line-clamp-2 mt-0.5">{n.body}</div>}
                    <div className="text-[10px] text-gray-400 mt-1">{fmtAgo(n.createdAt)}</div>
                  </div>
                  {!n.readAt && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
                </button>
              ))
            )}
          </div>

          {items.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-100 text-center">
              <button
                onClick={async () => {
                  setLoading(true);
                  try {
                    const oldest = items[items.length - 1];
                    const r = await fetch(`/api/admin/notifications?before=${oldest.createdAt}`);
                    if (r.ok) {
                      const more = await r.json() as Notif[];
                      setItems(prev => [...prev, ...more]);
                    }
                  } finally { setLoading(false); }
                }}
                className="text-[11px] text-[#c9a227] hover:text-[#a07a10] font-medium"
              >
                Load more
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
