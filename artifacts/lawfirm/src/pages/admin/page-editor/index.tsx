import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor,
  useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, arrayMove, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Save, Loader2, CheckCircle2, AlertCircle, History,
  Sparkles, GripVertical, ChevronDown, ChevronUp, ExternalLink,
  Video, Eye, EyeOff,
} from "lucide-react";
import { AdminLayout } from "../AdminLayout";
import { PAGES, type Section, type Block } from "./config";
import RichTextEditor from "./RichTextEditor";
import AIPanel from "./AIPanel";
import VersionHistoryDrawer from "./VersionHistoryDrawer";

// ── Sortable section wrapper ───────────────────────────────────────────────────

function SortableSection({
  section, collapsed, onToggle, children,
}: {
  section: Section;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
    zIndex: isDragging ? 50 : undefined,
    position: "relative",
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className={`flex items-center gap-2 px-4 py-3 border-b border-gray-100 ${
        collapsed ? "bg-white" : "bg-gray-50"
      }`}>
        {/* Drag handle */}
        <button
          type="button"
          className="p-1 rounded text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing touch-none"
          title="Drag to reorder section"
          {...attributes}
          {...listeners}
        >
          <GripVertical size={15} />
        </button>
        <h3 className="flex-1 text-sm font-semibold text-gray-700 select-none">{section.title}</h3>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded hover:bg-gray-200 text-gray-400 transition-colors"
          title={collapsed ? "Expand section" : "Collapse section"}
        >
          {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
        </button>
      </div>
      {/* Section body */}
      {!collapsed && (
        <div className="p-5 space-y-4">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Block field renderer ───────────────────────────────────────────────────────

function BlockField({
  block, value, onChange, onAI, isSuperAdmin,
}: {
  block: Block;
  value: string;
  onChange: (v: string) => void;
  onAI: (block: Block, value: string) => void;
  isSuperAdmin: boolean;
}) {
  const [showHtml, setShowHtml] = useState(false);

  if (block.superAdminOnly && !isSuperAdmin) {
    return (
      <div className="flex items-center gap-2 bg-gray-50 border border-dashed border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-400">
        🔒 <span className="italic">{block.label} — Super Admin only</span>
      </div>
    );
  }

  const isAiable = ["text", "textarea", "richtext"].includes(block.type);
  const inputClass =
    "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044] transition placeholder:text-gray-300";

  return (
    <div>
      {/* Label row */}
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-700">
          {block.label}
          {block.hint && (
            <span className="ml-2 text-xs text-gray-400 font-normal">({block.hint})</span>
          )}
        </label>
        {isAiable && (
          <button
            type="button"
            onClick={() => onAI(block, value)}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 bg-violet-50 hover:bg-violet-100 px-2.5 py-1 rounded-lg transition-colors font-medium"
          >
            <Sparkles size={11} /> Improve with AI
          </button>
        )}
      </div>

      {/* Input by type */}
      {block.type === "text" && (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={block.placeholder ?? `Enter ${block.label.toLowerCase()}…`}
          className={inputClass}
        />
      )}

      {block.type === "textarea" && (
        <textarea
          rows={3}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={block.placeholder ?? `Enter ${block.label.toLowerCase()}…`}
          className={inputClass + " resize-y"}
        />
      )}

      {block.type === "richtext" && (
        <RichTextEditor
          value={value}
          onChange={onChange}
          placeholder={block.placeholder ?? `Start typing…`}
        />
      )}

      {block.type === "image" && (
        <div className="space-y-2">
          <input
            type="url"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className={inputClass}
          />
          {value && (
            <img
              src={value}
              alt="Preview"
              className="max-h-36 rounded-xl border border-gray-200 object-cover"
              onError={e => { (e.target as HTMLImageElement).hidden = true; }}
            />
          )}
        </div>
      )}

      {block.type === "video" && (
        <div className="space-y-2">
          <input
            type="url"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className={inputClass}
          />
          {value && (
            <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">
              <Video size={12} /> Video URL saved — will be embedded on the page.
            </div>
          )}
        </div>
      )}

      {block.type === "button" && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Button Text</label>
            <input
              type="text"
              value={value.split("||")[0] ?? ""}
              onChange={e => onChange(`${e.target.value}||${value.split("||")[1] ?? ""}`)}
              placeholder={block.placeholder ?? "Button Label"}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Button URL</label>
            <input
              type="text"
              value={value.split("||")[1] ?? ""}
              onChange={e => onChange(`${value.split("||")[0] ?? ""}||${e.target.value}`)}
              placeholder="/contact or https://..."
              className={inputClass}
            />
          </div>
        </div>
      )}

      {block.type === "html" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              ⚠️ Raw HTML — inject with care
            </span>
            <button
              type="button"
              onClick={() => setShowHtml(v => !v)}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
            >
              {showHtml ? <EyeOff size={11} /> : <Eye size={11} />}
              {showHtml ? "Hide" : "Show"}
            </button>
          </div>
          {showHtml && (
            <textarea
              rows={8}
              value={value}
              onChange={e => onChange(e.target.value)}
              placeholder={"<section>\n  <!-- Your custom HTML -->\n</section>"}
              className="w-full border border-gray-700 rounded-xl px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 resize-y bg-gray-900 text-green-400"
              spellCheck={false}
            />
          )}
          {!showHtml && value && (
            <p className="text-xs text-gray-400 italic">{value.length} chars of HTML saved.</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page editor ───────────────────────────────────────────────────────────

export default function AdminPageEditor() {
  const qc = useQueryClient();
  const [selectedPageId, setSelectedPageId] = useState("home");
  const [content, setContent]               = useState<Record<string, string>>({});
  const [sectionOrder, setSectionOrder]     = useState<string[]>([]);
  const [collapsed, setCollapsed]           = useState<Set<string>>(new Set());
  const [saving, setSaving]                 = useState(false);
  const [savedAt, setSavedAt]               = useState<Date | null>(null);
  const [saveError, setSaveError]           = useState("");
  const [showHistory, setShowHistory]       = useState(false);
  const [aiTarget, setAiTarget]             = useState<{ block: Block; value: string } | null>(null);

  const selectedPage = PAGES.find(p => p.id === selectedPageId)!;

  // Fetch content for selected page
  const { data, isLoading } = useQuery<{ page: string; content: Record<string, string> }>({
    queryKey: ["admin-page-content", selectedPageId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/pages/${selectedPageId}`, { credentials: "include" });
      if (!r.ok) return { page: selectedPageId, content: {} };
      return r.json();
    },
  });

  // Sync loaded content into form state
  useEffect(() => {
    const c = data?.content ?? {};
    setContent(c);
    const savedOrder = c.__section_order__;
    if (savedOrder) {
      try {
        setSectionOrder(JSON.parse(savedOrder));
        return;
      } catch { /* fall through */ }
    }
    setSectionOrder(selectedPage.sections.map(s => s.id));
  }, [data]);

  // When page tab changes, reset UI state
  function selectPage(pageId: string) {
    setSelectedPageId(pageId);
    setContent({});
    setSavedAt(null);
    setSaveError("");
    setCollapsed(new Set());
    setSectionOrder(PAGES.find(p => p.id === pageId)!.sections.map(s => s.id));
  }

  // Build ordered section list (config order as fallback for any not in saved order)
  const orderedSections = [
    ...sectionOrder.map(id => selectedPage.sections.find(s => s.id === id)).filter(Boolean),
    ...selectedPage.sections.filter(s => !sectionOrder.includes(s.id)),
  ] as Section[];

  function handleChange(blockId: string, value: string) {
    setContent(prev => ({ ...prev, [blockId]: value }));
    setSavedAt(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError("");
    try {
      const r = await fetch(`/api/admin/pages/${selectedPageId}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { ...content, __section_order__: JSON.stringify(sectionOrder) },
        }),
      });
      if (!r.ok) throw new Error("Save failed");
      setSavedAt(new Date());
      qc.invalidateQueries({ queryKey: ["page-versions", selectedPageId] });
    } catch {
      setSaveError("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSectionOrder(prev => {
      const a = prev.indexOf(String(active.id));
      const b = prev.indexOf(String(over.id));
      if (a === -1 || b === -1) return prev;
      return arrayMove(prev, a, b);
    });
    setSavedAt(null);
  }

  function toggleCollapse(id: string) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Super admin check (role stored in session — use role from admin context)
  // For now, read from the session endpoint that returns the user
  const isSuperAdmin =
    typeof window !== "undefined" &&
    (document.cookie.includes("super_admin") ||
      sessionStorage.getItem("admin_role") === "super_admin");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  return (
    <AdminLayout
      title="Page Editor"
      subtitle="Edit any page — drag sections, rich text, images, AI writing tools, and version history"
    >
      <div className="flex h-full min-h-0 gap-0 -m-6">

        {/* ── Left: Page list ─────────────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col">
          <div className="px-4 py-3 border-b border-gray-200">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Pages</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {PAGES.map(page => {
              const Icon = page.icon;
              const active = selectedPageId === page.id;
              return (
                <button
                  key={page.id}
                  onClick={() => selectPage(page.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                    active
                      ? "bg-[#0f2044] text-white"
                      : "text-gray-700 hover:bg-white hover:text-[#0f2044]"
                  }`}
                >
                  <Icon size={15} className={active ? "text-[#c9a227]" : "text-gray-400"} />
                  <span className="font-medium leading-tight">{page.name}</span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-gray-200 p-4 space-y-2">
            <p className="text-[10px] text-gray-400 leading-relaxed">
              ⠿ Drag to reorder sections<br />
              ✨ AI tools on every text field<br />
              📋 Version history auto-saved
            </p>
          </div>
        </div>

        {/* ── Right: Editor ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-gray-50/50">

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-3.5 border-b border-gray-200 bg-white flex-shrink-0 gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-gray-900">{selectedPage.name}</h2>
                <span className="text-xs text-gray-400 font-mono bg-gray-100 rounded px-2 py-0.5 shrink-0">
                  {selectedPage.url}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">{selectedPage.description}</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {savedAt && (
                <span className="hidden sm:flex items-center gap-1.5 text-xs text-green-600 font-medium">
                  <CheckCircle2 size={13} /> Saved
                </span>
              )}
              {saveError && (
                <span className="hidden sm:flex items-center gap-1.5 text-xs text-red-500">
                  <AlertCircle size={13} /> {saveError}
                </span>
              )}
              <button
                onClick={() => setShowHistory(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <History size={13} /> History
              </button>
              <a
                href={selectedPage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 transition-colors"
              >
                <ExternalLink size={13} /> Preview
              </a>
              <button
                onClick={handleSave}
                disabled={saving || isLoading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-[#0f2044] text-white rounded-lg hover:bg-[#0f2044]/90 disabled:opacity-60 transition-colors font-medium"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>

          {/* Editor body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="flex items-center justify-center gap-3 text-gray-400 py-20">
                <Loader2 size={22} className="animate-spin" />
                <span>Loading page content…</span>
              </div>
            ) : (
              <div className="max-w-3xl mx-auto space-y-3">

                {/* Info banner */}
                <div className="flex items-start gap-3 bg-gradient-to-r from-violet-50 to-blue-50 border border-violet-100 rounded-xl p-4 text-sm text-violet-800">
                  <Sparkles size={16} className="mt-0.5 shrink-0 text-violet-500" />
                  <div>
                    <strong>Visual Page Editor</strong> — Drag ⠿ to reorder sections, click{" "}
                    <span className="inline-flex items-center gap-1 text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded text-xs font-medium">
                      <Sparkles size={10} /> Improve with AI
                    </span>{" "}
                    on any text field to rewrite, optimise for SEO, translate, and more.
                    Changes go live after clicking <strong>Save</strong>.
                  </div>
                </div>

                {/* Drag-and-drop sections */}
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={orderedSections.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {orderedSections.map(section => (
                      <SortableSection
                        key={section.id}
                        section={section}
                        collapsed={collapsed.has(section.id)}
                        onToggle={() => toggleCollapse(section.id)}
                      >
                        {section.blocks.map(block => (
                          <BlockField
                            key={block.id}
                            block={block}
                            value={content[block.id] ?? ""}
                            onChange={v => handleChange(block.id, v)}
                            onAI={(b, v) => setAiTarget({ block: b, value: v })}
                            isSuperAdmin={isSuperAdmin}
                          />
                        ))}
                      </SortableSection>
                    ))}
                  </SortableContext>
                </DndContext>

                {/* Bottom save */}
                <div className="flex items-center justify-between pt-2 pb-6">
                  {saveError && (
                    <span className="flex items-center gap-1.5 text-xs text-red-500">
                      <AlertCircle size={13} /> {saveError}
                    </span>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={saving || isLoading}
                    className="ml-auto flex items-center gap-2 px-6 py-2.5 text-sm bg-[#0f2044] text-white rounded-xl hover:bg-[#0f2044]/90 disabled:opacity-60 transition-colors font-medium shadow-sm"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? "Saving…" : "Save All Changes"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── AI Panel ─────────────────────────────────────────────────────── */}
      {aiTarget && (
        <AIPanel
          fieldLabel={aiTarget.block.label}
          currentText={aiTarget.value}
          onApply={text => {
            handleChange(aiTarget.block.id, text);
            setAiTarget(null);
          }}
          onClose={() => setAiTarget(null)}
        />
      )}

      {/* ── Version History ───────────────────────────────────────────────── */}
      {showHistory && (
        <VersionHistoryDrawer
          page={selectedPageId}
          onRestore={restoredContent => {
            const clean = { ...restoredContent };
            const order = clean.__section_order__;
            if (order) {
              try { setSectionOrder(JSON.parse(order)); } catch { /* ignore */ }
            }
            setContent(clean);
            setSavedAt(null);
          }}
          onClose={() => setShowHistory(false)}
        />
      )}
    </AdminLayout>
  );
}
