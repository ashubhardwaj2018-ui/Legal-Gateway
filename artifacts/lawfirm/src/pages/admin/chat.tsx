import { useState, useEffect, useRef, useCallback } from "react";
import {
  Hash, Lock, Plus, Send, Smile, Paperclip, Pin,
  Pencil, Trash2, CornerUpLeft, X, ChevronDown,
  Users, Search, AtSign, CheckCheck,
} from "lucide-react";
import { Link } from "wouter";

interface Channel { id: number; name: string; slug: string; type: string; description: string | null; createdAt: string; }
interface Msg {
  id: number; channelId: number; senderName: string; senderColor: string;
  content: string; msgType: string; fileName: string | null; fileUrl: string | null;
  reactions: string; replyToId: number | null; replyPreview: string | null;
  isEdited: boolean; isDeleted: boolean; isPinned: boolean; createdAt: string;
}
interface Member { id: number; name: string; department: string; designation: string; username?: string; }

function fileTypeInfo(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return { emoji: "📄", label: "PDF", bg: "bg-red-50 border-red-200", text: "text-red-700" };
  if (["xlsx","xls"].includes(ext)) return { emoji: "📊", label: "Excel", bg: "bg-green-50 border-green-200", text: "text-green-700" };
  if (ext === "csv") return { emoji: "📊", label: "CSV", bg: "bg-green-50 border-green-200", text: "text-green-700" };
  if (["docx","doc"].includes(ext)) return { emoji: "📝", label: "Word", bg: "bg-blue-50 border-blue-200", text: "text-blue-700" };
  if (["pptx","ppt"].includes(ext)) return { emoji: "📑", label: "PowerPoint", bg: "bg-orange-50 border-orange-200", text: "text-orange-700" };
  if (["jpg","jpeg","png","gif","webp"].includes(ext)) return { emoji: "🖼️", label: "Image", bg: "bg-purple-50 border-purple-200", text: "text-purple-700" };
  if (["zip","rar","7z"].includes(ext)) return { emoji: "🗜️", label: "Archive", bg: "bg-gray-50 border-gray-200", text: "text-gray-700" };
  return { emoji: "📎", label: "File", bg: "bg-gray-50 border-gray-200", text: "text-gray-700" };
}

const MEMBER_COLORS = ["#7c3aed","#2563eb","#059669","#dc2626","#ea580c","#0891b2","#be185d","#d97706","#16a34a","#7c3aed"];
const EMOJIS = ["👍","❤️","😂","😮","🎉","🔥","🙏","👏","✅","🚀","😢","💯"];

function nameColor(name: string): string {
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) % MEMBER_COLORS.length;
  return MEMBER_COLORS[h];
}
function initials(name: string) { return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2); }
function fmtTime(d: string) { return new Date(d).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }); }
function fmtDateLabel(d: string) {
  const dt = new Date(d), now = new Date();
  const today = now.toDateString(), yesterday = new Date(now.getTime() - 86400000).toDateString();
  if (dt.toDateString() === today) return "Today";
  if (dt.toDateString() === yesterday) return "Yesterday";
  return dt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });
}

const DEFAULT_CHANNELS_SEED = [
  { name: "general", type: "public", description: "Company-wide announcements and updates" },
  { name: "legal-team", type: "public", description: "Legal team discussions" },
  { name: "accounts", type: "public", description: "Finance and billing" },
  { name: "hr-corner", type: "public", description: "HR updates, leaves and policies" },
  { name: "random", type: "public", description: "Non-work banter and fun" },
];

