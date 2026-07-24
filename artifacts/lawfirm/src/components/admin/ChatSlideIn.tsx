import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Send, Hash, Lock, Plus, Smile, Paperclip, Pin, Pencil, Trash2,
  CornerUpLeft, Search, MessageSquare, Loader2, Check, CheckCheck,
} from "lucide-react";

interface Channel { id: number; name: string; slug: string; type: string; description: string | null; members?: string; }
interface Msg {
  id: number; channelId: number; senderName: string; senderColor: string;
  content: string; msgType: string; fileName: string | null; fileUrl: string | null;
  reactions: string; replyToId: number | null; replyPreview: string | null;
  isEdited: boolean; isDeleted: boolean; isPinned: boolean; createdAt: string;
}
interface Member { id: number; name: string; department: string; designation: string; }

const EMOJIS = ["👍","❤️","😂","😮","🎉","🔥","🙏","👏","✅","🚀","😢","💯","🎊","💡","⚡","🌟","🤝","👀","🔑","✨"];
const MEMBER_COLORS = ["#7c3aed","#2563eb","#059669","#dc2626","#ea580c","#0891b2","#be185d","#d97706"];
function nameColor(name: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % MEMBER_COLORS.length;
  return MEMBER_COLORS[h];
}
function initials(name: string) { return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); }
function fmtDate(d: string) {
  const dt = new Date(d), now = new Date();
  if (dt.toDateString() === now.toDateString()) return "Today";
  const yest = new Date(now.getTime() - 86400000);
  if (dt.toDateString() === yest.toDateString()) return "Yesterday";
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

interface Props {
  open: boolean;
  onClose: () => void;
  currentUser: string;
}

export function ChatSlideIn({ open, onClose, currentUser }: Props) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [active, setActive] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState<string[]>([]);
  const [showEmoji, setShowEmoji] = useState(false);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"channels" | "dms">("channels");
  const [creating, setCreating] = useState(false);
  const [newChanName, setNewChanName] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [pinned, setPinned] = useState<Msg[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  // Track which messages the OTHER party has read (for double-tick)
  const [readers, setReaders] = useState<Record<number, string[]>>({});

  const bottomRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Presence heartbeat — update server every 60s, fetch online list every 30s
  useEffect(() => {
    if (!open || !currentUser) return;
    const heartbeat = () =>
      fetch("/api/admin/chat/presence/heartbeat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: currentUser }),
      }).catch(() => {});
    heartbeat();
    const hb = setInterval(heartbeat, 60000);
    const poll = setInterval(async () => {
      const r = await fetch("/api/admin/chat/presence");
      if (r.ok) setOnlineUsers(await r.json() as string[]);
    }, 30000);
    fetch("/api/admin/chat/presence").then(r => r.ok ? r.json() : []).then(d => setOnlineUsers(d as string[])).catch(() => {});
    return () => { clearInterval(hb); clearInterval(poll); };
  }, [open, currentUser]);

  // Load channels and members on open
  useEffect(() => {
    if (!open) return;
    fetch("/api/admin/chat/channels").then(r => r.json()).then(d => setChannels(d as Channel[])).catch(() => {});
    fetch("/api/admin/chat/members").then(r => r.json()).then(d => setMembers(d as Member[])).catch(() => {});
  }, [open]);

  // Load messages when active channel changes
  const loadMessages = useCallback(async (ch: Channel) => {
    setLoadingMsgs(true);
    try {
      const r = await fetch(`/api/admin/chat/channels/${ch.id}/messages?limit=60`);
      if (r.ok) {
        const msgs = await r.json() as Msg[];
        setMessages(msgs);

        // Mark all visible messages as read
        const unreadIds = msgs.filter(m => m.senderName !== currentUser && !m.isDeleted).map(m => m.id);
        if (unreadIds.length > 0) {
          fetch(`/api/admin/chat/channels/${ch.id}/mark-read`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ readerName: currentUser, messageIds: unreadIds }),
          }).catch(() => {});
        }

        // Fetch who has read my messages
        const myIds = msgs.filter(m => m.senderName === currentUser).map(m => m.id);
        if (myIds.length > 0) {
          const r2 = await fetch(`/api/admin/chat/channels/${ch.id}/readers?ids=${myIds.join(",")}`);
          if (r2.ok) setReaders(await r2.json() as Record<number, string[]>);
        }
      }
    } finally { setLoadingMsgs(false); }

    // Pinned messages
    const r2 = await fetch(`/api/admin/chat/channels/${ch.id}/messages?limit=100`);
    if (r2.ok) {
      const all = await r2.json() as Msg[];
      setPinned(all.filter(m => m.isPinned));
    }
  }, [currentUser]);

  // SSE for real-time messages
  useEffect(() => {
    if (!active) return;
    sseRef.current?.close();
    const es = new EventSource(`/api/admin/chat/channels/${active.id}/stream`);
    sseRef.current = es;
    es.addEventListener("message", (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string) as Msg;
      setMessages(prev => [...prev.filter(m => m.id !== msg.id), msg]);
      // Auto-mark as read if not our own message
      if (msg.senderName !== currentUser && !msg.isDeleted) {
        fetch(`/api/admin/chat/channels/${active.id}/mark-read`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ readerName: currentUser, messageIds: [msg.id] }),
        }).catch(() => {});
      }
    });
    es.addEventListener("update", (e: MessageEvent) => {
      const msg = JSON.parse(e.data as string) as Msg;
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    });
    return () => { es.close(); sseRef.current = null; };
  }, [active?.id, currentUser]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Poll typing + read receipts for my messages
  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      const r = await fetch(`/api/admin/chat/channels/${active.id}/typing`);
      if (r.ok) setTyping((await r.json() as string[]).filter(n => n !== currentUser));

      // Refresh read receipts for sent messages
      const myIds = messages.filter(m => m.senderName === currentUser).map(m => m.id);
      if (myIds.length > 0) {
        const r2 = await fetch(`/api/admin/chat/channels/${active.id}/readers?ids=${myIds.join(",")}`);
        if (r2.ok) setReaders(await r2.json() as Record<number, string[]>);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [active?.id, currentUser, messages]);

  function onInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    if (!active) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    fetch(`/api/admin/chat/channels/${active.id}/typing`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberName: currentUser }),
    }).catch(() => {});
    typingTimerRef.current = setTimeout(() => {}, 3000);
  }

  async function sendMessage() {
    if (!active || !input.trim()) return;
    const body: Record<string, unknown> = {
      senderName: currentUser,
      senderColor: nameColor(currentUser),
      content: input.trim(),
      msgType: "text",
    };
    if (replyTo) {
      body.replyToId = replyTo.id;
      body.replyPreview = replyTo.content.slice(0, 80);
    }
    await fetch(`/api/admin/chat/channels/${active.id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setInput(""); setReplyTo(null); setShowEmoji(false);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !active) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const data = ev.target?.result as string;
      const r = await fetch("/api/admin/chat/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, data }),
      });
      if (r.ok) {
        const { url } = await r.json() as { url: string };
        await fetch(`/api/admin/chat/channels/${active.id}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderName: currentUser, senderColor: nameColor(currentUser), content: file.name, msgType: "file", fileName: file.name, fileUrl: url }),
        });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  async function editMsg() {
    if (editId == null || !editVal.trim()) return;
    await fetch(`/api/admin/chat/messages/${editId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: editVal }),
    });
    setEditId(null); setEditVal("");
  }

  async function deleteMsg(id: number) {
    await fetch(`/api/admin/chat/messages/${id}`, { method: "DELETE" });
  }

  async function togglePin(msg: Msg) {
    await fetch(`/api/admin/chat/messages/${msg.id}/pin`, { method: "PATCH" });
    const updated = { ...msg, isPinned: !msg.isPinned };
    setMessages(prev => prev.map(m => m.id === msg.id ? updated : m));
    setPinned(prev => updated.isPinned ? [...prev, updated] : prev.filter(m => m.id !== updated.id));
  }

  async function react(msgId: number, emoji: string) {
    await fetch(`/api/admin/chat/messages/${msgId}/react`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji, userName: currentUser }),
    });
  }

  // Server-side DM dedup: GET /admin/chat/channels/dm?a=&b=
  async function openDm(member: Member) {
    const r = await fetch(`/api/admin/chat/channels/dm?a=${encodeURIComponent(currentUser)}&b=${encodeURIComponent(member.name)}`);
    if (!r.ok) return;
    const ch = await r.json() as Channel;
    // Add to channels list if not already there
    setChannels(prev => prev.some(c => c.id === ch.id) ? prev : [...prev, ch]);
    selectChannel(ch);
    setTab("channels");
  }

  function selectChannel(ch: Channel) {
    setActive(ch); setMessages([]); setReaders({}); setShowPinned(false);
    loadMessages(ch);
  }

  async function createChannel() {
    if (!newChanName.trim()) return;
    const r = await fetch("/api/admin/chat/channels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newChanName.trim(), type: "public" }),
    });
    if (r.ok) {
      const ch = await r.json() as Channel;
      setChannels(prev => [...prev, ch]);
      setNewChanName(""); setCreating(false);
      selectChannel(ch);
    }
  }

  function isDmChannel(ch: Channel) { return ch.type === "direct"; }
  function dmLabel(ch: Channel): string {
    if (!isDmChannel(ch)) return ch.name;
    try {
      const participants = JSON.parse(ch.members ?? "[]") as string[];
      const other = participants.find(n => n !== currentUser);
      return other ?? ch.name;
    } catch { return ch.name; }
  }

  const publicChannels = channels.filter(c =>
    c.type !== "direct" && c.name.toLowerCase().includes(search.toLowerCase())
  );
  const dmChannels = channels.filter(c =>
    c.type === "direct" && dmLabel(c).toLowerCase().includes(search.toLowerCase())
  );
  const filteredMembers = members.filter(m =>
    m.name !== currentUser && m.name.toLowerCase().includes(search.toLowerCase())
  );

  // Group messages by date
  const grouped: { date: string; msgs: Msg[] }[] = [];
  for (const msg of messages.filter(m => !m.isDeleted)) {
    const d = fmtDate(msg.createdAt);
    const last = grouped[grouped.length - 1];
    if (last?.date === d) last.msgs.push(msg);
    else grouped.push({ date: d, msgs: [msg] });
  }

  // Read receipt for a message: check if anyone other than sender has read it
  function getReadReceipt(msg: Msg): "none" | "sent" | "read" {
    if (msg.senderName !== currentUser) return "none";
    const readBy = readers[msg.id] ?? [];
    const otherReads = readBy.filter(n => n !== currentUser);
    return otherReads.length > 0 ? "read" : "sent";
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 bg-white shadow-2xl flex" style={{ width: 680, maxWidth: "95vw" }}>
        {/* Left: Channel/DM list */}
        <div className="w-52 bg-[#0f2044] flex flex-col shrink-0">
          <div className="p-3 border-b border-white/10 flex items-center gap-2">
            <MessageSquare size={15} className="text-[#c9a227]" />
            <span className="text-sm font-bold text-white">Team Chat</span>
            <button onClick={onClose} className="ml-auto p-1 text-white/40 hover:text-white rounded">
              <X size={14} />
            </button>
          </div>

          {/* Tab toggle */}
          <div className="flex px-2 pt-2 gap-1">
            {(["channels", "dms"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 py-1 text-[10px] font-semibold rounded-lg transition-all ${tab === t ? "bg-[#c9a227] text-[#0f2044]" : "text-white/50 hover:text-white"}`}>
                {t === "channels" ? "Channels" : "Direct"}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="px-2 pt-2">
            <div className="flex items-center bg-white/10 rounded-lg px-2 py-1.5 gap-2">
              <Search size={11} className="text-white/40" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={tab === "channels" ? "Search channels" : "Search people"}
                className="bg-transparent text-white text-xs placeholder-white/30 flex-1 outline-none" />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
            {tab === "channels" && (
              <>
                {/* Public/private channels */}
                {publicChannels.map(ch => (
                  <button key={ch.id} onClick={() => selectChannel(ch)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all text-left ${active?.id === ch.id ? "bg-[#c9a227] text-[#0f2044] font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                    {ch.type === "private" ? <Lock size={11} className="shrink-0" /> : <Hash size={11} className="shrink-0" />}
                    <span className="truncate">{ch.name}</span>
                  </button>
                ))}
                {/* DM channels shown in Channels tab too */}
                {dmChannels.length > 0 && (
                  <div className="text-[9px] text-white/30 uppercase tracking-wider px-2 pt-2 pb-1">Direct</div>
                )}
                {dmChannels.map(ch => {
                  const other = dmLabel(ch);
                  const isOnline = onlineUsers.includes(other);
                  return (
                    <button key={ch.id} onClick={() => selectChannel(ch)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all text-left ${active?.id === ch.id ? "bg-[#c9a227] text-[#0f2044] font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                      <div className="relative shrink-0">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: nameColor(other) }}>
                          {initials(other)}
                        </div>
                        {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-[#0f2044]" />}
                      </div>
                      <span className="truncate">{other}</span>
                    </button>
                  );
                })}
                <button onClick={() => setCreating(v => !v)}
                  className="w-full flex items-center gap-2 px-2 py-2 text-white/40 hover:text-white text-xs rounded-lg transition-colors mt-1">
                  <Plus size={11} /> New channel
                </button>
                {creating && (
                  <div className="mt-1 space-y-1">
                    <input value={newChanName} onChange={e => setNewChanName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") createChannel(); }}
                      placeholder="Channel name"
                      className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none placeholder-white/30"
                      autoFocus />
                    <button onClick={createChannel} className="w-full bg-[#c9a227] text-[#0f2044] text-xs font-semibold py-1.5 rounded-lg">Create</button>
                  </div>
                )}
              </>
            )}
            {tab === "dms" && (
              <>
                {filteredMembers.map(m => {
                  const isOnline = onlineUsers.includes(m.name);
                  return (
                    <button key={m.id} onClick={() => openDm(m)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all text-left">
                      <div className="relative shrink-0">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: nameColor(m.name) }}>
                          {initials(m.name)}
                        </div>
                        {isOnline && <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-[#0f2044]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate">{m.name}</div>
                        <div className="text-[9px] text-white/30 truncate">{m.designation}</div>
                      </div>
                      {isOnline && <div className="ml-auto text-[9px] text-green-400 shrink-0">●</div>}
                    </button>
                  );
                })}
              </>
            )}
          </div>
        </div>

        {/* Right: Messages */}
        <div className="flex-1 flex flex-col min-w-0">
          {active ? (
            <>
              {/* Channel header */}
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2 bg-white shrink-0">
                {isDmChannel(active) ? (
                  <>
                    <div className="relative">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold" style={{ background: nameColor(dmLabel(active)) }}>
                        {initials(dmLabel(active))}
                      </div>
                      {onlineUsers.includes(dmLabel(active)) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-[#0f2044] text-sm">{dmLabel(active)}</div>
                      <div className={`text-[10px] ${onlineUsers.includes(dmLabel(active)) ? "text-green-500" : "text-gray-400"}`}>
                        {onlineUsers.includes(dmLabel(active)) ? "Online" : "Offline"}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Hash size={14} className="text-gray-400" />
                    <span className="font-semibold text-[#0f2044] text-sm">{active.name}</span>
                    {active.description && <span className="text-xs text-gray-400 truncate">{active.description}</span>}
                  </>
                )}
                <div className="ml-auto flex items-center gap-2">
                  <button onClick={() => setShowPinned(v => !v)} title="Pinned messages"
                    className={`p-1.5 rounded-lg transition-colors ${showPinned ? "bg-[#c9a227] text-[#0f2044]" : "text-gray-400 hover:bg-gray-100"}`}>
                    <Pin size={13} />
                  </button>
                </div>
              </div>

              {/* Pinned messages panel */}
              {showPinned && pinned.length > 0 && (
                <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 space-y-1 shrink-0">
                  <div className="text-[11px] font-semibold text-amber-700 flex items-center gap-1"><Pin size={11} /> Pinned messages</div>
                  {pinned.slice(0, 3).map(m => (
                    <div key={m.id} className="text-[11px] text-amber-800 truncate">{m.senderName}: {m.content}</div>
                  ))}
                </div>
              )}

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 bg-gray-50/30">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 size={20} className="animate-spin text-[#c9a227]" />
                  </div>
                ) : (
                  grouped.map(({ date, msgs }) => (
                    <div key={date}>
                      <div className="text-center mb-3">
                        <span className="text-[10px] text-gray-400 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">{date}</span>
                      </div>
                      <div className="space-y-3">
                        {msgs.map(msg => {
                          const isMe = msg.senderName === currentUser;
                          const reactions = JSON.parse(msg.reactions || "{}") as Record<string, string[]>;
                          const receipt = getReadReceipt(msg);
                          return (
                            <div key={msg.id} className={`flex gap-2 group ${isMe ? "flex-row-reverse" : ""}`}>
                              {!isMe && (
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 mt-0.5" style={{ background: nameColor(msg.senderName) }}>
                                  {initials(msg.senderName)}
                                </div>
                              )}
                              <div className={`max-w-[70%] ${isMe ? "items-end" : "items-start"} flex flex-col gap-1`}>
                                {!isMe && <div className="text-[10px] text-gray-500 font-medium px-1">{msg.senderName}</div>}
                                {/* Reply */}
                                {msg.replyPreview && (
                                  <div className={`text-[10px] rounded-lg px-2 py-1 border-l-2 border-[#c9a227] ${isMe ? "bg-amber-50" : "bg-white"} text-gray-500`}>
                                    {msg.replyPreview}
                                  </div>
                                )}
                                {/* Content */}
                                {editId === msg.id ? (
                                  <div className="flex gap-1">
                                    <input value={editVal} onChange={e => setEditVal(e.target.value)}
                                      onKeyDown={e => { if (e.key === "Enter") editMsg(); if (e.key === "Escape") setEditId(null); }}
                                      className="text-xs border border-gray-200 rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-[#c9a227]"
                                      autoFocus />
                                    <button onClick={editMsg} className="text-[#c9a227]"><Check size={13} /></button>
                                  </div>
                                ) : msg.msgType === "file" && msg.fileUrl ? (
                                  <a href={msg.fileUrl} target="_blank" rel="noreferrer"
                                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium ${isMe ? "bg-[#0f2044] text-white border-[#0f2044]" : "bg-white border-gray-200 text-gray-700"}`}>
                                    <Paperclip size={12} /> {msg.fileName ?? "File"}
                                  </a>
                                ) : (
                                  <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed ${isMe ? "bg-[#0f2044] text-white rounded-tr-sm" : "bg-white text-gray-800 shadow-sm rounded-tl-sm"} ${msg.isPinned ? "ring-1 ring-[#c9a227]" : ""}`}>
                                    {msg.content}
                                    {msg.isEdited && <span className="text-[9px] opacity-50 ml-1">(edited)</span>}
                                    <div className={`flex items-center gap-1 mt-0.5 ${isMe ? "justify-end" : ""}`}>
                                      <span className={`text-[9px] ${isMe ? "text-white/40" : "text-gray-400"}`}>{fmtTime(msg.createdAt)}</span>
                                      {/* Read receipt ticks */}
                                      {isMe && receipt === "read" && (
                                        <span title="Read"><CheckCheck size={10} className="text-blue-300" /></span>
                                      )}
                                      {isMe && receipt === "sent" && (
                                        <span title="Sent"><Check size={10} className="text-white/40" /></span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {/* Reactions */}
                                {Object.keys(reactions).length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {Object.entries(reactions).map(([emoji, users]) => (
                                      <button key={emoji} onClick={() => react(msg.id, emoji)}
                                        className={`text-[11px] px-1.5 py-0.5 rounded-full border transition-colors ${users.includes(currentUser) ? "bg-[#c9a227]/20 border-[#c9a227]" : "bg-white border-gray-200 hover:border-[#c9a227]"}`}>
                                        {emoji} {users.length}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {/* Hover actions */}
                                <div className={`opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity ${isMe ? "flex-row-reverse" : ""}`}>
                                  {EMOJIS.slice(0, 4).map(emoji => (
                                    <button key={emoji} onClick={() => react(msg.id, emoji)}
                                      className="text-[11px] hover:scale-110 transition-transform">{emoji}</button>
                                  ))}
                                  <button onClick={() => setReplyTo(msg)} className="p-0.5 text-gray-400 hover:text-gray-600 rounded" title="Reply">
                                    <CornerUpLeft size={11} />
                                  </button>
                                  <button onClick={() => togglePin(msg)} className={`p-0.5 rounded ${msg.isPinned ? "text-[#c9a227]" : "text-gray-400 hover:text-gray-600"}`} title="Pin">
                                    <Pin size={11} />
                                  </button>
                                  {isMe && <>
                                    <button onClick={() => { setEditId(msg.id); setEditVal(msg.content); }} className="p-0.5 text-gray-400 hover:text-gray-600 rounded" title="Edit">
                                      <Pencil size={11} />
                                    </button>
                                    <button onClick={() => deleteMsg(msg.id)} className="p-0.5 text-red-400 hover:text-red-600 rounded" title="Delete">
                                      <Trash2 size={11} />
                                    </button>
                                  </>}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
                {typing.length > 0 && (
                  <div className="text-[11px] text-gray-400 italic px-1">{typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…</div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Reply preview */}
              {replyTo && (
                <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 flex items-center gap-2 shrink-0">
                  <CornerUpLeft size={12} className="text-amber-600" />
                  <span className="text-xs text-amber-700 flex-1 truncate">Replying to: {replyTo.content.slice(0, 60)}</span>
                  <button onClick={() => setReplyTo(null)} className="text-amber-500 hover:text-amber-700"><X size={12} /></button>
                </div>
              )}

              {/* Emoji picker */}
              {showEmoji && (
                <div className="px-4 py-2 bg-white border-t border-gray-100 flex flex-wrap gap-1.5 shrink-0">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { setInput(v => v + e); setShowEmoji(false); }}
                      className="text-lg hover:scale-110 transition-transform">{e}</button>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="px-3 py-3 border-t border-gray-100 bg-white flex items-end gap-2 shrink-0">
                <input ref={fileRef} type="file" className="hidden" onChange={handleFile}
                  accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.zip,.png,.jpg,.jpeg,.webp" />
                <button onClick={() => fileRef.current?.click()}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors shrink-0">
                  <Paperclip size={16} />
                </button>
                <button onClick={() => setShowEmoji(v => !v)}
                  className={`p-2 rounded-lg transition-colors shrink-0 ${showEmoji ? "bg-[#c9a227] text-[#0f2044]" : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"}`}>
                  <Smile size={16} />
                </button>
                <textarea
                  value={input}
                  onChange={onInputChange}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={active.type === "direct" ? `Message ${dmLabel(active)}…` : `Message #${active.name}…`}
                  rows={1}
                  className="flex-1 resize-none text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#c9a227]/30 focus:border-[#c9a227] max-h-24 overflow-y-auto"
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim()}
                  className="p-2 bg-[#0f2044] text-white rounded-xl hover:bg-[#0f2044]/80 disabled:opacity-40 transition-colors shrink-0"
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
              <MessageSquare size={36} className="mb-3 opacity-20" />
              <p className="text-sm font-medium">Select a channel to start chatting</p>
              <p className="text-xs mt-1">or pick a team member for a direct message</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
