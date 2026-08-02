import { useState, useRef } from "react";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Download, CheckCircle2, AlertCircle, RefreshCw,
  FileText, ArrowLeft,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// categoryId must match a SERVICES_DATA key: consult-expert | business-setup | tax-compliance |
//   trademark-ip | documentation | fundraising | ngo | property-personal | lawyers
const TEMPLATE_HEADERS = ["name", "slug", "categoryId", "shortDescription", "description", "price", "isActive"];
const TEMPLATE_EXAMPLE = [
  ["Private Limited Company Registration", "private-limited-company-registration", "business-setup", "Fast and affordable PLC registration across India.", "Full description here...", "6999", "true"],
  ["Trademark Registration", "trademark-registration", "trademark-ip", "Register your trademark quickly.", "Full description here...", "4999", "true"],
];

interface ParsedRow {
  idx: number;
  name?: string;
  slug?: string;
  categoryId?: string;
  shortDescription?: string;
  description?: string;
  price?: string;
  isActive?: string;
  errors: string[];
  isValid: boolean;
}

interface ImportResult { inserted: number; updated: number; errors: number; }

function parseCSV(text: string): string[][] {
  return text.trim().split(/\r?\n/).map(line =>
    line.split(",").map(cell => cell.trim().replace(/^"|"$/g, "").replace(/""/g, '"'))
  );
}

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE];
  const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "services-template.csv"; a.click();
  URL.revokeObjectURL(url);
}

const VALID_CATEGORY_IDS = new Set([
  "consult-expert", "business-setup", "tax-compliance", "trademark-ip",
  "documentation", "fundraising", "ngo", "property-personal", "lawyers",
]);

function validateRow(row: Record<string, string>, idx: number): ParsedRow {
  const errors: string[] = [];
  if (!row.name?.trim()) errors.push("name is required");
  if (!row.slug?.trim()) errors.push("slug is required");
  else if (!/^[a-z0-9-]+$/.test(row.slug)) errors.push("slug must be lowercase letters, digits, hyphens only");
  if (!row.categoryId?.trim()) errors.push("categoryId is required");
  else if (!VALID_CATEGORY_IDS.has(row.categoryId.trim())) errors.push(`categoryId "${row.categoryId}" is not valid`);
  if (row.price && (isNaN(Number(row.price)) || !Number.isFinite(Number(row.price)) || Number(row.price) < 0)) {
    errors.push("price must be a non-negative number");
  }
  return {
    idx, ...row,
    errors,
    isValid: errors.length === 0,
  };
}

