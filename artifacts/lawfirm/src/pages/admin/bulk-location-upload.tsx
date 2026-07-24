import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Download, FileText, CheckCircle2, AlertCircle,
  RefreshCw, X, MapPin, ArrowLeft, ChevronRight,
} from "lucide-react";
import * as XLSX from "xlsx";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface ParsedRow {
  _idx: number;
  country?: string;
  state?: string;
  district?: string;
  city?: string;
  town?: string;
  village?: string;
  pincode?: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  slug?: string;
  errors: string[];
}

interface ImportResult {
  totalRows: number;
  inserted: number;
  updated: number;
  duplicates: number;
  errors: number;
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

function makeSlug(row: ParsedRow): string {
  const primary = row.city || row.town || row.village || row.district || row.state || "";
  return primary
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function normalizeRow(raw: Record<string, unknown>, idx: number): ParsedRow {
  const pick = (keys: string[]): string | undefined => {
    for (const k of keys) {
      const v = raw[k] ?? raw[k.toLowerCase()] ?? raw[k.toUpperCase()];
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return undefined;
  };
  const row: ParsedRow = {
    _idx: idx,
    country: pick(["Country", "country"]) ?? "India",
    state: pick(["State", "state", "STATE"]),
    district: pick(["District", "district"]),
    city: pick(["City", "city", "CITY"]),
    town: pick(["Town", "town"]),
    village: pick(["Village", "village"]),
    pincode: pick(["Pincode", "pincode", "PIN", "Zip"]),
    latitude: Number(pick(["Latitude", "latitude", "lat"])) || undefined,
    longitude: Number(pick(["Longitude", "longitude", "lng", "lon"])) || undefined,
    population: Number(pick(["Population", "population"])) || undefined,
    errors: [],
  };
  row.slug = makeSlug(row);
  return row;
}

function validateRows(rows: ParsedRow[]): ParsedRow[] {
  const slugsSeen = new Map<string, number>();
  return rows.map((row) => {
    const errors: string[] = [];
    if (!row.state) errors.push("State is required");
    if (!row.city && !row.town && !row.village && !row.district) errors.push("At least one of City / Town / Village / District required");
    if (!row.slug) errors.push("Could not generate slug");
    if (row.slug) {
      if (slugsSeen.has(row.slug)) errors.push(`Duplicate slug within file (row ${(slugsSeen.get(row.slug) ?? 0) + 1})`);
      else slugsSeen.set(row.slug, row._idx);
    }
    return { ...row, errors };
  });
}

type Step = "pick" | "preview" | "done";

export default function BulkLocationUpload() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>("pick");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);

  const { data: uploadLogs = [] } = useQuery<UploadLog[]>({
    queryKey: ["upload-logs"],
    queryFn: () => fetch(`${BASE}/api/admin/location-upload-logs`).then((r) => r.json()),
  });

  const validRows = rows.filter((r) => r.errors.length === 0);
  const errorRows = rows.filter((r) => r.errors.length > 0);

  const parseFile = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext ?? "")) {
      toast({ title: "Unsupported file type", description: "Please upload .xlsx, .xls or .csv", variant: "destructive" });
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
      if (raw.length === 0) {
        toast({ title: "Empty file", description: "No data rows found in the file.", variant: "destructive" });
        return;
      }
      // Detect columns from first row
      const cols = Object.keys(raw[0] ?? {});
      setDetectedColumns(cols);
      const parsed = raw.map((r, i) => normalizeRow(r, i + 1));
      const validated = validateRows(parsed);
      setRows(validated);
      setFileName(file.name);
      setStep("preview");
    } catch {
      toast({ title: "Parse failed", description: "Could not read the file. Check it's a valid Excel or CSV.", variant: "destructive" });
    }
  }, [toast]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  }, [parseFile]);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
    e.target.value = "";
  };

  async function doImport() {
    if (validRows.length === 0) return;
    setImporting(true);
    setImportProgress(10);
    try {
      const records = validRows.map((r) => ({
        country: r.country ?? "India",
        state: r.state!,
        district: r.district,
        city: r.city,
        town: r.town,
        village: r.village,
        pincode: r.pincode,
        latitude: r.latitude,
        longitude: r.longitude,
        population: r.population,
      }));
      setImportProgress(40);
      const res = await fetch(`${BASE}/api/admin/locations/bulk-upsert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName, records }),
      });
      setImportProgress(85);
      const result = await res.json() as ImportResult;
      setImportResult(result);
      setImportProgress(100);
      setStep("done");
      qc.invalidateQueries({ queryKey: ["locations-list"] });
      qc.invalidateQueries({ queryKey: ["location-stats"] });
      qc.invalidateQueries({ queryKey: ["upload-logs"] });
      toast({ title: `Import complete — ${result.inserted} inserted, ${result.updated} updated` });
    } catch {
      toast({ title: "Import failed", description: "Server error during import.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep("pick");
    setRows([]);
    setFileName("");
    setImportResult(null);
    setImportProgress(0);
    setDetectedColumns([]);
  }

  async function downloadTemplate() {
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
            {/* Drop zone */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-[#0f2044] mb-4 flex items-center gap-2"><Upload size={16} /> Select File</h2>
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragOver ? "border-[#c9a227] bg-[#c9a227]/5" : "border-gray-200 hover:border-gray-300"}`}
              >
                <Upload size={36} className="mx-auto text-gray-300 mb-3" />
                <p className="font-medium text-gray-700 mb-1">Drag & drop your Excel or CSV file here</p>
                <p className="text-xs text-gray-400 mb-5">Supported: .xlsx, .xls, .csv · Recommended max: 50,000 rows</p>
                <label className="cursor-pointer">
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onFileInput} />
                  <span className="inline-block bg-[#0f2044] text-white text-sm font-medium px-6 py-2 rounded-lg hover:bg-[#1a3060] transition-colors">
                    Browse File
                  </span>
                </label>
              </div>

              {/* Column guide */}
              <div className="mt-5 p-4 bg-gray-50 rounded-xl">
                <p className="text-xs font-semibold text-gray-600 mb-2">Expected column names (case-insensitive):</p>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {[
                    { name: "State", required: true },
                    { name: "City", required: false },
                    { name: "District", required: false },
                    { name: "Town", required: false },
                    { name: "Village", required: false },
                    { name: "Country", required: false },
                    { name: "Pincode", required: false },
                    { name: "Latitude", required: false },
                    { name: "Longitude", required: false },
                    { name: "Population", required: false },
                  ].map((col) => (
                    <span key={col.name} className={`text-xs px-2 py-0.5 rounded font-mono ${col.required ? "bg-[#0f2044] text-white" : "bg-gray-200 text-gray-700"}`}>
                      {col.name}{col.required ? " ✱" : ""}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-gray-400">✱ Required. All others are optional. Duplicate slugs are updated (upsert).</p>
              </div>
            </div>
          </div>

          {/* Upload History */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="font-semibold text-[#0f2044] mb-4 flex items-center gap-2"><RefreshCw size={16} /> Upload History</h2>
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
      {step === "preview" && (
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
                  <span className="text-gray-500">{rows.length.toLocaleString()} total rows</span>
                  <span className="text-green-700 font-semibold">{validRows.length.toLocaleString()} valid</span>
                  {errorRows.length > 0 && <span className="text-red-600 font-semibold">{errorRows.length.toLocaleString()} errors</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={reset} className="gap-1.5">
                  <ArrowLeft size={13} /> Back
                </Button>
                <Button
                  size="sm"
                  onClick={doImport}
                  disabled={validRows.length === 0 || importing}
                  className="gap-1.5 bg-[#0f2044] hover:bg-[#1a3060] text-white"
                >
                  {importing ? <><RefreshCw size={13} className="animate-spin" /> Importing…</> : <><CheckCircle2 size={13} /> Import {validRows.length.toLocaleString()} rows</>}
                </Button>
              </div>
            </div>

            {/* Progress bar during import */}
            {importing && (
              <div className="mt-4">
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div className="bg-[#c9a227] h-2 rounded-full transition-all duration-300" style={{ width: `${importProgress}%` }} />
                </div>
                <p className="text-xs text-gray-400 mt-1 text-right">{importProgress}%</p>
              </div>
            )}

            {/* Detected column mapping */}
            {detectedColumns.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-1.5">Detected columns:</p>
                <div className="flex flex-wrap gap-1.5">
                  {detectedColumns.map((col) => (
                    <span key={col} className="text-xs px-2 py-0.5 rounded-full font-mono bg-blue-50 text-blue-700 border border-blue-100">{col}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-[#0f2044] text-sm">Row Preview (first 200 shown)</h2>
              <div className="flex items-center gap-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span> Valid</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block"></span> Error</span>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500 w-10">#</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">State</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">City / Town</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">District</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Slug</th>
                    <th className="px-3 py-2.5 text-left font-semibold text-gray-500">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {rows.slice(0, 200).map((row) => {
                    const hasError = row.errors.length > 0;
                    return (
                      <tr key={row._idx} className={hasError ? "bg-red-50" : "hover:bg-gray-50"}>
                        <td className="px-3 py-2 text-gray-400">{row._idx}</td>
                        <td className={`px-3 py-2 font-medium ${!row.state ? "text-red-500" : "text-[#0f2044]"}`}>
                          {row.state || <span className="italic text-red-400">missing</span>}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.city || row.town || row.village || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 text-gray-500">{row.district || <span className="text-gray-300">—</span>}</td>
                        <td className="px-3 py-2 font-mono text-[#c9a227]">{row.slug || <span className="text-red-400 italic">none</span>}</td>
                        <td className="px-3 py-2">
                          {hasError ? (
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
                    );
                  })}
                </tbody>
              </table>
              {rows.length > 200 && (
                <p className="text-xs text-gray-400 text-center py-3 border-t border-gray-100">
                  Showing first 200 of {rows.length.toLocaleString()} rows — all {validRows.length.toLocaleString()} valid rows will be imported.
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
