import { useState, useRef, useEffect, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Building2, Search, Upload, Download, Trash2, X, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, FileSpreadsheet, RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";

interface Company {
  id: number;
  cin: string;
  companyName: string;
  companyType: string | null;
  companyStatus: string | null;
  state: string | null;
  city: string | null;
  industry: string | null;
  incorporationDate: string | null;
  slug: string;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: string[];
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  "active": "bg-green-100 text-green-800",
  "strike off": "bg-red-100 text-red-800",
};

function statusColor(s: string | null) {
  if (!s) return "bg-gray-100 text-gray-500";
  return STATUS_COLORS[s.toLowerCase()] ?? "bg-blue-100 text-blue-700";
}

export default function AdminIndianCompanies() {
  const [tab, setTab] = useState<"browse" | "import">("browse");

  // Browse state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: Company[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Import state
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<Record<string, string>[] | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 400);
  }, [search]);

  const loadCompanies = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), limit: "50" });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (statusFilter) params.set("status", statusFilter);
    if (typeFilter) params.set("type", typeFilter);
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/indian-companies?${params}`);
      setData(await r.json());
    } finally { setLoading(false); }
  }, [debouncedSearch, statusFilter, typeFilter, page]);

  useEffect(() => { loadCompanies(); }, [loadCompanies]);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/indian-companies/${id}`, { method: "DELETE" });
    loadCompanies();
  };

  const handleFileChange = (f: File | null) => {
    if (!f) return;
    setFile(f); setParseError(null); setParsedRows(null); setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
        if (rows.length === 0) { setParseError("No data rows found in file."); return; }
        setParsedRows(rows);
      } catch (err) {
        setParseError(`Parse error: ${err instanceof Error ? err.message : "Unknown error"}`);
      }
    };
    if (f.name.endsWith(".csv")) {
      reader.readAsText(f);
    } else {
      reader.readAsBinaryString(f);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) handleFileChange(f);
  };

  const handleImport = async () => {
    if (!parsedRows || parsedRows.length === 0) return;
    setImporting(true); setImportResult(null);
    const BATCH = 200;
    let totalImported = 0, totalUpdated = 0, totalSkipped = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < parsedRows.length; i += BATCH) {
      const batch = parsedRows.slice(i, i + BATCH);
      try {
        const r = await fetch("/api/admin/indian-companies/bulk-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records: batch }),
        });
        const result = await r.json();
        totalImported += result.imported ?? 0;
        totalUpdated += result.updated ?? 0;
        totalSkipped += result.skipped ?? 0;
        if (result.errors) allErrors.push(...result.errors);
      } catch (e) {
        allErrors.push(`Batch ${Math.floor(i / BATCH) + 1}: Network error`);
      }
    }

    setImportResult({ imported: totalImported, updated: totalUpdated, skipped: totalSkipped, errors: allErrors.slice(0, 20), total: parsedRows.length });
    setImporting(false);
    loadCompanies();
  };

  const total = data?.total ?? 0;
  const pages = Math.ceil(total / 50);

  return (
    <AdminLayout
      title="Indian Companies Database"
      subtitle={`${total.toLocaleString()} companies in database`}
      actions={
        <div className="flex gap-2">
          <a
            href="/api/admin/indian-companies/export"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> Export CSV
          </a>
          <Button onClick={() => setTab("import")} className="bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] gap-2">
            <Upload size={14} /> Import
          </Button>
        </div>
      }
    >
      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-6">
        {(["browse", "import"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${tab === t ? "bg-white text-[#0f2044] shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
          >
            {t === "browse" ? `Browse & Manage` : "Import Data"}
          </button>
        ))}
      </div>

      {/* BROWSE TAB */}
      {tab === "browse" && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search by name or CIN…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <select
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
              className="h-9 border border-gray-200 rounded-lg px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
            >
              <option value="">All Status</option>
              <option>Active</option>
              <option>Strike Off</option>
              <option>Dissolved</option>
            </select>
            <select
              value={typeFilter}
              onChange={e => { setTypeFilter(e.target.value); setPage(1); }}
              className="h-9 border border-gray-200 rounded-lg px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20"
            >
              <option value="">All Types</option>
              <option>Private Limited</option>
              <option>Public Limited</option>
              <option>LLP</option>
              <option>OPC</option>
              <option>Government</option>
              <option>Foreign</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadCompanies} className="h-9">
              <RefreshCw size={14} />
            </Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="w-7 h-7 border-2 border-[#0f2044] border-t-transparent rounded-full animate-spin mr-2" />
              Loading…
            </div>
          )}

          {!loading && data && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Company Name</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">CIN</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Type</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Status</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">State</th>
                      <th className="text-left px-4 py-3 font-semibold text-gray-700">Incorporated</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.data.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-gray-400">
                          <Building2 size={32} className="mx-auto mb-2 text-gray-300" />
                          No companies found. Import data to get started.
                        </td>
                      </tr>
                    ) : data.data.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-2.5">
                          <a href={`/company/${c.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0f2044] hover:text-[#c9a227] transition-colors line-clamp-1">
                            {c.companyName}
                          </a>
                          {c.industry && <div className="text-xs text-gray-400 truncate max-w-[260px]">{c.industry}</div>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{c.cin}</td>
                        <td className="px-4 py-2.5">
                          {c.companyType && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{c.companyType}</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {c.companyStatus && <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor(c.companyStatus)}`}>{c.companyStatus}</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{c.state ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{c.incorporationDate ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => handleDelete(c.id, c.companyName)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pages > 1 && (
                <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between">
                  <span className="text-xs text-gray-500">Page {page} of {pages} · {total.toLocaleString()} total</span>
                  <div className="flex gap-1">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></Button>
                    <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* IMPORT TAB */}
      {tab === "import" && (
        <div className="max-w-3xl space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
            <strong>Supported formats:</strong> .xlsx, .xls, .csv — The system auto-detects column names (CIN, Company Name, State, etc.). Duplicates are updated based on CIN.
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              file ? "border-[#c9a227] bg-[#c9a227]/5" : "border-gray-300 hover:border-[#0f2044] hover:bg-gray-50"
            }`}
          >
            <FileSpreadsheet size={40} className={`mx-auto mb-3 ${file ? "text-[#c9a227]" : "text-gray-400"}`} />
            {file ? (
              <div>
                <div className="font-semibold text-[#0f2044]">{file.name}</div>
                <div className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
                {parsedRows && <div className="text-sm text-green-700 font-medium mt-2">✓ {parsedRows.length.toLocaleString()} rows parsed and ready to import</div>}
              </div>
            ) : (
              <div>
                <div className="font-semibold text-gray-700">Drop your Excel or CSV file here</div>
                <div className="text-sm text-gray-400 mt-1">or click to browse</div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => handleFileChange(e.target.files?.[0] ?? null)} />
          </div>

          {parseError && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {parseError}
            </div>
          )}

          {parsedRows && !parseError && (
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-[#0f2044]">Preview — {parsedRows.length.toLocaleString()} rows detected</h3>
                <button onClick={() => { setFile(null); setParsedRows(null); setImportResult(null); if (fileInputRef.current) fileInputRef.current.value = ""; }} className="text-gray-400 hover:text-gray-600">
                  <X size={16} />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50">
                      {Object.keys(parsedRows[0]).slice(0, 8).map(k => (
                        <th key={k} className="text-left px-2 py-2 font-medium text-gray-600 whitespace-nowrap">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        {Object.keys(parsedRows![0]).slice(0, 8).map(k => (
                          <td key={k} className="px-2 py-1.5 text-gray-600 max-w-[150px] truncate">{String(row[k] ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && <div className="text-xs text-gray-400 mt-2">…and {parsedRows.length - 5} more rows</div>}

              <div className="mt-4">
                <Button
                  onClick={handleImport}
                  disabled={importing}
                  className="bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] gap-2 w-full"
                >
                  {importing ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Importing {parsedRows.length.toLocaleString()} records…</>
                  ) : (
                    <><Upload size={15} /> Import {parsedRows.length.toLocaleString()} Records</>
                  )}
                </Button>
              </div>
            </div>
          )}

          {importResult && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 text-green-700 font-semibold">
                <CheckCircle size={18} /> Import Complete
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: "Imported", value: importResult.imported, color: "text-green-700 bg-green-50" },
                  { label: "Updated", value: importResult.updated, color: "text-blue-700 bg-blue-50" },
                  { label: "Skipped", value: importResult.skipped, color: "text-yellow-700 bg-yellow-50" },
                  { label: "Errors", value: importResult.errors.length, color: "text-red-700 bg-red-50" },
                ].map(s => (
                  <div key={s.label} className={`rounded-lg p-3 text-center ${s.color}`}>
                    <div className="text-xl font-bold">{s.value}</div>
                    <div className="text-xs font-medium mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              {importResult.errors.length > 0 && (
                <div className="bg-red-50 rounded-lg p-3">
                  <div className="text-xs font-semibold text-red-700 mb-2">Errors (first 20):</div>
                  <ul className="space-y-1">
                    {importResult.errors.map((e, i) => <li key={i} className="text-xs text-red-600">{e}</li>)}
                  </ul>
                </div>
              )}
              <Button variant="outline" onClick={() => { setFile(null); setParsedRows(null); setImportResult(null); setTab("browse"); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                View Imported Data
              </Button>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
