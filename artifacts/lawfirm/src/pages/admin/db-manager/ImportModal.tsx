import { useState, useRef } from "react";
import { X, Upload, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import * as XLSX from "xlsx";

interface ColDef { name: string; db: string; label: string; type: string; readonly?: boolean; }

interface Props {
  tableName: string;
  columns: ColDef[];
  onClose: () => void;
  onImported: (count: number) => void;
}

export default function ImportModal({ tableName, columns, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ headers: string[]; rows: Record<string, unknown>[]; all: Record<string, unknown>[] } | null>(null);
  const [issues, setIssues] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setPreview(null);
    setIssues([]);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const all = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
        if (!all.length) { setError("No rows found in the spreadsheet."); return; }

        const headers = Object.keys(all[0]);
        const knownLabels = new Set(columns.map(c => c.label.toLowerCase()));
        const knownNames  = new Set(columns.map(c => c.name.toLowerCase()));
        const knownDbs    = new Set(columns.map(c => c.db.toLowerCase()));

        const warns: string[] = [];
        for (const h of headers) {
          const hl = h.toLowerCase();
          if (!knownLabels.has(hl) && !knownNames.has(hl) && !knownDbs.has(hl)) {
            warns.push(`Column "${h}" not recognised — it will be skipped`);
          }
        }
        setIssues(warns);
        setPreview({ headers, rows: all.slice(0, 5), all });
      } catch {
        setError("Could not parse file. Ensure it is a valid .xlsx file.");
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    if (!preview) return;
    setImporting(true);
    setError("");
    try {
      const r = await fetch(`/api/admin/db-manager/${tableName}/import`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview.all }),
      });
      const d = await r.json() as { ok?: boolean; inserted?: number; errors?: string[]; error?: string };
      if (!r.ok || !d.ok) { setError(d.error ?? "Import failed"); return; }
      setResult({ inserted: d.inserted ?? 0, errors: d.errors ?? [] });
      onImported(d.inserted ?? 0);
    } catch (e) {
      setError(String(e));
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[88vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Import from Excel</h2>
            <p className="text-xs text-gray-400 mt-0.5">{tableName} · .xlsx files only</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Column reference */}
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-600 mb-2">Expected columns (use any of: label, camelCase name, or db_name)</p>
            <div className="flex flex-wrap gap-1.5">
              {columns.filter(c => c.type !== "id" && !c.readonly).map(c => (
                <span key={c.name} className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-0.5 text-gray-600">
                  {c.label}
                </span>
              ))}
            </div>
          </div>

          {/* File drop zone */}
          {!result && (
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center cursor-pointer hover:border-[#0f2044]/30 hover:bg-gray-50 transition-colors"
            >
              <Upload size={28} className="mx-auto text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">Click to select .xlsx file</p>
              <p className="text-xs text-gray-400 mt-1">First sheet will be imported · max 5,000 rows</p>
              <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFile} />
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              <AlertTriangle size={14} /> {error}
            </div>
          )}

          {/* Warnings */}
          {issues.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">⚠️ Warnings ({issues.length})</p>
              <ul className="space-y-0.5">
                {issues.map((w, i) => <li key={i} className="text-xs text-amber-600">{w}</li>)}
              </ul>
            </div>
          )}

          {/* Preview */}
          {preview && !result && (
            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">
                Preview — first 5 of {preview.all.length} rows
              </p>
              <div className="overflow-x-auto rounded-xl border border-gray-200">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {preview.headers.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.rows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        {preview.headers.map(h => (
                          <td key={h} className="px-3 py-2 text-gray-600 max-w-[140px] truncate">{String(row[h] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Success */}
          {result && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4">
              <div className="flex items-center gap-2 text-green-700 font-semibold mb-1">
                <CheckCircle2 size={16} /> Import complete
              </div>
              <p className="text-sm text-green-600">{result.inserted} rows inserted successfully.</p>
              {result.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs font-medium text-red-600 mb-1">{result.errors.length} errors:</p>
                  <ul className="space-y-0.5">
                    {result.errors.map((e, i) => <li key={i} className="text-xs text-red-500">{e}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600">
            {result ? "Close" : "Cancel"}
          </button>
          {preview && !result && (
            <button
              onClick={handleImport}
              disabled={importing}
              className="flex items-center gap-2 px-5 py-2 text-sm bg-[#0f2044] text-white rounded-lg hover:bg-[#0f2044]/90 disabled:opacity-60 font-medium"
            >
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? "Importing…" : `Import ${preview.all.length} rows`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
