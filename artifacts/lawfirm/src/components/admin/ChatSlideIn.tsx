import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Send, Hash, Lock, Plus, Smile, Paperclip, Pin, Pencil, Trash2,
  CornerUpLeft, Search, MessageSquare, Loader2, Check, CheckCheck, Users, X as XIcon,
} from "lucide-react";

interface Channel { id: number; name: string; slug: string; type: string; description: string | null; members?: string; }
interface Msg {
  id: number; channelId: number; senderName: string; senderColor: string;
  content: string; msgType: string; fileName: string | null; fileUrl: string | null;
  reactions: string; replyToId: number | null; replyPreview: string | null;
  isEdited: boolean; isDeleted: boolean; isPinned: boolean; createdAt: string;
}
interface Member { id: number; name: string; username: string; department: string; designation: string; }
interface PresenceEntry { userName: string; lastSeenAt: string; isOnline: boolean; }

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
function fmtLastSeen(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
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
  const [createMode, setCreateMode] = useState<"public" | "group" | null>(null);
  const [newChanName, setNewChanName] = useState("");
  const [groupMemberUsernames, setGroupMemberUsernames] = useState<string[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [editVal, setEditVal] = useState("");
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [pinned, setPinned] = useState<Msg[]>([]);
  const [showPinned, setShowPinned] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [presenceData, setPresenceData] = useState<PresenceEntry[]>([]);
  const [readers, setReaders] = useState<Record<number, string[]>>({});
  // Message search
  const [showMsgSearch, setShowMsgSearch] = useState(false);
  const [msgSearchQuery, setMsgSearchQuery] = useState("");
  const [msgSearchResults, setMsgSearchResults] = useState<Msg[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  // Member management
  const [showMembers, setShowMembers] = useState(false);
  const [channelMembers, setChannelMembers] = useState<string[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function isUserOnline(name: string): boolean {
    return presenceData.some(p => p.userName === name && p.isOnline);
  }
  function userLastSeenText(name: string): string | null {
    const p = presenceData.find(p => p.userName === name);
    if (!p) return null;
    return p.isOnline ? null : `Last seen ${fmtLastSeen(p.lastSeenAt)}`;
  }

  // Presence heartbeat — server derives userName from auth session
  useEffect(() => {
    if (!open) return;
    const heartbeat = () =>
      fetch("/api/admin/chat/presence/heartbeat", { method: "POST" }).catch(() => {});
    heartbeat();
    const hb = setInterval(heartbeat, 60000);
    const poll = setInterval(async () => {
      const r = await fetch("/api/admin/chat/presence");
      if (r.ok) setPresenceData(await r.json() as PresenceEntry[]);
    }, 30000);
    fetch("/api/admin/chat/presence").then(r => r.ok ? r.json() : []).then(d => setPresenceData(d as PresenceEntry[])).catch(() => {});
    return () => { clearInterval(hb); clearInterval(poll); };
  }, [open]);

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

        // Mark all visible messages as read — server derives readerName from auth
        const unreadIds = msgs.filter(m => m.senderName !== currentUser && !m.isDeleted).map(m => m.id);
        if (unreadIds.length > 0) {
          fetch(`/api/admin/chat/channels/${ch.id}/mark-read`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messageIds: unreadIds }),
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
      // Auto-mark as read if not our own message — server derives readerName from auth
      if (msg.senderName !== currentUser && !msg.isDeleted) {
        fetch(`/api/admin/chat/channels/${active.id}/mark-read`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageIds: [msg.id] }),
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
    // Server derives memberName from auth session
    fetch(`/api/admin/chat/channels/${active.id}/typing`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }).catch(() => {});
    typingTimerRef.current = setTimeout(() => {}, 3000);
  }

  async function sendMessage() {
    if (!active || !input.trim()) return;
    // senderName is derived from auth on the server — not sent in body
    const body: Record<string, unknown> = {
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
        // senderName derived from auth on server
        await fetch(`/api/admin/chat/channels/${active.id}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ senderColor: nameColor(currentUser), content: file.name, msgType: "file", fileName: file.name, fileUrl: url }),
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
    const r = await fetch(`/api/admin/chat/messages/${msg.id}/pin`, { method: "PATCH" });
    if (!r.ok) return; // only update local state on server confirmation
    const updated = await r.json() as Msg;
    setMessages(prev => prev.map(m => m.id === updated.id ? updated : m));
    setPinned(prev => updated.isPinned ? [...prev.filter(m => m.id !== updated.id), updated] : prev.filter(m => m.id !== updated.id));
  }

  // userName is derived from auth on the server — not sent in body
  async function react(msgId: number, emoji: string) {
    await fetch(`/api/admin/chat/messages/${msgId}/react`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emoji }),
    });
  }

  // Message history search
  async function runMsgSearch(q: string) {
    if (!q.trim()) { setMsgSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const url = active
        ? `/api/admin/chat/search?q=${encodeURIComponent(q)}&channelId=${active.id}`
        : `/api/admin/chat/search?q=${encodeURIComponent(q)}`;
      const r = await fetch(url);
      if (r.ok) setMsgSearchResults(await r.json() as Msg[]);
    } finally { setSearchLoading(false); }
  }

  // Load channel members for member management panel
  async function loadChannelMembers(chId: number) {
    const r = await fetch(`/api/admin/chat/channels/${chId}/members`);
    if (r.ok) setChannelMembers(await r.json() as string[]);
  }

  async function addChannelMember(username: string) {
    if (!active) return;
    await fetch(`/api/admin/chat/channels/${active.id}/members`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memberName: username }),
    });
    await loadChannelMembers(active.id);
  }

  async function removeChannelMember(username: string) {
    if (!active) return;
    await fetch(`/api/admin/chat/channels/${active.id}/members/${encodeURIComponent(username)}`, { method: "DELETE" });
    await loadChannelMembers(active.id);
  }

  // Server-side DM dedup — 'a' derived from auth on server; only 'b' (target username) sent
  async function openDm(member: Member) {
    const r = await fetch(`/api/admin/chat/channels/dm?b=${encodeURIComponent(member.username)}`);
    if (!r.ok) return;
    const ch = await r.json() as Channel;
    setChannels(prev => prev.some(c => c.id === ch.id) ? prev : [...prev, ch]);
    selectChannel(ch);
    setTab("channels");
  }

  function selectChannel(ch: Channel) {
    setActive(ch); setMessages([]); setReaders({}); setShowPinned(false);
    setShowMsgSearch(false); setMsgSearchQuery(""); setMsgSearchResults([]);
    setShowMembers(false);
    loadMessages(ch);
    if (ch.type === "private") loadChannelMembers(ch.id);
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
      setNewChanName(""); setCreateMode(null);
      selectChannel(ch);
    }
  }

  async function createGroup() {
    if (!newChanName.trim()) return;
    const r = await fetch("/api/admin/chat/channels", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newChanName.trim(), type: "private",
        initialMembers: groupMemberUsernames,
      }),
    });
    if (r.ok) {
      const ch = await r.json() as Channel;
      setChannels(prev => [...prev, ch]);
      setNewChanName(""); setGroupMemberUsernames([]); setCreateMode(null);
      selectChannel(ch);
    }
  }

  function displayNameForUsername(username: string): string {
    return members.find(m => m.username === username)?.name ?? username;
  }

  function isDmChannel(ch: Channel) { return ch.type === "direct"; }
  /** Returns the other participant's auth username from a DM channel. */
  function dmPartnerUsername(ch: Channel): string {
    try {
      const participants = JSON.parse(ch.members ?? "[]") as string[];
      return participants.find(n => n !== currentUser) ?? "";
    } catch { return ""; }
  }
  /** Returns the display name for a DM channel (looks up by username). */
  function dmLabel(ch: Channel): string {
    if (!isDmChannel(ch)) return ch.name;
    const username = dmPartnerUsername(ch);
    if (!username) return ch.name;
    // Look up display name from the members list by username
    const found = members.find(m => m.username === username);
    return found?.name ?? username;
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
                {publicChannels.map(ch => (
                  <button key={ch.id} onClick={() => selectChannel(ch)}
                    className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all text-left ${active?.id === ch.id ? "bg-[#c9a227] text-[#0f2044] font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                    {ch.type === "private" ? <Lock size={11} className="shrink-0" /> : <Hash size={11} className="shrink-0" />}
                    <span className="truncate">{ch.name}</span>
                  </button>
                ))}
                {dmChannels.length > 0 && (
                  <div className="text-[9px] text-white/30 uppercase tracking-wider px-2 pt-2 pb-1">Direct</div>
                )}
                {dmChannels.map(ch => {
                  const other = dmLabel(ch);
                  const otherUsername = dmPartnerUsername(ch);
                  const online = isUserOnline(otherUsername);
                  const lastSeen = userLastSeenText(otherUsername);
                  return (
                    <button key={ch.id} onClick={() => selectChannel(ch)}
                      className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs transition-all text-left ${active?.id === ch.id ? "bg-[#c9a227] text-[#0f2044] font-semibold" : "text-white/70 hover:bg-white/10 hover:text-white"}`}>
                      <div className="relative shrink-0">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: nameColor(other) }}>
                          {initials(other)}
                        </div>
                        {online && <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-[#0f2044]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate">{other}</div>
                        {lastSeen && <div className="text-[8px] text-white/30 truncate">{lastSeen}</div>}
                      </div>
                    </button>
                  );
                })}
                <div className="flex gap-1 mt-1">
                  <button onClick={() => { setCreateMode(m => m === "public" ? null : "public"); setNewChanName(""); setGroupMemberUsernames([]); }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-white/40 hover:text-white text-[10px] rounded-lg transition-colors">
                    <Hash size={10} /> Channel
                  </button>
                  <button onClick={() => { setCreateMode(m => m === "group" ? null : "group"); setNewChanName(""); setGroupMemberUsernames([]); }}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-white/40 hover:text-white text-[10px] rounded-lg transition-colors">
                    <Lock size={10} /> Group
                  </button>
                </div>
                {createMode === "public" && (
                  <div className="mt-1 space-y-1">
                    <input value={newChanName} onChange={e => setNewChanName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") createChannel(); }}
                      placeholder="Channel name"
                      className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none placeholder-white/30"
                      autoFocus />
                    <button onClick={createChannel} className="w-full bg-[#c9a227] text-[#0f2044] text-xs font-semibold py-1.5 rounded-lg">Create Public Channel</button>
                  </div>
                )}
                {createMode === "group" && (
                  <div className="mt-1 space-y-1.5">
                    <input value={newChanName} onChange={e => setNewChanName(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") createGroup(); }}
                      placeholder="Group name"
                      className="w-full bg-white/10 text-white text-xs rounded-lg px-2 py-1.5 outline-none placeholder-white/30"
                      autoFocus />
                    <div className="text-[9px] text-white/30 uppercase tracking-wider px-0.5">Add members</div>
                    <div className="max-h-28 overflow-y-auto space-y-0.5">
                      {members.map(m => {
                        const checked = groupMemberUsernames.includes(m.username);
                        return (
                          <button key={m.id}
                            onClick={() => setGroupMemberUsernames(prev =>
                              checked ? prev.filter(u => u !== m.username) : [...prev, m.username]
                            )}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-[10px] transition-all text-left ${checked ? "bg-[#c9a227]/20 text-[#c9a227]" : "text-white/60 hover:bg-white/10 hover:text-white"}`}>
                            <div className={`w-3 h-3 rounded border flex-shrink-0 flex items-center justify-center ${checked ? "bg-[#c9a227] border-[#c9a227]" : "border-white/30"}`}>
                              {checked && <span className="text-[#0f2044] text-[8px] font-bold">✓</span>}
                            </div>
                            {m.name}
                          </button>
                        );
                      })}
                    </div>
                    <button onClick={createGroup} disabled={!newChanName.trim()}
                      className="w-full bg-[#c9a227] text-[#0f2044] text-xs font-semibold py-1.5 rounded-lg disabled:opacity-40">
                      Create Group ({groupMemberUsernames.length} members)
                    </button>
                  </div>
                )}
              </>
            )}
            {tab === "dms" && (
              <>
                {filteredMembers.map(m => {
                  const online = isUserOnline(m.username);
                  const lastSeen = userLastSeenText(m.username);
                  return (
                    <button key={m.id} onClick={() => openDm(m)}
                      className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-xs text-white/70 hover:bg-white/10 hover:text-white transition-all text-left">
                      <div className="relative shrink-0">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[9px] font-bold" style={{ background: nameColor(m.name) }}>
                          {initials(m.name)}
                        </div>
                        {online && <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full border border-[#0f2044]" />}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate">{m.name}</div>
                        <div className="text-[9px] text-white/30 truncate">
                          {online ? "Online" : lastSeen ?? m.designation}
                        </div>
                      </div>
                      {online && <div className="ml-auto text-[9px] text-green-400 shrink-0">●</div>}
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
                      {isUserOnline(dmPartnerUsername(active)) && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-400 rounded-full border-2 border-white" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-[#0f2044] text-sm">{dmLabel(active)}</div>
                      <div className={`text-[10px] ${isUserOnline(dmPartnerUsername(active)) ? "text-green-500" : "text-gray-400"}`}>
                        {isUserOnline(dmPartnerUsername(active))
                          ? "Online"
                          : userLastSeenText(dmPartnerUsername(active)) ?? "Offline"}
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
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={() => { setShowMsgSearch(v => !v); setMsgSearchQuery(""); setMsgSearchResults([]); }}
                    title="Search messages"
                    className={`p-1.5 rounded-lg transition-colors ${showMsgSearch ? "bg-[#c9a227] text-[#0f2044]" : "text-gray-400 hover:bg-gray-100"}`}>
                    <Search size={13} />
                  </button>
                  {active.type === "private" && (
                    <button onClick={() => { setShowMembers(v => !v); if (!showMembers) loadChannelMembers(active.id); }}
                      title="Manage members"
                      className={`p-1.5 rounded-lg transition-colors ${showMembers ? "bg-[#c9a227] text-[#0f2044]" : "text-gray-400 hover:bg-gray-100"}`}>
                      <Users size={13} />
                    </button>
                  )}
                  <button onClick={() => setShowPinned(v => !v)} title="Pinned messages"
                    className={`p-1.5 rounded-lg transition-colors ${showPinned ? "bg-[#c9a227] text-[#0f2044]" : "text-gray-400 hover:bg-gray-100"}`}>
                    <Pin size={13} />
                  </button>
                </div>
              </div>

              {/* Message search bar */}
              {showMsgSearch && (
                <div className="px-4 py-2 border-b border-gray-100 bg-amber-50 shrink-0">
                  <div className="flex items-center gap-2">
                    <Search size={13} className="text-gray-400" />
                    <input
                      value={msgSearchQuery}
                      onChange={e => { setMsgSearchQuery(e.target.value); runMsgSearch(e.target.value); }}
                      placeholder="Search messages in this channel…"
                      className="flex-1 text-xs outline-none bg-transparent placeholder-gray-400"
                      autoFocus
                    />
                    {searchLoading && <Loader2 size={12} className="animate-spin text-gray-400" />}
                    {msgSearchQuery && (
                      <button onClick={() => { setMsgSearchQuery(""); setMsgSearchResults([]); }} className="text-gray-400 hover:text-gray-600">
                        <XIcon size={12} />
                      </button>
                    )}
                  </div>
                  {msgSearchResults.length > 0 && (
                    <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                      {msgSearchResults.map(m => (
                        <div key={m.id} className="text-[11px] bg-white rounded-lg px-2 py-1.5 border border-gray-100">
                          <span className="font-semibold text-[#0f2044]">{m.senderName}</span>
                          <span className="text-gray-400 ml-1">{fmtTime(m.createdAt)}</span>
                          <div className="text-gray-700 truncate mt-0.5">{m.content}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {msgSearchQuery && !searchLoading && msgSearchResults.length === 0 && (
                    <div className="mt-1 text-[11px] text-gray-400">No messages found.</div>
                  )}
                </div>
              )}

              {/* Member management panel */}
              {showMembers && active.type === "private" && (
                <div className="px-4 py-2 border-b border-gray-100 bg-blue-50 shrink-0">
                  <div className="text-[11px] font-semibold text-[#0f2044] mb-1 flex items-center gap-1">
                    <Users size={11} /> Members ({channelMembers.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {channelMembers.map(uname => (
                      <span key={uname} className="flex items-center gap-1 bg-white border border-gray-200 rounded-full px-2 py-0.5 text-[10px]">
                        {displayNameForUsername(uname)}
                        <button onClick={() => removeChannelMember(uname)} className="text-red-400 hover:text-red-600">
                          <XIcon size={9} />
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {members.filter(m => !channelMembers.includes(m.username)).slice(0, 8).map(m => (
                      <button key={m.id} onClick={() => addChannelMember(m.username)}
                        className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5">
                        <Plus size={9} />{m.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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
                                  {isMe && (
                                    <>
                                      <button onClick={() => { setEditId(msg.id); setEditVal(msg.content); }} className="p-0.5 text-gray-400 hover:text-gray-600 rounded" title="Edit">
                                        <Pencil size={11} />
                                      </button>
                                      <button onClick={() => deleteMsg(msg.id)} className="p-0.5 text-red-400 hover:text-red-600 rounded" title="Delete">
                                        <Trash2 size={11} />
                                      </button>
                                    </>
                                  )}
                                  <button onClick={() => togglePin(msg)} className={`p-0.5 rounded ${msg.isPinned ? "text-[#c9a227]" : "text-gray-400 hover:text-gray-600"}`} title="Pin">
                                    <Pin size={11} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>

              {/* Typing indicator */}
              {typing.length > 0 && (
                <div className="px-4 py-1 text-[10px] text-gray-400 italic shrink-0">
                  {typing.join(", ")} {typing.length === 1 ? "is" : "are"} typing…
                </div>
              )}

              {/* Reply bar */}
              {replyTo && (
                <div className="px-4 py-1.5 bg-amber-50 border-t border-amber-100 flex items-center gap-2 shrink-0">
                  <CornerUpLeft size={12} className="text-[#c9a227]" />
                  <span className="text-[11px] text-amber-700 truncate flex-1">Replying to: {replyTo.content.slice(0, 60)}</span>
                  <button onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600"><X size={12} /></button>
                </div>
              )}

              {/* Emoji picker */}
              {showEmoji && (
                <div className="px-4 py-2 border-t border-gray-100 flex flex-wrap gap-1 shrink-0 bg-white">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => { setInput(v => v + e); setShowEmoji(false); }}
                      className="text-lg hover:scale-110 transition-transform">{e}</button>
                  ))}
                </div>
              )}

              {/* Input area */}
              <div className="px-4 py-3 border-t border-gray-100 bg-white shrink-0">
                <div className="flex items-end gap-2 bg-gray-50 rounded-2xl px-3 py-2 border border-gray-200 focus-within:border-[#c9a227] transition-colors">
                  <textarea
                    value={input}
                    onChange={onInputChange}
                    onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    placeholder={`Message ${isDmChannel(active) ? dmLabel(active) : "#" + active.name}`}
                    rows={1}
                    className="flex-1 bg-transparent text-xs resize-none outline-none placeholder-gray-400 max-h-20 leading-relaxed"
                  />
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setShowEmoji(v => !v)} className="p-1 text-gray-400 hover:text-[#c9a227] transition-colors">
                      <Smile size={14} />
                    </button>
                    <button onClick={() => fileRef.current?.click()} className="p-1 text-gray-400 hover:text-[#c9a227] transition-colors">
                      <Paperclip size={14} />
                    </button>
                    <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />
                    <button onClick={sendMessage} disabled={!input.trim()}
                      className="p-1.5 bg-[#0f2044] text-white rounded-xl hover:bg-[#1a3060] transition-colors disabled:opacity-40">
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-3">
              <MessageSquare size={32} className="opacity-20" />
              <div className="text-sm font-medium">Select a channel to start chatting</div>
              <div className="text-xs text-gray-300">Or start a direct message from the Direct tab</div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
