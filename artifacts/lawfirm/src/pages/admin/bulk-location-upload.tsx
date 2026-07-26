import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Download, FileText, CheckCircle2, AlertCircle,
  RefreshCw, MapPin, ArrowLeft, ChevronRight, ArrowRight,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PreviewRow {
  idx: number;
  city?: string;
  state?: string;
  country?: string;
  slug?: string;
  metaTitle?: string;
  metaDescription?: string;
  latitude?: number;
  longitude?: number;
  errors: string[];
  isValid: boolean;
}

interface ColumnMapping {
  source: string;
  target: string;
}

interface ParsePreviewResponse {
  parseId: string;
  totalRows: number;
  validCount: number;
  errorCount: number;
  detectedColumns: string[];
  columnMapping: ColumnMapping[];
  rows: PreviewRow[];
  // validRows NOT returned — server stores them keyed by parseId to avoid double round-trip
}

interface ImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
}

interface JobStatus {
  status: "pending" | "running" | "done" | "error";
  total: number;
  processed: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
  message?: string;
}

interface UploadLog {
  id: number;
  fileName: string;
  totalRows: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
  createdAt: string;
}

type Step = "pick" | "preview" | "done";

export default function BulkLocationUpload() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("pick");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<ParsePreviewResponse | null>(null);
  const [importing, setImporting] = useState(false);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: uploadLogs = [] } = useQuery<UploadLog[]>({
    queryKey: ["upload-logs"],
    queryFn: () => fetch(`${BASE}/api/admin/location-upload-logs`).then((r) => r.json()),
  });

  const uploadForPreview = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast({ title: "Unsupported file type", description: "Please upload .xlsx, .xls or .csv", variant: "destructive" });
      return;
    }
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${BASE}/api/admin/locations/parse-preview`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        toast({ title: "Parse failed", description: err.error ?? "Server could not read the file.", variant: "destructive" });
        return;
      }
      const data = await res.json() as ParsePreviewResponse;
      if (data.totalRows === 0) {
        toast({ title: "Empty file", description: "No data rows found.", variant: "destructive" });
        return;
      }
      setPreview(data);
      setFileName(file.name);
      setStep("preview");
    } catch {
      toast({ title: "Upload failed", description: "Could not connect to server.", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadForPreview(file);
  }, [uploadForPreview]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadForPreview(file);
    e.target.value = "";
  };

  async function doImport() {
    if (!preview || preview.validCount === 0) return;
    setImporting(true);
    setJobStatus(null);

    try {
      // Send parseId — server looks up the stored validRows (no double round-trip for large files)
      const startRes = await fetch(`${BASE}/api/admin/locations/start-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, parseId: preview.parseId }),
      });
      if (!startRes.ok) {
        const err = await startRes.json().catch(() => ({})) as { error?: string };
        toast({ title: "Import failed", description: err.error ?? "Server error starting import.", variant: "destructive" });
        setImporting(false);
        return;
      }
      const { jobId } = await startRes.json() as { jobId: string };

      // Poll for live row-count progress every 600 ms
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const statusRes = await fetch(`${BASE}/api/admin/locations/import-status/${jobId}`);
          if (!statusRes.ok) return;
          const status = await statusRes.json() as JobStatus;
          setJobStatus(status);

          if (status.status === "done" || status.status === "error") {
            clearInterval(pollRef.current!);
            pollRef.current = null;
            setImporting(false);

            if (status.status === "error") {
              toast({ title: "Import failed", description: status.message ?? "Unknown error.", variant: "destructive" });
              return;
            }
            setImportResult({
              totalRows: status.total,
              inserted: status.inserted,
              updated: status.updated,
              duplicates: status.duplicates,
              errors: status.errors,
            });
            setStep("done");
            qc.invalidateQueries({ queryKey: ["locations-list"] });
            qc.invalidateQueries({ queryKey: ["location-stats"] });
            qc.invalidateQueries({ queryKey: ["upload-logs"] });
            toast({ title: `Import complete — ${status.inserted} inserted, ${status.updated} updated` });
          }
        } catch { /* transient poll failure — keep polling */ }
      }, 600);
    } catch {
      toast({ title: "Import failed", description: "Could not connect to server.", variant: "destructive" });
      setImporting(false);
    }
  }

  function reset() {
    setStep("pick");
    setPreview(null);
    setFileName("");
    setImportResult(null);
    setJobStatus(null);
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function downloadTemplate() {
    const a = document.createElement("a");
    a.href = `${BASE}/api/admin/locations/template`;
    a.download = "locations-template.xlsx";
    a.click();
  }

  async function exportCsv() {
    setExportingCsv(true);
    try {
      const res = await fetch(`${BASE}/api/admin/locations/export-csv`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "locations-export.csv";
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExportingCsv(false);
    }
  }

  return (
    <AdminLayout
      title="Bulk Location Upload"
      subtitle="Upload hundreds of location entries at once via Excel or CSV"
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={downloadTemplate}>
            <Download size={14} /> Download Template
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={exportCsv} disabled={exportingCsv}>
            <FileText size={14} /> {exportingCsv ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      }
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-sm">
        {[
          { key: "pick", label: "1. Upload File" },
          { key: "preview", label: "2. Preview & Validate" },
          { key: "done", label: "3. Import Complete" },
        ].map((s, i, arr) => (
          <div key={s.key} className="flex items-center gap-2">
            <span className={`font-medium ${step === s.key ? "text-[#0f2044]" : "text-gray-400"}`}>{s.label}</span>
            {i < arr.length - 1 && <ChevronRight size={14} className="text-gray-300" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Pick File ─────────────────────────────────────── */}
      {step === "pick" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-[#0f2044] mb-4 flex items-center gap-2">
                <Upload size={16} /> Select File
              </h2>

              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-[#c9a227] bg-[#c9a227]/5" : "border-gray-200 hover:border-gray-300"}`}
              >
                {parsing ? (
                  <>
                    <RefreshCw size={36} className="mx-auto text-[#c9a227] mb-3 animate-spin" />
                    <p className="font-medium text-gray-700">Parsing file on server…</p>
                    <p className="text-xs text-gray-400 mt-1">Validating rows and mapping columns</p>
                  </>
                ) : (
                  <>
                    <Upload size={36} className="mx-auto text-gray-300 mb-3" />
                    <p className="font-medium text-gray-700 mb-1">Drag & drop your Excel or CSV file here</p>
                    <p className="text-xs text-gray-400 mb-5">Supported: .xlsx, .xls, .csv · Max 50 MB</p>
                    <label className="cursor-pointer">
                      <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileInput} disabled={parsing} />
                      <span className="inline-block bg-[#0f2044] text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-[#1a3060] transition-colors">
                        Browse File
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* Column guide */}
              <div className="mt-5 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-600 mb-2">Template column names:</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { name: "City", required: true },
                    { name: "State", required: true },
                    { name: "Country", required: false },
                    { name: "Slug", required: false },
                    { name: "Meta Title", required: false },
                    { name: "Meta Description", required: false },
                    { name: "Latitude", required: false },
                    { name: "Longitude", required: false },
                  ].map((col) => (
                    <span key={col.name} className={`text-xs px-2 py-0.5 rounded font-mono ${col.required ? "bg-[#0f2044] text-white" : "bg-gray-200 text-gray-700"}`}>
                      {col.name}{col.required ? " ✱" : ""}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400">✱ Required. Slug auto-generated from City if omitted. Duplicate slugs are updated (upsert).</p>
              </div>
            </div>
          </div>

          {/* Upload History */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-[#0f2044] mb-4 flex items-center gap-2">
              <RefreshCw size={16} /> Upload History
            </h2>
            {uploadLogs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">No uploads yet</p>
            ) : (
              <div className="space-y-3 overflow-y-auto max-h-80">
                {uploadLogs.map((log) => (
                  <div key={log.id} className="p-3 bg-gray-50 rounded-lg text-xs">
                    <div className="font-medium text-[#0f2044] truncate mb-1">{log.fileName}</div>
                    <div className="text-gray-400 mb-1.5">{new Date(log.createdAt).toLocaleString("en-IN")}</div>
                    <div className="flex gap-2 flex-wrap">
                      <span className="text-gray-500">{log.totalRows.toLocaleString()} rows</span>
                      <span className="text-green-600">+{log.inserted} ins</span>
                      <span className="text-blue-600">~{log.updated} upd</span>
                      {log.errors > 0 && <span className="text-red-600">{log.errors} err</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Step 2: Preview & Validate ───────────────────────────── */}
      {step === "preview" && preview && (
        <div className="space-y-5">
          {/* Summary bar */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <MapPin size={15} className="text-[#0f2044]" />
                  <strong className="text-[#0f2044]">{fileName}</strong>
                </div>
                <div className="flex gap-3 text-sm flex-wrap">
                  <span className="text-gray-500">{preview.totalRows.toLocaleString()} total rows</span>
                  <span className="text-green-700 font-semibold">{preview.validCount.toLocaleString()} valid</span>
                  {preview.errorCount > 0 && (
                    <span className="text-red-600 font-semibold">{preview.errorCount.toLocaleString()} errors</span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                  <ArrowLeft size={13} /> Back
                </Button>
                <Button
                  size="sm"
                  onClick={doImport}
                  disabled={preview.validCount === 0 || importing}
                  className="gap-1.5 bg-[#0f2044] hover:bg-[#1a3060] text-white"
                >
                  {importing ? (
                    <><RefreshCw size={13} className="animate-spin" /> Importing…</>
                  ) : (
                    <><ArrowRight size={13} /> Import {preview.validCount.toLocaleString()} rows</>
                  )}
                </Button>
              </div>
            </div>

            {/* Import progress bar — driven by live processed/total from server */}
            {importing && (
              <div className="mt-4">
                {jobStatus && jobStatus.total > 0 ? (
                  <>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-[#c9a227] h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.round((jobStatus.processed / jobStatus.total) * 100)}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-1">
                      <span>{jobStatus.processed.toLocaleString()} / {jobStatus.total.toLocaleString()} rows processed</span>
                      <span>{Math.round((jobStatus.processed / jobStatus.total) * 100)}%</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div className="bg-[#c9a227] h-2 w-1/3 rounded-full animate-pulse" />
                    </div>
                    <p className="text-xs text-gray-400 mt-1">Starting import…</p>
                  </>
                )}
              </div>
            )}

            {/* Column mapping from server */}
            {preview.columnMapping.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2">Column mapping (detected → target):</p>
                <div className="flex flex-wrap gap-2">
                  {preview.columnMapping.map((m) => (
                    <span key={m.source} className="text-xs flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-100 text-blue-700">
                      <span className="font-mono">{m.source}</span>
                      <ArrowRight size={10} />
                      <span className="font-mono text-[#0f2044]">{m.target}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-[#0f2044] text-sm">
                Row Preview {preview.rows.length > 200 ? "(first 200 shown)" : `(${preview.rows.length} rows)`}
              </h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Valid
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Error
                </span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 w-10">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">City</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">State</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Slug</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Meta Title</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {preview.rows.slice(0, 200).map((row) => (
                    <tr key={row.idx} className={!row.isValid ? "bg-red-50" : "hover:bg-gray-50"}>
                      <td className="px-3 py-2 text-gray-400">{row.idx}</td>
                      <td className={`px-3 py-2 font-medium ${!row.city ? "text-red-500" : "text-[#0f2044]"}`}>
                        {row.city || <span className="italic text-red-400">missing</span>}
                      </td>
                      <td className={`px-3 py-2 ${!row.state ? "text-red-500" : "text-gray-600"}`}>
                        {row.state || <span className="italic text-red-400">missing</span>}
                      </td>
                      <td className="px-3 py-2 font-mono text-[#c9a227] text-[10px]">
                        {row.slug || <span className="text-red-400 italic">none</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                        {row.metaTitle || <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2">
                        {!row.isValid ? (
                          <div className="flex items-start gap-1">
                            <AlertCircle size={12} className="text-red-500 shrink-0 mt-0.5" />
                            <span className="text-red-600 text-[10px] leading-tight">{row.errors.join("; ")}</span>
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 size={12} /> Valid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.rows.length > 200 && (
                <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-100">
                  Showing first 200 of {preview.rows.length.toLocaleString()} rows —{" "}
                  all {preview.validCount.toLocaleString()} valid rows will be imported.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Done ─────────────────────────────────────────── */}
      {step === "done" && importResult && (
        <div className="max-w-xl mx-auto">
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold text-[#0f2044] font-serif mb-1">Import Complete!</h2>
            <p className="text-sm text-gray-500 mb-6">{fileName}</p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: "Total Rows", value: importResult.totalRows, color: "text-gray-700", bg: "bg-gray-50" },
                { label: "Inserted", value: importResult.inserted, color: "text-green-700", bg: "bg-green-50" },
                { label: "Updated", value: importResult.updated, color: "text-blue-700", bg: "bg-blue-50" },
                { label: "Errors", value: importResult.errors, color: "text-red-600", bg: "bg-red-50" },
              ].map((s) => (
                <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
                  <div className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="flex justify-center gap-3">
              <Button variant="outline" onClick={reset} className="gap-2">
                <Upload size={15} /> Upload Another
              </Button>
              <Button
                onClick={() => { window.location.href = `${BASE}/admin/locations`; }}
                className="gap-2 bg-[#0f2044] hover:bg-[#1a3060] text-white"
              >
                <MapPin size={15} /> View Locations
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
