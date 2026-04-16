import { useRef, useState } from "react";
import {
  useListCompanyData, useBulkImportCompanyData, useDeleteCompanyRecord,
  getListCompanyDataQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AdminLayout } from "./AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { Upload, Trash2, Search, RefreshCw, FileUp, ChevronLeft, ChevronRight, Building2 } from "lucide-react";

type CompanyRecord = NonNullable<ReturnType<typeof useListCompanyData>["data"]>["data"][number];

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, "").toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map(line => {
    const values = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
    return headers.reduce((obj, h, i) => ({ ...obj, [h]: values[i] ?? "" }), {} as Record<string, string>);
  });
}

const FIELD_MAP: Record<string, string> = {
  company_name: "companyName",
  cin: "cin",
  category: "category",
  state: "state",
  date_of_incorporation: "dateOfIncorporation",
  authorized_capital: "authorizedCapital",
  paid_up_capital: "paidUpCapital",
  email: "email",
  registered_address: "registeredAddress",
  company_status: "companyStatus",
  status: "companyStatus",
  name: "companyName",
};

export default function AdminCompanyData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");

  const { data, isLoading, refetch } = useListCompanyData(
    { search: search || undefined, page, limit: 50 },
    { query: { enabled: true } }
  );

  const bulkMutation = useBulkImportCompanyData();
  const deleteMutation = useDeleteCompanyRecord();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);
      setPreview(rows.slice(0, 5));
      setImporting(false);
    };
    reader.readAsText(file);
  };

  const handleImport = () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const rows = parseCSV(text);

      const records = rows
        .filter(r => r.company_name || r.name)
        .map(r => {
          const record: Record<string, string | null> = { companyName: "" };
          for (const [csvKey, apiKey] of Object.entries(FIELD_MAP)) {
            if (r[csvKey] !== undefined) record[apiKey] = r[csvKey] || null;
          }
          record.companyName = r.company_name || r.name || "Unknown";
          return record;
        });

      if (records.length === 0) {
        toast({ title: "No valid records found", variant: "destructive" });
        setImporting(false);
        return;
      }

      bulkMutation.mutate(
        { data: { records: records as Parameters<typeof bulkMutation.mutate>[0]["data"]["records"] } },
        {
          onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: getListCompanyDataQueryKey() });
            setPreview(null);
            setFileName("");
            if (fileRef.current) fileRef.current.value = "";
            setImporting(false);
            toast({ title: `Import complete`, description: `${result.imported} imported, ${result.errors} errors` });
          },
          onError: () => {
            setImporting(false);
            toast({ title: "Import failed", variant: "destructive" });
          }
        }
      );
    };
    reader.readAsText(file);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this company record?")) return;
    deleteMutation.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCompanyDataQueryKey() });
          toast({ title: "Record deleted" });
        }
      }
    );
  };

  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <AdminLayout
      title="Company Data"
      subtitle={`${total.toLocaleString()} records`}
      actions={
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5">
            <RefreshCw size={13} /> Refresh
          </Button>
          <Button size="sm" className="gap-1.5 bg-[#0f2044] hover:bg-[#0f2044]/90 text-white" onClick={() => fileRef.current?.click()}>
            <Upload size={13} /> Upload CSV
          </Button>
        </div>
      }
    >
      <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileChange} />

      {/* CSV Upload Section */}
      {(fileName || preview) && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileUp size={16} className="text-[#0f2044]" />
              <span className="font-medium text-sm">{fileName}</span>
            </div>
            <button onClick={() => { setPreview(null); setFileName(""); if (fileRef.current) fileRef.current.value = ""; }} className="text-gray-400 hover:text-gray-600">×</button>
          </div>

          {preview && (
            <>
              <p className="text-xs text-gray-500 mb-3">Preview (first 5 rows):</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 mb-4">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      {Object.keys(preview[0] ?? {}).slice(0, 6).map(key => (
                        <th key={key} className="px-3 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {Object.values(row).slice(0, 6).map((val, j) => (
                          <td key={j} className="px-3 py-2 text-gray-700 truncate max-w-[100px]">{val as string}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleImport}
                  disabled={importing || bulkMutation.isPending}
                  className="bg-[#0f2044] hover:bg-[#0f2044]/90 text-white gap-2"
                >
                  <Upload size={14} /> {importing || bulkMutation.isPending ? "Importing..." : "Import All Records"}
                </Button>
                <Button variant="outline" onClick={() => { setPreview(null); setFileName(""); }}>Cancel</Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Search & Filter */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            className="pl-8 h-9 text-sm"
            placeholder="Search by company name, CIN or email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Company Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">CIN</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">State</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden xl:table-cell">Incorporated</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Del</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {isLoading ? Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>{Array.from({ length: 7 }).map((_, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>)}</tr>
              )) : (data?.data ?? []).length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Building2 size={32} className="text-gray-300" />
                      <p className="text-gray-400">{search ? "No records match your search" : "No company data yet"}</p>
                      {!search && (
                        <Button size="sm" onClick={() => fileRef.current?.click()} className="gap-1.5 bg-[#0f2044] text-white">
                          <Upload size={14} /> Upload CSV
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (data?.data ?? []).map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[#0f2044] text-sm truncate max-w-[200px]">{c.companyName}</div>
                    {c.email && <div className="text-xs text-gray-400 truncate">{c.email}</div>}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-xs text-gray-600">{c.cin ?? "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-600">{c.state ?? "—"}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-600">{c.category ?? "—"}</td>
                  <td className="px-4 py-3 hidden xl:table-cell text-xs text-gray-600">{c.dateOfIncorporation ?? "—"}</td>
                  <td className="px-4 py-3">
                    {c.companyStatus && (
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${c.companyStatus.toLowerCase().includes("active") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {c.companyStatus}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(c.id)} className="h-7 w-7 p-0 text-gray-400 hover:text-red-600">
                      <Trash2 size={13} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <span className="text-xs text-gray-500">
              Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, total)} of {total.toLocaleString()}
            </span>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" disabled={page === 1} onClick={() => setPage(p => p - 1)} className="h-7 w-7 p-0">
                <ChevronLeft size={14} />
              </Button>
              <span className="text-xs text-gray-600 min-w-[60px] text-center">Page {page} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="h-7 w-7 p-0">
                <ChevronRight size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
