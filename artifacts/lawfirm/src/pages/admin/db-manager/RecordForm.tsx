import { useState, useEffect } from "react";
import { X, Save, Loader2 } from "lucide-react";

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
  tableName: string;
  columns: ColDef[];
  record?: Record<string, unknown> | null;  // null = create mode
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}

export default function RecordForm({ tableName, columns, record, onSave, onClose }: Props) {
  const isEdit = record != null;
  const editableCols = columns.filter(c => !c.readonly && c.type !== "id");

  const buildDefaults = () => {
    const d: Record<string, unknown> = {};
    for (const col of editableCols) {
      if (isEdit) {
        const raw = record?.[col.db] ?? record?.[col.name];
        // Preserve null/undefined for nullable fields; default non-nullable to ""
        d[col.name] = raw ?? (col.nullable ? null : "");
      } else {
        // New record: nullable fields start as null so the API never receives ""
        d[col.name] = col.nullable ? null : (col.type === "boolean" ? false : "");
      }
    }
    return d;
  };

  const [form, setForm] = useState<Record<string, unknown>>(buildDefaults);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { setForm(buildDefaults()); }, [record]);

  function set(name: string, val: unknown) {
    setForm(prev => ({ ...prev, [name]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {isEdit ? "Edit Record" : "Create New Record"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">{tableName}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {editableCols.map(col => (
              <div key={col.name} className={col.type === "text" && String(form[col.name] ?? "").length > 80 ? "sm:col-span-2" : ""}>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  {col.label}
                  {col.nullable && <span className="ml-1 text-gray-300">optional</span>}
                </label>

                {col.type === "boolean" ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="checkbox"
                      id={col.name}
                      checked={!!form[col.name]}
                      onChange={e => set(col.name, e.target.checked)}
                      className="w-4 h-4 accent-[#0f2044]"
                    />
                    <label htmlFor={col.name} className="text-sm text-gray-700">{col.label}</label>
                  </div>
                ) : col.type === "enum" && col.enumValues ? (
                  <select
                    value={String(form[col.name] ?? "")}
                    onChange={e => set(col.name, e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044]"
                  >
                    <option value="">— select —</option>
                    {col.enumValues.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                ) : col.type === "number" ? (
                  <input
                    type="number"
                    value={String(form[col.name] ?? "")}
                    onChange={e => set(col.name, e.target.value === "" ? null : Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044]"
                  />
                ) : col.type === "timestamp" ? (
                  <input
                    type="datetime-local"
                    value={form[col.name] ? String(form[col.name]).slice(0, 16) : ""}
                    onChange={e => set(col.name, e.target.value ? new Date(e.target.value).toISOString() : null)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044]"
                  />
                ) : col.type === "jsonb" ? (
                  <textarea
                    rows={4}
                    value={typeof form[col.name] === "string" ? form[col.name] as string : JSON.stringify(form[col.name] ?? [], null, 2)}
                    onChange={e => {
                      try { set(col.name, JSON.parse(e.target.value)); }
                      catch { set(col.name, e.target.value); }
                    }}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044] resize-y"
                    placeholder="[]"
                  />
                ) : String(form[col.name] ?? "").length > 80 || col.name.toLowerCase().includes("description") || col.name.toLowerCase().includes("message") || col.name.toLowerCase().includes("content") ? (
                  <textarea
                    rows={3}
                    value={String(form[col.name] ?? "")}
                    onChange={e => set(col.name, e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044] resize-y"
                  />
                ) : (
                  <input
                    type="text"
                    value={String(form[col.name] ?? "")}
                    onChange={e => set(col.name, e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20 focus:border-[#0f2044]"
                  />
                )}
              </div>
            ))}
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3 shrink-0">
          {error && <p className="text-xs text-red-500 flex-1">{error}</p>}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit as any}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-[#0f2044] text-white rounded-lg hover:bg-[#0f2044]/90 disabled:opacity-60 font-medium"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {saving ? "Saving…" : isEdit ? "Save Changes" : "Create Record"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
