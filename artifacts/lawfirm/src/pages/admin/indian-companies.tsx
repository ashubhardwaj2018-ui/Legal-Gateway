import { useState, useRef, useEffect, useCallback } from "react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2, Search, Upload, Download, Trash2, ChevronLeft, ChevronRight,
  CheckCircle, AlertCircle, FileSpreadsheet, RefreshCw, X, ArrowRight,
} from "lucide-react";

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

interface PreviewRow {
  rowIndex: number;
  cin: string;
  companyName: string;
  companyType: string | null;
  companyStatus: string | null;
  state: string | null;
  city: string | null;
  errors: string[];
  isValid: boolean;
}

interface ParseResponse {
  parseId: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  detectedColumns: string[];
  preview: PreviewRow[];
}

interface JobStatus {
  status: "pending" | "running" | "done" | "error";
  total: number;
  processed: number;
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  message?: string;
}

interface ImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: number;
  total: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  "strike off": "bg-red-100 text-red-800",
  dissolved: "bg-gray-100 text-gray-600",
};

function statusColor(s: string | null) {
  if (!s) return "bg-gray-100 text-gray-500";
  return STATUS_COLORS[s.toLowerCase()] ?? "bg-blue-100 text-blue-700";
}

type Step = "pick" | "preview" | "importing" | "done";

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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Import state
  const [step, setStep] = useState<Step>("pick");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── Server-side parse ────────────────────────────────────────────────────────
  const uploadForPreview = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      alert("Unsupported file. Please upload .xlsx, .xls or .csv");
      return;
    }
    setFileName(file.name);
    setParsing(true);
    setParseData(null);
    setImportResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/indian-companies/parse-preview", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        alert(err.error ?? "Server could not parse the file.");
        return;
      }
      const data = await res.json() as ParseResponse;
      if (data.totalRows === 0) { alert("No data rows found in file."); return; }
      setParseData(data);
      setStep("preview");
    } catch {
      alert("Upload failed — could not connect to server.");
    } finally { setParsing(false); }
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) uploadForPreview(f);
  };

  // ── Start background import using parseId ────────────────────────────────────
  async function startImport() {
    if (!parseData) return;
    setStep("importing");
    setJobStatus(null);

    const res = await fetch("/api/admin/indian-companies/start-import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parseId: parseData.parseId, fileName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string };
      alert(err.error ?? "Failed to start import.");
      setStep("preview");
      return;
    }
    const { jobId } = await res.json() as { jobId: string };

    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const sr = await fetch(`/api/admin/indian-companies/import-status/${jobId}`);
        if (!sr.ok) return;
        const status = await sr.json() as JobStatus;
        setJobStatus(status);
        if (status.status === "done" || status.status === "error") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          if (status.status === "error") {
            alert(status.message ?? "Import failed.");
            setStep("preview");
            return;
          }
          setImportResult({ imported: status.imported, updated: status.updated, skipped: status.skipped, errors: status.errors, total: status.total });
          setStep("done");
          loadCompanies();
        }
      } catch { /* keep polling */ }
    }, 600);
  }

  function resetImport() {
    setStep("pick");
    setParseData(null);
    setFileName("");
    setImportResult(null);
    setJobStatus(null);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  const total = data?.total ?? 0;
  const pages = Math.ceil(total / 50);
  const progressPct = jobStatus && jobStatus.total > 0 ? Math.round((jobStatus.processed / jobStatus.total) * 100) : 0;

  return (
    <AdminLayout
      title="Indian Companies Database"
      subtitle={`${total.toLocaleString()} companies in database`}
      actions={
        <div className="flex gap-2">
          <a
            href="/api/admin/indian-companies/template"
            download="indian-companies-template.xlsx"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> Template
          </a>
          <a
            href="/api/admin/indian-companies/export"
            className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download size={14} /> Export CSV
          </a>
          <Button onClick={() => { setTab("import"); resetImport(); }} className="bg-[#0f2044] text-white hover:bg-[#c9a227] hover:text-[#0f2044] gap-2">
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
            {t === "browse" ? "Browse & Manage" : "Import Data"}
          </button>
        ))}
      </div>

      {/* ── BROWSE TAB ────────────────────────────────────────────────────────── */}
      {tab === "browse" && (
        <div>
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="relative flex-1 min-w-48">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <Input placeholder="Search by name or CIN…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
            </div>
            <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="h-9 border border-gray-200 rounded-lg px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20">
              <option value="">All Status</option>
              <option>Active</option>
              <option>Strike Off</option>
              <option>Dissolved</option>
            </select>
            <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(1); }} className="h-9 border border-gray-200 rounded-lg px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0f2044]/20">
              <option value="">All Types</option>
              <option>Private Limited</option>
              <option>Public Limited</option>
              <option>LLP</option>
              <option>OPC</option>
              <option>Government</option>
              <option>Foreign</option>
            </select>
            <Button variant="outline" size="sm" onClick={loadCompanies} className="h-9"><RefreshCw size={14} /></Button>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <div className="w-7 h-7 border-2 border-[#0f2044] border-t-transparent rounded-full animate-spin mr-2" /> Loading…
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
                      <tr><td colSpan={7} className="text-center py-16 text-gray-400">
                        <Building2 size={32} className="mx-auto mb-2 text-gray-300" />
                        No companies found. Import data to get started.
                      </td></tr>
                    ) : data.data.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50/70 transition-colors">
                        <td className="px-4 py-2.5">
                          <a href={`/company/${c.slug}`} target="_blank" rel="noopener noreferrer" className="font-medium text-[#0f2044] hover:text-[#c9a227] transition-colors line-clamp-1">{c.companyName}</a>
                          {c.industry && <div className="text-xs text-gray-400 truncate max-w-[260px]">{c.industry}</div>}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-gray-600 whitespace-nowrap">{c.cin}</td>
                        <td className="px-4 py-2.5">{c.companyType && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">{c.companyType}</span>}</td>
                        <td className="px-4 py-2.5">{c.companyStatus && <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${statusColor(c.companyStatus)}`}>{c.companyStatus}</span>}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{c.state ?? "—"}</td>
                        <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">{c.incorporationDate ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button onClick={() => handleDelete(c.id, c.companyName)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={13} /></button>
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

      {/* ── IMPORT TAB ────────────────────────────────────────────────────────── */}
      {tab === "import" && (
        <div className="max-w-4xl space-y-5">
          {/* Step indicator */}
          <div className="flex items-center gap-2 text-sm mb-2">
            {[
              { key: "pick", label: "1. Upload File" },
              { key: "preview", label: "2. Preview & Validate" },
              { key: "importing", label: "3. Importing…" },
              { key: "done", label: "4. Complete" },
            ].map((s, i, arr) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className={`font-medium ${step === s.key ? "text-[#0f2044]" : "text-gray-400"}`}>{s.label}</span>
                {i < arr.length - 1 && <span className="text-gray-300">›</span>}
              </div>
            ))}
          </div>

          {/* ── Step 1: Pick ─────────────────────────────────────────────────── */}
          {step === "pick" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
                  <strong>Supported formats:</strong> .xlsx, .xls, .csv · Up to 200 MB · The system auto-detects column headers.
                  Duplicate CINs are updated (upsert). <a href="/api/admin/indian-companies/template" download className="underline font-semibold">Download template</a> for the correct format.
                </div>

                <div
                  onDrop={handleDrop}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => document.getElementById("ic-file-input")?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${dragOver ? "border-[#c9a227] bg-[#c9a227]/5" : "border-gray-300 hover:border-[#0f2044] hover:bg-gray-50"}`}
                >
                  {parsing ? (
                    <div>
                      <div className="w-10 h-10 border-3 border-[#c9a227] border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderWidth: 3 }} />
                      <p className="font-medium text-gray-700">Parsing file on server…</p>
                      <p className="text-xs text-gray-400 mt-1">Validating rows and checking for duplicates</p>
                    </div>
                  ) : (
                    <div>
                      <FileSpreadsheet size={40} className="mx-auto mb-3 text-gray-300" />
                      <p className="font-semibold text-gray-700 mb-1">Drop your Excel or CSV file here</p>
                      <p className="text-xs text-gray-400 mb-4">or click to browse · Max 200 MB</p>
                      <span className="inline-block bg-[#0f2044] text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-[#1a3060] transition-colors">Browse File</span>
                    </div>
                  )}
                  <input id="ic-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadForPreview(f); e.target.value = ""; }} />
                </div>

                <div className="p-4 bg-gray-50 rounded-xl">
                  <p className="text-xs font-semibold text-gray-600 mb-2">Expected column headers (auto-detected):</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { name: "CIN", req: true }, { name: "Company Name", req: true }, { name: "Company Type", req: false },
                      { name: "Company Status", req: false }, { name: "Date of Incorporation", req: false },
                      { name: "State", req: false }, { name: "City", req: false }, { name: "Email", req: false },
                    ].map(col => (
                      <span key={col.name} className={`text-xs px-2 py-0.5 rounded font-mono ${col.req ? "bg-[#0f2044] text-white" : "bg-gray-200 text-gray-700"}`}>
                        {col.name}{col.req ? " ✱" : ""}
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">✱ Required. All other columns optional. Duplicates updated by CIN.</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="font-semibold text-[#0f2044] mb-3 text-sm">Quick steps</h3>
                <ol className="space-y-3 text-sm text-gray-600">
                  {[
                    "Download the template Excel file",
                    "Fill in your company data (CIN + Company Name required)",
                    "Upload the file here — up to 200 MB",
                    "Review the preview and fix any errors",
                    "Click Import — runs in background with live progress",
                  ].map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-[#0f2044] text-white text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      {s}
                    </li>
                  ))}
                </ol>
                <a href="/api/admin/indian-companies/template" download className="mt-4 flex items-center gap-2 justify-center w-full py-2 border border-[#0f2044] text-[#0f2044] rounded-lg text-sm font-medium hover:bg-[#0f2044] hover:text-white transition-colors">
                  <Download size={14} /> Download Template
                </a>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview ───────────────────────────────────────────────── */}
          {step === "preview" && parseData && (
            <div className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h3 className="font-semibold text-[#0f2044]">{fileName}</h3>
                    <div className="flex gap-4 mt-1 text-sm flex-wrap">
                      <span className="text-gray-500">{parseData.totalRows.toLocaleString()} total rows</span>
                      <span className="text-green-700 font-semibold">{parseData.validCount.toLocaleString()} valid</span>
                      {parseData.errorCount > 0 && <span className="text-red-600 font-semibold">{parseData.errorCount.toLocaleString()} errors</span>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={resetImport}>← Back</Button>
                    <Button
                      size="sm"
                      onClick={startImport}
                      disabled={parseData.validCount === 0}
                      className="bg-[#0f2044] hover:bg-[#1a3060] text-white gap-1.5"
                    >
                      <ArrowRight size={13} /> Import {parseData.validCount.toLocaleString()} records
                    </Button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                  <h3 className="font-semibold text-[#0f2044] text-sm">
                    Row Preview {parseData.preview.length > 200 ? "(first 200 shown)" : `(${parseData.preview.length} rows)`}
                  </h3>
                  <div className="flex gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Valid</span>
                    <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Error</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500 w-8">#</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500">CIN</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Company Name</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Type</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500">State</th>
                        <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {parseData.preview.slice(0, 200).map(row => (
                        <tr key={row.rowIndex} className={!row.isValid ? "bg-red-50" : "hover:bg-gray-50"}>
                          <td className="px-3 py-2 text-gray-400">{row.rowIndex}</td>
                          <td className={`px-3 py-2 font-mono ${!row.cin ? "text-red-500 italic" : "text-gray-600"}`}>{row.cin || "missing"}</td>
                          <td className={`px-3 py-2 font-medium ${!row.companyName ? "text-red-500 italic" : "text-[#0f2044]"}`}>{row.companyName || "missing"}</td>
                          <td className="px-3 py-2 text-gray-500">{row.companyType || "—"}</td>
                          <td className="px-3 py-2 text-gray-500">{row.state || "—"}</td>
                          <td className="px-3 py-2">
                            {!row.isValid ? (
                              <div className="flex items-start gap-1">
                                <AlertCircle size={11} className="text-red-500 shrink-0 mt-0.5" />
                                <span className="text-red-600 text-[10px] leading-tight">{row.errors.join("; ")}</span>
                              </div>
                            ) : (
                              <span className="text-green-600 flex items-center gap-1"><CheckCircle size={11} /> Valid</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parseData.totalRows > 200 && (
                    <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-100">
                      Showing first 200 of {parseData.totalRows.toLocaleString()} rows — all {parseData.validCount.toLocaleString()} valid rows will be imported.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Importing ─────────────────────────────────────────────── */}
          {step === "importing" && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <div className="w-14 h-14 border-4 border-[#0f2044] border-t-[#c9a227] rounded-full animate-spin mx-auto mb-5" style={{ borderWidth: 4 }} />
              <h3 className="font-bold text-[#0f2044] text-lg mb-1">Importing…</h3>
              <p className="text-sm text-gray-500 mb-6">{fileName}</p>

              {jobStatus && jobStatus.total > 0 ? (
                <div className="max-w-sm mx-auto">
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden mb-2">
                    <div className="bg-[#c9a227] h-3 rounded-full transition-all duration-300" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="text-sm text-gray-600 font-medium">{jobStatus.processed.toLocaleString()} / {jobStatus.total.toLocaleString()} rows</p>
                  <div className="grid grid-cols-3 gap-3 mt-4 text-xs">
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <div className="font-bold text-green-700 text-lg">{jobStatus.imported}</div>
                      <div className="text-green-600">Imported</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <div className="font-bold text-blue-700 text-lg">{jobStatus.updated}</div>
                      <div className="text-blue-600">Updated</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 text-center">
                      <div className="font-bold text-red-700 text-lg">{jobStatus.errors}</div>
                      <div className="text-red-600">Errors</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="max-w-sm mx-auto">
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="bg-[#c9a227] h-3 w-1/4 rounded-full animate-pulse" />
                  </div>
                  <p className="text-xs text-gray-400 mt-2">Starting import…</p>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Done ──────────────────────────────────────────────────── */}
          {step === "done" && importResult && (
            <div className="max-w-lg mx-auto bg-white rounded-2xl border border-gray-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={32} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-[#0f2044] mb-1">Import Complete!</h3>
              <p className="text-sm text-gray-500 mb-6">{fileName}</p>
              <div className="grid grid-cols-4 gap-3 mb-6">
                {[
                  { label: "Total", value: importResult.total, color: "text-gray-700 bg-gray-50" },
                  { label: "Imported", value: importResult.imported, color: "text-green-700 bg-green-50" },
                  { label: "Updated", value: importResult.updated, color: "text-blue-700 bg-blue-50" },
                  { label: "Errors", value: importResult.errors, color: "text-red-600 bg-red-50" },
                ].map(s => (
                  <div key={s.label} className={`rounded-xl p-3 ${s.color}`}>
                    <div className="text-2xl font-bold">{s.value.toLocaleString()}</div>
                    <div className="text-xs mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-3">
                <Button variant="outline" onClick={resetImport} className="gap-2"><Upload size={14} /> Import Another</Button>
                <Button onClick={() => { setTab("browse"); resetImport(); }} className="bg-[#0f2044] hover:bg-[#1a3060] text-white gap-2">
                  <Building2 size={14} /> View Companies
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