export default function BulkServiceUpload() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");

  const handleFile = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) { toast({ title: "Empty file", variant: "destructive" }); return; }
      const headers = parsed[0].map(h => h.toLowerCase().trim());
      const dataRows = parsed.slice(1).filter(r => r.some(c => c.trim()));
      const validated = dataRows.map((r, i) => {
        const obj: Record<string, string> = {};
        headers.forEach((h, j) => { obj[h] = r[j] ?? ""; });
        return validateRow(obj, i + 2);
      });
      setRows(validated);
      setStep("preview");
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file?.name.endsWith(".csv")) handleFile(file);
  };

  const handleImport = async () => {
    const valid = rows.filter(r => r.isValid);
    if (!valid.length) return;
    setImporting(true);
    try {
      const r = await fetch(`${BASE}/api/admin/services/bulk`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: valid.map(r => ({
          name: r.name, slug: r.slug,
          categoryId: r.categoryId,
          shortDescription: r.shortDescription ?? "",
          description: r.description ?? "",
          price: r.price ? Math.round(Number(r.price)) : null,
          isActive: r.isActive !== "false",
        })) }),
      });
      if (!r.ok) throw new Error(await r.text());
      const data: ImportResult = await r.json();
      setResult(data);
      setStep("done");
      toast({ title: `Imported ${data.inserted} new, updated ${data.updated}` });
    } catch (err) {
      toast({ title: "Import failed", description: String(err), variant: "destructive" });
    } finally { setImporting(false); }
  };

  const reset = () => { setStep("upload"); setRows([]); setResult(null); setFileName(""); };

  const validCount = rows.filter(r => r.isValid).length;
  const errorCount = rows.filter(r => !r.isValid).length;

  return (
    <AdminLayout title="Bulk Service Upload" subtitle="Import services from a CSV file">
      {step === "upload" && (
        <div className="max-w-xl mx-auto space-y-6">
          {/* Template download */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <FileText size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-800">Download CSV Template</p>
              <p className="text-xs text-blue-600 mt-0.5">Use this template to format your service data correctly before uploading.</p>
            </div>
            <Button size="sm" variant="outline" onClick={downloadTemplate} className="gap-1.5 text-xs shrink-0 border-blue-300 text-blue-700 hover:bg-blue-100">
              <Download size={12} /> Template
            </Button>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-300 hover:border-[#c9a227] rounded-2xl p-12 text-center cursor-pointer transition-colors group"
          >
            <Upload size={32} className="mx-auto text-gray-300 group-hover:text-[#c9a227] mb-3 transition-colors" />
            <p className="text-sm font-medium text-gray-600">Drop your CSV file here, or <span className="text-[#c9a227]">browse</span></p>
            <p className="text-xs text-gray-400 mt-1">Supported: .csv</p>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          </div>

          {/* Column reference */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4">
            <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Required Columns</p>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_HEADERS.map(h => (
                <span key={h} className={`text-xs px-2 py-0.5 rounded-full font-mono ${["name","slug","categoryId"].includes(h) ? "bg-red-100 text-red-700" : "bg-gray-200 text-gray-600"}`}>{h}</span>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">Red = required · Grey = optional</p>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-[#0f2044]">{fileName}</p>
              <p className="text-xs text-gray-500">{rows.length} rows · <span className="text-green-600 font-medium">{validCount} valid</span> · <span className="text-red-500 font-medium">{errorCount} errors</span></p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={reset} className="gap-1.5"><ArrowLeft size={13} /> Back</Button>
              <Button size="sm" onClick={handleImport} disabled={importing || validCount === 0}
                className="bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-1.5">
                {importing ? <><RefreshCw size={13} className="animate-spin" /> Importing…</> : <><Upload size={13} /> Import {validCount} Services</>}
              </Button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-auto max-h-[60vh]">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold w-10">#</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Name</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Slug</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Category ID</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Price</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => (
                  <tr key={row.idx} className={row.isValid ? "" : "bg-red-50"}>
                    <td className="px-3 py-2 text-gray-400">{row.idx}</td>
                    <td className="px-3 py-2 font-medium max-w-[200px] truncate">{row.name || <span className="text-red-400 italic">missing</span>}</td>
                    <td className="px-3 py-2 font-mono text-gray-600 max-w-[160px] truncate">{row.slug || <span className="text-red-400 italic">missing</span>}</td>
                    <td className="px-3 py-2 text-center">{row.categoryId}</td>
                    <td className="px-3 py-2">{row.price ? `₹${Number(row.price).toLocaleString("en-IN")}` : "—"}</td>
                    <td className="px-3 py-2">
                      {row.isValid
                        ? <span className="flex items-center gap-1 text-green-600"><CheckCircle2 size={12} /> Valid</span>
                        : <span className="flex items-center gap-1 text-red-500"><AlertCircle size={12} /> {row.errors.join("; ")}</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="max-w-sm mx-auto text-center space-y-6 py-12">
          <CheckCircle2 size={56} className="mx-auto text-green-500" />
          <div>
            <p className="text-xl font-bold text-[#0f2044]">Import Complete</p>
            <p className="text-sm text-gray-500 mt-1">Services have been saved to the database.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
              <p className="text-2xl font-bold text-green-700">{result.inserted}</p>
              <p className="text-xs text-green-600 mt-0.5">New Services</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 text-center border border-blue-100">
              <p className="text-2xl font-bold text-blue-700">{result.updated}</p>
              <p className="text-xs text-blue-600 mt-0.5">Updated</p>
            </div>
            {result.errors > 0 && (
              <div className="col-span-2 bg-red-50 rounded-xl p-4 text-center border border-red-100">
                <p className="text-2xl font-bold text-red-700">{result.errors}</p>
                <p className="text-xs text-red-600 mt-0.5">Errors</p>
              </div>
            )}
          </div>
          <Button onClick={reset} className="gap-1.5"><RefreshCw size={14} /> Upload Another File</Button>
        </div>
      )}
    </AdminLayout>
  );
}