export default function AdminChat() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [typing, setTyping] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);

  // Current user — derived from session, never from localStorage or manual picker
  const [myName, setMyName] = useState("");
  const [myColor, setMyColor] = useState("");

  // Input
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [editingMsg, setEditingMsg] = useState<Msg | null>(null);
  const [editText, setEditText] = useState("");
  const [emojiTarget, setEmojiTarget] = useState<number | null>(null);

  // Create channel
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelDesc, setNewChannelDesc] = useState("");

  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const typingTimer = useRef<NodeJS.Timeout | null>(null);
  const typingPoll = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload state
  const [pendingFile, setPendingFile] = useState<{ name: string; url: string; size: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  }, []);

  // Load channels + always resolve identity from session (never from localStorage/manual picker)
  const loadChannels = useCallback(async () => {
    const [chR, mbR, meR] = await Promise.all([
      fetch("/api/admin/chat/channels").then(r => r.json()),
      fetch("/api/admin/chat/members").then(r => r.json()),
      fetch("/api/admin/auth/me").then(r => r.ok ? r.json() : null).catch(() => null),
    ]);
    const chs: Channel[] = Array.isArray(chR) ? chR : [];
    const mbs: Member[] = Array.isArray(mbR) ? mbR : [];
    // Seed defaults if empty
    if (chs.length === 0) {
      for (const seed of DEFAULT_CHANNELS_SEED) {
        await fetch("/api/admin/chat/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(seed) });
      }
      const fresh = await fetch("/api/admin/chat/channels").then(r => r.json());
      setChannels(Array.isArray(fresh) ? fresh : []);
      setActiveChannel(Array.isArray(fresh) ? fresh[0] : null);
    } else {
      setChannels(chs);
      if (!activeChannel) setActiveChannel(chs[0] ?? null);
    }
    setMembers(mbs);
    // Always resolve name from session — no manual override allowed
    if (meR?.user?.username) {
      const uname = meR.user.username as string;
      const match = mbs.find((m: Member) => m.username === uname || m.name.toLowerCase().replace(/\s+/g, "") === uname.toLowerCase());
      const resolvedName = match ? match.name : uname === "admin" ? "Admin" : uname;
      const color = nameColor(resolvedName);
      setMyName(resolvedName);
      setMyColor(color);
    }
  }, [activeChannel]);

  useEffect(() => { loadChannels(); }, []);

  // Load messages for active channel
  const loadMessages = useCallback(async (ch: Channel) => {
    setLoading(true);
    const msgs = await fetch(`/api/admin/chat/channels/${ch.id}/messages?limit=60`).then(r => r.json());
    setMessages(Array.isArray(msgs) ? msgs : []);
    setLoading(false);
    setTimeout(() => scrollToBottom(false), 100);
  }, [scrollToBottom]);

  useEffect(() => {
    if (!activeChannel) return;
    loadMessages(activeChannel);
    // SSE
    if (sseRef.current) sseRef.current.close();
    const es = new EventSource(`/api/admin/chat/channels/${activeChannel.id}/stream`);
    es.addEventListener("message", (e) => {
      const msg: Msg = JSON.parse(e.data);
      setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
      setTimeout(() => scrollToBottom(), 50);
    });
    es.addEventListener("update", (e) => {
      const msg: Msg = JSON.parse(e.data);
      setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
    });
    sseRef.current = es;
    // Typing poll
    if (typingPoll.current) clearInterval(typingPoll.current);
    typingPoll.current = setInterval(async () => {
      const t = await fetch(`/api/admin/chat/channels/${activeChannel.id}/typing`).then(r => r.json());
      setTyping(Array.isArray(t) ? t.filter((n: string) => n !== myName) : []);
    }, 2000);
    return () => { es.close(); if (typingPoll.current) clearInterval(typingPoll.current); };
  }, [activeChannel, myName, loadMessages, scrollToBottom]);

  const loadOlderMessages = async () => {
    if (!activeChannel || messages.length === 0 || loadingOlder) return;
    setLoadingOlder(true);
    const oldest = messages[0].createdAt;
    const older = await fetch(`/api/admin/chat/channels/${activeChannel.id}/messages?before=${encodeURIComponent(oldest)}&limit=30`).then(r => r.json());
    if (Array.isArray(older) && older.length > 0) setMessages(prev => [...older, ...prev]);
    setLoadingOlder(false);
  };

  const sendTyping = () => {
    if (!activeChannel || !myName) return;
    if (typingTimer.current) clearTimeout(typingTimer.current);
    fetch(`/api/admin/chat/channels/${activeChannel.id}/typing`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ memberName: myName }) });
    typingTimer.current = setTimeout(() => {}, 3000);
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const data = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      const r = await fetch("/api/admin/chat/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, mimetype: file.type, data }),
      }).then(res => res.json());
      const bytes = file.size;
      const size = bytes < 1024 ? `${bytes}B` : bytes < 1048576 ? `${(bytes / 1024).toFixed(1)}KB` : `${(bytes / 1048576).toFixed(1)}MB`;
      setPendingFile({ name: file.name, url: r.url, size });
    } catch {
      alert("File upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const sendMessage = async () => {
    if (!activeChannel || !myName) return;
    const color = myColor || nameColor(myName);

    // Send pending file if any
    if (pendingFile) {
      await fetch(`/api/admin/chat/channels/${activeChannel.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderName: myName, senderColor: color,
          content: pendingFile.name, msgType: "file",
          fileName: pendingFile.name, fileUrl: pendingFile.url,
          replyToId: replyTo?.id ?? null,
          replyPreview: replyTo ? `${replyTo.senderName}: ${replyTo.content.slice(0, 80)}` : null,
        }),
      });
      setPendingFile(null);
      if (!text.trim()) { setReplyTo(null); setTimeout(() => scrollToBottom(), 100); return; }
    }

    const content = text.trim();
    if (!content) return;
    setText("");
    setReplyTo(null);
    await fetch(`/api/admin/chat/channels/${activeChannel.id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderName: myName, senderColor: color, content, replyToId: replyTo?.id ?? null, replyPreview: replyTo ? `${replyTo.senderName}: ${replyTo.content.slice(0, 80)}` : null }),
    });
    setTimeout(() => scrollToBottom(), 100);
  };

  const saveEdit = async () => {
    if (!editingMsg || !editText.trim()) return;
    await fetch(`/api/admin/chat/messages/${editingMsg.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: editText.trim() }) });
    setEditingMsg(null); setEditText("");
  };

  const deleteMsg = async (id: number) => {
    await fetch(`/api/admin/chat/messages/${id}`, { method: "DELETE" });
  };

  const react = async (msgId: number, emoji: string) => {
    if (!myName) return;
    await fetch(`/api/admin/chat/messages/${msgId}/react`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emoji, userName: myName }) });
    setEmojiTarget(null);
  };

  const createChannel = async () => {
    if (!newChannelName.trim()) return;
    const ch = await fetch("/api/admin/chat/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newChannelName.trim(), description: newChannelDesc.trim(), type: "public" }) }).then(r => r.json());
    await loadChannels();
    setActiveChannel(ch);
    setShowCreateChannel(false); setNewChannelName(""); setNewChannelDesc("");
  };

  const startDM = async (member: Member) => {
    const dmName = `dm-${[myName || "you", member.name].sort().join("-").toLowerCase().replace(/\s+/g, "-")}`;
    const existing = channels.find(c => c.slug === dmName);
    if (existing) { setActiveChannel(existing); return; }
    const ch = await fetch("/api/admin/chat/channels", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: `${member.name}`, description: `DM with ${member.name}`, type: "dm", slug: dmName }) }).then(r => r.json());
    await loadChannels();
    setActiveChannel(ch);
  };

  // Grouped messages
  const filteredMsgs = showSearch && searchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()) || m.senderName.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const msgGroups: Array<{ dateLabel: string; msgs: Msg[] }> = [];
  let currentDate = "";
  for (const msg of filteredMsgs) {
    const dateLabel = fmtDateLabel(msg.createdAt);
    if (dateLabel !== currentDate) { currentDate = dateLabel; msgGroups.push({ dateLabel, msgs: [] }); }
    msgGroups[msgGroups.length - 1].msgs.push(msg);
  }

  const typingText = typing.length === 0 ? "" : typing.length === 1 ? `${typing[0]} is typing…` : `${typing.slice(0, -1).join(", ")} and ${typing[typing.length - 1]} are typing…`;

  const publicChannels = channels.filter(c => c.type === "public");
  const dmChannels = channels.filter(c => c.type === "dm");

  return (
    <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 flex bg-[#0f2044]" style={{ zIndex: 40 }}>
      {/* ─── SIDEBAR ─── */}
      <div className="w-60 bg-[#0f2044] flex flex-col shrink-0 select-none">
        {/* Workspace header */}
        <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="font-bold text-white text-sm tracking-wide">Legal Filing India</div>
            <div className="text-white/40 text-[10px] flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block" /> Active</div>
          </div>
          <Link href="/admin" className="text-white/40 hover:text-white/70 p-1 rounded transition-colors" title="Back to Admin">
            <X size={14} />
          </Link>
        </div>

        {/* Search */}
        <button onClick={() => setShowSearch(s => !s)} className="mx-3 mt-2 flex items-center gap-2 bg-white/10 hover:bg-white/15 rounded-lg px-3 py-1.5 text-white/60 hover:text-white/80 text-xs transition-colors">
          <Search size={12} /> <span>Search messages</span>
        </button>

        {/* Current user — read-only, auto-resolved from session */}
        <div className="mx-3 mt-2 flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
          {myName ? (
            <>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: myColor || nameColor(myName) }}>{initials(myName)}</div>
              <span className="text-white/80 text-xs font-medium truncate flex-1">{myName}</span>
              <span className="text-white/30 text-[9px]">You</span>
            </>
          ) : (
            <span className="text-white/30 text-xs">Loading…</span>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-2 space-y-0.5">
          {/* Channels */}
          <div className="px-3 py-1.5 flex items-center justify-between">
            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Channels</span>
            <button onClick={() => setShowCreateChannel(true)} className="text-white/30 hover:text-white/70 transition-colors"><Plus size={13} /></button>
          </div>
          {publicChannels.map(ch => (
            <button key={ch.id} onClick={() => setActiveChannel(ch)} className={`w-full text-left flex items-center gap-2 px-3 py-1 mx-1 rounded-lg text-sm transition-colors ${activeChannel?.id === ch.id ? "bg-white/20 text-white font-semibold" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
              <Hash size={14} className="shrink-0 opacity-70" />
              <span className="truncate">{ch.name}</span>
            </button>
          ))}

          {/* Direct Messages */}
          <div className="px-3 py-1.5 mt-3 flex items-center justify-between">
            <span className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">Direct Messages</span>
          </div>
          {members.map(m => {
            const dmCh = channels.find(c => c.type === "dm" && c.name === m.name);
            const isActive = activeChannel?.id === dmCh?.id;
            return (
              <button key={m.id} onClick={() => startDM(m)} className={`w-full text-left flex items-center gap-2 px-3 py-1 mx-1 rounded-lg text-sm transition-colors ${isActive ? "bg-white/20 text-white font-semibold" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
                <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: nameColor(m.name) }}>{initials(m.name)}</div>
                <span className="truncate text-xs">{m.name}</span>
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full ml-auto shrink-0" />
              </button>
            );
          })}
          {dmChannels.filter(d => !members.find(m => m.name === d.name)).map(ch => (
            <button key={ch.id} onClick={() => setActiveChannel(ch)} className={`w-full text-left flex items-center gap-2 px-3 py-1 mx-1 rounded-lg text-sm transition-colors ${activeChannel?.id === ch.id ? "bg-white/20 text-white font-semibold" : "text-white/60 hover:text-white hover:bg-white/10"}`}>
              <AtSign size={13} className="shrink-0 opacity-70" />
              <span className="truncate text-xs">{ch.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ─── MAIN AREA ─── */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
        {!activeChannel ? (
          <div className="flex-1 flex items-center justify-center text-gray-300">
            <div className="text-center"><Hash size={48} className="mx-auto mb-3 opacity-30" /><p className="text-gray-400">Select a channel to start chatting</p></div>
          </div>
        ) : (
          <>
            {/* Channel header */}
            <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0 bg-white shadow-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {activeChannel.type === "dm" ? <AtSign size={16} className="text-gray-400 shrink-0" /> : <Hash size={16} className="text-gray-400 shrink-0" />}
                <span className="font-bold text-[#0f2044] text-base">{activeChannel.name}</span>
                {activeChannel.description && <span className="text-gray-400 text-sm hidden md:block truncate">— {activeChannel.description}</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setShowSearch(s => !s)} className={`p-2 rounded-lg transition-colors ${showSearch ? "bg-[#0f2044] text-white" : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"}`}><Search size={15} /></button>
                <div className="flex items-center gap-1 text-xs text-gray-400 px-2"><Users size={13} />{members.length + 1}</div>
              </div>
            </div>

            {/* Search bar */}
            {showSearch && (
              <div className="px-5 py-2 border-b border-gray-100 bg-gray-50">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search in this channel…" className="w-full pl-8 pr-4 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 bg-white" />
                  {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={13} /></button>}
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0 min-h-0" onScroll={e => { if ((e.target as HTMLDivElement).scrollTop < 60) loadOlderMessages(); }}>
              {loadingOlder && <div className="text-center py-2 text-gray-400 text-xs">Loading older messages…</div>}
              {loading && <div className="text-center py-8 text-gray-400 text-sm">Loading messages…</div>}

              {!loading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-[#0f2044] rounded-2xl flex items-center justify-center mb-4"><Hash size={28} className="text-[#c9a227]" /></div>
                  <h3 className="font-bold text-[#0f2044] text-lg mb-1">Welcome to #{activeChannel.name}</h3>
                  <p className="text-gray-400 text-sm max-w-xs">{activeChannel.description ?? "This is the beginning of this channel."}</p>
                </div>
              )}

              {msgGroups.map(group => (
                <div key={group.dateLabel}>
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 font-semibold px-2">{group.dateLabel}</span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                  {group.msgs.map((msg, i) => {
                    const prev = i > 0 ? group.msgs[i - 1] : null;
                    const isGrouped = prev && prev.senderName === msg.senderName && new Date(msg.createdAt).getTime() - new Date(prev.createdAt).getTime() < 5 * 60 * 1000;
                    const reactions: Record<string, string[]> = JSON.parse(msg.reactions ?? "{}");
                    const isMe = msg.senderName === myName;

                    return (
                      <div key={msg.id} className={`flex gap-2.5 group relative hover:bg-gray-50/80 rounded-xl px-2 py-0.5 transition-colors ${isGrouped ? "mt-0.5" : "mt-3"}`}>
                        {/* Avatar */}
                        <div className="shrink-0 mt-0.5">
                          {isGrouped ? <div className="w-8 opacity-0 group-hover:opacity-100 text-[9px] text-gray-300 text-right pt-1">{fmtTime(msg.createdAt)}</div> : (
                            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[10px] font-bold cursor-default" style={{ backgroundColor: msg.senderColor || nameColor(msg.senderName) }}>{initials(msg.senderName)}</div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          {/* Sender name + time */}
                          {!isGrouped && (
                            <div className="flex items-baseline gap-2 mb-0.5">
                              <span className="font-bold text-sm" style={{ color: msg.senderColor || nameColor(msg.senderName) }}>{msg.senderName}</span>
                              <span className="text-[10px] text-gray-400">{fmtTime(msg.createdAt)}</span>
                              {msg.isEdited && <span className="text-[10px] text-gray-300">(edited)</span>}
                              {msg.isPinned && <Pin size={10} className="text-[#c9a227]" />}
                            </div>
                          )}

                          {/* Reply preview */}
                          {msg.replyPreview && (
                            <div className="border-l-2 border-gray-300 pl-2 mb-1 text-[11px] text-gray-400 line-clamp-1">{msg.replyPreview}</div>
                          )}

                          {/* Content */}
                          {editingMsg?.id === msg.id ? (
                            <div className="flex gap-2">
                              <input value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setEditingMsg(null); }} autoFocus className="flex-1 border border-[#c9a227] rounded-lg px-3 py-1.5 text-sm focus:outline-none bg-white shadow-sm" />
                              <button onClick={saveEdit} className="text-xs px-2 py-1.5 bg-[#0f2044] text-white rounded-lg hover:bg-[#c9a227] hover:text-[#0f2044] transition-colors">Save</button>
                              <button onClick={() => setEditingMsg(null)} className="text-xs px-2 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                            </div>
                          ) : msg.isDeleted ? (
                            <span className="text-sm italic text-gray-400">This message was deleted.</span>
                          ) : msg.msgType === "file" && msg.fileUrl ? (() => {
                            const fi = fileTypeInfo(msg.fileName ?? msg.content);
                            return (
                              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" download={msg.fileName ?? undefined}
                                className={`inline-flex items-center gap-3 border rounded-xl px-3 py-2.5 mt-1 max-w-xs hover:shadow-md transition-shadow cursor-pointer no-underline ${fi.bg}`}>
                                <span className="text-2xl shrink-0">{fi.emoji}</span>
                                <div className="min-w-0">
                                  <p className={`text-xs font-semibold truncate ${fi.text}`}>{msg.fileName ?? msg.content}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{fi.label} · Click to download</p>
                                </div>
                              </a>
                            );
                          })() : (
                            <span className="text-sm leading-relaxed whitespace-pre-wrap break-words text-gray-800">{msg.content}</span>
                          )}

                          {/* Reactions */}
                          {Object.keys(reactions).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {Object.entries(reactions).map(([emoji, users]) => (
                                <button key={emoji} onClick={() => react(msg.id, emoji)} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all ${users.includes(myName) ? "bg-[#0f2044]/10 border-[#0f2044]/30 text-[#0f2044]" : "bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200"}`}>
                                  <span>{emoji}</span><span className="font-semibold">{users.length}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Hover toolbar */}
                        {!msg.isDeleted && editingMsg?.id !== msg.id && (
                          <div className="absolute right-2 top-0 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-all bg-white border border-gray-200 rounded-xl shadow-lg flex items-center gap-0.5 px-1.5 py-1 z-10">
                            <button onClick={() => setEmojiTarget(emojiTarget === msg.id ? null : msg.id)} className="p-1.5 text-gray-400 hover:text-yellow-500 hover:bg-yellow-50 rounded-lg transition-colors" title="React"><Smile size={13} /></button>
                            <button onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }} className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors" title="Reply"><CornerUpLeft size={13} /></button>
                            {isMe && <button onClick={() => { setEditingMsg(msg); setEditText(msg.content); }} className="p-1.5 text-gray-400 hover:text-[#0f2044] hover:bg-gray-100 rounded-lg transition-colors" title="Edit"><Pencil size={13} /></button>}
                            {isMe && <button onClick={() => deleteMsg(msg.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={13} /></button>}
                          </div>
                        )}

                        {/* Emoji picker */}
                        {emojiTarget === msg.id && (
                          <div className="absolute right-2 top-8 bg-white border border-gray-200 rounded-2xl shadow-2xl p-2.5 z-20 grid grid-cols-6 gap-1">
                            {EMOJIS.map(e => (
                              <button key={e} onClick={() => react(msg.id, e)} className="text-lg hover:scale-125 transition-transform p-1 rounded-lg hover:bg-gray-100">{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Typing indicator */}
            <div className="h-5 px-6 shrink-0">
              {typingText && (
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="flex gap-0.5">{[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}</div>
                  <span>{typingText}</span>
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="px-4 pb-4 pt-1 border-t border-gray-100 shrink-0">
              {replyTo && (
                <div className="flex items-center gap-2 mb-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <CornerUpLeft size={12} className="text-blue-500 shrink-0" />
                  <span className="text-xs text-blue-600 font-semibold">{replyTo.senderName}:</span>
                  <span className="text-xs text-blue-500 flex-1 truncate">{replyTo.content.slice(0, 80)}</span>
                  <button onClick={() => setReplyTo(null)} className="text-blue-400 hover:text-blue-600 shrink-0"><X size={12} /></button>
                </div>
              )}
              {/* Pending file preview */}
              {pendingFile && (
                <div className="flex items-center gap-2 mb-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2">
                  <span className="text-base">{fileTypeInfo(pendingFile.name).emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-blue-800 truncate">{pendingFile.name}</p>
                    <p className="text-[10px] text-blue-500">{pendingFile.size} · Ready to send</p>
                  </div>
                  <button onClick={() => setPendingFile(null)} className="text-blue-400 hover:text-blue-600 shrink-0"><X size={12} /></button>
                </div>
              )}
              {uploading && (
                <div className="flex items-center gap-2 mb-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                  <div className="w-3 h-3 border-2 border-[#0f2044] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-gray-500">Uploading file…</span>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
              <div className="flex items-end gap-2 bg-gray-100 rounded-2xl px-4 py-2.5">
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={e => { setText(e.target.value); sendTyping(); }}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                  placeholder={!myName ? "Set your name first…" : `Message #${activeChannel.name}`}
                  rows={1}
                  className="flex-1 bg-transparent text-sm focus:outline-none resize-none text-gray-800 placeholder-gray-400 max-h-32"
                  style={{ minHeight: "24px" }}
                />
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => fileInputRef.current?.click()} disabled={uploading} title="Attach file"
                    className={`p-1.5 rounded-lg transition-colors ${pendingFile ? "text-blue-500 bg-blue-50" : "text-gray-400 hover:text-[#0f2044] hover:bg-white"}`}>
                    <Paperclip size={16} />
                  </button>
                  <button onClick={() => setEmojiTarget(emojiTarget === -1 ? null : -1)} className="p-1.5 text-gray-400 hover:text-yellow-500 rounded-lg transition-colors"><Smile size={16} /></button>
                  <button onClick={sendMessage} disabled={!text.trim() && !pendingFile} className="w-8 h-8 bg-[#0f2044] disabled:opacity-40 text-white rounded-xl flex items-center justify-center hover:bg-[#c9a227] hover:text-[#0f2044] transition-all disabled:hover:bg-[#0f2044] disabled:hover:text-white">
                    <Send size={14} />
                  </button>
                </div>
              </div>
              {/* Input emoji picker */}
              {emojiTarget === -1 && (
                <div className="absolute bottom-20 right-6 bg-white border border-gray-200 rounded-2xl shadow-2xl p-2.5 z-20 grid grid-cols-6 gap-1">
                  {EMOJIS.map(e => <button key={e} onClick={() => { setText(t => t + e); setEmojiTarget(null); inputRef.current?.focus(); }} className="text-lg hover:scale-125 transition-transform p-1 rounded-lg hover:bg-gray-100">{e}</button>)}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ─── CREATE CHANNEL ─── */}
      {showCreateChannel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-bold text-[#0f2044] mb-4">Create a channel</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Channel name</label>
                <div className="flex items-center border border-gray-200 rounded-lg px-3 h-9 gap-1.5 focus-within:ring-2 focus-within:ring-[#0f2044]/20">
                  <Hash size={13} className="text-gray-400 shrink-0" />
                  <input value={newChannelName} onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, "-"))} placeholder="e.g. project-updates" className="flex-1 text-sm focus:outline-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-600 mb-1 block">Description (optional)</label>
                <input value={newChannelDesc} onChange={e => setNewChannelDesc(e.target.value)} placeholder="What's this channel about?" className="w-full border border-gray-200 rounded-lg px-3 h-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20" />
              </div>
              <div className="flex gap-2 pt-1">
                <button onClick={createChannel} disabled={!newChannelName.trim()} className="flex-1 py-2 bg-[#0f2044] text-white text-sm rounded-lg hover:bg-[#c9a227] hover:text-[#0f2044] transition-all disabled:opacity-50 font-semibold">Create Channel</button>
                <button onClick={() => setShowCreateChannel(false)} className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
